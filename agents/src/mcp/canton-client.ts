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

const BASE_URL     = process.env.CANTON_LEDGER_URL ?? "http://localhost:7575";
const USER_ID      = process.env.CANTON_USER_ID     ?? "vetify-agents";
const PACKAGE_NAME = "vetify"; // daml.yaml `name:`

const PARTY_JWTS: Record<string, string> = {
  vetify:   process.env.CANTON_VETIFY_JWT   ?? "",
  verifier: process.env.CANTON_VERIFIER_JWT ?? "",
};

// Actual on-ledger Party identifiers (e.g. "Vetify::1220...") — distinct from
// the JWTs above. Populate by allocating each party once against the target
// participant (`POST /v2/parties`) and recording the resulting `party` string.
const PARTY_IDS: Record<string, string> = {
  vetify:   process.env.CANTON_VETIFY_PARTY_ID   ?? "",
  verifier: process.env.CANTON_VERIFIER_PARTY_ID ?? "",
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
  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
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
  const res = await fetch(`${BASE_URL}/v2/state/ledger-end`);
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

  return result.map((entry) => ({
    contractId: entry.contractEntry.JsActiveContract.createdEvent.contractId,
    payload: entry.contractEntry.JsActiveContract.createdEvent.createArgument,
  }));
}

export async function exerciseLedgerChoice(
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
