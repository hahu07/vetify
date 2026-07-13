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
import { readSecret } from "./secrets.js";
import { requestScopedCommandId } from "./idempotency.js";

const BASE_URL  = process.env.CANTON_LEDGER_URL ?? "http://localhost:7575";
const USER_ID   = process.env.CANTON_USER_ID     ?? "vetify-backend";
const PACKAGE_NAME = "vetify"; // daml.yaml `name:` — used for the `#<name>:Module:Entity` templateId shorthand

const PARTY_JWTS: Record<string, string> = {
  business:             readSecret("CANTON_BUSINESS_JWT"),
  vetify:               readSecret("CANTON_VETIFY_JWT"),
  verifier:             readSecret("CANTON_VERIFIER_JWT"),
  // Vetify's own underwriting team — same "not a third party" framing as
  // verifier — screens/qualifies businesses before Stage 7 (see Financing.daml's
  // BeginUnderwriting/RejectUnderwriting, both dual-controller with vetify).
  assessor:          readSecret("CANTON_ASSESSOR_JWT"),
  // Vetify's own portfolio-monitoring team — same "not a third party" framing
  // as verifier/assessor — makes the real Stage 9 delinquency call (see
  // Murabahah.daml's FlagDelinquent/ResumeActive, both dual-controller with
  // vetify, gated by the AuthorizedSentinel registry).
  sentinel:             readSecret("CANTON_SENTINEL_JWT"),
  // Genuinely independent Shari'a Supervisory Board party — AAOIFI governance
  // standards require independence from management, so this is modeled like
  // riskCommittee below, not "vetify's own team" the way verifier/assessor/
  // sentinel are framed (see Compliance.daml's RecordShariahPreCheck/
  // SupersedeShariahVerdict, gated by the AuthorizedAdvisor registry).
  advisor:         readSecret("CANTON_ADVISOR_JWT"),
  financialInstitution: readSecret("CANTON_FI_JWT"),
  regulator:            readSecret("CANTON_REGULATOR_JWT"),
  // Layer 2 of the Policy-Approval Security Roadmap (docs/deferred-gaps.md):
  // a genuinely distinct party from vetify. In a real deployment this JWT is
  // held by the Risk & Credit Governance Committee's own system, not by
  // whoever operates the vetify platform party — this backend only proxies
  // the ledger call, it isn't the source of the second signature's trust.
  riskCommittee:        readSecret("CANTON_RISK_COMMITTEE_JWT"),
};

// Actual on-ledger Party identifiers (e.g. "Vetify::1220...") — distinct from
// the JWTs above. v2's explicit actAs/query-filter model needs these; v1
// never did, since the JSON API resolved the acting party from the token
// itself. Populate by allocating each party once against the target
// participant (`POST /v2/parties`) and recording the resulting `party` string.
const PARTY_IDS: Record<string, string> = {
  business:             process.env.CANTON_BUSINESS_PARTY_ID       ?? "",
  vetify:               process.env.CANTON_VETIFY_PARTY_ID         ?? "",
  verifier:             process.env.CANTON_VERIFIER_PARTY_ID       ?? "",
  assessor:          process.env.CANTON_ASSESSOR_PARTY_ID    ?? "",
  sentinel:             process.env.CANTON_SENTINEL_PARTY_ID       ?? "",
  advisor:         process.env.CANTON_ADVISOR_PARTY_ID  ?? "",
  financialInstitution: process.env.CANTON_FI_PARTY_ID             ?? "",
  regulator:            process.env.CANTON_REGULATOR_PARTY_ID      ?? "",
  riskCommittee:        process.env.CANTON_RISK_COMMITTEE_PARTY_ID ?? "",
};

// Runtime-registered parties (one per self-serve financer signup) — additive
// to the 9 static roles above, not a replacement. Namespaced (e.g. "fi:42")
// so a dynamic key can never collide with a static role name. In-memory only:
// lost on process restart, so callers must replay registerDynamicParty() for
// every existing financer at boot (backend/src/index.ts calls
// listFinancerPartyRegistrations() + this — see that file).
const DYNAMIC_PARTY_IDS = new Map<string, string>();
const DYNAMIC_PARTY_JWTS = new Map<string, string>();
const STATIC_ROLE_KEYS = new Set(Object.keys(PARTY_IDS));

export function registerDynamicParty(key: string, partyIdValue: string, bearerToken = ""): void {
  if (STATIC_ROLE_KEYS.has(key)) {
    throw new Error(`"${key}" collides with a static party-role key — use a namespaced key`);
  }
  DYNAMIC_PARTY_IDS.set(key, partyIdValue);
  DYNAMIC_PARTY_JWTS.set(key, bearerToken);
}

