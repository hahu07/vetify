# Prompt: Review & Enhance the Vetify Daml Contracts

## Context

`daml/Onboarding.daml` is a single 506-line module holding the entire 10-stage Murabahah financing lifecycle for Vetify (AI-powered non-interest private credit on Canton). It compiles and works as an MVP, but it has accumulated everything — enums, records, and all nine templates — in one `Onboarding` module. We are promoting Vetify to production grade.

Your job is to **review the contract for correctness, authorization safety, and Shariah/regulatory soundness, then refactor it into a properly split module structure and implement the fixes.** Work in two phases: deliver a written review first, get sign-off, then implement.

## Hard Constraint: Split the Module

Do **not** keep everything in one module. Split by lifecycle domain with a shared types module at the base. Proposed structure (adjust if you find a cleaner cut, but justify it):

```
daml/Vetify/
  Types.daml         -- all enums + data records; shared party bundles; no templates
  Onboarding.daml    -- Stage 1–2: BusinessOnboarding, VerificationResult
  Compliance.daml    -- Stage 3–4: ComplianceReview, ApprovedBorrower
  Financing.daml     -- Stage 5–7: FinancingRequest, UnderwritingResult
  Murabahah.daml     -- Stage 8–10: MurabahahContract, RepaymentRecord
  Reporting.daml     -- PortfolioReport
  Tests/             -- one test module per domain
```

Resolve the circular reference risk (e.g. `BusinessOnboarding.Approve` creates `VerificationResult` — keep both in the same module; `ComplianceReview.ApproveCompliance` creates `ApprovedBorrower` — keep both together). Map the create-graph before choosing module boundaries so no module needs to import a template defined downstream of it.

## ⚠️ Cross-Cutting Impact — Flag Before Touching Code

Splitting modules **changes Daml template IDs** from `Onboarding:TemplateName` to e.g. `Compliance:ComplianceReview`. This breaks three downstream consumers that hardcode `"Onboarding:..."`:

1. `backend/src/repository.ts` — the `T` template-ID map and every `active('Onboarding:...')` call
2. `backend/src/routes/*.ts` — the `T_*` constants
3. The agents' Canton MCP references and any PQS `active(...)` SQL

Produce a **migration checklist** of every string that must change, keyed to file and line. Do not silently rename — surface the full blast radius first.

## Review Dimensions

Evaluate the contract against each, citing `Onboarding.daml:line`:

1. **Authorization & multi-party consent** — who signs, who controls, whose authority is required to create downstream contracts.
2. **Template invariants** — what illegal states are currently constructible.
3. **Lifecycle completeness** — which declared states/transitions are unreachable or missing.
4. **Audit trail integrity** — which decisions vanish instead of being recorded on-ledger (critical for a CBN/AAOIFI-regulated platform).
5. **Privacy** — confirm the signatory/observer sets match the documented privacy model (borrowers isolated, regulator sees only Murabahah + reports).
6. **Idiomatic Daml** — propose/accept patterns, `ensure`, `nonconsuming`, contract keys, ledger-time usage.

## Specific Items to Investigate (verify each, then fix if confirmed)

**Authorization / consent**
- `MurabahahContract` is signed by `financialInstitution` only; the borrower — who carries the repayment obligation — is a mere observer and never consents on-ledger. A Murabahah sale is bilateral. Evaluate a **propose/accept** flow: FI proposes terms → borrower accepts → active contract with both as signatories.
- `FinancingRequest.ApproveFunding` lets the FI unilaterally mint the binding contract. Same propose/accept question.
- `ApprovedBorrower.RequestFinancing` is a **consuming** choice — so an approved borrower can request financing exactly once, ever. Confirm whether it should be `nonconsuming` to allow repeat facilities.

**Lost audit trail**
- `ComplianceReview.RejectCompliance` returns `()` and archives — no on-ledger record, unlike `VerificationResult` which preserves approvals *and* rejections. Asymmetric. Consider a `ComplianceResult` record template.
- `FinancingRequest.RejectFunding` likewise returns `()` — rejection reason is lost.

**Missing invariants (`ensure` clauses)**
- `MurabahahTerms`: nothing enforces `salePrice == assetCost + profitAmount`.
- `FinancingTerms`: `amount` and `tenureMonths` can be ≤ 0.
- `MurabahahContract`: `outstandingBalance` / `installmentsPaid` can be negative.

**`RecordPayment` logic (lines 433–456)**
- No `amountPaid > 0` guard; overpayment drives `outstandingBalance` negative unchecked.
- Unconditionally sets `status = Active`, so one partial payment "cures" a `Delinquent` contract even if still in arrears.
- `installmentNo` is caller-supplied and never reconciled against `installmentsPaid + 1`.

**Unreachable / inconsistent states**
- `MurabahahStatus.Defaulted` is declared but no choice ever sets it — the `Delinquent → Defaulted` write-off path is missing.
- `PortfolioReport` has `completedCount` but no `defaultedCount`, while `backend` `PortfolioSummary` expects defaulted figures. Reconcile the schemas.

**Modeling smells**
- `ReviewStatus` doubles as both workflow state (`Draft`, `UnderReview`, …) and terminal outcome (`VerificationResult.outcome`). Consider separating lifecycle state from decision.
- `VerificationResult` is an inert record with no choices; the `→ ComplianceReview` handoff happens off-ledger. Consider a `ProceedToCompliance` choice so the chain is explicit and auditable, and store upstream contract IDs for traceability.
- The `borrower / vetify / businessName / cacRegNumber` tuple is repeated across nearly every template — consider a shared `DealParties` / identity record.

**Time**
- No use of ledger time. `incorporationDate`, `startDate`, `paymentDate` are unvalidated and could be in the future; `PortfolioReport.reportDate` is passed in rather than derived from `getTime`.

## Testing (none exist today)

There are currently **no Daml Script tests**. Deliver comprehensive coverage:
- Happy path: full lifecycle borrower onboarding → verification → compliance → approval → financing → underwriting → Murabahah → repayments → closure.
- Authorization failures: every choice exercised by the wrong party must fail.
- Invariant rejections: each new `ensure` clause has a failing-construction test.
- State-guard failures: each `assertMsg` is exercised from an illegal source state.
- Privacy: assert each party sees only the contracts they should (use `queryFilter` / visibility checks).

## Deliverables & Working Agreement

1. **Phase 1 — Review document** (`docs/daml-review.md`): findings table (issue · location · severity · recommendation), the proposed module split with the create-graph justification, and the template-ID migration checklist. **Stop here for sign-off.**
2. **Phase 2 — Implementation**: the split modules, the fixes, and the tests. Update the three downstream consumers per the migration checklist.
3. Every phase ends green: `daml build` and `daml test` both pass. Report the test summary verbatim.

## Guardrails

- Preserve the documented privacy model and the Model-C risk-gating semantics (auto-approve / flag / auto-reject) — refactor their *structure*, not their *meaning*.
- Keep `package name = vetify`. Note the package version bump and that a re-deploy + PQS re-index will be required.
- Don't change agent prompt logic or backend business rules beyond the mechanical template-ID rename — those are separate workstreams.
