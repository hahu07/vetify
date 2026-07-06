/**
 * Canton JSON Ledger API (v2) client.
 * All ledger reads and choice exercises go through these helpers.
 *
 * Migrated from the classic v1 HTTP JSON API (`/v1/query`, `/v1/create`,
 * `/v1/exercise`) — verified empirically against a real local sandbox
 * (`dpm sandbox --json-api-port`, Canton 3.5.1) that those endpoints do not
 * exist on this SDK's bundled JSON API; it serves the newer JSON Ledger API
 * (v2) natively instead. See docs/production-readiness-backlog.md's
 * "🔴 Critical" entry (now resolved) for the discovery, and CLAUDE.md's
 * Application Architecture section.
 *
 * Callers (routes/*.ts) are unaffected — queryContracts/exerciseChoice/
 * createContract keep the exact same signatures and return shapes
 * (`Array<{contractId, payload}>` / `{contractId, payload, events}`) as
 * before; only the internals changed.
 *
 * Key differences from v1 this file has to bridge:
 * - v1 inferred the acting party from the JWT alone; v2 requires the actual
 *   Party identifier explicitly in `actAs` and in query filters. A JWT
 *   authorizes *that* a caller may act as a party; it is not itself the
 *   party identifier. Hence PARTY_IDS below, alongside the existing
 *   PARTY_JWTS — both are needed now.
 * - v2 also requires a `userId` on every command (Daml's user-management
 *   model) — CANTON_USER_ID, one application-level user for this backend.
 * - templateId must be package-qualified: `#<package-name>:<Module>:<Entity>`
 *   (this project's Daml package name is "vetify", per daml.yaml).
 * - create/exercise use `submit-and-wait-for-transaction` (not the bare
 *   `submit-and-wait`) so the resulting created/archived events are
 *   available to return to callers — `submit-and-wait` alone only returns
 *   an opaque updateId/offset, which is not useful to route handlers that
 *   need the new contract's ID (e.g. after ApprovePolicyChange).
 */
import "dotenv/config";

const BASE_URL  = process.env.CANTON_LEDGER_URL ?? "http://localhost:7575";
const USER_ID   = process.env.CANTON_USER_ID     ?? "vetify-backend";
const PACKAGE_NAME = "vetify"; // daml.yaml `name:` — used for the `#<name>:Module:Entity` templateId shorthand

const PARTY_JWTS: Record<string, string> = {
  borrower:             process.env.CANTON_BORROWER_JWT       ?? "",
  vetify:               process.env.CANTON_VETIFY_JWT         ?? "",
  verifier:             process.env.CANTON_VERIFIER_JWT       ?? "",
  financialInstitution: process.env.CANTON_FI_JWT             ?? "",
  regulator:            process.env.CANTON_REGULATOR_JWT      ?? "",
  // Layer 2 of the Policy-Approval Security Roadmap (docs/deferred-gaps.md):
  // a genuinely distinct party from vetify. In a real deployment this JWT is
  // held by the Risk & Credit Governance Committee's own system, not by
  // whoever operates the vetify platform party — this backend only proxies
  // the ledger call, it isn't the source of the second signature's trust.
  riskCommittee:        process.env.CANTON_RISK_COMMITTEE_JWT ?? "",
};

// Actual on-ledger Party identifiers (e.g. "Vetify::1220...") — distinct from
// the JWTs above. v2's explicit actAs/query-filter model needs these; v1
// never did, since the JSON API resolved the acting party from the token
// itself. Populate by allocating each party once against the target
// participant (`POST /v2/parties`) and recording the resulting `party` string.
const PARTY_IDS: Record<string, string> = {
  borrower:             process.env.CANTON_BORROWER_PARTY_ID       ?? "",
  vetify:               process.env.CANTON_VETIFY_PARTY_ID         ?? "",
  verifier:             process.env.CANTON_VERIFIER_PARTY_ID       ?? "",
  financialInstitution: process.env.CANTON_FI_PARTY_ID             ?? "",
  regulator:            process.env.CANTON_REGULATOR_PARTY_ID      ?? "",
  riskCommittee:        process.env.CANTON_RISK_COMMITTEE_PARTY_ID ?? "",
};

