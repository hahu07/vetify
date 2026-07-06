# Production Readiness Backlog

Companion to `docs/deferred-gaps.md`. That document tracks gaps deliberately deferred
*within* the Daml model. This document tracks the remaining items from a broader
production-readiness gap audit (19 categories) that are **not Daml modeling concerns** —
infrastructure, operations, and identity-provisioning items that belong to `backend/`,
`agents/`, or platform/DevOps decisions outside `daml/Vetify/`.

Four of the original 19 categories (RBAC/segregation of duties/approval workflows, audit
trail/versioning, risk/AI-governance/AML fields, limits/idempotency/state-machine
enforcement) were implemented directly in the Daml model — see `Vetify.Governance`
(new module), and the extended `RiskAssessment`/`AIDecisionMetadata`/`AmlEvidenceRefs`
records, `PaymentIdempotencyGuard`, `DefaultRecord`, and `isValidMurabahahTransition` in
`Vetify.Murabahah`. The remaining items are catalogued below in the same
What / Why deferred / Prerequisite format as `deferred-gaps.md`.

---

## ✅ Resolved — Stage 6 (Underwriting) migrated to off-ledger deterministic scoring, and a live-data numifyWeights bug it uncovered

**What it was**: `agents/src/agents/underwriting.ts` did not follow the off-ledger deterministic
scoring pattern already established for Stage 2/3 (`agents/src/scoring/verification.ts`,
`compliance.ts`) — its LLM component computed the DSCR-based score/riskCategory/recommendedLimit
itself and exercised `BeginUnderwriting` directly, with no separate deterministic scoring engine
to make that decision reproducible/auditable independent of the LLM's phrasing that run.

**What was done**: `agents/src/scoring/underwriting.ts` (new) — `scoreUnderwriting()`, a pure
function scoring DSCR (35pts), revenue consistency (20), business age (15), amount-vs-limit (15),
and existing debt (15) from evidence the LLM only gathers and reports as JSON (mono.co Connect/
Creditworthiness calls); `underwriting.ts` rewritten to have no `exercise_choice` tool access at
all, same restriction as the Verifier Agent. Unlike Stage 2/3 there is no Approve/Reject/Flag
branching — `BeginUnderwriting` always proceeds once evidence is gathered, since the FI alone
decides in Stage 7.

Four gaps surfaced while building this were tracked and then closed in the same pass, each
verified live against a real sandbox + Postgres + backend, not just typechecked:
- **Missing reference docs**: `agents/skills/underwriting/references/dscr-guide.md` and
  `mono-underwriting-fields.md` written, matching what `SKILL.md` already referenced.
- **`FinancingRequest` didn't carry `incorporationDate`**: added to the Daml template, threaded
  through `RequestFinancing` (`Compliance.daml`, copied from `ApprovedBorrower.incorporationDate`).
  Missing-data handling stays principled either way — `scoreUnderwriting` treats an absent date as
  `undefined` (0 points, `BUSINESS_AGE_UNKNOWN` flag), distinct from a confirmed `NEW_BUSINESS`
  finding (<12 months).
- **`UnderwritingScoringWeights` was a hardcoded TS constant, not on-ledger policy data**: added as
  a Daml record (`Types.daml`), a field on `UnderwritingPolicy` (`Financing.daml`, keyed per
  `(vetify, financialInstitution)` — an FI-specific risk appetite, unlike Stage 2/3's vetify-wide
  singleton policy), threaded through `UpdatePolicy` and `BeginUnderwriting`'s
  `UnderwritingPolicySnapshot`. `underwriting.ts` now fetches the active policy per FI and falls
  back to `DEFAULT_UNDERWRITING_WEIGHTS` if none exists, mirroring `verifier.ts`. Backend routes
  added: `GET/POST /api/financing/underwriting-policy`, `POST .../underwriting-policy/:id/update`.
