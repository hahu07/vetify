# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vetify is an **AI-powered non-interest private credit infrastructure platform** built on the Canton blockchain (Daml). It connects Nigerian SME borrowers with licensed financial institutions through a fully digital **Murabahah financing workflow** — from onboarding and KYC through underwriting, contract execution, repayment monitoring, and regulatory reporting.

Four AI agents (Verifier, Underwriting, Monitoring, Reporting) plus a standalone Shariah pre-check agent assist human decision-makers at each stage but do not replace authorized approvals. The Canton ledger provides multi-party privacy, immutable audit trails, and regulatory-friendly data sharing.

**Off-ledger deterministic scoring**: the LLM-based agents do not decide Stage 2/3 outcomes. They gather evidence (calling mono.co/Youverify tools) and report it as structured JSON; a deterministic scoring engine (`agents/src/scoring/`) computes the score, checks, and decision from that evidence, and only that engine's output is ever used to exercise a Canton choice. See "Off-Ledger Deterministic Scoring" below.

- **Daml SDK**: 3.5.1 / **LF target**: 2.3 (contract keys enabled via `build-options: [--target=2.3]` in `daml.yaml`)
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
- PQS image: `europe-docker.pkg.dev/da-images/public/docker/scribe:3.5.1` — **must match this project's `sdk-version` in `daml.yaml`**; an older Scribe (e.g. `0.6.11`) cannot parse packages built with `--target=2.3` and crash-loops with `NoSuchElementException: key not found: LanguageMinorVersion(3)` before ever creating its Postgres schema (verified live — see `docs/production-readiness-backlog.md`'s "PQS/Scribe sidecar" entry). SQL function: `active('Vetify.<Module>:TemplateName')` (e.g. `active('Vetify.Murabahah:MurabahahContract')`); payload stored as JSONB
- `docker-compose.yml`'s `pqs` service runs with `network_mode: host` — `dpm sandbox`'s gRPC Ledger API binds `127.0.0.1` only (no bind-address override exists for the `sandbox` subcommand), which is unreachable from a bridge-networked container regardless of `host.docker.internal`/`extra_hosts` DNS fixes; host networking sidesteps this entirely (verified live)

> **Migrated from the classic v1 HTTP JSON API** (`/v1/query`/`/v1/create`/`/v1/exercise`) to the **v2 JSON Ledger API** — verified empirically against a real local sandbox that v1 endpoints don't exist on Canton 3.5.1's bundled JSON API (`dpm sandbox --json-api-port` serves v2 natively; confirmed `/v2/parties` → 200 vs `/v1/*` → 404). `canton.ts` reverse-engineered the v2 request/response shapes against a live sandbox (no OpenAPI spec is bundled) and preserved its `queryContracts`/`exerciseChoice`/`createContract` signatures exactly, so `onboarding.ts`/`financing.ts`/`contracts.ts`/`policy.ts` needed zero changes. Full history and the specific gotchas (explicit `actAs`/`userId`/party-ID requirements, `Int`/`Decimal` fields needing string encoding) in `docs/production-readiness-backlog.md`'s "✅ Resolved" entry.

### Backend Routes (`backend/src/routes/`)

| File | Mounted at | Covers |
|---|---|---|
| `onboarding.ts` | `/api/onboarding` | Stages 1–4: Onboarding, Verification, Compliance, ApprovedBorrower |
| `financing.ts` | `/api/financing` | Stages 5–7: Financing Request, Underwriting, FI decision |
| `contracts.ts` | `/api/contracts` | Stages 8–10: Murabahah contract, repayments, closure, portfolio reports |
| `policy.ts` | `/api/policy` | Cross-cutting: `VerificationPolicy`/`CompliancePolicy` propose→approve/reject workflow, `PolicyApprover` registry (register/deactivate/reactivate) — see "Policy & Governance Templates" below |
| `providers.ts` | `/api/providers` | Stage 0: `FinancingProviderOnboarding` lifecycle (create/submit/approve/reject/amend), `ApprovedProvider` list (the credential `ApproveFunding` requires), `AuthorizedOfficer` registry (register/deactivate/reactivate) — gates `financing.ts`'s `ApproveFunding` route |