function jwt(party: string): string {
  return PARTY_JWTS[party] ?? PARTY_JWTS["vetify"];
}

function partyId(party: string): string {
  const id = PARTY_IDS[party] ?? PARTY_IDS["vetify"];
  if (!id) throw new Error(`No Party ID configured for "${party}" — set CANTON_${party.toUpperCase()}_PARTY_ID`);
  return id;
}

function v2TemplateId(templateId: string): string {
  return `#${PACKAGE_NAME}:${templateId}`;
}

let commandCounter = 0;
function nextCommandId(prefix: string): string {
  commandCounter += 1;
  return `${prefix}-${Date.now()}-${commandCounter}`;
}

/** Daml's LF Int64/Numeric types must be JSON-encoded as strings, not JSON
 * numbers (avoids precision loss for 64-bit integers) — the same convention
 * `pqs.ts` documents for reads ("Int64, Decimal, ContractId → strings")
 * applies to writes here too, confirmed empirically: the v2 API 500s with
 * "Expected ujson.Str" if a create/exercise argument has a raw JS number.
 * Every other Daml field type (Text, Bool, Time, Party, ContractId, enums)
 * is already non-numeric in JS, so it's safe to blanket-convert any `number`
 * found anywhere in the payload tree — callers keep passing plain JS numbers
 * (matching what route code naturally produces from parsed request JSON)
 * without needing to know about this Daml-specific encoding rule themselves. */
function stringifyNumbers(value: unknown): unknown {
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(stringifyNumbers);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stringifyNumbers(v)]));
  }
  return value;
}

async function ledgerFetch(path: string, party: string, body: unknown): Promise<unknown> {
  const token = jwt(party);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Omit the header entirely when unconfigured — a present-but-empty bearer
  // token is rejected as malformed by a sandbox with auth enabled, whereas a
  // missing header is accepted by one running with no auth configured at all.
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    // v2 error bodies are {code, cause, ...} rather than v1's {status, errors}.
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { cause?: string; code?: string };
      if (parsed.cause) detail = `${parsed.code ?? ""} ${parsed.cause}`.trim();
    } catch { /* not JSON — fall back to raw text */ }
    throw new Error(`Canton ${path} failed [${res.status}]: ${detail}`);
  }
  return text ? JSON.parse(text) : {};
}

interface CreatedEventV2 {
  contractId: string;
  templateId: string;
  createArgument: unknown;
}
interface ArchivedEventV2 {
  contractId: string;
  templateId: string;
}
type TransactionEventV2 =
  | { CreatedEvent: CreatedEventV2 }
  | { ArchivedEvent: ArchivedEventV2 };

interface TransactionV2 {
  updateId: string;
  events: TransactionEventV2[];
}

async function ledgerEnd(): Promise<number> {
  const res = await fetch(`${BASE_URL}/v2/state/ledger-end`);
  if (!res.ok) throw new Error(`Canton /v2/state/ledger-end failed [${res.status}]`);
  const data = (await res.json()) as { offset: number };
  return data.offset;
}

export async function queryContracts(templateId: string, party = "vetify") {
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

  return result.map((entry) => ({
    contractId: entry.contractEntry.JsActiveContract.createdEvent.contractId,
    payload: entry.contractEntry.JsActiveContract.createdEvent.createArgument,
  }));
}

/** Extracts the first created/archived contract from a v2 transaction's event
 * list, for callers that just want "the contract this choice produced" —
 * same shape as createContract's return, plus the full raw event list for
 * choices that create more than one contract (e.g. RecordPayment creating
 * both a RepaymentRecord and a LatePaymentCharity). */
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

export async function exerciseChoice(
  templateId: string,
  contractId: string,
  choice: string,
  argument: unknown,
  party: string,
) {
  const id = partyId(party);
  const data = (await ledgerFetch("/v2/commands/submit-and-wait-for-transaction", party, {
    commands: {
      commandId: nextCommandId("exercise"),
      userId: USER_ID,
      actAs: [id],
      commands: [
        { ExerciseCommand: { templateId: v2TemplateId(templateId), contractId, choice, choiceArgument: stringifyNumbers(argument) } },
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

  return summarizeTransaction(data.transaction);
}

export async function createContract(templateId: string, payload: unknown, party = "vetify") {
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