/** Namespaced dynamic-party key for a self-serve-signed-up financer, keyed by
 * their `users` row id — one Canton party per financial institution tenant. */
export const fiPartyKey = (userId: number): string => `fi:${userId}`;

/** Resolves which party a "financer"-role session should act as when
 * exercising a choice/creating a contract as the FI: their own dynamically-
 * allocated party if they signed up through POST /api/auth/signup, or the
 * legacy shared "financialInstitution" role for the grandfathered
 * pre-migration seeded demo account (whose canton_party_id stays NULL —
 * see routes/auth.ts's signup route and docs on the migration). */
export function resolveFinancerParty(
  authUser: { userId: number; financialInstitutionPartyId?: string },
): string {
  return authUser.financialInstitutionPartyId ? fiPartyKey(authUser.userId) : "financialInstitution";
}

function jwt(party: string): string {
  if (DYNAMIC_PARTY_JWTS.has(party)) return DYNAMIC_PARTY_JWTS.get(party)!;
  if (party in PARTY_JWTS) return PARTY_JWTS[party];
  throw new Error(`No JWT configured for party "${party}"`);
}

export function partyId(party: string): string {
  if (DYNAMIC_PARTY_IDS.has(party)) return DYNAMIC_PARTY_IDS.get(party)!;
  if (!(party in PARTY_IDS)) throw new Error(`Unknown party key "${party}"`);
  const id = PARTY_IDS[party];
  if (!id) throw new Error(`No Party ID configured for "${party}" — set CANTON_${party.toUpperCase()}_PARTY_ID`);
  return id;
}

/** Allocates a brand-new Canton party (self-serve financer signup — see
 * routes/auth.ts's POST /signup). No JWT is needed to call this: party
 * allocation is a participant-admin operation, not a per-party-authorized
 * one. Response shape empirically verified against a live `dpm sandbox`
 * (Canton 3.5.1's v2 JSON Ledger API) — same "no bundled OpenAPI spec,
 * confirm live" discipline this file's top comment describes for the rest
 * of the v2 migration. */
export async function allocateParty(partyIdHint: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/v2/parties`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partyIdHint }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Canton /v2/parties allocation failed [${res.status}]: ${text}`);
  let data: { partyDetails?: { party?: string }; party?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Canton /v2/parties returned non-JSON response: ${text}`);
  }
  const allocatedParty = data.partyDetails?.party ?? data.party;
  if (!allocatedParty) throw new Error(`Canton /v2/parties returned no party ID: ${text}`);
  return allocatedParty;
}

function v2TemplateId(templateId: string): string {
  return `#${PACKAGE_NAME}:${templateId}`;
}

