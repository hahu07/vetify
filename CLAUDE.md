# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vetify is an **AI-powered non-interest private credit infrastructure platform** built on the Canton blockchain (Daml). It connects Nigerian SME businesses with licensed financial institutions through a fully digital **Murabahah financing workflow** — from onboarding and KYC through underwriting, contract execution, repayment monitoring, and regulatory reporting.

Four AI agents (Verifier, Underwriting, Monitoring, Reporting) plus a standalone Shariah pre-check agent assist human decision-makers at each stage but do not replace authorized approvals. The Canton ledger provides multi-party privacy, immutable audit trails, and regulatory-friendly data sharing.

**Off-ledger deterministic scoring**: the LLM-based agents do not decide Stage 2/3 outcomes. They gather evidence (calling mono.co/Youverify tools) and report it as structured JSON; a deterministic scoring engine (`agents/src/scoring/`) computes the score, checks, and decision from that evidence, and only that engine's output is ever used to exercise a Canton choice. See "Off-Ledger Deterministic Scoring" below.

- **Daml SDK**: 3.4.11 / **LF target**: 2.2 (`build-options: [--target=2.2]` in `daml.yaml`). Downgraded from 3.5.1/LF 2.3 for deployment-platform compatibility — verified live that 3.4.11's `damlc` doesn't recognize `--target=2.3` at all (`Unknown Daml-LF version: 2.3`), and its highest working target (2.1/2.2) rejects contract keys outright (`Failure to process Daml program, this feature is not currently supported. Contract keys.`). **No template in this codebase declares `key`/`maintainer` anymore** — every `lookupByKey`/`fetchByKey`/`exerciseByKey` use was replaced by an explicit `ContractId <Template>` choice argument the caller resolves off-ledger first (via `queryContracts`/PQS for a policy singleton or RBAC registry entry) and passes in; the `requireActiveX` helpers in `Vetify.Governance` now `fetch` that ContractId and assert an identity match (e.g. `entry.assessor == assessor`) instead of doing the lookup themselves. Residual, accepted regressions from losing ledger-enforced keys: (1) uniqueness on ~15 previously-keyed templates (`BusinessOnboarding`, `FinancingRequest`, `MurabahahContract`, etc.) is no longer ledger-enforced — a caller-side duplicate check is the only guard; (2) "only one active policy" for `VerificationPolicy`/`CompliancePolicy`/`UnderwritingPolicy`/`ProviderVerificationPolicy` is an application-layer convention, not a ledger invariant — mitigated in practice by the maker-checker + Risk Committee endorsement friction on the two that go through that flow; (3) `PaymentIdempotencyGuard`'s duplicate-`directDebitRef` rejection in `RecordPayment` is no longer atomic — a caller-side PQS check before submitting narrows but does not close the race.
- **Package name**: `vetify`
- **Source root**: `daml/`
- **Dependencies**: `daml-prim`, `daml-stdlib`, `daml-script`
- **Product spec**: `docs/vetify.md`

---

## Application Architecture

```
Frontend (React)
      │  HTTP/REST
      ▼
Backend (Node.js/Express)  ──── writes ────▶  Canton HTTP JSON API (/v1/exercise, /v1/create)
      │                                              │
      │  SQL (pg)                                   ▼
      ▼                                        Canton Ledger (gRPC :6865)
PQS PostgreSQL (reads)                              │
      ▲                                             │ transaction stream
      └──────── Scribe (PQS sidecar) ◀─────────────┘
```

- **Writes** (choice exercises, contract creation) → Canton **JSON Ledger API (v2)** via `backend/src/canton.ts`
- **Reads** (list contracts, dashboard queries, aggregations) → PQS PostgreSQL via `backend/src/pqs.ts` + `backend/src/repository.ts`
- PQS image: `europe-docker.pkg.dev/da-images/public/docker/scribe:3.4.1` — **must match this project's `sdk-version` in `daml.yaml`**, but Scribe's own version numbering is independent of the Daml SDK's (confirmed live: SDK 3.4.11 bundles `scribe/daml3.4` at version `3.4.1`, not `3.4.11` — check `dpm resolve | grep scribe` rather than assuming an exact numeric match; `docker manifest inspect` the tag before wiring it into `docker-compose.yml` to confirm it exists, since a plausible-looking but wrong tag fails the `docker compose up` pull with a clear "manifest unknown" error, not a silent wrong-version crash-loop). An older/mismatched Scribe cannot parse packages built for a newer LF target and crash-loops before ever creating its Postgres schema (verified live against the 3.5.1/LF 2.3 pairing pre-downgrade — see `docs/production-readiness-backlog.md`'s "PQS/Scribe sidecar" entry). SQL function: `active('Vetify.<Module>:TemplateName')` (e.g. `active('Vetify.Murabahah:MurabahahContract')`); payload stored as JSONB
- `docker-compose.yml`'s `pqs` service runs with `network_mode: host` — `dpm sandbox`'s gRPC Ledger API binds `127.0.0.1` only (no bind-address override exists for the `sandbox` subcommand), which is unreachable from a bridge-networked container regardless of `host.docker.internal`/`extra_hosts` DNS fixes; host networking sidesteps this entirely (verified live)
- **Pagination + read-your-writes (review gap G12)**: `pqs.ts`'s `activePaged()` pushes `LIMIT`/`OFFSET` down to Postgres (fetches `limit+1` rows to derive `hasMore` without a second `COUNT` query) instead of pulling a whole template's active-contract set into the process — wired into the two lists that actually scale with book size, `GET /api/contracts` and `GET /api/contracts/repayments` (opt-in: pass `?limit`/`?offset` to get a `{ rows, limit, offset, hasMore }` envelope; omit both for the legacy unbounded array, kept for compatibility). `backend/src/canton.ts`'s `queryContracts` (ledger ACS, no server-side `LIMIT` in the v2 API) is audited to only ever be called for headcount-sized registries/policy singletons — a hard tripwire throws if a future caller ever points it at growable data instead of routing through PQS. `agents/src/mcp/canton-client.ts`'s `queryActiveContracts` **is** used by the Supervisor's poll loop against genuinely growable lifecycle data by design (no server-side status filter exists at the v2 API) — a soft growth warning logs instead of throwing, since the real fix is the Phase 2 "queue-based orchestration replacing the poll loop" item, not something this pagination pass should paper over. **Read-your-writes**: `pqs.ts`'s `contractByIdWithRetry()` (bounded retry with short backoff, live-verified against Postgres including a genuinely late-arriving row) mitigates the Scribe ledger→PQS lag for the specific case of a client reading back its own just-completed write (`getProposalById`/`getContractById` in `repository.ts`) — a full second read path against the ledger's JSON API was considered and deferred (would need its own live-sandbox verification cycle for marginal benefit over the bounded retry). **Policy-fetch caching**: `agents/src/agents/util.ts`'s `withPolicyCache()` (60s TTL) wraps `VerificationPolicy`/`CompliancePolicy`/`UnderwritingPolicy` fetches in `verifier.ts`/`underwriting.ts` — safe because real policy changes go through the maker-checker + Risk Committee endorsement workflow (minutes, not seconds), so a 60s-stale read is a non-issue in practice.

> **Migrated from the classic v1 HTTP JSON API** (`/v1/query`/`/v1/create`/`/v1/exercise`) to the **v2 JSON Ledger API** — verified empirically against a real local sandbox that v1 endpoints don't exist on Canton 3.5.1's bundled JSON API (`dpm sandbox --json-api-port` serves v2 natively; confirmed `/v2/parties` → 200 vs `/v1/*` → 404). `canton.ts` reverse-engineered the v2 request/response shapes against a live sandbox (no OpenAPI spec is bundled) and preserved its `queryContracts`/`exerciseChoice`/`createContract` signatures exactly, so `onboarding.ts`/`financing.ts`/`contracts.ts`/`policy.ts` needed zero changes. Full history and the specific gotchas (explicit `actAs`/`userId`/party-ID requirements, `Int`/`Decimal` fields needing string encoding) in `docs/production-readiness-backlog.md`'s "✅ Resolved" entry.

### Backend Routes (`backend/src/routes/`)

| File | Mounted at | Covers |
|---|---|---|
| `onboarding.ts` | `/api/onboarding` | Stages 1–4: Onboarding, Verification, Compliance, ApprovedBusiness |
| `financing.ts` | `/api/financing` | Stages 5–7: Financing Request, Underwriting, FI decision |
| `contracts.ts` | `/api/contracts` | Stages 8–10: Murabahah contract, repayments, closure, portfolio reports |
| `policy.ts` | `/api/policy` | Cross-cutting: `VerificationPolicy`/`CompliancePolicy` propose→approve/reject workflow, `PolicyApprover` registry (register/deactivate/reactivate) — see "Policy & Governance Templates" below |
| `providers.ts` | `/api/providers` | Stage 0: `FinancingProviderOnboarding` lifecycle (create/submit/approve/reject/amend), `ApprovedProvider` list (the credential `ApproveFunding` requires), `AuthorizedOfficer` registry (register/deactivate/reactivate) — gates `financing.ts`'s `ApproveFunding` route |

**Every `/api/*` route requires a real backend session** (review gap G1, Phase 1): a blanket `requireAuth()` covers all GETs at mount time (`backend/src/app.ts` — the app is built there; `index.ts` only validates config and listens), and every mutating route carries its own `requireAuth("<role>")` mapping the acting Canton party to the session role allowed to drive it (`business` role acts as the `business` Canton party directly, `financialInstitution`→`financer`, vetify/verifier/dual-controller→`vetify`). Sessions come from `POST /api/auth/login` (bcrypt `users` table + optional TOTP) — the frontend's old mock login (hardcoded creds in the bundle) is gone; `npm run seed:users` seeds the demo portal accounts. Exclusions: `/health`, `/api/auth`, `/api/webhooks` (external caller; own shared-secret check). Route tests: `backend/test/auth-gating.test.ts`.

Daml is split into two packages (review gap G10a): the root `vetify` package is
**templates only** (no daml-script — uploading its DAR no longer bloats the
participant package store), and `daml-tests/` holds every Daml Script test plus
the operational seed scripts (`vetify-tests`, data-depends on the built root
DAR). `multi-package.yaml` at the root ties them together for the IDE.

