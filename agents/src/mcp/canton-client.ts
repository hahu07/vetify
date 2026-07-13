/**
 * Canton JSON Ledger API (v2) client — shared by the MCP server
 * (canton-server.ts, used by the LLM-facing tools) and the Supervisor's own
 * direct ledger polling (supervisor.ts), so the v2 request-building logic
 * exists in exactly one place within this package.
 *
 * Migrated from the classic v1 HTTP JSON API (`/v1/query`, `/v1/create`,
 * `/v1/exercise`) — same migration, same reverse-engineered v2 shapes, as
 * backend/src/canton.ts (see that file's doc comment and
 * docs/production-readiness-backlog.md's "✅ Resolved" entry for the full
 * discovery story: no v1 endpoints exist on this SDK's bundled Canton JSON
 * API, no OpenAPI spec ships with v2 either, so the shapes here were
 * confirmed empirically against a live sandbox, not read off documentation).
 *
 * Same two API-shape gotchas apply here as in the backend:
 * - v2 needs the actual Party ID explicitly (actAs, query filters) — a JWT
 *   only authorizes *that* a caller may act as a party, it isn't the party
 *   identifier itself. Hence PARTY_IDS below, alongside PARTY_JWTS.
 * - Daml Int/Decimal fields must be JSON-encoded as strings, not numbers —
 *   handled by the same blanket stringifyNumbers() transform.
 */
import "dotenv/config";
import { readSecret } from "../secrets.js";
import { logger } from "../logger.js";

const BASE_URL     = process.env.CANTON_LEDGER_URL ?? "http://localhost:7575";
const USER_ID      = process.env.CANTON_USER_ID     ?? "vetify-agents";
const PACKAGE_NAME = "vetify"; // daml.yaml `name:`

const PARTY_JWTS: Record<string, string> = {
  vetify:       readSecret("CANTON_VETIFY_JWT"),
  verifier:     readSecret("CANTON_VERIFIER_JWT"),
  assessor:     readSecret("CANTON_ASSESSOR_JWT"),
  sentinel:     readSecret("CANTON_SENTINEL_JWT"),
  advisor:      readSecret("CANTON_ADVISOR_JWT"),
  // Needed by the Collections Agent: DirectDebitCollectionAttempt/GSMInvocation
  // are FI-signed templates, and DirectDebitMandate's choices are FI-controlled
  // (review gap G6).
  financialInstitution: readSecret("CANTON_FI_JWT"),
};

// Actual on-ledger Party identifiers (e.g. "Vetify::1220...") — distinct from
// the JWTs above. Populate by allocating each party once against the target
// participant (`POST /v2/parties`) and recording the resulting `party` string.
const PARTY_IDS: Record<string, string> = {
  vetify:       process.env.CANTON_VETIFY_PARTY_ID       ?? "",
  verifier:     process.env.CANTON_VERIFIER_PARTY_ID     ?? "",
  assessor:     process.env.CANTON_ASSESSOR_PARTY_ID     ?? "",
  sentinel:     process.env.CANTON_SENTINEL_PARTY_ID     ?? "",
  advisor:      process.env.CANTON_ADVISOR_PARTY_ID      ?? "",
  financialInstitution: process.env.CANTON_FI_PARTY_ID   ?? "",
};

function jwt(party: string): string {
  if (party in PARTY_JWTS) return PARTY_JWTS[party];
  // Not one of the static role names — treated as an already-resolved
  // literal Party ID (e.g. a self-serve-signed-up FI's own dynamically-
  // allocated party from backend/src/canton.ts's allocateParty; see
  // partyId() below and monitoring.ts's Collections Agent, which now derives
  // the acting FI party from each contract's own financialInstitution field
  // rather than the fixed "financialInstitution" role name). This sandbox
  // runs with no auth at all, so no JWT is actually validated for it either way.
  return "";
}

export function partyId(party: string): string {
  if (party in PARTY_IDS) {
    const id = PARTY_IDS[party];
    if (!id) throw new Error(`No Party ID configured for "${party}" — set CANTON_${party.toUpperCase()}_PARTY_ID`);
    return id;
  }
  // Already a literal Canton Party ID ("Name::fingerprint") rather than one
  // of the 9 static role names — pass it through unchanged. Multi-FI
  // tenancy means the acting financialInstitution party is no longer always
  // the one fixed CANTON_FI_PARTY_ID; callers (monitoring.ts) now pass the
  // specific contract's own financialInstitution field value directly.
  if (party.includes("::")) return party;
  throw new Error(`Unknown party "${party}"`);
}

function v2TemplateId(templateId: string): string {
  return `#${PACKAGE_NAME}:${templateId}`;
}

let commandCounter = 0;
function nextCommandId(prefix: string): string {
  commandCounter += 1;
  return `${prefix}-${Date.now()}-${commandCounter}`;
}

function stringifyNumbers(value: unknown): unknown {
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(stringifyNumbers);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stringifyNumbers(v)]));
  }
  return value;
}

async function ledgerFetch(path: string, party: string, body: unknown): Promise<unknown> {
  const token = jwt(party);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { cause?: string; code?: string };
      if (parsed.cause) detail = `${parsed.code ?? ""} ${parsed.cause}`.trim();
    } catch { /* not JSON — fall back to raw text */ }
    throw new Error(`Canton ${path} failed [${res.status}]: ${detail}`);
  }
  return text ? JSON.parse(text) : {};
}