## Common Commands

```bash
# Compile the Daml source
daml build

# Run all Daml Script tests
daml test

# Run tests scoped to a single file
daml test --files daml/Vetify/Tests/OnboardingTests.daml

# Start local Canton sandbox + HTTP JSON API (gRPC on :6865, HTTP JSON API on :7575)
daml start

# Start PostgreSQL + PQS (Scribe) sidecar
docker compose up -d

# Start backend API server
cd backend && npm run dev

# Open Daml Studio (VS Code with Daml language extension)
daml studio

# Lint (config in .dlint.yaml)
daml lint
```

---

## Participants (Canton Parties)

| Party | Role |
|---|---|
| `borrower` | SME seeking financing; creates onboarding, submits financing requests, makes repayments |
| `vetify` | Platform orchestration layer; coordinates all workflow transitions |
| `financialInstitution` | Provides financing; makes final approval, executes Murabahah contract |
| `verifier` | Vetify's own compliance team; decision authority for both Stage 2 identity/KYC verification and Stage 3 AML/KYB/CDD compliance review — not a third party |
| `regulator` | Read-only supervisory observer; receives portfolio and compliance reports |
| `riskCommittee` | Vetify's own Risk & Credit Governance Committee (`docs/risk-governance-charter.md`) — genuinely distinct from `vetify`, independently endorses scoring-policy changes before `vetify` can activate them (Layer 2 of the Policy-Approval Security Roadmap, see below) |

---

## Financing Lifecycle (10 Stages)

