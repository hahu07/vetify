# Vetify Daml Contract Review — Phase 1

Review of `daml/Onboarding.daml` (506 lines, single `Onboarding` module) against the
production-grade prompt in `docs/daml-review-prompt.md`. This document is the **Phase 1
deliverable**: findings, proposed module split, and the template-ID migration checklist.
**No code has been changed.** Implementation (Phase 2) begins only after sign-off.

---

## 1. Findings

Severity: **HIGH** = correctness / legal / regulatory / audit defect · **MEDIUM** =
robustness or schema-consistency gap · **LOW** = design/readability.

| # | Severity | Location | Issue | Recommendation |
|---|---|---|---|---|
| F1 | HIGH | whole file | Entire 10-stage lifecycle (5 enums, 8 records, 9 templates) in one `Onboarding` module. | Split per §2. |
| F2 | HIGH | `tests/OnBoarding.daml` + `daml.yaml` | Test module is **stale and orphaned**: written against a removed schema (`module OnBoarding`, `owner`/`verifier`/`bankAccounts`/`amendmentNote`, `BusinessBankAccount`/`Current`) and is outside the build path (`source: daml`), so it never compiles or runs. "Tests exist" is effectively false. | Delete it; replace with real per-domain tests under the new build path. |
| F3 | HIGH | `ApprovedBorrower.RequestFinancing` (322) | Choice is **consuming** (default), so an approved borrower can request financing **exactly once, ever** — `ApprovedBorrower` is archived on first use. | Make `nonconsuming` so a vetted borrower can open repeat facilities. |
| F4 | HIGH | `MurabahahContract` signatory (429–430) | Signed by `financialInstitution` only; borrower is an **observer**. A Murabahah sale is bilateral and the borrower carries the repayment obligation, yet never consents on-ledger. `ApproveFunding` (369) mints a binding obligation unilaterally. | Introduce **propose/accept**: FI proposes terms → borrower accepts → active contract signed by **both**. |
| F5 | HIGH | `RecordPayment` (441) | `newBalance = outstandingBalance - amountPaid` with no `amountPaid > 0` guard and no overpayment guard → balance can go **negative**. | Add `ensure`/`assertMsg`: `amountPaid > 0.0` and `amountPaid <= outstandingBalance` (or define explicit overpayment handling). |
| F6 | HIGH | `RejectCompliance` (284–294), `RejectFunding` (392–397) | Both `return ()` and archive — **no on-ledger record** of the rejection or its reason. Asymmetric with `VerificationResult`, which preserves rejections. Unacceptable audit gap for a CBN/AAOIFI-regulated platform. | Create `ComplianceResult` / `FinancingDecision` record templates capturing outcome, reason, scores, party, timestamp. |
| F7 | HIGH | `MurabahahTerms` (108–115) | No invariant ties `salePrice == assetCost + profitAmount`. A mis-stated profit/sale price breaks Shariah disclosure integrity (the disclosed profit is the heart of Murabahah). | Add `ensure salePrice == assetCost + profitAmount && profitAmount >= 0.0`. |
| F8 | MEDIUM | `RecordPayment` (445) | Always resets `status = Active`, so a single partial payment "cures" a `Delinquent` contract even if still in arrears. | Recompute status from arrears, not unconditionally. |
| F9 | MEDIUM | `RecordPayment` (433–456) | `installmentNo` is caller-supplied and never reconciled against `installmentsPaid + 1`; allows skips/double-counts. | Derive or assert `installmentNo == installmentsPaid + 1`. |
| F10 | MEDIUM | `MurabahahStatus.Defaulted` (38) | Declared but **no choice ever sets it** — the `Delinquent → Defaulted` write-off path is missing. | Add a `Default`/`WriteOff` choice (FI or vetify-controlled) with guard `status == Delinquent`. |
| F11 | MEDIUM | `PortfolioReport` (491–502) | Has `completedCount` but **no `defaultedCount`**, while `backend` `getPortfolioSummary` (`repository.ts`) computes and expects defaulted figures. Schema mismatch. | Add `defaultedCount` (and reconcile field names with the backend summary). |
| F12 | MEDIUM | `FinancingTerms` (91–96) | `amount` and `tenureMonths` can be ≤ 0. | `ensure amount > 0.0 && tenureMonths > 0`. |
| F13 | MEDIUM | `VerificationResult` (225–239) | Inert record with no choices; the `→ ComplianceReview` handoff happens **off-ledger** (backend `create`), breaking the on-ledger chain of custody. | Add a `ProceedToCompliance` choice that creates `ComplianceReview` and stores the upstream contract ID for traceability. |
| F14 | MEDIUM | all templates | No contract keys. Agents poll and re-run; without a key, re-creation/idempotency is unguarded. | Add keys, e.g. `BusinessOnboarding` keyed by `(borrower, cacRegNumber)`. |
| F15 | LOW | `ReviewStatus` (17–25) | Overloaded as both workflow state (`Draft`, `UnderReview`…) and terminal outcome (`VerificationResult.outcome`, 234). | Split into `WorkflowStatus` and a separate `Decision` (Approved/Rejected). |
| F16 | LOW | most templates | `borrower / vetify / businessName / cacRegNumber` repeated across nearly every template. | Extract a shared `DealParties` / `BorrowerRef` record. |
| F17 | LOW/MED | dates throughout | No ledger-time validation: `incorporationDate`, `startDate`, `paymentDate` may be future-dated; `PortfolioReport.reportDate` (496) passed in rather than from `getTime`. | Validate against `getTime`; derive report date on-ledger. |