**Smart Contract Upgrade (SCU) lineage** (review gap G10b, `docs/daml-upgrade-lineage.md`): `--target=2.2` (was `2.3` pre-downgrade) puts every template on an LF version Canton 3.x can upgrade in place, and the mechanism is confirmed live (pre-downgrade, against LF 2.3 — not yet re-verified against 2.2) — `dpm build` (via `daml.yaml`'s `upgrades:` field) or standalone `dpm upgrade-check` genuinely rejects an incompatible change (e.g. a removed field) with the specific template/field named, and passes an additive `Optional`-field change silently. The full runbook — version-bump policy, the compatible/incompatible change list, the cut-a-real-upgrade checklist, and the exact CI-wiring trigger ("the day the first real version bump happens") — lives in that doc rather than here, since it's a process document, not an architecture fact; that doc's own `--target=2.3` references are still pending the same update.

**Phase 2 production-architecture design** (`docs/phase2-tranche-b-design.md`): queue-based orchestration (ledger-native, replacing the Supervisor's poll loop), participant-per-org Canton topology + PQS-per-org, observability stack, DR/backup runbooks — design deliverables, not implemented, since none are buildable/verifiable inside this project's single-participant sandbox. See that doc for the concrete migration paths and open questions.

**Full local environment startup** (`docs/local-dev-startup.md`): the commands below assume Docker and the Canton sandbox are already up. The sandbox has no persistent storage — every party ID and every ledger contract is gone after any Docker/sandbox restart — so that doc has the full recovery procedure: re-allocating all 9 parties, keeping `backend/.env`/`agents/.env`/`frontend/.env`'s party-ID fingerprints in sync across all three (they carry different, non-identical subsets of the 9 parties), and hand-registering the governance contracts (`AuthorizedReviewer`, etc.) that nothing seeds automatically.

```bash
# Compile the production (templates-only) DAR — required BEFORE building tests
dpm build

# Run all Daml Script tests (from the tests package)
cd daml-tests && dpm test

# Run tests scoped to a single file
cd daml-tests && dpm test --files daml/Vetify/Tests/OnboardingTests.daml

# Start local Canton sandbox + HTTP JSON API (gRPC on :6865, HTTP JSON API on :7575)
# NOT `daml start` — this SDK's tooling is `dpm`, not the legacy `daml` CLI (not on
# public GitHub releases; see docs/local-dev-startup.md for why and the full recovery
# procedure — the sandbox is in-memory-only, so this needs re-running, with parties
# re-allocated, after every Docker/sandbox restart, not just once per machine).
dpm sandbox --dar .daml/dist/vetify-0.3.0.dar --json-api-port 7575

# Start PostgreSQL + PQS (Scribe) sidecar
docker compose up -d

# Start backend API server
cd backend && npm run dev

# Backend route tests (auth gating, error sanitization — no ledger/DB needed)
cd backend && npm test

# Open Daml Studio (VS Code with Daml language extension)
daml studio

# Lint (config in .dlint.yaml)
daml lint
```

---

## Participants (Canton Parties)

| Party | Role |
|---|---|
| `business` | SME seeking financing; creates onboarding, submits financing requests, makes repayments |
| `vetify` | Platform orchestration layer; coordinates all workflow transitions |
| `financialInstitution` | Provides financing; makes final approval, executes Murabahah contract |
| `verifier` | Vetify's own compliance team; decision authority for both Stage 2 identity/KYC verification and Stage 3 AML/KYB/CDD compliance review — not a third party |
| `assessor` | Vetify's own underwriting team; decision authority for Stage 6 — screens/qualifies businesses before they reach the FI at all, not a third party (same framing as `verifier`) |
| `sentinel` | Vetify's own portfolio-monitoring team; decision authority for Stage 9 — makes the real delinquency call (`FlagDelinquent`/`ResumeActive`), not a third party (same framing as `verifier`/`assessor`) |
| `regulator` | Read-only supervisory observer; receives portfolio and compliance reports |
| `riskCommittee` | Vetify's own Risk & Credit Governance Committee (`docs/risk-governance-charter.md`) — genuinely distinct from `vetify`, independently endorses scoring-policy changes before `vetify` can activate them (Layer 2 of the Policy-Approval Security Roadmap, see below) |
| `advisor` | Shari'a Supervisory Board — genuinely independent of `vetify` (same trust model as `riskCommittee`, **not** "vetify's own team" the way `verifier`/`assessor`/`sentinel` are framed; AAOIFI governance standards require this independence). Makes the real Stage 3 Shariah pre-check call and can correct it via `SupersedeShariahVerdict` |

---

## Financing Lifecycle (10 Stages)

```
Stage 1   Business Onboarding       business submits profile + KYC docs
Stage 2   Verification              Verifier Agent validates identity, CAC reg, documents
Stage 3   Compliance Review         Verifier Agent performs AML, CDD, regulatory checks
Stage 4   Business Approval         business becomes eligible for financing
Stage 5   Financing Request         business submits amount, purpose, tenure
Stage 6   AI Underwriting           Underwriting Agent scores risk, recommends limit
Stage 7   Financing Review          financialInstitution makes final Approve/Reject decision
Stage 8   Murabahah Execution       asset purchased + sold to business at disclosed profit margin
Stage 9   Repayment Monitoring      Monitoring Agent tracks installments, flags delinquency
Stage 10  Financing Closure         contract completed on full repayment
```

---

## Daml Template Architecture

Contract logic is split by lifecycle domain under `daml/Vetify/` (namespaced modules). Template IDs are `Vetify.<Module>:<TemplateName>`:

| Module | Templates | Stage |
|---|---|---|
| `Vetify.Types` | (enums + records only, no templates) | — |
| `Vetify.Onboarding` | `BusinessOnboarding`, `VerificationResult` | 1–2 |
| `Vetify.Compliance` | `ComplianceReview`, `ComplianceResult`, `ApprovedBusiness`, `EDDCase` (G14) | 3–4 |
| `Vetify.Financing` | `FinancingRequest`, `UnderwritingResult`, `UnderwritingRejection`, `FinancingDecision` | 5–7 |
| `Vetify.Murabahah` | `MurabahahWad`, `MurabahahWakala`, `AssetPurchaseRecord`, `MurabahahProposal`, `MurabahahContract`, `RepaymentRecord`, `IbraRequest`, `LatePaymentCharity`, `RahnAgreement`, (+ many more — see file) | 7→10 |
| `Vetify.Reporting` | `PortfolioReport` | ongoing |
| `Vetify.Governance` | `AuthorizedOfficer` (FI-side officer registry/RBAC), `PolicyApprover` (vetify-side scoring-policy approver registry), `AuthorizedAssessor` (vetify-side Stage 6 assessor registry), `AuthorizedSentinel` (vetify-side Stage 9 sentinel registry), `AuthorizedAdvisor` (Stage 3 advisor registry); leaf module, no imports at all | cross-cutting |

> The tables below cover the core lifecycle templates and this session's policy/governance additions. Both `Financing.daml` and `Murabahah.daml` have grown substantially beyond what's itemized here (dozens of supporting templates for collections, disputes, collateral, regulatory records, etc.) — check the file directly for the full template list rather than treating this table as exhaustive.

Import DAG (acyclic): `Compliance → Financing → Murabahah`; `Onboarding`, `Reporting` depend only on `Types`. Tests live in `daml-tests/daml/Vetify/Tests/` (a separate `vetify-tests` package — see Common Commands above). See `docs/daml-review.md` for the refactor rationale.

The template set mirrors the lifecycle above:

### Data Records

| Record | Key Fields |
|---|---|
| `BusinessDirector` | name, address, phoneNumber, ninNumber, bvn, email |
| `BusinessProfile` | name, address, state, phoneNumber, email, website, businessType, incorporationDate, directors (list), businessActivity, businessSector |
| `BusinessKyc` | cacRegNumber, taxId |
| `FinancingTerms` | amount, purpose, tenureMonths |
| `MurabahahTerms` | assetCost, profitAmount, salePrice, installmentAmount, tenureMonths |
| `AssetDetails` | description, supplier, supplierRef, estimatedCost |
| `RiskAssessment` | score, riskCategory, recommendedLimit, recommendation |
| `ComplianceCheck` | shariahCompliant, amlCleared, kycValidated, cddCompleted |
| `DocumentRef` | docType, contentHash (SHA-256 hex), storageRef |
| `AIDecisionMetadata` | agentName, modelVersion, executionId, reasonCode, confidence |
| `PaymentScheduleEntry` | installmentNo, dueDate, dueAmount |
| `CollateralStatus` | CollateralActive, CollateralReleased, CollateralEnforced |

### Enumerations

| Enum | Values |
|---|---|
| `BusinessType` | SoleProprietorship, LimitedCompany |
| `RiskLevel` | Low, Medium, High |
| `ReviewStatus` | Draft, Pending, UnderReview, ManualReview, PendingAmendment, Approved, Rejected — shared across all workflow templates to avoid constructor conflicts |
| `FinancingStatus` | Submitted, Underwriting, FinancingApproved, FinancingRejected |
| `MurabahahStatus` | Active, Delinquent, Completed, Defaulted, DelinquencyManualReview |

### Templates

| Template | Signatory | Observer(s) | Stage |
|---|---|---|---|
| `BusinessOnboarding` | business | vetify, verifier | 1–4 |
| `VerificationResult` | **verifier** | vetify, business | 2 |
| `ComplianceReview` | vetify | verifier, business, advisor | 3 |
| `ComplianceResult` | vetify | verifier, business | 3 |
| `ApprovedBusiness` | vetify | business | 4 |
| `FinancingRequest` | business | vetify, financialInstitution, assessor | 5 |
| `UnderwritingResult` | **assessor** | vetify, financialInstitution, business | 6 |
| `UnderwritingRejection` | **assessor** | vetify, business, financialInstitution | 6 |
| `FinancingDecision` | financialInstitution | business, vetify | 7 |
| `MurabahahWad` | business | financialInstitution, vetify | 7→8 |
| `MurabahahWakala` | financialInstitution | business, vetify | 8 |
| `AssetPurchaseRecord` | financialInstitution | business, vetify | 8 |
| `MurabahahProposal` | financialInstitution | business, vetify, advisor | 8 |
| `ShariahContractCertification` | **advisor** | business, financialInstitution, vetify | 8 |
| `MurabahahContract` | **business, financialInstitution** | vetify, sentinel, regulator | 8 |
| `RepaymentRecord` | business, financialInstitution | vetify, regulator | 9 |
| `IbraRequest` | business | financialInstitution, vetify | 9–10 |
| `LatePaymentCharity` | financialInstitution | business, vetify | 9 |
| `RahnAgreement` | **business, financialInstitution** | vetify | 8–10 |
| `PortfolioReport` | vetify | financialInstitution, regulator | ongoing |

> **Murabahah acquisition chain** (AAOIFI Std No. 8): `ApproveFunding` → `MurabahahWad` (business's irrevocable promise) → FI chooses `ProceedWithWakala` (appoints business as agent) or `ProceedDirectly` → `AssetPurchaseRecord` (FI ownership evidence) → business exercises `AcknowledgeDelivery` (Qabdh) → FI exercises `OfferMurabahah` → `MurabahahProposal` → **advisor exercises `CertifyShariahTerms` (G11 — SSB sign-off on the executed cost/profit/sale-price/tenure)** → business exercises `AcceptProposal` (presenting that certification) → bilateral `MurabahahContract`. The regulator observes only the accepted contract, not any prior step — but the contract carries `shariahCertificationRef`/`shariahCertifiedBy` so the SSB sign-off is examiner-visible: on the ledger/PQS directly, and (as of the Phase 2 validation pass, `docs/platform-review-2026-07.md` §23.15/V3) on the FI's own contract detail page (`frontend/src/pages/fi/ContractDetail.tsx`) via `MurabahahContract.shariahCertificationRef`/`.shariahCertifiedBy` in `frontend/src/api/client.ts`. No business-facing contract detail page exists yet at all (business dashboard is summary-only), so this is FI/back-office visible today, not yet business-visible — a smaller, separate gap from what V3 covers.

> **G11 — per-contract Shari'a certification** (AAOIFI GSIFI No. 1/2): the Stage-3 pre-check (`RecordShariahPreCheck`) only clears the *business's line of activity*; it says nothing about the *financial structure of a specific facility*. `CertifyShariahTerms` (nonconsuming on `MurabahahProposal`, controller `advisor, vetify`, gated by `requireActiveAdvisor`) creates an `advisor`-signed `ShariahContractCertification` snapshotting that proposal's `salePrice`/`assetCost`/`profitAmount`/`tenureMonths`. `AcceptProposal` fetches it and **hard-asserts** the snapshot still matches — same facility, same advisor, verdict `COMPLIANT`, identical figures — so a business cannot execute a contract the SSB has not signed off on. `RevokeCertification` (controller `advisor`) archives a certification whose terms have since changed, blocking `AcceptProposal` until a fresh one is issued. Deliberately a human (ACP `skills/shariah-review`) act, not autonomous — a real SSB member stands behind the certified figures. Backend: `POST /api/financing/proposals/:id/certify-shariah`, `.../certifications/:id/revoke` (both `requireAuth("vetify")`, acting as `[advisor,vetify]`/`advisor`).

### Key Choices per Template

**BusinessOnboarding** (no contract key on SDK 3.4.11/LF 2.2 — `(business, kyc.cacRegNumber)` uniqueness is an application-layer convention now, not ledger-enforced; see the SDK line at the top of this doc)
- `SubmitForReview` (business) → status: UnderReview; records `submittedAt`
- `Approve` (**verifier, vetify** dual-controller — vetify co-signs since it's `VerificationPolicy`'s signatory; the caller supplies that policy's `ContractId` as `policyCid`, no ledger-side lookup) → creates `VerificationResult`
- `Reject` (verifier, vetify) → creates `VerificationResult` with reason
- `FlagForManualReview` (verifier agent) → status: ManualReview; stores `agentScore`, `agentRisk`, `agentNote`, `agentVersion`
- `RequestAmendment` (vetify) → status: PendingAmendment
- `Amend` (business) → status: Draft; clears agent scoring; `amendmentCount + 1` (max 5; CAC number immutable)

**ComplianceReview**
- `StartReview` (vetify) → status: UnderReview
- `RecordShariahPreCheck` (**advisor, vetify** dual-controller — advisor makes the real call, vetify co-signs so `create this` is authorized since `ComplianceReview`'s signatory is vetify alone; gated by `requireActiveAdvisor`) → records the standalone Shariah Agent's verdict (`shariahVerdict` field); does not transition status
- `SupersedeShariahVerdict` (**vetify** alone — Option A, mirrors `Supersede`: advisor cannot unilaterally correct its own past call) → post-hoc audit correction; updates `shariahVerdict` and creates a `ShariahVerdictCorrection`; usable regardless of `status`
- `ApproveCompliance` (verifier, `eddCaseCid : Optional (ContractId EDDCase)`) → creates `ApprovedBusiness` + `ComplianceResult`. **G14 hard gate**: when `eddCaseCid` is `Some`, asserts that case belongs to this review and its `status == EddClosed` — a PEP hit's still-open EDD case blocks approval regardless of the rest of the decision; `None` for the vast majority of reviews where `OpenEddCase` was never exercised
- `RejectCompliance` (verifier) → creates `ComplianceResult` (outcome=Rejected, reason on-ledger)
- `FlagComplianceForManualReview` (vetify agent) → status: ManualReview
- `OpenEddCase` (**nonconsuming**, vetify) → creates an `EDDCase` (G14) — the Verifier Agent calls this specifically when its Youverify evidence shows a PEP-only hit (`review_required` driven by a PEP match, not a sanctions match), distinct from the generic `FlagComplianceForManualReview` every other ambiguous case gets

**EDDCase** (G14 — Enhanced Due Diligence checklist, signatory vetify, observer verifier/business; status `EddOpen`/`EddClosed`)
- `UpdateEddChecklist` (**nonconsuming**, verifier) → progressively fills in `sourceOfWealthVerified`/`sourceOfWealthNote`/`enhancedMediaSearchDone`/`seniorManagementSignoff`/`monitoringFrequency`
- `CloseEddCase` (verifier, `closedBy_`) → asserts every checklist item is complete before transitioning to `EddClosed`; only a closed case satisfies `ApproveCompliance`'s gate

**ApprovedBusiness**
- `RequestFinancing` (business, **nonconsuming** — supports repeat facilities) → creates `FinancingRequest`

**FinancingRequest** — Stage 6 mirrors Stage 2/3's Approve/Reject/Flag pattern: `assessor` (vetify's own underwriting team, dual-controller with vetify since vetify is `UnderwritingPolicy`'s signatory and the caller supplies that policy's `ContractId` as `policyCid`, no ledger-side lookup) screens businesses before they ever reach the FI
- `BeginUnderwriting` (**assessor, vetify**; from Submitted or UnderwritingManualReview) → status: Underwriting; creates `UnderwritingResult` — Low-risk auto-qualify, or the human-approved-after-flag path
- `RejectUnderwriting` (**assessor, vetify**; from Submitted or UnderwritingManualReview) → archives; creates `UnderwritingRejection` (reason on-ledger) — a hard veto, the business never reaches `ApproveFunding`/`RejectFunding` at all
- `FlagUnderwritingForManualReview` (vetify) → status: UnderwritingManualReview; stores `agentScore`/`agentRisk`/`agentNote`/`agentVersion` — Medium-risk escalation to a human assessor (ACP `skills/underwriting-review`)
- `ApproveFunding` (financialInstitution, `assetDetails : AssetDetails`) → creates `MurabahahWad` (business's irrevocable promise to purchase)
- `RejectFunding` (financialInstitution) → creates `FinancingDecision` (reason on-ledger)

**MurabahahWad** (business's irrevocable promise — AAOIFI Std No. 8, §2/2)
- `ProceedWithWakala` (financialInstitution) → creates `MurabahahWakala` (agency appointment)
- `ProceedDirectly` (financialInstitution, `actualCost, purchaseDate, invoiceRef`) → creates `AssetPurchaseRecord` with `purchasedViaWakala = False`
- `WithdrawWad` (business, `reason`) → archives (supplier unavailable / changed circumstances)

**MurabahahWakala** (agency agreement — AAOIFI Std No. 23)
- `RecordAssetPurchase` (business, `actualCost, purchaseDate, invoiceRef`) → creates `AssetPurchaseRecord` with `purchasedViaWakala = True`
- `DeclineAgency` (business, `reason`) → archives; FI must buy directly

**AssetPurchaseRecord** (FI ownership evidence + Qabdh gate — AAOIFI Std No. 8, §3/1)
- `AcknowledgeDelivery` (business) → `deliveryAcknowledged = True`; required before `OfferMurabahah`
- `OfferMurabahah` (financialInstitution, `murabahahTerms, paymentSchedule, regulator, advisor, startDate`) → creates `MurabahahProposal`; gated by Qabdh; enforces `assetCost == actualCost`. `advisor` (the SSB party that will certify the terms — G11) is supplied by the backend from server config, same as `sentinel` on `AcceptProposal`

**MurabahahProposal** (FI's formal sale offer — Ijab)
- `CertifyShariahTerms` (**nonconsuming**, `advisor, vetify` — G11; gated by `requireActiveAdvisor`) → creates an `advisor`-signed `ShariahContractCertification` snapshotting this proposal's `salePrice`/`assetCost`/`profitAmount`/`tenureMonths`; args `certificationRef, aaoifiStandards, rationale, certifiedBy`
- `AcceptProposal` (business, `sentinel : Party`, `certificationCid : ContractId ShariahContractCertification`) → creates bilateral `MurabahahContract` (Qabul). **Hard-gated by G11**: fetches the certification and asserts it's for this facility/advisor, verdict `COMPLIANT`, and its snapshot equals the proposal's terms — a missing, revoked, or stale-terms certification blocks acceptance. `sentinel`/`certificationCid` are both supplied by the backend, not the business's own session
- `DeclineProposal` (business, `reason`) → archives

**ShariahContractCertification** (G11 — advisor's per-contract sign-off; signatory `advisor`, observer business/FI/vetify)
- `RevokeCertification` (advisor, `revocationRef, reason, revokedBy`) → archives + creates `ShariahCertificationRevocation` audit record; blocks `AcceptProposal` until a fresh certification is issued

**MurabahahContract** (`ensure salePrice == assetCost + profitAmount`)
- `RecordPayment` (financialInstitution) → creates `RepaymentRecord` + optional `LatePaymentCharity` if `paymentDate > dueDate`. Guards: `amountPaid > 0`, no overpayment, strict installment sequence. Status **preserved** (partial payment does not auto-cure delinquency).
- `FlagDelinquent` (**sentinel, vetify** dual-controller — vetify co-signs so the atomic `AuditEvent` creation is authorized, since `MurabahahContract`'s signatories are business/financialInstitution, not vetify; gated by `requireActiveSentinel`) → Active/DelinquencyManualReview → Delinquent
- `ResumeActive` (**sentinel, vetify**) → Delinquent/DelinquencyManualReview → Active (the real delinquency call, made by the Sentinel Agent per its deterministic scoring engine, or by a human sentinel via `skills/monitoring-review` for an escalated case)
- `FlagForDelinquencyReview` (vetify alone — pure escalation, no sentinel decision made yet, mirrors `FlagUnderwritingForManualReview`) → Active → DelinquencyManualReview
- `DefaultContract` (financialInstitution) → Delinquent → Defaulted (write-off; unaffected by the Sentinel Agent split — no vetify/sentinel authority dependency, so the FI keeps sole authority over its own default decision, same precedent as `ApproveFunding`/`RejectFunding` staying FI-only after `assessor` was introduced)
- `CloseContract` (financialInstitution) → Completed (requires `outstandingBalance <= 0`)
- `RequestIbra` (**nonconsuming**, business) → creates `IbraRequest` (early settlement request)

**IbraRequest** (early settlement rebate — AAOIFI Std No. 8, §6/1; discretionary, not stipulated)
- `GrantIbra` (financialInstitution, `rebateAmount`) → FI voluntarily waives part of remaining profit
- `DeclineIbra` (financialInstitution) → business pays full outstanding balance

**LatePaymentCharity** (Sadaqah obligation — AAOIFI Std No. 8, §2/4/20)
- `SetCharityAmount` (financialInstitution, `amount`) → FI applies Shariah committee formula
- `ConfirmCharityPayment` (business, `charityRef`) → donation confirmed with receipt reference

**RahnAgreement** (collateral pledge — AAOIFI Std No. 39)
- `ReleaseCollateral` (financialInstitution, `note`) → CollateralActive → CollateralReleased (on closure)
- `EnforceCollateral` (financialInstitution, `reason`) → CollateralActive → CollateralEnforced (on default)

### Policy & Governance Templates

Config/policy templates are `vetify`-signed, intended as singletons (no contract key on SDK 3.4.11/LF 2.2 to enforce that — see the SDK line at the top of this doc); workflow choices that read one take its `ContractId` as an explicit argument, resolved off-ledger by the caller (`queryContracts`/PQS) rather than via a ledger-side lookup — distinct from the lifecycle templates above, so listed separately.

| Template | Module | Purpose |
|---|---|---|
| `VerificationPolicy` | Onboarding | Stage 2 thresholds (`autoApproveMin`/`autoRejectMax`/`slaHours`/`requiredDocTypes`) **and** `scoringWeights : VerificationScoringWeights` — the off-ledger Stage 2 scoring engine's per-check point table, now data instead of hardcoded constants |
| `PendingVerificationPolicy` | Onboarding | Maker-checker draft for the above — see below |
| `CompliancePolicy` | Compliance | Stage 3 thresholds + `scoringWeights : ComplianceScoringWeights` (Stage 3 scoring engine's point table) + `shariahPolicyVersion`. `effectiveFrom`/`effectiveTo` are recorded for audit only — **not enforced** as a staging gate; a policy change takes effect the instant it's created |
| `PendingCompliancePolicy` | Compliance | Maker-checker draft for the above |
| `AuthorizedReviewer` | Compliance | Registry gating who may exercise `ApproveCompliance`/`RejectCompliance` as `verifier` |
| `AuthorizedOfficer` | Governance | FI-side officer registry/RBAC (role + approval-limit gating on Financing/Murabahah choices) |
| `PolicyApprover` | Governance | Vetify-side registry gating who may exercise `ApprovePolicyChange` (Layer 1 of the Policy-Approval Security Roadmap — see below) |
| `AuthorizedAssessor` | Governance | Vetify-side registry gating who may exercise `BeginUnderwriting`/`RejectUnderwriting` as `assessor` (`requireActiveAssessor`) — mirrors `AuthorizedReviewer`'s purpose but with `PolicyApprover`'s fuller register/deactivate/reactivate lifecycle |
| `AuthorizedSentinel` | Governance | Vetify-side registry gating who may exercise `FlagDelinquent`/`ResumeActive` as `sentinel` (`requireActiveSentinel`) — same register/deactivate/reactivate shape as `AuthorizedAssessor` |
| `AuthorizedAdvisor` | Governance | Registry gating who may exercise `RecordShariahPreCheck` as `advisor` (`requireActiveAdvisor`) — same register/deactivate/reactivate shape as `AuthorizedSentinel`/`AuthorizedAssessor`, but for a genuinely independent party (see participants table) rather than "vetify's own team" |

**Maker-checker for scoring-policy changes** (`PendingVerificationPolicy`/`PendingCompliancePolicy`): `vetify` proposes a new policy with `proposedBy`/`reason`/`proposedAt`; a *different*, **registered** individual must exercise `ApprovePolicyChange` (`approvedBy /= proposedBy` **and** `approvedBy` must match a currently-active `PolicyApprover` entry, both asserted) before it archives the currently-active policy and replaces it. `RejectPolicyChange` withdraws a proposal (self-rejection is fine — only *activating* a change requires a distinct, registered approver). Without this, a single `vetify` signature could silently retune the entire Stage 2/3 auto-decision rubric with no independent review.

**Policy-Approval Security Roadmap** (full detail in `docs/deferred-gaps.md`, plain-English version in `docs/risk-governance-charter.md`'s appendix): closing this gap fully is staged, not one-shot.
- ✅ **Layer 0** (done): `approvedBy /= proposedBy` — a bare distinct-name check.
- ✅ **Layer 1** (done): `PolicyApprover` registry (`Vetify.Governance`, `requireActivePolicyApprover`) — `approvedBy` must match a real, currently-active registrant, not any invented string. `DeactivatePolicyApprover`/`ReactivatePolicyApprover` mirror `AuthorizedOfficer`'s lifecycle. **Someone still has to register each real Committee member** — `POST /api/policy/approvers` (`backend/src/routes/policy.ts`).
- ✅ **Layer 2** (done): a new `riskCommittee` Canton party — genuinely distinct from `vetify`, confirmed held by a separate keyholder before this was built — must exercise `EndorseByRiskCommittee` on the pending policy (its own separate ledger transaction, `POST /api/policy/verification|compliance/:id/endorse`) before `ApprovePolicyChange` will succeed. Deliberately two single-controller choices, not one `controller vetify, riskCommittee` exercise: a combined exercise only proves whoever called this backend held authority for both parties, which is meaningless since this one Express process holds every party's JWT in `canton.ts`. Two separate transactions, each needing that party's own JWT, is what actually proves two distinct signers acted. **Only a real improvement in production if `CANTON_RISK_COMMITTEE_JWT` is genuinely held by the Risk Committee's own system**, not colocated with this backend's other party JWTs — see `docs/deferred-gaps.md`'s Residual row.
- ✅ **Layer 3** (done, app-layer variant): Layer 2 still let anyone holding the shared `riskCommittee`/`vetify` JWT submit `endorsedBy`/`approvedBy`/`rejectedBy` as any Text they liked. A real human login (`backend/src/auth.ts`/`appdb.ts` — bcrypt-hashed `users` table, JWT session tokens distinct from every `CANTON_*_JWT`) now gates the endorse/approve/reject routes; those fields are derived from the authenticated session, not the request body, and every action is written to an append-only `audit_log` (`GET /api/auth/audit-log`). That log — not the Canton ledger, which still only ever sees the shared party — is where individual attribution actually lives, so this is only as strong as "the ledger API is unreachable except through this backend." The heavier one-Canton-party-per-individual variant was considered and deliberately not built (see `docs/deferred-gaps.md`). `npm run seed:users` seeds initial accounts (dev-only, no password-recovery flow).
- ✅ **Layer 4** (done, TOTP/software-MFA half only): RFC 6238 TOTP, opt-in per user (`POST /api/auth/mfa/enroll-init`/`enroll-verify`, QR code via `qrcode`). Once enabled, password alone no longer issues a session — `POST /api/auth/login` returns a short-lived `mfa_pending` token that cannot pass `requireAuth` (a `type` discriminator on the JWT enforces this) until `POST /api/auth/mfa/verify-login` checks the TOTP code. **Hardware keys (WebAuthn/FIDO2) were not built** — this environment can't drive a real or virtual FIDO2 authenticator (no CDP virtual-authenticator support available, no physical key), and shipping unverifiable code would break this project's verification discipline. TOTP was chosen because it's fully testable end-to-end and genuinely closes "stolen password alone is sufficient," even though it isn't literally hardware-backed — see `docs/deferred-gaps.md` for the full reasoning.
- ⚠️ **Residual, permanently accepted**: two distinct, legitimately-registered approvers colluding — or the same team quietly holding both `vetify`'s and `riskCommittee`'s JWTs (degrades Layer 2 back to Layer 1) — or reaching the Canton ledger API directly, bypassing this backend and Layers 3/4's audit log and login entirely. Not closable by any of the above — only non-technical controls (audit sampling, more-than-two-person sign-off for the highest-stakes changes) mitigate it.

---

## Off-Ledger Deterministic Scoring (`agents/src/scoring/`)

Stage 2, Stage 3, and Stage 6 outcomes are computed by pure, unit-tested TypeScript functions, not by LLM judgment:

```
agents/src/scoring/
├── types.ts             # raw evidence shapes (MashupResult, AmlEvidence, ...); *ScoringWeights
│                         # interfaces mirroring the Daml records; DEFAULT_* fallback constants
├── verification.ts      # scoreVerification() — Stage 2, risk-scoring-guide.md's point table
├── compliance.ts         # scoreCompliance() — Stage 3, AML/KYB fully quantified; CDD's
│                         # "purpose & profile coherence" bucket has no structured data source
│                         # anywhere in the schema, so it is never guessed at — see below
├── underwriting.ts      # scoreUnderwriting() — Stage 6 orchestrator; no Approve/Reject/Flag
│                         # branching like Stage 2/3 — BeginUnderwriting always proceeds, the FI
│                         # alone decides in Stage 7. Delegates to five independent engines:
├── underwriting-transactions.ts       # shared derivation helpers (cash flow, recurring debt)
├── underwriting-financial-behaviour.ts # income stability, expense discipline, liquidity, revenue
├── underwriting-cashflow-risk.ts       # net cashflow, DSCR, cash reserve, 3-scenario stress test
├── underwriting-creditworthiness.ts    # bureau credit score banding
├── underwriting-fraud-detection.ts     # rule-based transaction pattern flags — not ML
├── underwriting-final-decision.ts      # weighted combinator + fraud hard override
├── shariah-policy.ts    # classifyShariahCompliance() — maintained keyword table, fails
│                         # closed to REQUIRES_REVIEW for any unrecognized sector
└── *.test.ts             # node:test unit tests (run: npm test in agents/)
```

**The architecture principle**: `agents/src/agents/verifier.ts`'s LLM component only calls mono.co/Youverify tools and reports raw results as JSON — it has no tool access to `exercise_choice`/`create_contract` at all, so it is architecturally incapable of deciding, not just instructed not to. Code parses that JSON, calls the scoring engine, and exercises the Canton choice directly based purely on the engine's output. The LLM only ever contributes narrative text (the `note` on a `FlagForManualReview`), never the decision itself.

**`scoreCompliance` can never resolve to `ApproveCompliance` on its own.** AML and KYB are fully quantifiable from Youverify's status fields; business age is quantifiable from the incorporation date. But `cdd-framework.md`'s "purpose & profile coherence" factors (financing purpose vs. declared activity, amount proportionality, director-industry fit) have no structured data source anywhere in the schema — no business turnover, employee count, or director employment history field exists. Rather than fabricate a formula, the scorer only ever auto-rejects (on a clear hard-rule violation — confirmed AML hit, struck-off business, Shariah `NON_COMPLIANT`) or flags for a human, who alone can close out that qualitative judgment.

**G14 — continuous screening + Enhanced Due Diligence** (docs/platform-review-2026-07.md §12): three gaps closed. (1) **EDD checklist**: a PEP-only hit (`evidence.pepHit`, distinct from a sanctions hit) makes `verifier.ts` call `OpenEddCase` alongside its usual `FlagComplianceForManualReview` — this creates a structured `EDDCase` (source-of-wealth verification, enhanced media search, senior-management sign-off, monitoring cadence) that `ApproveCompliance` **hard-gates** on via its `eddCaseCid` argument, so a PEP relationship cannot be approved on a bare review note the way an ordinary flagged case can. (2) **List-version stamping**: `AmlEvidenceRefs.sanctionsListVersion`/`sanctionsListDate` (schema existed since "Gap 10", never populated) now record the actual screening date and Youverify's documented fixed watchlist coverage — not a fabricated incrementing version number Youverify's API doesn't expose. `sanctionsCheckRef`/`pepCheckRef`/`adverseMediaRef` are now relayed from the LLM's evidence (real verification IDs when the tool response includes one, `null` otherwise — never invented). (3) **Rescreen scheduler**: the Supervisor's daily sweep (`agents/src/agents/supervisor.ts`) exercises `RequestRecertification` on any `BusinessActive` `ApprovedBusiness` whose `approvedAt` exceeds `RESCREEN_INTERVAL_DAYS` (default 180, policy-configurable via env) — naturally idempotent, since recertification archives the current `ApprovedBusiness` and it won't reappear as stale until a fresh compliance cycle produces a new one. Gap F38 (a hard pre-`ApproveFunding` sanctions refresh) was deliberately **not** built as a Daml gate — it would need threading fresh AML evidence through `FinancingRequest`/`UnderwritingResult` to a FI-controlled choice, a much larger ripple than this sweep's continuous-freshness approach justifies.

**`agents/src/agents/shariah.ts`** mirrors this: `classifyShariahCompliance()` (keyword table ported from `prohibited-sectors.md`) is the verdict authority. The RAG/LLM pipeline only runs — and only ever produces a narrative, never a verdict — when the table has no match at all (a genuinely novel sector); even then the verdict is fixed to `REQUIRES_REVIEW` regardless of what the LLM writes.

**Scoring weights are on-ledger policy data, not hardcoded constants** — see "Policy & Governance Templates" above. `verifier.ts` fetches the active `VerificationPolicy`/`CompliancePolicy` (`get_active_contracts`, queried as `vetify` since neither has an observer clause) before scoring, falling back to `DEFAULT_VERIFICATION_WEIGHTS`/`DEFAULT_COMPLIANCE_WEIGHTS` if none is active.

**Data-completeness gap closed**: `ComplianceReview` now carries `businessSector`/`businessActivity`/`incorporationDate` directly (added fields, carried over from `BusinessOnboarding.profile` at creation time — both the `RequestRecertification` choice and `verifier.ts`'s post-`Approve` auto-creation populate them; `ApprovedBusiness` also carries the same three fields so `RequestRecertification` can pass them through to the next compliance cycle). The Shariah classifier and business-age scoring (`agents/src/agents/supervisor.ts`, `agents/src/scoring/compliance.ts`) use the real fields now instead of a `businessName` proxy / omitting the factor.

**Stage 6 (Underwriting) is scored by five independent deterministic engines, not one flat formula** — mirroring how real institutional credit engines separate these concerns so each can be audited, tuned, and explained on its own:

| Engine | Scores | Populates |
|---|---|---|
| Financial Behaviour | revenue consistency, business age, expense discipline (burn rate), liquidity (balance-derived buffer, best-effort) | `RiskAssessment.behaviouralScore` |
| Cashflow Risk | DSCR, existing-debt leverage, cash reserve months (best-effort), 3-scenario stress test (-10%/-25%/-40% revenue haircuts against existing debt + an estimated installment) | `cashflowRiskScore` |
| Creditworthiness | bureau `creditScore` banding — previously fetched and explicitly discarded, now finally used | `creditworthinessScore` |
| Fraud Detection | four **rule-based** transaction pattern checks (structuring, round-tripping, pre-application income spikes, transaction velocity anomalies) — explicitly heuristic, **not ML** (no labeled fraud-outcome dataset exists to train or validate against) | `fraudScore` |
| Final Decision | weighted combinator over the four sub-scores (policy-configurable engine-level weights) + a **hard override**: a Fraud Detection score below `UnderwritingScoringWeights.fraudReviewThreshold` (per-institution policy data, default 30 — not a hardcoded constant, since risk tolerance for a rule-based fraud signal is a genuine FI-specific judgment call) forces `riskCategory = High` regardless of the weighted composite, mirroring Stage 3's AML hard-override precedent | composite `score`/`riskCategory`/`recommendedLimit`/`recommendation` |

`agents/src/agents/underwriting.ts`'s LLM component only calls mono.co Connect/Creditworthiness
tools and relays a **normalized transaction list** (date/amount/direction/description/
counterparty/balanceAfter) — a pure relay/normalization task, not aggregation. All arithmetic (net
cashflow, revenue variance, recurring-debt detection via named counterparty grouping, fraud
pattern matching) happens deterministically in code from that list
(`agents/src/scoring/underwriting-transactions.ts` + the five engine files), closing a
trust-boundary gap an earlier version of this agent had: the LLM used to aggregate "dozens of raw
transaction records" itself into pre-computed numbers, a categorically different task from Stage
2/3's pure categorical bucketing. The agent has no tool access to `exercise_choice` at all, same
restriction as the Verifier Agent.

**Stage 6 now mirrors Stage 2/3's Approve/Reject/Flag branching**, via the real `assessor`
party: the Final Decision engine's `decision` field (mirrors `VerificationDecision`/
`ComplianceDecision` exactly) maps Low risk → `BeginUnderwriting` (auto-qualify), Medium risk →
`FlagUnderwritingForManualReview` (escalates to a human assessor via the ACP
`skills/underwriting-review` skill), High risk → `RejectUnderwriting` (a hard veto — the business
never reaches the FI at all, mirroring `RejectCompliance`'s screening authority). The Fraud
Detection hard override (forcing `riskCategory = High`) naturally routes to `RejectUnderwriting`
instead of just a flag in the assessment text. `underwriting.ts`'s dispatch is a pure `switch` on
`scoring.decision.action`, mirroring `verifier.ts`'s — no branching logic of its own, same as
Stage 2/3. `BeginUnderwriting`/`RejectUnderwriting` are dual-controller (`assessor, vetify`,
gated by `requireActiveAssessor`/`AuthorizedAssessor`); `FlagUnderwritingForManualReview` is
`vetify` alone (pure escalation, no assessor decision made yet) — mirroring
`FlagComplianceForManualReview`'s single-controller pattern over Stage 2's `FlagForManualReview`
(`verifier`-controlled) precedent.

`RiskAssessment` also carries `probabilityOfDefault`/`lossGivenDefault`/`exposureAtDefault`
(Basel-style PD/LGD/EAD) — these stay unpopulated by design: no calibrated model or historical
loan-outcome data exists yet to responsibly produce those figures, same reasoning as Stage 3's
CDD "purpose & profile coherence" gap (never fabricate a formula for a factor with no real data
source).

`UnderwritingScoringWeights` is on-ledger policy data on `UnderwritingPolicy` (`Vetify.Financing`,
keyed per `(vetify, financialInstitution)` — unlike Stage 2/3's vetify-wide singleton, since
underwriting risk appetite is an FI-specific decision), fetched the same way as
`VerificationPolicy`/`CompliancePolicy` and falling back to `DEFAULT_UNDERWRITING_WEIGHTS` if none
is active for that institution. Kept flat (not nested per-engine records) so `numifyWeights`'s
shallow string-to-number conversion (see the bug note below) keeps working unchanged.

**Two tiers of configurability, deliberately not one.** `UnderwritingScoringWeights` carries both
(a) **point values** — how many points a band is worth (`dscrHigh = 40`, engine-level combination
weights, `fraudReviewThreshold`) — and (b) **band boundaries** — the risk-tolerance cutoffs
themselves (`dscrHighThreshold = 1.5`, `creditScoreExcellentThreshold = 700`,
`stressTestHaircutMild/Moderate/Severe = 0.10/0.25/0.40`, etc.), covering DSCR, debt-ratio, cash-
reserve, revenue-variance, business-age, burn-rate, liquidity, and credit-score cutoffs across the
three affected engines. Both are genuine FI-specific risk-appetite decisions, so both are
policy-configurable. The **Fraud Detection engine's window/multiple constants** (`STRUCTURING_THRESHOLDS`,
`*_WINDOW_DAYS`, `*_MULTIPLE`, `VELOCITY_MIN_SAMPLE_SIZE` — all in `underwriting-fraud-detection.ts`)
are deliberately **not** promoted to policy data: they calibrate a rule-based pattern-matching
heuristic's shape (what counts as "suspiciously close together in time," what counts as a "round"
NGN amount tied to real reporting-threshold conventions), not a business risk-appetite dial — only
the four penalty *point values* for that engine are configurable, same as every other engine's
point values.

**Data gaps are handled the same principled way across all five engines**: an unavailable DSCR,
missing incorporation date, missing account balance, or missing tenure each contributes 0 to its
factor and raises a distinct `*_UNAVAILABLE`/`*_UNKNOWN` flag — never fabricated, and never
conflated with a confirmed adverse finding (e.g. `DSCR_UNAVAILABLE` vs. `DSCR_BELOW_ONE`,
`BUSINESS_AGE_UNKNOWN` vs. `NEW_BUSINESS`).

**Bug found and fixed while building the original single-engine version of this stage** (still
applies, unchanged by the five-engine split): the Daml v2 JSON Ledger API encodes `Int`/`Decimal`
fields as JSON strings (e.g. `"dscrHigh": "40"`), not just on write (already handled) but also on
**read** — a policy's `scoringWeights` fetched from the ledger arrives with every field as a
string, so summing them with `+` silently string-concatenates instead of adding. This was never
triggered before because only the `DEFAULT_*_WEIGHTS` TS constants (genuine numbers) had ever been
exercised in practice. Fixed via a shared `numifyWeights<T>()` helper (`agents/src/scoring/types.ts`)
applied at all three fetch sites: `verifier.ts`'s Stage 2 and Stage 3 weight fetches, and
`underwriting.ts`'s Stage 6 fetch.

---

## AI Agents

| Agent | Assists | Capabilities |
|---|---|---|
| **Verifier Agent** | verifier | Stage 2: identity, CAC reg, document validation, data consistency. Stage 3: AML screening, KYC, CDD, regulatory checks |
| **Underwriting Agent** | assessor | Financial analysis, cash flow, risk scoring; qualifies/rejects/flags businesses before financing eligibility ever reaches the FI |
| **Delinquency Monitor** | sentinel | Stage 9: deterministically scores missed-installment evidence, flags/clears/escalates delinquency — qualifies/flags before the FI acts, mirrors the Underwriting Agent's split |
| **Collections Agent** | financialInstitution | Direct Debit collection retries, GSM escalation — procedural workflows, kept separate from the delinquency decision above |
| **Reporting Agent** | management, regulator | Portfolio reports, compliance summaries, performance analytics; all metrics computed deterministically in code, LLM only writes the narrative |

The Verifier Agent merges the former Verification Agent (Stage 2) and Compliance Agent
(Stage 3) under one Canton party, `verifier` — vetify's own compliance team, not a third
party. It exposes two entry points, `runVerifierVerificationStage` and
`runVerifierComplianceStage` (`agents/src/agents/verifier.ts`), since the two stages watch
different template IDs, use different MCP tool sets, and load different skill content.

**Model C risk-gating** applies to both stages of the Verifier Agent — decided by the deterministic scoring engine (`agents/src/scoring/`, see above), not the LLM:
- Score ≥ 80 (Low risk) → auto-decided, choice exercised directly
- Score 50–79 (Medium risk) → flagged for human review via `FlagForManualReview`
- Score < 50 (High risk) → auto-rejected (Stage 2) or flagged; Stage 3 can only auto-reject on a hard-rule violation, never auto-approve (see above)

Default thresholds are in `agents/.env` (`RISK_THRESHOLD_AUTO_APPROVE`, `RISK_THRESHOLD_AUTO_REJECT`); the per-check point weights feeding into the score are `VerificationPolicy`/`CompliancePolicy`'s `scoringWeights`, not `.env`.

### Delinquency Monitor and Collections Agent (Stage 9)

`agents/src/agents/monitoring.ts` is split into two independent functions, both dispatched by the
Supervisor for every `Active`/`Delinquent` `MurabahahContract` — mirroring the Underwriting
Agent's evidence/decision split, but for a narrower reason: only the **delinquency flag/resume
decision** gets the deterministic-engine + real-party treatment. Direct Debit collection retries
and GSM escalation are sequential API-orchestration workflows, not a scored judgment call, so
they deliberately keep the LLM's full, unrestricted tool access — forcing them into the same
pattern would be over-engineering.

- **`runDelinquencyMonitor`** — evidence-only (mono.co `get_account_transactions`, **no `canton`
  MCP server at all** passed to the LLM), mirrors `underwriting.ts` exactly: the LLM relays a
  normalized transaction list, and `scoreDelinquency` (`agents/src/scoring/monitoring.ts`)
  computes `missedCount` and the resulting decision in code. `sentinel` (vetify's own
  portfolio-monitoring team, not a third party — same framing as `verifier`/`assessor`) makes
  the real call: `FlagDelinquent`/`ResumeActive` are dual-controller `[sentinel, vetify]` (vetify
  co-signs so the atomic `AuditEvent` creation is authorized), gated by the `AuthorizedSentinel`
  registry (`requireActiveSentinel`, fails closed if unregistered/deactivated).
- **`runCollectionsAgent`** (renamed from the pre-split `runMonitoringAgent`, logic unchanged) —
  keeps full `canton`+`mono` tool access for Direct Debit retries and GSM escalation
  (`skills/collections`).

**Why this isn't the same shape as Stage 2/3/6's Medium band**: unlike genuinely insufficient or
conflicting evidence, one missed payment alone isn't ambiguous — it's just early. `scoreDelinquency`
escalates to a human sentinel (`FlagForDelinquencyReview`, `vetify` alone — pure escalation, no
sentinel decision made yet, mirrors `FlagUnderwritingForManualReview`) specifically when: exactly
one installment is missed (too early to distinguish a real default from a processing delay), or
two-or-more appear missed but a bank credit roughly matching the installment amount was found
within the last 7 days (a plausible unrecorded payment). Two-or-more missed with no offsetting
credit auto-flags (`FlagDelinquent`); a business back on schedule auto-clears (`ResumeActive`).
The new `DelinquencyManualReview` status is deliberately **not** re-polled by the Supervisor once
set (mirrors verifier/assessor's `ManualReview`/`UnderwritingManualReview` precedent) — only a
human sentinel resolves it, via the ACP `skills/monitoring-review` skill.

### Shariah Compliance Agent

A standalone agent, dispatched directly by the Supervisor as its own step whenever a
`ComplianceReview` is `Pending` with `shariahVerdict = None` — i.e. before the Verifier
Agent's compliance stage runs at all, not as a nested call from within it. Its verdict is
persisted on-ledger via `RecordShariahPreCheck` (`ComplianceReview.shariahVerdict`), so the
Verifier Agent's compliance stage simply reads it from the contract payload rather than
invoking the Shariah Agent itself. It is a hard gate: a `NON_COMPLIANT` verdict immediately
triggers `RejectCompliance` without executing any Youverify API calls.

**The verdict authority is a deterministic keyword table** (`classifyShariahCompliance()` in
`agents/src/scoring/shariah-policy.ts`, ported from `prohibited-sectors.md`), not the LLM —
see "Off-Ledger Deterministic Scoring" above. Any sector/financing-structure the table
recognizes resolves with no LLM call at all. The RAG/LLM pipeline below is only ever
consulted when the table has *no* match (a genuinely novel sector), and even then only to
produce a citation-backed narrative — the verdict in that case is always fixed to
`REQUIRES_REVIEW` regardless of what the LLM writes.

**Architecture:**
- `agents/src/scoring/shariah-policy.ts` — `classifyShariahCompliance(businessSector, businessActivity, financingPurpose): ShariahClassification` — the deterministic table lookup
- `agents/src/agents/shariah.ts` — exported function `runShariahAgent(businessSector, businessActivity, financingPurpose): Promise<ShariahResult>`; checks the table first, only invokes the RAG/LLM agent below on a table miss; no ledger-write access at all
- `agents/src/agents/supervisor.ts` — dispatches the Shariah Agent, then calls `RecordShariahPreCheck` directly against the ledger, `party: ["advisor", "vetify"]`
- `agents/src/mcp/shariah-server.ts` — two MCP tools: `query_shariah_ruling` and `check_prohibited_sector`
- `agents/src/rag/shariah/ingest.ts` — one-time PDF ingestion script (run once per PDF update)
- `agents/src/rag/shariah/retriever.ts` — lazy FaissStore singleton loaded by the MCP server

**`advisor` — a genuinely independent party, not "vetify's own team."** Unlike
`verifier`/`assessor`/`sentinel` (all framed as vetify's own staff), AAOIFI governance
standards require the Shari'a Supervisory Board to be independent of management — so
`advisor` is modeled like `riskCommittee` instead. `RecordShariahPreCheck` is dual-controller
`[advisor, vetify]` (`ComplianceReview`'s signatory is `vetify` alone, so `create this`
needs vetify's co-signature — the same class of issue `BeginUnderwriting`/`FlagDelinquent`
also have), gated by `requireActiveAdvisor` (`AuthorizedAdvisor` registry, fails closed if
unregistered/deactivated; the caller supplies that registry entry's `ContractId` as
`advisorCid`, no ledger-side lookup on SDK 3.4.11/LF 2.2).

**`SupersedeShariahVerdict`** — a post-hoc audit correction for an erroneous verdict, mirroring
`Supersede` on `VerificationResult`/`ComplianceResult` exactly, including the deliberate choice of
controller `vetify` alone (Option A: `advisor`, who made the original call, cannot
unilaterally correct its own past decision). Requires a previously-recorded `shariahVerdict`;
usable regardless of `ComplianceReview.status` (a documented correction for the record, not a
reversal of whatever already happened downstream — same scope as the existing `Supersede`
choices). Creates a `ShariahVerdictCorrection` audit record preserving the original verdict
alongside the correction.

**Human review path**: a `REQUIRES_REVIEW` verdict (or any verdict an advisor has
independent reason to question) can be reviewed by a human Shari'a advisor via the ACP
`vetify-shariah` agent (`skills/shariah-review`) — full `shariah` + `canton` MCP tool access,
safe specifically because a human is present watching every tool call. This is separate from the
Verifier Agent's general compliance `ManualReview` queue (`skills/verifier-review`), which a
`REQUIRES_REVIEW` verdict also still triggers for the AML/KYB side — the two paths cover
different expertise (fiqh judgment vs. AML/CDD judgment) over the same underlying case.

**Knowledge Base (RAG):**
- AAOIFI Shari'a Standards — in particular Standard No. 8 (Murabahah), No. 28 (Prohibited Activities), No. 40 (Distribution of Profit)
- CBN Non-Interest Financial Institutions (NIFI) Framework — Nigerian regulatory overlay
- Place PDFs in `agents/data/shariah/` and run `npm run rag:ingest:shariah` to index them
- Vector store persisted to `agents/data/shariah-vectorstore/` (FAISS, git-ignored)
- Embeddings: OpenAI `text-embedding-3-small`; chunk size 1200, overlap 200

**Verdicts and Downstream Effect:**

| Verdict | Condition (table-driven) | Verifier Agent (compliance stage) Action |
|---|---|---|
| `COMPLIANT` | Matched a permissible-sector keyword | `shariahCompliant: true`; proceed to AML/KYB |
| `REQUIRES_REVIEW` | Matched a mixed/ambiguous-sector keyword, **or** no table match at all (fail-closed default) | `shariahCompliant: false`; run AML/KYB but force `FlagComplianceForManualReview` |
| `NON_COMPLIANT` | Matched a prohibited-sector keyword or a prohibited financing-structure keyword (e.g. "refinancing", "working capital", "cash advance") | `shariahCompliant: false`; immediately exercise `RejectCompliance` |

**Setup sequence (first time):**
```bash
# 1. Place AAOIFI and CBN NIFI PDFs in agents/data/shariah/
# 2. Index them into FAISS
npm run rag:ingest:shariah
# 3. Start the Shariah MCP server (in its own terminal)
npm run mcp:shariah
```

Full setup guide including PDF naming conventions, environment variables, verification steps, and troubleshooting: `agents/docs/shariah-rag.md`

### Reporting Agent

Same trust-boundary fix as Stage 6/9, applied to portfolio aggregation: `aggregatePortfolio()`
(`agents/src/scoring/reporting.ts`) computes every `PortfolioReport` number in code — total
active contracts, total disbursed, total outstanding, delinquency rate, completion rate — from
the queried `MurabahahContract` list. The LLM's only remaining job is writing the 2-3 paragraph
narrative from those pre-computed numbers (`skills/reporting`), with no ledger-write tool access
at all; `runReportingAgent` (`agents/src/agents/reporting.ts`) creates the `PortfolioReport`
contract directly afterward.

Unlike Stage 2/3/6/9, this doesn't get a new party or registry: aggregation isn't a judgment call
with a "who is accountable for this decision" question to close (there's no real decision-maker
role analogous to verifier/assessor/sentinel/advisor here), so `vetify` remains the signatory.

---

## Agent Project (`agents/`)

TypeScript project using **deepagents** (v1.10.5) — a batteries-included agent harness built on LangGraph.

```
agents/
├── src/
│   ├── index.ts                  # entry point — starts the Supervisor
│   ├── acp.ts                    # ACP server — exposes agents to IDEs via stdio
│   ├── types/index.ts            # shared types: RiskLevel, ReviewStatus, RiskDecision
│   ├── agents/
│   │   ├── supervisor.ts         # polls Canton ledger, routes to sub-agents
│   │   ├── verifier.ts           # Stages 2+3 — identity/CAC/BVN/NIN, then AML/KYC/CDD (merged Verifier Agent)
│   │   ├── shariah.ts            # Standalone Shariah pre-check via RAG, dispatched before Stage 3
│   │   ├── underwriting.ts       # Stage 6 — cash flow, DSCR scoring via mono.co
│   │   ├── monitoring.ts         # Stage 9 — runDelinquencyMonitor (evidence-only, scoring engine decides)
│   │   │                         # + runCollectionsAgent (Direct Debit/GSM, unchanged full tool access)
│   │   └── reporting.ts          # Ongoing — queries+creates PortfolioReport; LLM writes narrative only
│   ├── mcp/
│   │   ├── canton-client.ts      # Canton JSON Ledger API (v2) client — shared by canton-server.ts and supervisor.ts
│   │   ├── canton-server.ts      # MCP server: Canton ledger tools (query, exercise, create), thin wrapper over canton-client.ts
│   │   ├── mono-server.ts        # MCP server: all mono.co products (see below)
│   │   ├── youverify-server.ts   # MCP server: AML/PEP screening, adverse media, KYB (Youverify)
│   │   └── shariah-server.ts     # MCP server: Shariah RAG (query_shariah_ruling, check_prohibited_sector)
│   ├── scoring/                  # deterministic Stage 2/3 decision engine — see "Off-Ledger
│   │   ├── types.ts              # Deterministic Scoring" above; no LLM involved in this directory
│   │   ├── verification.ts       # scoreVerification() — Stage 2
│   │   ├── compliance.ts         # scoreCompliance() — Stage 3
│   │   ├── underwriting*.ts      # five-engine Stage 6 scorer (see "Stage 6" section above)
│   │   ├── monitoring.ts         # scoreDelinquency() — Stage 9 delinquency decision
│   │   ├── shariah-policy.ts     # classifyShariahCompliance() — sector/structure keyword table
│   │   ├── reporting.ts          # aggregatePortfolio() — Ongoing PortfolioReport metrics
│   │   └── *.test.ts             # node:test unit tests
│   └── rag/
│       └── shariah/
│           ├── ingest.ts         # one-time PDF ingestion → FAISS vector store
│           └── retriever.ts      # lazy singleton FaissStore loader
├── data/
│   ├── shariah/                  # place AAOIFI + CBN NIFI PDFs here before ingestion
│   └── shariah-vectorstore/      # generated by rag:ingest:shariah (git-ignored)
├── .mcp.json                     # MCP server config — auto-discovered by dcode CLI
├── .env.example                  # all required environment variables
├── package.json
└── tsconfig.json
```

### mono.co Products Used

| Tool | mono.co Product | Stage |
|---|---|---|
| `lookup_mashup` | Lookup — NIN + BVN + DOB in one call | 2 Verifier (verification stage) |
| `lookup_cac` | Lookup — CAC registry check | 2 Verifier (verification stage) |
| `lookup_tin` | Lookup — Tax ID / TIN verification | 2 Verifier (verification stage) |
| `lookup_credit_history` | Lookup — CRC & First Central bureau | 3 Verifier (compliance stage) |
| `prove_initiate` | Prove — Tiered KYC with facial recognition | 2/3 |
| `get_account_statement` | Connect — Bank statement retrieval | 6 Underwriting |
| `get_account_transactions` | Connect — Enriched transaction data | 6 Underwriting |
| `assess_creditworthiness` | Creditworthiness — DSCR-based credit score | 6 Underwriting |

### Agent Commands

```bash
cd agents
npm install

# Unit tests for the deterministic scoring engine (agents/src/scoring/)
npm test

# One-time Shariah RAG ingestion (place AAOIFI + CBN PDFs in data/shariah/ first)
npm run rag:ingest:shariah

# Start MCP servers (each in its own terminal)
npm run mcp:canton      # Canton ledger operations
npm run mcp:mono        # mono.co: Lookup, Prove, Connect, Creditworthiness
npm run mcp:youverify   # Youverify: AML/PEP screening, adverse media, KYB
npm run mcp:shariah     # Shariah RAG: query_shariah_ruling, check_prohibited_sector

# Start the Supervisor agent (polls ledger and dispatches sub-agents)
npm run dev

# Start ACP server — connects agents to VS Code / Zed / JetBrains IDEs via stdio
npm run acp

# Interactive agent development via Deep Agents Code CLI
# (auto-discovers agents/.mcp.json; use /mcp inside to inspect server status)
dcode
```

### ACP (Agent Client Protocol) — `src/acp.ts`

ACP exposes Vetify agents to IDE assistants (VS Code Copilot, JetBrains AI Assistant, Zed) via the `deepagents-acp` package.

Five agents are registered (the autonomous Shariah Agent itself still runs standalone via the
Supervisor, not through ACP — `vetify-shariah` below is a separate, human-review-only agent):

| Agent | Skills |
|---|---|
| `vetify-verifier` | `skills/verifier-review` — full tool access (incl. `exercise_choice`/`create_contract`), human-supervised |
| `vetify-underwriting` | `skills/underwriting-review` — full tool access, human-supervised → BeginUnderwriting/RejectUnderwriting |
| `vetify-monitoring` | `skills/monitoring-review` — full tool access, human-supervised → FlagDelinquent/ResumeActive |
| `vetify-shariah` | `skills/shariah-review` — full tool access (`shariah` + `canton` MCP), human-supervised → SupersedeShariahVerdict |
| `vetify-reporting` | `skills/reporting` — portfolio aggregation → PortfolioReport creation |

**`vetify-verifier`/`vetify-underwriting`/`vetify-monitoring`/`vetify-shariah` here are intentionally different skills from the Supervisor's.** The autonomous Supervisor paths (`agents/src/agents/verifier.ts`/`underwriting.ts`/`monitoring.ts`'s `runDelinquencyMonitor`/`shariah.ts`) load `skills/verifier`/`skills/underwriting`/`skills/monitoring` (and, for Shariah, the deterministic table in `scoring/shariah-policy.ts` directly, no skill-gated tool access at all) — evidence-gathering only, no `exercise_choice`/`create_contract` tool access, so the LLM is architecturally incapable of deciding (see "Off-Ledger Deterministic Scoring" above). These ACP agents load `skills/verifier-review`/`skills/underwriting-review`/`skills/monitoring-review`/`skills/shariah-review` and *do* have full tool access, because a human officer is present in the session watching every tool call — that supervision is the safety mechanism here, not a capability restriction. Each is only ever invoked on contracts already flagged for manual review or a recorded verdict worth questioning: cases the deterministic scoring engine explicitly could not resolve on its own (Medium-risk band, a serious CAC name mismatch, Shariah `REQUIRES_REVIEW`, or Stage 3's CDD purpose/proportionality judgment for the Verifier Agent; Medium-risk `UnderwritingManualReview` for the Underwriting Agent; ambiguous `DelinquencyManualReview` for the Delinquency Monitor; any recorded Shariah verdict for `vetify-shariah`). `vetify-monitoring`'s Direct Debit/GSM counterpart, the Collections Agent, has no ACP presence — it's a procedural workflow, not a decision needing human review.

Start with `npm run acp` in the `agents/` directory. The IDE will discover it automatically via the stdio transport.

### `.mcp.json` — MCP Server Config File

`agents/.mcp.json` declares all four MCP servers in the standard Deep Agents config format:

```json
{
  "mcpServers": {
    "canton":    { "command": "npm", "args": ["run", "mcp:canton"] },
    "mono":      { "command": "npm", "args": ["run", "mcp:mono"] },
    "youverify": { "command": "npm", "args": ["run", "mcp:youverify"] },
    "shariah":   { "command": "npm", "args": ["run", "mcp:shariah"] }
  }
}
```

This file is auto-discovered by the `dcode` CLI (Deep Agents Code) when run from `agents/`. It is also referenced directly by `acp.ts` — each agent's `mcpServers` config follows the same format. Config files at `~/.deepagents/.mcp.json` (user-level) and `<project>/.deepagents/.mcp.json` are also merged in if present.

Two use modes:
- **`dcode`** — interactive terminal session for developing and debugging agents; `/mcp` shows server status and loaded tools
- **`npm run acp`** — headless ACP server for IDE integration (VS Code, JetBrains, Zed)

### Skills Directory

```
agents/skills/
├── verifier/                            # Supervisor path — evidence-gathering only, no exercise_choice access
│   ├── SKILL.md                        # report mono.co/Youverify results as JSON; scoring engine decides
│   └── references/
│       ├── risk-scoring-guide.md       # per-check score table, Model C thresholds
│       ├── mono-api-responses.md       # mono.co response field definitions
│       ├── aml-decision-guide.md       # Youverify status values, false positive handling
│       └── cdd-framework.md            # 100-point CDD scoring breakdown, hard override rules
├── verifier-review/                     # ACP/HITL path — full tool access, human-supervised
│   └── SKILL.md                        # assist an officer completing a ManualReview case
├── shariah/
│   ├── SKILL.md                        # 6-step Shariah RAG workflow, verdict JSON format
│   └── references/
│       ├── prohibited-sectors.md       # absolute prohibitions, mixed business thresholds
│       └── aaoifi-standards-index.md   # AAOIFI Std No. 8, 28, 40; CBN NIFI index; citation format
├── shariah-review/                       # ACP/HITL path — full tool access, human-supervised
│   └── SKILL.md                        # assist an advisor reviewing/superseding a verdict
├── underwriting/                        # Supervisor path — evidence-gathering only, no exercise_choice access
│   ├── SKILL.md                        # relay normalized transactions; five deterministic engines decide
│   └── references/
│       ├── dscr-guide.md               # DSCR calculation, thresholds, recommended limit formula
│       └── mono-underwriting-fields.md # mono.co creditworthiness response field definitions
├── underwriting-review/                 # ACP/HITL path — full tool access, human-supervised
│   └── SKILL.md                        # assist an assessor completing an UnderwritingManualReview case
├── monitoring/                           # Supervisor path — evidence-gathering only, no exercise_choice access
│   └── SKILL.md                        # relay recent transactions; scoreDelinquency decides
├── monitoring-review/                    # ACP/HITL path — full tool access, human-supervised
│   └── SKILL.md                        # assist a sentinel completing a DelinquencyManualReview case
├── collections/                          # Direct Debit retries + GSM escalation — procedural, not scored
│   └── SKILL.md                        # runCollectionsAgent's workflow, unchanged from the pre-split design
└── reporting/
    └── SKILL.md                        # portfolio metrics, PortfolioReport contract creation
```

Skills use YAML frontmatter (`name`, `description`) and progressive loading: metadata at startup, body on invocation, references on demand.

### Key Design Points

Phase 1 hardening (review gaps G3/G6/G9, `docs/platform-review-2026-07.md`) added three cross-cutting behaviours to every agent:
- **Evidence schema validation + prompt fencing** (`agents/src/agents/util.ts` + `evidence-schemas.ts`): every LLM evidence reply is zod-validated via `parseEvidence` before any scoring engine consumes it (malformed/injection-shaped evidence fails closed — no decision reaches the ledger), business-influenced text interpolated into prompts is wrapped in `<untrusted_data>` fencing paired with `UNTRUSTED_DATA_GUIDANCE`, and the one piece of LLM-authored prose persisted on-ledger (`PortfolioReport.summary`) is length-capped. The old per-file `extractJson` (greedy first-`{`-to-last-`}` regex) is gone — the shared extractor prefers fenced ```json blocks then does a balanced-brace scan.
- **LLM resilience** (`withLlmResilience`, G9): every `agent.invoke` has a timeout (`LLM_TIMEOUT_MS`, default 180s) and bounded retries (`LLM_MAX_ATTEMPTS`, default 2) — safe because evidence gathering is side-effect-free and all downstream decisions are deterministic. All outbound provider fetches (mono.co, Youverify, Canton) carry 30s `AbortSignal` timeouts.
- **Collections write path fixed** (G6, live-verified): `create_contract` takes a `party` param (`vetify` default, `financialInstitution` allowed) because `DirectDebitCollectionAttempt`/`GSMInvocation` are FI-signed; the MCP `PARTY` enum also gained `sentinel`/`advisor`/`financialInstitution` (the Stage 9 dispatch would previously have failed the MCP schema before reaching the ledger). Party custody rules: `docs/secrets-custody.md`; all `CANTON_*_JWT`s support the `<NAME>_FILE` secret-mount convention (G2).
- `server.registerTool()` is used throughout (MCP SDK v1.x API — not the deprecated `server.tool()`)
- `MultiServerMCPClient` config key is `mcpServers` (not `servers` or top-level keys)
- `createDeepAgent()` is synchronous — no `await`
- **`FilesystemBackend` is required for skills to load** — without it the `skills` array is silently ignored. All agents use `new FilesystemBackend({ rootDir: ".", virtualMode: true })`
- **`MemorySaver` checkpointer is required** for human-in-the-loop interrupts (Model C Medium risk flagging); all agents include it
- `acp.ts` passes `mcpServers` config objects directly to each agent in `startServer` (same format as `.mcp.json`) — no manual `MultiServerMCPClient` instantiation needed
- `verifier.ts` (Supervisor path) still uses `MultiServerMCPClient` programmatically — it runs headlessly and needs explicit tool lists
- The Supervisor polls Canton every 10 s and delegates based on contract status. Three orchestration behaviours from the Phase 0 review fixes (`docs/platform-review-2026-07.md` G5a/G7): every dispatch is individually try/caught (one contract's failure doesn't abort the tick); Stage 9 monitoring/collections run as a **daily** sweep, not per-tick (the per-tick version was one LLM evidence pass per Active contract every 10 s); the monthly `PortfolioReport` cursor is derived from the **ledger** (latest `PortfolioReport.reportDate`), not in-memory state, so restarts don't mint duplicate reports. `agents/src/config.ts` fail-fast-validates all party IDs at startup (placeholder `X::...` values count as unset) — `CANTON_FI_PARTY`/`CANTON_REGULATOR_PARTY` role-name vars were replaced by real `CANTON_FI_PARTY_ID`/`CANTON_REGULATOR_PARTY_ID`
- The Underwriting Agent Shariah-screens `FinancingRequest.terms.purpose` deterministically (`classifyFinancingPurpose`, `scoring/shariah-policy.ts`) **before** spending an LLM evidence pass — Stage 3's pre-check necessarily ran with a placeholder purpose (the request didn't exist yet), so prohibited structures (refinancing/working capital/cash advance) and prohibited-sector keywords in the purpose text hard-veto via `RejectUnderwriting` here (review gap G4)
- Agents are stateless per invocation — LangSmith traces every run for observability
- `CANTON_VETIFY_JWT`, `CANTON_VERIFIER_JWT`, and `CANTON_ASSESSOR_JWT` are separate JWTs for each Canton party; the matching `CANTON_*_PARTY_ID` vars are the actual on-ledger Party identifiers the v2 JSON Ledger API needs explicitly (a JWT alone isn't the party identifier — see below). Dual-controller choices (`Onboarding.Approve`/`Reject`, `Financing.BeginUnderwriting`/`RejectUnderwriting`) need every controller's party ID in `actAs` — `exercise_choice`'s `party` field accepts either a single party string or an array (`canton-client.ts`'s `exerciseLedgerChoice`/`canton.ts`'s `exerciseChoice`)
- `supervisor.ts` no longer makes direct ledger `fetch` calls — `queryContracts`/`recordShariahPreCheck` are thin wrappers over `canton-client.ts`, the same client `canton-server.ts`'s MCP tools use

---

## Privacy Model

Canton's sub-transaction privacy means each party only sees contracts where they are a signatory or observer. Key rules:
- Businesses see only their own contracts.
- Financial institutions access only financing requests and contracts directed to them.
- The verifier party accesses only verification- and compliance-related contracts.
- Regulators observe `MurabahahContract` and `PortfolioReport` only.
- No participant can see another business's data.

---

## Key Daml Concepts

- **Signatory**: party whose authority creates/archives a contract; must authorize creation.
- **Observer**: can see a contract but cannot act on it.
- **Choice**: an action a party exercises on a contract, producing new contracts or archiving the current one.
- **`daml-script`**: test/scripting library for ledger interaction scenarios; add `import Daml.Script` when writing test `Script` values.