interface CreatedEventV2 { contractId: string; templateId: string; createArgument: unknown }
interface ArchivedEventV2 { contractId: string; templateId: string }
type TransactionEventV2 = { CreatedEvent: CreatedEventV2 } | { ArchivedEvent: ArchivedEventV2 };
interface TransactionV2 { updateId: string; events: TransactionEventV2[] }

async function ledgerEnd(): Promise<number> {
  const res = await fetch(`${BASE_URL}/v2/state/ledger-end`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Canton /v2/state/ledger-end failed [${res.status}]`);
  const data = (await res.json()) as { offset: number };
  return data.offset;
}

function summarizeTransaction(transaction: TransactionV2) {
  const created = transaction.events
    .filter((e): e is { CreatedEvent: CreatedEventV2 } => "CreatedEvent" in e)
    .map((e) => ({ contractId: e.CreatedEvent.contractId, payload: e.CreatedEvent.createArgument }));
  const archivedContractIds = transaction.events
    .filter((e): e is { ArchivedEvent: ArchivedEventV2 } => "ArchivedEvent" in e)
    .map((e) => e.ArchivedEvent.contractId);
  return {
    contractId: created[0]?.contractId ?? null,
    payload: created[0]?.payload ?? null,
    createdContracts: created,
    archivedContractIds,
    updateId: transaction.updateId,
  };
}

// G12 note: unlike backend/src/canton.ts's queryContracts (registries/policies
// only, hard-tripwired), this function's callers (supervisor.ts's poll loop) DO
// query genuinely growable lifecycle data (BusinessOnboarding, ComplianceReview,
// FinancingRequest, MurabahahContract) every 10s, by design — there is no
// server-side status filter at the v2 ledger API, only a full per-template ACS
// pull. A hard cap here would just turn "the loan book grew" into a Supervisor
// outage with no fallback path. The real fix is architectural (event-driven
// dispatch instead of poll-and-full-scan) — tracked as its own Phase 2 item
// ("queue-based orchestration replacing the poll loop", docs/platform-review-
// 2026-07.md §21) rather than something this pagination pass should paper over.
// A soft warning at least gives production visibility before that lands.
const ACS_GROWTH_WARNING_THRESHOLD = 500;

export async function queryActiveContracts(templateId: string, party: string) {
  const id = partyId(party);
  const offset = await ledgerEnd();
  const result = (await ledgerFetch("/v2/state/active-contracts", party, {
    filter: {
      filtersByParty: {
        [id]: {
          cumulative: [
            { identifierFilter: { TemplateFilter: { value: { templateId: v2TemplateId(templateId), includeCreatedEventBlob: false } } } },
          ],
        },
      },
    },
    verbose: true,
    activeAtOffset: offset,
  })) as Array<{ contractEntry: { JsActiveContract: { createdEvent: CreatedEventV2 } } }>;

  if (result.length > ACS_GROWTH_WARNING_THRESHOLD) {
    logger.warn(
      { templateId, count: result.length },
      `queryActiveContracts returned ${result.length} contracts — approaching the scale where the ` +
      `Supervisor's poll-and-full-scan loop needs to move to queue-based orchestration (Phase 2 backlog item)`,
    );
  }

  return result.map((entry) => ({
    contractId: entry.contractEntry.JsActiveContract.createdEvent.contractId,
    payload: entry.contractEntry.JsActiveContract.createdEvent.createArgument,
  }));
}

/** party may be a single party name or an array — dual/multi-controller choices
 * (e.g. BeginUnderwriting/RejectUnderwriting's `controller assessor, vetify`,
 * mirroring Onboarding.Approve/Reject's `controller verifier, vetify`) need every
 * controller present in actAs, or the Daml interpreter rejects the command for
 * missing authorization — independent of JWT/auth mode. The JWT used for the
 * request is the first-listed party's; this is a local-dev simplification (same
 * one already documented elsewhere in this codebase for shared JWT holding) —
 * a real deployment needs a token whose rights actually cover every listed party. */
export async function exerciseLedgerChoice(
  templateId: string,
  contractId: string,
  choice: string,
  argument: unknown,
  party: string | string[],
) {
  const parties = Array.isArray(party) ? party : [party];
  const ids = parties.map(partyId);
  const data = (await ledgerFetch("/v2/commands/submit-and-wait-for-transaction", parties[0], {
    commands: {
      commandId: nextCommandId("exercise"),
      userId: USER_ID,
      actAs: ids,
      commands: [
        { ExerciseCommand: { templateId: v2TemplateId(templateId), contractId, choice, choiceArgument: stringifyNumbers(argument) } },
      ],
    },
    transactionFormat: {
      eventFormat: {
        filtersByParty: Object.fromEntries(ids.map((id) => [id, { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }] }])),
        verbose: true,
      },
      transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
    },
  })) as { transaction: TransactionV2 };

  return summarizeTransaction(data.transaction);
}

export async function createLedgerContract(templateId: string, payload: unknown, party: string) {
  const id = partyId(party);
  const data = (await ledgerFetch("/v2/commands/submit-and-wait-for-transaction", party, {
    commands: {
      commandId: nextCommandId("create"),
      userId: USER_ID,
      actAs: [id],
      commands: [
        { CreateCommand: { templateId: v2TemplateId(templateId), createArguments: stringifyNumbers(payload) } },
      ],
    },
    transactionFormat: {
      eventFormat: {
        filtersByParty: { [id]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }] } },
        verbose: true,
      },
      transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
    },
  })) as { transaction: TransactionV2 };

  const { contractId, payload: createdPayload } = summarizeTransaction(data.transaction);
  return { contractId, payload: createdPayload };
}