- **`assess_creditworthiness` delivers its result via webhook, not synchronously**
  (`mono-server.ts`'s own tool description) — no receiver existed anywhere in this codebase. Built
  `backend/src/routes/webhooks.ts` (`POST /api/webhooks/mono/creditworthiness`, optional
  `MONO_WEBHOOK_SECRET` signature check) persisting to a new `creditworthiness_webhooks` table
  (`infra/postgres/init.sql`, `backend/src/appdb.ts`); `underwriting.ts` triggers the check,
  captures the reference, then polls `GET .../creditworthiness/:reference` for up to 30s. If
  nothing arrives, `dscr` stays `undefined` (never fabricated) — `scoreUnderwriting` scores that
  factor 0 and raises `DSCR_UNAVAILABLE`, distinct from a confirmed `DSCR_BELOW_ONE` finding.
  Verified live: `GET` 404s before the webhook POST, 200s with the correct values after.

**A real, previously-unnoticed bug was found and fixed along the way**: the Daml v2 JSON Ledger
API encodes `Int`/`Decimal` fields as JSON strings not just on write (already handled, see the v1→
v2 migration entry below) but also on **read** — a policy's `scoringWeights` fetched back from the
ledger arrives as `{"dscrHigh": "40", ...}`, all strings. Summing those with `+` silently string-
concatenates instead of adding. This affected the already-shipped Stage 2/3 weight-fetch code in
`verifier.ts` too, just never triggered before because only the `DEFAULT_*_WEIGHTS` TS constants
(genuine numbers) had ever actually been exercised — no real on-ledger policy had been active yet.
Fixed with one shared `numifyWeights<T>(raw): T` helper (`agents/src/scoring/types.ts`) applied at
all three fetch sites (Stage 2, Stage 3, Stage 6). Verified live: `typeof numified.dscrHigh ===
"number"` and summing two numified fields produces a correct numeric sum, not concatenation.

---

## ✅ Resolved — `backend/src/canton.ts` migrated from v1 to the v2 JSON Ledger API

**What it was**: `backend/src/canton.ts` called `/v1/query`, `/v1/create`, `/v1/exercise` — the
classic Daml HTTP JSON API — which does not exist on the Canton 3.5.1 JSON API this project's own
tooling serves (`dpm sandbox --json-api-port`). Verified by hitting a real local sandbox directly:
`/v1/*` all 404; `/v2/parties` → 200, `/v2/commands/submit-and-wait` → 405 (exists, wrong method
for GET). This Canton version bundles the newer **JSON Ledger API (v2)** natively — no separate
legacy `json-api` component exists anywhere in `dpm`'s toolchain to fall back to.

**What was done**: `canton.ts` rewritten against v2, empirically reverse-engineered endpoint-by-
endpoint against a live sandbox (no OpenAPI spec is bundled) rather than guessed from memory:
- `queryContracts` → `POST /v2/state/active-contracts` with an explicit `filtersByParty` filter
  (v1 inferred the querying party from the JWT alone; v2 requires the real Party ID explicitly),
  preceded by `GET /v2/state/ledger-end` for the `activeAtOffset` the query needs.
- `createContract`/`exerciseChoice` → `POST /v2/commands/submit-and-wait-for-transaction` (not
  the simpler `submit-and-wait`, which only returns an opaque `updateId` — routes need the
  resulting created contract's ID/payload).
- `templateId` needed a package-qualifier shorthand: `#vetify:<Module>:<Entity>`.
- Every command needs an explicit `userId` (Daml's user-management model) and `actAs` with the
  real Party ID string, not the role name — added a `PARTY_IDS` map (new `CANTON_*_PARTY_ID` env
  vars) alongside the existing `PARTY_JWTS`, since a JWT authorizes *that* a caller may act as a
  party, but is not itself the party identifier v2 needs explicitly.
- Discovered mid-migration: Daml's `Int`/`Decimal` fields must be JSON-encoded as **strings**, not
  JSON numbers (same convention `pqs.ts` already documents for reads) — a raw JS number in a
  create/exercise payload 500s with `Expected ujson.Str`. Handled with a blanket recursive
  `stringifyNumbers()` transform inside `canton.ts` so route code keeps passing plain JS numbers
  unchanged (every other Daml field type is already non-numeric in JS, so this is safe generally,
  not template-specific).

**`queryContracts`/`exerciseChoice`/`createContract` kept their exact signatures and return
shapes** (`Array<{contractId, payload}>` / `{contractId, payload, ...}`) — zero changes needed in
`onboarding.ts`, `financing.ts`, `contracts.ts`, or `policy.ts`.

**Verified live, not just typechecked**: full round trip through the real Express routes against
a live sandbox — registered a `PolicyApprover` via HTTP, proposed a `VerificationPolicy` change,
approved it (archived old + created new, confirmed via a follow-up `GET`), and confirmed both
negative paths (self-approval, unregistered approver) surface the correct Daml assertion messages
through the HTTP error response.

---

## ✅ Resolved — `agents/` had the identical v1 problem, in two more places

**What it was**: fixing the backend didn't fix the actual AI agent pipeline — `agents/src/mcp/canton-server.ts`
(the MCP server every agent uses for `get_active_contracts`/`exercise_choice`/`create_contract`)
and `agents/src/agents/supervisor.ts` (which also had two direct `fetch` calls of its own, bypassing
MCP entirely, for polling and `RecordShariahPreCheck`) both called the same nonexistent `/v1/*`
endpoints. Found by grepping for the same pattern immediately after fixing the backend, not by
assuming it was isolated to one file.

**What was done**: extracted the v2 request-building logic into one shared module,
`agents/src/mcp/canton-client.ts` (`queryActiveContracts`/`exerciseLedgerChoice`/
`createLedgerContract`) — same reverse-engineered v2 shapes as `backend/src/canton.ts` (same
project, same migration, no reason to re-derive them independently or duplicate the logic twice
within the `agents/` package). `canton-server.ts`'s three MCP tools now call into it; `supervisor.ts`'s
`queryContracts`/`recordShariahPreCheck` helpers are now two-line wrappers around it instead of
their own `fetch` calls.

**Verified live**: ran the new `canton-client.ts` directly against a fresh local sandbox (create →
query → exercise round trip for a `PolicyApprover`, confirming the deactivate choice correctly
archived the old contract and created the new one) — same empirical-verification bar as the
backend migration, not just a typecheck.

**New env vars** (`agents/.env.example`): `CANTON_USER_ID`, `CANTON_VETIFY_PARTY_ID`,
`CANTON_VERIFIER_PARTY_ID` — same rationale as the backend's, see above.

---

## ✅ Resolved — PQS/Scribe sidecar never actually ingested anything (two independent bugs)

**What it was**: the backend's read path (`backend/src/pqs.ts`/`repository.ts` → Postgres via
Scribe) had never been run against a real ledger — earlier verification passes deliberately
scoped around it (write path only). Standing it up end-to-end for the first time surfaced two
real, independent bugs in `docker-compose.yml`, neither related to the v1→v2 migration:

1. **`host.docker.internal` + bridge networking cannot reach `dpm sandbox`'s gRPC Ledger API at
   all.** Confirmed via `ss -tlnp | grep 6865`: the sandbox binds `127.0.0.1:6865` only, never
   `0.0.0.0`. `extra_hosts: host.docker.internal:host-gateway` fixes the *DNS* resolution (Linux
   Docker Engine doesn't auto-resolve that hostname the way Docker Desktop does) but the
   container still can't complete a TCP connection through the bridge gateway to a strictly
   loopback-bound host port — confirmed by the error changing from "unknown host" to a 30s
   connection timeout against the real gateway IP. Checked `dpm sandbox --help` for a bind-
   address override — the only `--host` flag in the whole CLI belongs to the unrelated
   `sandbox-console` subcommand (confirmed by reading the full help text's `Command:` section
   boundaries), and passing it to `sandbox` anyway fails immediately with "Unknown option
   --host". **Fix**: `pqs` now runs with `network_mode: host` (shares the host's network
   namespace directly, reaching `127.0.0.1:6865` with no bridge/gateway hop at all), with
   `SCRIBE_SOURCE_LEDGER_HOST`/`SCRIBE_TARGET_POSTGRES_HOST` both changed to `localhost`
   accordingly (a host-networked container can no longer resolve the `postgres` compose service
   by name, so Postgres is reached via its published host port instead).
2. **Scribe 0.6.11 cannot read packages built with `--target=2.3`** (this project's LF target,
   required for contract keys — see `daml.yaml`). Once the networking was fixed, Scribe still
   crash-looped on startup with `java.util.NoSuchElementException: key not found:
   LanguageMinorVersion(3)` — it doesn't recognize LF minor version 3 at all, so it fails before
   ever creating its Postgres schema (`active()` doesn't exist, no tables). Digital Asset
   publishes Scribe images tagged to match the Daml SDK version they support (confirmed via the
   registry's tag list); switching the image to `scribe:3.5.1` (matching this project's own
   `sdk-version: 3.5.1`) resolved it immediately — schema migrated (42 Flyway migrations),
   94 entity types + 240 exercise types initialized, ledger ingestion started from genesis.
   **Lesson for future upgrades**: the Scribe image tag must track the project's `sdk-version`
   in `daml.yaml`, not be pinned independently — `docker-compose.yml`'s image tag is a second
   place that needs bumping whenever the Daml SDK version changes, easy to forget since nothing
   else in the repo references it.

**Verified live, full stack, not just typechecked**: fresh sandbox → 5 parties allocated →
`docker compose up` (postgres + pqs) → real `POST /api/onboarding` created a `BusinessOnboarding`
contract via the v2 write path → confirmed Scribe ingested it (`active()` query directly against
Postgres) → confirmed all three PQS-backed read routes return it correctly: `GET
/api/onboarding` (list), `GET /api/onboarding/:contractId` (single), and `GET
/api/onboarding?status=Draft` vs `?status=UnderReview` (status filter, including the
correctly-empty case). This closes out the last unverified half of the backend — both the write
path (v2 JSON Ledger API) and read path (PQS/Scribe) are now proven against a real local stack.

---

## ✅ Resolved — frontend was entirely mock-data-driven, never wired to the real backend

**What it was**: all 12 `frontend/src/pages/**` components imported hardcoded arrays from
`frontend/src/api/mockData.ts` directly — `frontend/src/api/client.ts` existed with
`useQuery`/`useMutation` hooks but was never actually called from any page, and its types
assumed a flattened response shape (`{id, profile, createdAt, ...}`) that doesn't match what
the backend actually returns (raw Canton `{contractId, payload}` with Daml field names —
confirmed live in the PQS verification pass above). Both gaps were latent since neither had
ever been exercised end-to-end.

**What was done**: `client.ts` rewritten with types matching the real Daml payload shapes
(`RawContract<T>` wrapper types) plus an adapter layer (`adaptOnboarding`, `adaptComplianceReview`,
etc.) converting them into UI-friendly view models — including parsing Daml's string-encoded
Int/Decimal fields back into JS numbers, which every page needs and previously had nowhere
centralized. All 12 pages rewired to the real hooks; `mockData.ts` deleted once no longer
referenced. Two genuine backend route gaps found and fixed in the process (both pre-existing,
independent of the frontend work — the routes silently dropped required Daml choice fields):
`POST /financing/:id/begin-underwriting` wasn't forwarding `autoDecided`/`decisionDocuments`
(non-optional on `BeginUnderwriting`); `POST /financing/:id/reject` wasn't forwarding
`decisionFactors`/`decisionDocuments` (also non-optional on `RejectFunding`).

**Resolved in a follow-up pass**: `ApproveFunding` (the FI's funding-approval choice) requires
`approvedProviderCid : ContractId ApprovedProvider` and `approvingOfficerId : Text` — both
mandatory. `Vetify.FinancingProvider`'s entire `ApprovedProvider`/officer-approval workflow had
**zero backend routes** (confirmed via grep at the time — not even a query route existed).
Fixed: new `backend/src/routes/providers.ts` (mounted at `/api/providers`) covers the full
`FinancingProviderOnboarding` lifecycle (create/submit/approve/reject/amend/request-amendment),
`GET /api/providers/approved` (lists `ApprovedProvider` — the credential `ApproveFunding`
needs), and `POST/GET /api/providers/officers` + deactivate/reactivate for the
`AuthorizedOfficer` RBAC registry. `financing.ts`'s `/approve` route now forwards
`approvedProviderCid`/`approvingOfficerId` (previously silently dropped, so this route could
never have succeeded against a real ledger) plus the remaining optional fields
(`approvedByName`, `underwriterName`, `reasonCode`, `decisionFactors`, `approvalSignature`,
`decisionDocuments`, `offerExpiresAt`). **Verified live**: registered a provider, submitted it,
approved it (confirmed the resulting `ApprovedProvider` contract via its HTTP response),
registered a `CreditOfficer` — all against a real sandbox. `ApproveFunding`'s own choice logic
already had solid Daml Script test coverage (`testApproveFundingCreatesWad` and others in
`FinancingTests.daml`, part of the 269 passing tests) — the gap was purely that the HTTP layer
could never supply what the choice requires, not that the choice itself was undertested.
**Frontend follow-up also completed**: `frontend/src/pages/fi/UnderwritingQueue.tsx`'s "Approve
Financing" modal now collects real `AssetDetails` fields and an authorizing Credit Officer
selection, calling the completed `ApproveFunding` route directly — no more preview-only
placeholder. New pages: `frontend/src/pages/fi/ProviderSettings.tsx` (FI self-registers as a
provider, submits for review, manages its `AuthorizedOfficer` roster once approved) and
`frontend/src/pages/vetify/ProviderApprovals.tsx` (Vetify reviews/approves/rejects pending
provider registrations). New `client.ts` hooks: `useProviderOnboardings`, `useApprovedProviders`,
`useAuthorizedOfficers`, `useCreateProvider`, `useSubmitProvider`, `useApproveProvider`,
`useRejectProvider`, `useCreateOfficer`, `useDeactivateOfficer`, `useReactivateOfficer`,
`useApproveFinancing`. **Verified live, full stack**: registered a provider via the browser,
approved it as Vetify, registered a Credit Officer, then opened the Underwriting Queue's Approve
modal — it correctly detected the approved provider and populated the officer dropdown from real
ledger data — and submitted a real `ApproveFunding` call that succeeded, confirmed by the
resulting `MurabahahWad` contract's `assetDetails` matching exactly what was typed into the form.

**Frontend for the Policy Governance workflow built (previously zero UI existed for it — only
curl/API)**: `frontend/src/pages/vetify/PolicyGovernance.tsx` (active `VerificationPolicy`/
`CompliancePolicy` summary, pending-proposal review with Approve/Reject, full propose forms
including every scoring-weight field, and `PolicyApprover` registry management) and a genuinely
separate **Risk Committee portal** (`frontend/src/pages/risk-committee/RiskCommitteeDashboard.tsx`,
its own login/role/nav — `riskCommittee` added to `AuthContext`'s `UserRole` union — not a tab
inside the vetify portal, since Layer 2's entire premise is that this party's credentials are
held by someone other than whoever operates vetify's own portal). **Verified live, full stack,
through the actual UI**: proposed a Verification Policy change as vetify → switched to the Risk
Committee portal and endorsed it there → switched back to vetify and finalized the approval →
confirmed the new `VerificationPolicy` went active, exactly mirroring the curl-based proof from
Layer 2's initial implementation but this time end-to-end through real pages. Two real bugs
caught and fixed along the way: (1) `useVerificationPolicy`/`useCompliancePolicy`'s query
functions returned `undefined` when no policy was active yet (empty array `[0]`), which React
Query rejects outright (`"Query data cannot be undefined"`) — fixed to return `null` explicitly;
(2) the generic `adaptWeights<T>`/`WeightGrid<T>` helpers were declared with a `T extends
Record<string, ...>` constraint that TypeScript's structural typing rejects for the specific
`VerificationScoringWeights`/`ComplianceScoringWeights` interfaces (no index signature) — fixed
by dropping the constraint.

**Also fixed**: `BusinessOnboarding.SubmitForReview` asserts `onboardingRef /= None`
(Gap 9 in the Daml source) — the frontend's create-onboarding payload never set it, so every
submission failed with `AssertionFailed: Onboarding reference must be set before submission`
until caught by the live browser test below. Initially patched with a client-side
`ONB-${Date.now()}` stopgap, then properly fixed by generating it server-side instead
(`onboarding.ts`'s `POST /` route, `ONB-<year>-<uuid8>`) — a backend correlation ID shouldn't
be invented by the client in the first place, and this removes the collision risk of a
client-side timestamp-only ref. Not a true per-year sequence (e.g. `"ONB-2026-000001"`) — that
needs a backend-owned mutable store, since PQS is read-only; the UUID-derived suffix avoids
collisions without new infra.

**Other real-vs-mock mismatches resolved during the rewrite** (see inline comments at each
site for the reasoning): `ApprovedBorrower` has no credit-limit field on-ledger at all
(`FinancingForm.tsx` now uses a fixed platform ceiling, not a fabricated per-borrower limit);
`ComplianceCheck`'s 4 booleans are a *decision the reviewer submits*, not pre-computed ledger
state (`ComplianceReview.checks` is only ever set inside `ApproveCompliance`/`RejectCompliance`
itself) — `ComplianceReview.tsx`'s checklist is now an input form, not a read-only display;
`FlagDelinquent`/`ResumeActive` are `controller vetify`, not the FI, so the "Flag as
Delinquent" button was removed from the FI-facing `ContractDetail.tsx` rather than wired to an
action that would always fail authorization; `FIDashboard.tsx`'s monthly bar chart and
activity feed had no real data source (`PortfolioReport`/`getPortfolioSummary()` don't carry
per-month or per-event breakdowns) and were dropped rather than fabricated, keeping only the
KPI cards and status-breakdown donut chart that the real `getPortfolioSummary()` aggregation
actually supports.

**Verified live, full stack, in a real browser** (not just typechecked): fresh sandbox + PQS
+ backend + frontend, logged in as the mock `business` user, filled and submitted the full
4-step onboarding wizard through `agent-browser`, confirmed the resulting `BusinessOnboarding`
contract via direct `GET /api/onboarding` (correct `business`/`kyc`/`directors` shape,
`status: UnderReview`, `onboardingRef` set), confirmed it renders correctly on the Borrower
Dashboard, the Vetify admin's Onboarding Pipeline table (correct filter-tab counts), and that
the Compliance and FI dashboards render their real (empty) states cleanly with no console
errors. `frontend/.env.example` added (`VITE_*_PARTY_ID`, mirroring the backend's own
`.env.example` pattern) since this demo has one fixed seeded borrower/FI party rather than
per-login Canton identities.

---

## Already resolved by existing design (no action needed)

### Concurrency Control
**What**: Optimistic locking, conflict resolution, duplicate transaction prevention,
concurrent approval handling.
**Resolution**: Canton's contract-ID-based consumption model is inherently
optimistic-concurrent — exercising a choice on a contract ID that has already been
archived (by a concurrent transaction) fails at submission time with a contract-not-found
error. No additional Daml modeling is needed; this is a property of the ledger, not a gap.

### Document Integrity (partially resolved)
**What**: SHA-256 document hashing, digital signatures, timestamp verification, tamper
detection.
**Resolution**: `DocumentRef` (Types.daml) already carries `contentHash`/`checksumAlgorithm`
(content hashing, Gap 5/7) and `digitalSignature`/`signatureAlgorithm`/`signatoryRef`/
`signedAt` (M14, digital signature evidence). The remaining gap is third-party
**timestamp-authority verification** (RFC 3161 style) — confirming *when* a signature was
applied against an independent trusted clock, rather than trusting the recorded `signedAt`
value. This is a `backend/` integration with a TSA provider, not a Daml schema change.

### Multi-Tenancy (partially resolved)
**What**: Tenant separation by financial institution, branch, business unit, organization.
**Resolution**: Canton's multi-party privacy model already isolates each FI's data at the
ledger level — a `financialInstitution` party only observes contracts where it is a
signatory/observer, so cross-FI data leakage is already structurally prevented (see
"Privacy Model" in `CLAUDE.md`). What's missing is *sub-tenant* separation **within** one
FI (branch/business-unit scoping) — the new `AuthorizedOfficer` registry (Phase A) is a
step toward this (officers are FI-scoped records), but branch-level reporting/permissions
are a `backend/` and PQS query-layer concern, not a ledger privacy gap.
**Prerequisite**: FI branch/business-unit data model; product decision on whether branches
need distinct observer visibility or just backend-side filtering.

---

## Open infrastructure/ops items

### Disaster Recovery & Resilience
**What**: Backup strategy, disaster recovery, ledger replication, recovery procedures,
business continuity planning.
**Why not Daml**: This is Canton participant/synchronizer topology and ops runbook design
— replication, backup cadence, and failover are configured at the participant node and
infrastructure level, not expressible in Daml templates.
**Prerequisite**: Infra/ops decision on participant node topology (single vs. replicated),
backup target (e.g. Postgres WAL archiving for the participant's ledger API store), and an
incident-response runbook. Out of scope for this repository until a deployment
architecture is chosen.

### API Gateway & Security Controls
**What**: API Gateway, authentication, authorization, rate limiting, request throttling,
abuse detection, session controls, security monitoring.
**Why not Daml**: These sit in front of `backend/src/canton.ts` (the HTTP JSON API client)
and are standard web-service concerns — a gateway product/library choice (e.g. Kong, AWS
API Gateway, or an Express middleware stack), not part of the ledger model.
**Prerequisite**: Choice of gateway/infra provider; JWT/session strategy for the backend's
existing `CANTON_VETIFY_JWT`/`CANTON_VERIFIER_JWT` party credentials (see `agents/`
section of `CLAUDE.md`); rate-limit policy per party/endpoint.

### Operational Monitoring
**What**: Processing latency, approval turnaround time, default rate, recovery rate, SLA
monitoring, platform health metrics.
**Why not Daml**: PQS (the Participant Query Store) already gives SQL access to every
contract's full history for building these metrics (`active('Vetify.<Module>:Template')`),
and Canton participants expose their own operational metrics separately. What's missing is
the aggregation/dashboard layer — a `backend/` metrics endpoint or a BI tool reading from
PQS Postgres, not a new Daml template.
**Prerequisite**: Metrics/dashboard tooling choice (e.g. Grafana over the PQS Postgres
instance); definition of SLA thresholds per stage (some already exist as policy fields —
`CompliancePolicy.escalationSlaHours`, `UnderwritingPolicy.requestSlaHours` — the gap is
alerting on breaches, not tracking them).

---

## Cross-reference

For gaps within the Daml model itself (Compliance, Financing, Murabahah modules), see
`docs/deferred-gaps.md`. For the RBAC/audit/risk/limits work that *was* implemented from
the original 19-category audit, see the `Vetify.Governance` module and the extended
records in `Vetify.Types`/`Vetify.Murabahah`/`Vetify.Financing` (Phases A-D, this pass).