```
Stage 1   Borrower Onboarding       borrower submits profile + KYC docs
Stage 2   Verification              Verifier Agent validates identity, CAC reg, documents
Stage 3   Compliance Review         Verifier Agent performs AML, CDD, regulatory checks
Stage 4   Borrower Approval         borrower becomes eligible for financing
Stage 5   Financing Request         borrower submits amount, purpose, tenure
Stage 6   AI Underwriting           Underwriting Agent scores risk, recommends limit
Stage 7   Financing Review          financialInstitution makes final Approve/Reject decision
Stage 8   Murabahah Execution       asset purchased + sold to borrower at disclosed profit margin
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
| `Vetify.Compliance` | `ComplianceReview`, `ComplianceResult`, `ApprovedBorrower` | 3–4 |
| `Vetify.Financing` | `FinancingRequest`, `UnderwritingResult`, `FinancingDecision` | 5–7 |
| `Vetify.Murabahah` | `MurabahahWad`, `MurabahahWakala`, `AssetPurchaseRecord`, `MurabahahProposal`, `MurabahahContract`, `RepaymentRecord`, `IbraRequest`, `LatePaymentCharity`, `RahnAgreement`, (+ many more — see file) | 7→10 |
| `Vetify.Reporting` | `PortfolioReport` | ongoing |
| `Vetify.Governance` | `AuthorizedOfficer` (FI-side officer registry/RBAC), `PolicyApprover` (vetify-side scoring-policy approver registry); leaf module, no imports at all | cross-cutting |

> The tables below cover the core lifecycle templates and this session's policy/governance additions. Both `Financing.daml` and `Murabahah.daml` have grown substantially beyond what's itemized here (dozens of supporting templates for collections, disputes, collateral, regulatory records, etc.) — check the file directly for the full template list rather than treating this table as exhaustive.

Import DAG (acyclic): `Compliance → Financing → Murabahah`; `Onboarding`, `Reporting` depend only on `Types`. Tests live in `daml/Vetify/Tests/`. See `docs/daml-review.md` for the refactor rationale.

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
| `MurabahahStatus` | Active, Delinquent, Completed, Defaulted |

### Templates

| Template | Signatory | Observer(s) | Stage |
|---|---|---|---|
| `BusinessOnboarding` | borrower | vetify, verifier | 1–4 |
| `VerificationResult` | **verifier** | vetify, borrower | 2 |
| `ComplianceReview` | vetify | verifier, borrower | 3 |
| `ComplianceResult` | vetify | verifier, borrower | 3 |
| `ApprovedBorrower` | vetify | borrower | 4 |
| `FinancingRequest` | borrower | vetify, financialInstitution | 5 |
| `UnderwritingResult` | vetify | financialInstitution, borrower | 6 |
| `FinancingDecision` | financialInstitution | borrower, vetify | 7 |
| `MurabahahWad` | borrower | financialInstitution, vetify | 7→8 |
| `MurabahahWakala` | financialInstitution | borrower, vetify | 8 |
| `AssetPurchaseRecord` | financialInstitution | borrower, vetify | 8 |
| `MurabahahProposal` | financialInstitution | borrower, vetify | 8 |
| `MurabahahContract` | **borrower, financialInstitution** | vetify, regulator | 8 |
| `RepaymentRecord` | borrower, financialInstitution | vetify, regulator | 9 |
| `IbraRequest` | borrower | financialInstitution, vetify | 9–10 |
| `LatePaymentCharity` | financialInstitution | borrower, vetify | 9 |
| `RahnAgreement` | **borrower, financialInstitution** | vetify | 8–10 |
| `PortfolioReport` | vetify | financialInstitution, regulator | ongoing |

> **Murabahah acquisition chain** (AAOIFI Std No. 8): `ApproveFunding` → `MurabahahWad` (borrower's irrevocable promise) → FI chooses `ProceedWithWakala` (appoints borrower as agent) or `ProceedDirectly` → `AssetPurchaseRecord` (FI ownership evidence) → borrower exercises `AcknowledgeDelivery` (Qabdh) → FI exercises `OfferMurabahah` → `MurabahahProposal` → borrower exercises `AcceptProposal` → bilateral `MurabahahContract`. The regulator observes only the accepted contract, not any prior step.

### Key Choices per Template

**BusinessOnboarding** (LF 2.3 contract key: `(borrower, kyc.cacRegNumber)` — ledger-enforced uniqueness)
- `SubmitForReview` (borrower) → status: UnderReview; records `submittedAt`
- `Approve` (**verifier, vetify** dual-controller — vetify co-signs so the `VerificationPolicy` lookupByKey is authorized) → creates `VerificationResult`; key released (no active onboarding remains)
- `Reject` (verifier, vetify) → creates `VerificationResult` with reason; key released
- `FlagForManualReview` (verifier agent) → status: ManualReview; stores `agentScore`, `agentRisk`, `agentNote`, `agentVersion`
- `RequestAmendment` (vetify) → status: PendingAmendment
- `Amend` (borrower) → status: Draft; clears agent scoring; `amendmentCount + 1` (max 5; CAC number immutable)

**ComplianceReview**
- `StartReview` (vetify) → status: UnderReview
- `RecordShariahPreCheck` (vetify) → records the standalone Shariah Agent's verdict (`shariahVerdict` field); does not transition status
- `ApproveCompliance` (verifier) → creates `ApprovedBorrower` + `ComplianceResult`
- `RejectCompliance` (verifier) → creates `ComplianceResult` (outcome=Rejected, reason on-ledger)
- `FlagComplianceForManualReview` (vetify agent) → status: ManualReview

**ApprovedBorrower**
- `RequestFinancing` (borrower, **nonconsuming** — supports repeat facilities) → creates `FinancingRequest`

**FinancingRequest**
- `BeginUnderwriting` (vetify) → status: Underwriting; creates `UnderwritingResult`
- `ApproveFunding` (financialInstitution, `assetDetails : AssetDetails`) → creates `MurabahahWad` (borrower's irrevocable promise to purchase)
- `RejectFunding` (financialInstitution) → creates `FinancingDecision` (reason on-ledger)

**MurabahahWad** (borrower's irrevocable promise — AAOIFI Std No. 8, §2/2)
- `ProceedWithWakala` (financialInstitution) → creates `MurabahahWakala` (agency appointment)
- `ProceedDirectly` (financialInstitution, `actualCost, purchaseDate, invoiceRef`) → creates `AssetPurchaseRecord` with `purchasedViaWakala = False`
- `WithdrawWad` (borrower, `reason`) → archives (supplier unavailable / changed circumstances)

**MurabahahWakala** (agency agreement — AAOIFI Std No. 23)
- `RecordAssetPurchase` (borrower, `actualCost, purchaseDate, invoiceRef`) → creates `AssetPurchaseRecord` with `purchasedViaWakala = True`
- `DeclineAgency` (borrower, `reason`) → archives; FI must buy directly

**AssetPurchaseRecord** (FI ownership evidence + Qabdh gate — AAOIFI Std No. 8, §3/1)
- `AcknowledgeDelivery` (borrower) → `deliveryAcknowledged = True`; required before `OfferMurabahah`
- `OfferMurabahah` (financialInstitution, `murabahahTerms, paymentSchedule, regulator, startDate`) → creates `MurabahahProposal`; gated by Qabdh; enforces `assetCost == actualCost`

**MurabahahProposal** (FI's formal sale offer — Ijab)
- `AcceptProposal` (borrower) → creates bilateral `MurabahahContract` (Qabul)
- `DeclineProposal` (borrower, `reason`) → archives

**MurabahahContract** (`ensure salePrice == assetCost + profitAmount`)
- `RecordPayment` (financialInstitution) → creates `RepaymentRecord` + optional `LatePaymentCharity` if `paymentDate > dueDate`. Guards: `amountPaid > 0`, no overpayment, strict installment sequence. Status **preserved** (partial payment does not auto-cure delinquency).
- `FlagDelinquent` (vetify) → Active → Delinquent
- `ResumeActive` (vetify) → Delinquent → Active (arrears cleared by Monitoring Agent)
- `DefaultContract` (financialInstitution) → Delinquent → Defaulted (write-off)
- `CloseContract` (financialInstitution) → Completed (requires `outstandingBalance <= 0`)
- `RequestIbra` (**nonconsuming**, borrower) → creates `IbraRequest` (early settlement request)

**IbraRequest** (early settlement rebate — AAOIFI Std No. 8, §6/1; discretionary, not stipulated)
- `GrantIbra` (financialInstitution, `rebateAmount`) → FI voluntarily waives part of remaining profit
- `DeclineIbra` (financialInstitution) → borrower pays full outstanding balance

**LatePaymentCharity** (Sadaqah obligation — AAOIFI Std No. 8, §2/4/20)
- `SetCharityAmount` (financialInstitution, `amount`) → FI applies Shariah committee formula
- `ConfirmCharityPayment` (borrower, `charityRef`) → donation confirmed with receipt reference

**RahnAgreement** (collateral pledge — AAOIFI Std No. 39)
- `ReleaseCollateral` (financialInstitution, `note`) → CollateralActive → CollateralReleased (on closure)
- `EnforceCollateral` (financialInstitution, `reason`) → CollateralActive → CollateralEnforced (on default)

### Policy & Governance Templates

Config/policy templates are `vetify`-signed singletons (`key vetify : Party`) read via `lookupByKey` inside workflow choices — distinct from the lifecycle templates above, so listed separately.

| Template | Module | Purpose |
|---|---|---|
| `VerificationPolicy` | Onboarding | Stage 2 thresholds (`autoApproveMin`/`autoRejectMax`/`slaHours`/`requiredDocTypes`) **and** `scoringWeights : VerificationScoringWeights` — the off-ledger Stage 2 scoring engine's per-check point table, now data instead of hardcoded constants |
| `PendingVerificationPolicy` | Onboarding | Maker-checker draft for the above — see below |
| `CompliancePolicy` | Compliance | Stage 3 thresholds + `scoringWeights : ComplianceScoringWeights` (Stage 3 scoring engine's point table) + `shariahPolicyVersion`. `effectiveFrom`/`effectiveTo` are recorded for audit only — **not enforced** as a staging gate; a policy change takes effect the instant it's created |
| `PendingCompliancePolicy` | Compliance | Maker-checker draft for the above |
| `AuthorizedReviewer` | Compliance | Registry gating who may exercise `ApproveCompliance`/`RejectCompliance` as `verifier` |
| `AuthorizedOfficer` | Governance | FI-side officer registry/RBAC (role + approval-limit gating on Financing/Murabahah choices) |
| `PolicyApprover` | Governance | Vetify-side registry gating who may exercise `ApprovePolicyChange` (Layer 1 of the Policy-Approval Security Roadmap — see below) |

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

**`agents/src/agents/shariah.ts`** mirrors this: `classifyShariahCompliance()` (keyword table ported from `prohibited-sectors.md`) is the verdict authority. The RAG/LLM pipeline only runs — and only ever produces a narrative, never a verdict — when the table has no match at all (a genuinely novel sector); even then the verdict is fixed to `REQUIRES_REVIEW` regardless of what the LLM writes.

**Scoring weights are on-ledger policy data, not hardcoded constants** — see "Policy & Governance Templates" above. `verifier.ts` fetches the active `VerificationPolicy`/`CompliancePolicy` (`get_active_contracts`, queried as `vetify` since neither has an observer clause) before scoring, falling back to `DEFAULT_VERIFICATION_WEIGHTS`/`DEFAULT_COMPLIANCE_WEIGHTS` if none is active.

**Data-completeness gap closed**: `ComplianceReview` now carries `businessSector`/`businessActivity`/`incorporationDate` directly (added fields, carried over from `BusinessOnboarding.business` at creation time — both the `RequestRecertification` choice and `verifier.ts`'s post-`Approve` auto-creation populate them; `ApprovedBorrower` also carries the same three fields so `RequestRecertification` can pass them through to the next compliance cycle). The Shariah classifier and business-age scoring (`agents/src/agents/supervisor.ts`, `agents/src/scoring/compliance.ts`) use the real fields now instead of a `businessName` proxy / omitting the factor.

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
restriction as the Verifier Agent. Unlike Stage 2/3, there's no Approve/Reject/Flag branching
here: `BeginUnderwriting` always proceeds once evidence is gathered, since the FI alone makes the
funding decision in Stage 7.

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
| **Underwriting Agent** | financialInstitution | Financial analysis, cash flow, risk scoring, financing eligibility |
| **Monitoring Agent** | financialInstitution | Delinquency detection, repayment tracking, early warnings |
| **Reporting Agent** | management, regulator | Portfolio reports, compliance summaries, performance analytics |

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
- `agents/src/agents/shariah.ts` — exported function `runShariahAgent(businessSector, businessActivity, financingPurpose): Promise<ShariahResult>`; checks the table first, only invokes the RAG/LLM agent below on a table miss
- `agents/src/agents/supervisor.ts` — dispatches the Shariah Agent, then calls `RecordShariahPreCheck` directly against the ledger (controller `vetify`, trivially authorized since `ComplianceReview`'s signatory is already `vetify`)
- `agents/src/mcp/shariah-server.ts` — two MCP tools: `query_shariah_ruling` and `check_prohibited_sector`
- `agents/src/rag/shariah/ingest.ts` — one-time PDF ingestion script (run once per PDF update)
- `agents/src/rag/shariah/retriever.ts` — lazy FaissStore singleton loaded by the MCP server

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
│   │   ├── monitoring.ts         # Stage 9 — delinquency detection, FlagDelinquent
│   │   └── reporting.ts          # Ongoing — monthly PortfolioReport creation
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
│   │   ├── shariah-policy.ts     # classifyShariahCompliance() — sector/structure keyword table
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

Four agents are registered (the Shariah Agent runs standalone via the Supervisor, not through ACP):

| Agent | Skills |
|---|---|
| `vetify-verifier` | `skills/verifier-review` — full tool access (incl. `exercise_choice`/`create_contract`), human-supervised |
| `vetify-underwriting` | `skills/underwriting` — DSCR/cash flow analysis → BeginUnderwriting |
| `vetify-monitoring` | `skills/monitoring` — delinquency detection → FlagDelinquent |
| `vetify-reporting` | `skills/reporting` — portfolio aggregation → PortfolioReport creation |

**`vetify-verifier` here is intentionally a different skill from the Supervisor's.** The autonomous Supervisor path (`agents/src/agents/verifier.ts`) loads `skills/verifier` — evidence-gathering only, no `exercise_choice`/`create_contract` tool access at all, so the LLM is architecturally incapable of deciding (see "Off-Ledger Deterministic Scoring" above). This ACP agent loads `skills/verifier-review` and *does* have full tool access, because a human verifier officer is present in the session watching every tool call — that supervision is the safety mechanism here, not a capability restriction. It's only ever invoked on contracts already flagged `ManualReview`: cases the deterministic scoring engine explicitly could not resolve on its own (Medium-risk band, a serious CAC name mismatch, Shariah `REQUIRES_REVIEW`, or Stage 3's CDD purpose/proportionality judgment, which the engine can *never* auto-resolve by design).

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
├── underwriting/
│   ├── SKILL.md                        # 7-step DSCR/cash flow workflow, BeginUnderwriting choice
│   └── references/
│       ├── dscr-guide.md               # DSCR calculation, thresholds, recommended limit formula
│       └── mono-underwriting-fields.md # mono.co creditworthiness response field definitions
├── monitoring/
│   └── SKILL.md                        # delinquency calculation, FlagDelinquent decision table
└── reporting/
    └── SKILL.md                        # portfolio metrics, PortfolioReport contract creation
```