### Privacy check (passes, with one note)
Signatory/observer sets match the documented model: borrowers see only their own contracts;
the regulator observes only `MurabahahContract` (430) and `PortfolioReport` (505). **Note:** F4's
propose/accept change must preserve this — the regulator should observe only the *accepted*
Murabahah contract, not the proposal.

---

## 2. Proposed Module Split

```
daml/Vetify/
  Types.daml         -- all enums + records; shared party bundles; NO templates
  Onboarding.daml    -- Stage 1–2: BusinessOnboarding, VerificationResult
  Compliance.daml    -- Stage 3–4: ComplianceReview, ApprovedBorrower
  Financing.daml     -- Stage 5–7: FinancingRequest, UnderwritingResult
  Murabahah.daml     -- Stage 8–10: MurabahahContract, RepaymentRecord
  Reporting.daml     -- PortfolioReport
  Tests/
    OnboardingTests.daml
    ComplianceTests.daml
    FinancingTests.daml
    MurabahahTests.daml
```

### Create-graph (drives the import DAG)

A module that exercises a choice creating template `T` must import `T`'s module. Mapping every
`create` in the contract:

| Choice (module) | Creates | Same module? |
|---|---|---|
| `BusinessOnboarding.Approve/Reject` (Onboarding) | `VerificationResult` | ✅ in-module |
| `ComplianceReview.ApproveCompliance` (Compliance) | `ApprovedBorrower` | ✅ in-module |
| `ApprovedBorrower.RequestFinancing` (Compliance) | `FinancingRequest` | ➡️ **Compliance → Financing** |
| `FinancingRequest.BeginUnderwriting` (Financing) | `UnderwritingResult` | ✅ in-module |
| `FinancingRequest.ApproveFunding` (Financing) | `MurabahahContract` | ➡️ **Financing → Murabahah** |
| `MurabahahContract.RecordPayment` (Murabahah) | `RepaymentRecord` | ✅ in-module |
| `PortfolioReport` | — (created off-ledger by agent) | standalone |
| `ComplianceReview` | — (created off-ledger by agent) | — |

**Resulting import DAG (acyclic):**

```
Types  ←  Onboarding        (Onboarding depends on Types only)
Types  ←  Murabahah         (leaf)
Types  ←  Financing  →  Murabahah
Types  ←  Compliance →  Financing
Types  ←  Reporting         (leaf)
```

No cycles. `Onboarding` is independent of `Compliance` because `ComplianceReview` is created
off-ledger today (the backend/agent calls `create`), so there is no compile-time edge from
Onboarding to Compliance.

**Decoupling tradeoff to decide at sign-off:** the `Compliance → Financing → Murabahah` chain
exists only because each approval choice directly `create`s the next-stage contract. If F4's
propose/accept is adopted for `MurabahahContract`, the `Financing → Murabahah` edge can be cut
(the proposal lives in Financing; the accepted contract in Murabahah is created by the borrower's
accept). Recommend adopting propose/accept and revisiting the DAG so each module owns its own
template creations where possible.

---

## 3. Template-ID Migration Checklist

Splitting modules changes template IDs from `Onboarding:<T>` to `<NewModule>:<T>`. The exact
Daml-LF qualified name depends on the final module path (e.g. `Vetify.Compliance:ComplianceReview`
→ template-ID string `"Vetify.Compliance:ComplianceReview"`). **Confirm the qualified-name format
the HTTP JSON API / PQS expects against the chosen module path before mass-editing.**

Every hardcoded `Onboarding:` string that must change:

### Backend
| File | Line | Current | New module |
|---|---|---|---|
| `backend/src/repository.ts` | 12 | `Onboarding:BusinessOnboarding` | Onboarding |
| `backend/src/repository.ts` | 13 | `Onboarding:VerificationResult` | Onboarding |
| `backend/src/repository.ts` | 14 | `Onboarding:ComplianceReview` | Compliance |
| `backend/src/repository.ts` | 15 | `Onboarding:ApprovedBorrower` | Compliance |
| `backend/src/repository.ts` | 16 | `Onboarding:FinancingRequest` | Financing |
| `backend/src/repository.ts` | 17 | `Onboarding:UnderwritingResult` | Financing |
| `backend/src/repository.ts` | 18 | `Onboarding:MurabahahContract` | Murabahah |
| `backend/src/repository.ts` | 19 | `Onboarding:RepaymentRecord` | Murabahah |
| `backend/src/repository.ts` | 20 | `Onboarding:PortfolioReport` | Reporting |
| `backend/src/repository.ts` | 7 | comment `"Onboarding:<TemplateName>"` | doc update |
| `backend/src/routes/onboarding.ts` | 20 | `Onboarding:BusinessOnboarding` | Onboarding |
| `backend/src/routes/onboarding.ts` | 21 | `Onboarding:ComplianceReview` | Compliance |
| `backend/src/routes/financing.ts` | 16 | `Onboarding:ApprovedBorrower` | Compliance |
| `backend/src/routes/financing.ts` | 17 | `Onboarding:FinancingRequest` | Financing |
| `backend/src/routes/contracts.ts` | 23 | `Onboarding:MurabahahContract` | Murabahah |
| `backend/src/pqs.ts` | 37 | comment example | doc update |

### Agents
| File | Line | Current | New module |
|---|---|---|---|
| `agents/src/agents/verification.ts` | 18 | `Onboarding:BusinessOnboarding` | Onboarding |
| `agents/src/agents/compliance.ts` | 19 | `Onboarding:ComplianceReview` | Compliance |
| `agents/src/agents/underwriting.ts` | 20 | `Onboarding:FinancingRequest` | Financing |
| `agents/src/agents/monitoring.ts` | 18 | `Onboarding:MurabahahContract` | Murabahah |
| `agents/src/agents/monitoring.ts` | 19 | `Onboarding:RepaymentRecord` | Murabahah |
| `agents/src/agents/reporting.ts` | 49 | `Onboarding:PortfolioReport` | Reporting |
| `agents/src/agents/reporting.ts` | 102–106 | prose refs to `Onboarding:*` | Murabahah/Reporting |
| `agents/src/agents/supervisor.ts` | 47 | `Onboarding:BusinessOnboarding` | Onboarding |
| `agents/src/agents/supervisor.ts` | 57 | `Onboarding:ComplianceReview` | Compliance |
| `agents/src/agents/supervisor.ts` | 67 | `Onboarding:FinancingRequest` | Financing |
| `agents/src/agents/supervisor.ts` | 77 | `Onboarding:MurabahahContract` | Murabahah |
| `agents/src/mcp/canton-server.ts` | 41 | example in tool description | doc update |

### Skills / Docs (prose references — lower priority, but keep consistent)
- `agents/skills/*/SKILL.md` and `agents/skills/*/references/*.md` — grep for `Onboarding:` choice examples.
- `CLAUDE.md` — the PQS section (`active('Onboarding:TemplateName')`) and the Daml Template Architecture table.
- `daml.yaml` — `source: daml` already covers `daml/Vetify/`; confirm and remove the stale `tests/` confusion (see F2).

> **Operational note:** module split = new package contents → **package version bump** (`daml.yaml version`), DAR re-upload to the Canton domain, and a **full PQS re-index** (Scribe replays the ledger; existing rows keyed by old template IDs become stale). Sequence: build DAR → upload → restart Scribe against a clean PQS schema → redeploy backend/agents with new IDs.

---

## 4. Recommended Phase 2 Sequence (on sign-off)

1. Create `daml/Vetify/Types.daml`; move enums + records (apply F7/F12 `ensure`, F15 enum split, F16 `DealParties`).
2. Split templates into the five domain modules per §2; resolve imports along the DAG.
3. Apply authorization/audit fixes: F3 (`nonconsuming`), F4 (propose/accept), F6 (decision records), F13 (`ProceedToCompliance`).
4. Apply Murabahah financial-integrity fixes: F5, F8, F9, F10, F11.
5. Add F14 keys and F17 ledger-time validation.
6. Delete the orphaned `tests/OnBoarding.daml`; write per-domain tests (happy path, authorization failures, `ensure` rejections, state-guard failures, privacy visibility).
7. `daml build` + `daml test` green; report summary verbatim.
8. Execute the §3 migration checklist; bump package version; re-deploy + re-index.

---

## 5. Open Questions for Sign-off

1. **Propose/accept for Murabahah (F4)** — adopt it (recommended, also simplifies the module DAG), or keep FI-unilateral creation for the MVP?
2. **Overpayment policy (F5)** — reject overpayment, or accept and carry a credit balance?
3. **Module path** — `daml/Vetify/*` (qualified IDs `Vetify.Onboarding:…`) vs. flat `daml/*` (IDs `Onboarding:…`, `Compliance:…`). The flat form minimizes the migration diff; the namespaced form is cleaner long-term. Pick one before the §3 edits.
4. **Default handling (F10)** — which party controls `Default`/`WriteOff`: `financialInstitution`, `vetify`, or jointly?