let commandCounter = 0;
function nextCommandId(prefix: string): string {
  // Prefer the request-scoped, retry-stable ID (idempotency.ts) — falls
  // back to a fresh, non-idempotent ID only when called outside an Express
  // request context (there is no client-supplied retry key to be stable
  // against in that case anyway).
  const scoped = requestScopedCommandId(prefix);
  if (scoped) return scoped;
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

/**
 * Typed ledger failure with an HTTP status the API layer can return directly
 * (review gap G16, docs/platform-review-2026-07.md). `publicMessage` is what
 * clients may see: for domain rejections (4xx) that's the Daml assertion/
 * precondition text — those messages are *written for users* ("Rejection
 * reason must not be empty") and safe to surface. For infrastructure
 * failures (5xx) it's a generic string; the raw detail (which can contain
 * contract IDs, party IDs, trace IDs) is only ever logged server-side.
 */
export class LedgerError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly publicMessage: string,
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

/** Maps Canton v2 error responses onto API-appropriate HTTP statuses.
 * Domain rejections (the business/FI did something the model forbids) → 4xx
 * with the Daml message; everything else → 502 (upstream dependency failed)
 * with a generic message. */
function toLedgerError(path: string, httpStatus: number, code: string, cause: string): LedgerError {
  const internal = `Canton ${path} failed [${httpStatus}]: ${code} ${cause}`.trim();
  // Daml-level business rejections — assertion/precondition text is
  // user-facing by design; extract just that message where possible.
  if (code === "DAML_FAILURE" || /PreconditionFailed|UNHANDLED_EXCEPTION|User failure/i.test(cause)) {
    const assertion = cause.match(/(?:User failure:|Assertion failed:|PreconditionFailed[^:]*:)\s*([^\n]+)/)?.[1];
    return new LedgerError(internal, 422, "DOMAIN_RULE_REJECTED", (assertion ?? cause).slice(0, 300));
  }
  if (code === "DUPLICATE_COMMAND") {
    return new LedgerError(internal, 409, code, "This command was already submitted — retry with a fresh request.");
  }
  if (/CONTRACT_NOT_FOUND|NOT_FOUND/.test(code)) {
    return new LedgerError(internal, 404, code, "Contract not found or no longer active.");
  }
  // DAML_AUTHORIZATION_ERROR (distinct from DAML_FAILURE above) — the command's
  // actAs parties don't match what the template/choice actually requires. Found
  // live (2026-07-08): a party-ID mismatch after a sandbox reset produced
  // exactly this code with "requires authorizers ..., but only ... were given"
  // — previously fell through to the generic 502 branch below, which reads as
  // an infra outage rather than the real, fixable cause (stale party config).
  if (code === "DAML_AUTHORIZATION_ERROR" || /PERMISSION_DENIED|UNAUTHENTICATED|missing authorization|requires authorizers/i.test(code + cause)) {
    return new LedgerError(internal, 403, code || "PERMISSION_DENIED", "Not authorized for this ledger action.");
  }
  if (code === "INVALID_ARGUMENT" || /Expected ujson|Unexpected fields/i.test(cause)) {
    return new LedgerError(internal, 400, code || "INVALID_ARGUMENT", "Request payload does not match the contract schema.");
  }
  return new LedgerError(internal, 502, code || "LEDGER_UNAVAILABLE", "Ledger request failed.");
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
    let cause = text;
    let code = "";
    try {
      const parsed = JSON.parse(text) as { cause?: string; code?: string };
      if (parsed.cause) cause = parsed.cause;
      if (parsed.code) code = parsed.code;
    } catch { /* not JSON — fall back to raw text */ }
    throw toLedgerError(path, res.status, code, cause);
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

// G12: queryContracts pulls a template's *entire* ACS in one call — the v2 API has
// no request-level LIMIT for active-contracts. Audited (2026-07): every current
// caller queries a headcount-sized registry (AuthorizedAdvisor/Assessor/Sentinel)
// or an effectively-singleton policy contract, never the growable lifecycle data
// (MurabahahContract, RepaymentRecord, FinancingRequest, ...) — those all go
// through PQS's active()/activePaged() (see pqs.ts/repository.ts), which does
// support LIMIT/OFFSET. MAX_ACS_RESULTS is a tripwire, not a real page: if a
// future caller points this at growable data, this throws instead of silently
// degrading, so the bug surfaces as a loud error rather than a slow memory climb.
const MAX_ACS_RESULTS = 1000;

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

  if (result.length > MAX_ACS_RESULTS) {
    throw new Error(
      `queryContracts("${templateId}") returned ${result.length} contracts, over the ` +
      `${MAX_ACS_RESULTS} tripwire — this template looks like growable lifecycle data, ` +
      `not a bounded registry/policy. Route it through PQS's activePaged() instead.`,
    );
  }

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

/** party may be a single party name or an array — dual/multi-controller choices
 * (e.g. Onboarding.Approve/Reject's `controller verifier, vetify`, or
 * Financing.BeginUnderwriting/RejectUnderwriting's `controller assessor,
 * vetify`) need every controller present in actAs, or the Daml interpreter
 * rejects the command for missing authorization — independent of JWT/auth
 * mode. The JWT used for the request is the first-listed party's; this is a
 * local-dev simplification (same one already documented elsewhere in this
 * codebase for shared JWT holding) — a real deployment needs a token whose
 * rights actually cover every listed party. */
export async function exerciseChoice(
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

// party accepts a single party or an array — needed for templates with more than one
// signatory (e.g. RahnAgreement's `signatory business, financialInstitution`), where Canton
// rejects the create unless every signatory is present in actAs. Mirrors exerciseChoice's
// existing multi-controller support exactly; single-party callers are unaffected.
export async function createContract(templateId: string, payload: unknown, party: string | string[] = "vetify") {
  const parties = Array.isArray(party) ? party : [party];
  const ids = parties.map(partyId);
  const data = (await ledgerFetch("/v2/commands/submit-and-wait-for-transaction", parties[0], {
    commands: {
      commandId: nextCommandId("create"),
      userId: USER_ID,
      actAs: ids,
      commands: [
        { CreateCommand: { templateId: v2TemplateId(templateId), createArguments: stringifyNumbers(payload) } },
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

  const { contractId, payload: createdPayload } = summarizeTransaction(data.transaction);
  return { contractId, payload: createdPayload };
}