Skills use YAML frontmatter (`name`, `description`) and progressive loading: metadata at startup, body on invocation, references on demand.

### Key Design Points
- `server.registerTool()` is used throughout (MCP SDK v1.x API — not the deprecated `server.tool()`)
- `MultiServerMCPClient` config key is `mcpServers` (not `servers` or top-level keys)
- `createDeepAgent()` is synchronous — no `await`
- **`FilesystemBackend` is required for skills to load** — without it the `skills` array is silently ignored. All agents use `new FilesystemBackend({ rootDir: ".", virtualMode: true })`
- **`MemorySaver` checkpointer is required** for human-in-the-loop interrupts (Model C Medium risk flagging); all agents include it
- `acp.ts` passes `mcpServers` config objects directly to each agent in `startServer` (same format as `.mcp.json`) — no manual `MultiServerMCPClient` instantiation needed
- `verifier.ts` (Supervisor path) still uses `MultiServerMCPClient` programmatically — it runs headlessly and needs explicit tool lists
- The Supervisor polls Canton every 10 s and delegates based on contract status
- Agents are stateless per invocation — LangSmith traces every run for observability
- `CANTON_VETIFY_JWT` and `CANTON_VERIFIER_JWT` are separate JWTs for each Canton party; `CANTON_VETIFY_PARTY_ID`/`CANTON_VERIFIER_PARTY_ID` are the actual on-ledger Party identifiers the v2 JSON Ledger API needs explicitly (a JWT alone isn't the party identifier — see below)
- `supervisor.ts` no longer makes direct ledger `fetch` calls — `queryContracts`/`recordShariahPreCheck` are thin wrappers over `canton-client.ts`, the same client `canton-server.ts`'s MCP tools use

---

## Privacy Model

Canton's sub-transaction privacy means each party only sees contracts where they are a signatory or observer. Key rules:
- Borrowers see only their own contracts.
- Financial institutions access only financing requests and contracts directed to them.
- The verifier party accesses only verification- and compliance-related contracts.
- Regulators observe `MurabahahContract` and `PortfolioReport` only.
- No participant can see another borrower's data.

---

## Key Daml Concepts

- **Signatory**: party whose authority creates/archives a contract; must authorize creation.
- **Observer**: can see a contract but cannot act on it.
- **Choice**: an action a party exercises on a contract, producing new contracts or archiving the current one.
- **`daml-script`**: test/scripting library for ledger interaction scenarios; add `import Daml.Script` when writing test `Script` values.
