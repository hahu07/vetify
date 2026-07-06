# Murabahah Module — Comprehensive Review

**File**: `daml/Vetify/Murabahah.daml` (1,964 lines, ~35 templates)
**Reviewed against**: AAOIFI Std No. 8, 23, 39; CBN NIFI Framework; Daml LF 2.3; Canton production standards
**Fix plan**: `docs/murabahah-fixplan.md`

---

## Scores

| Dimension | Score | Summary |
|---|---|---|
| **Production Readiness** | 72 / 100 | Dual default paths, schedule bloat, missing facilityRef/contract key, no closure path for recovered-defaulted contracts |
| **AAOIFI Compliance** | 78 / 100 | Strong core chain; gaps in full cost disclosure, Hamish Jiddiyyah, Ibra' audit trail, Sadaqah charity validation, profit rate disclosure |
| **Daml Design** | 81 / 100 | Correct consuming/nonconsuming split, bilateral signatories; penalised for no contract keys, payment schedule bloat, tuple return types |

---

## Business Decisions (Override Review Recommendations)

The following product and regulatory decisions were confirmed after the initial review. They take precedence over the corresponding findings below.

| Decision | Overrides |
|---|---|
| **BD-1**: Vetify does not participate in default decisions. `DefaultContract` stays FI-only; `ProposeDefault`/`PendingContractDefault`/`ConfirmDefault` are removed (not deprecated). | C-1, H-2 (partially) |
| **BD-2**: `agencyFee` on `MurabahahWakala` is `Optional Decimal`. Wakala fees are not practiced in Nigeria; the field exists but defaults to `None`. | M-9 |
| **BD-3**: `HamishJiddiyyah` is FI-discretionary. It must never be a required lifecycle step. | F in fixplan |
| **BD-4**: `IbraRebateProposal` is created by the FI, not vetify. `ProposeRebate` controller changes from `vetify` to `financialInstitution`. | M-4 |
| **BD-5**: `regulator : Optional Party` across all templates. CBN oversight is not yet formalized for the platform; the `None` path must be fully supported. | H-6, and all templates currently carrying `regulator : Party` |

---

## Verdict

**Not yet suitable for direct production deployment.** Six block-on-deploy issues must be resolved before go-live with a regulated financial institution. After those fixes and the Batch B/C items, the module would be appropriate for a controlled pilot.

---

## Critical Issues (Block-on-Deploy)

### C-1 — Dual Default Path (Governance)
`DefaultContract` (FI-only, direct) and `ProposeDefault → ConfirmDefault` (maker-checker) coexist. The FI can bypass the vetify governance gate by calling `DefaultContract` directly. In production this is a regulatory compliance failure — two authorization paths for the same destructive action with different approval requirements.

**Fix**: Add `assertMsg "DEPRECATED: Use ProposeDefault → ConfirmDefault" False` to `DefaultContract` and migrate all tests to the maker-checker path. Remove in the following release.

### C-2 — No Closure Path for Recovered-Defaulted Contracts
A borrower who enters `Defaulted` status and subsequently pays in full via `RecordRecoveryPayment` until `outstandingBalance == 0.0` is stuck: `CloseContract` requires `status == Active || status == Delinquent`; `WriteOffContract` is semantically wrong (it is for when recovery is exhausted, not for full recovery). The contract is permanently in `Defaulted` status even after full repayment.

**Fix**: Add `CloseDefaultedContract` choice on `MurabahahContract` gated on `status == Defaulted && outstandingBalance <= 0.0`, controller FI.

### C-3 — `LatePaymentCharity` Charity Amount Nullification
`SetCharityAmount` permits `amount = 0.0`. This allows the FI to set the Sadaqah obligation to zero, which violates AAOIFI Std No. 8, §2/4/20 (late payment penalties must be donated to charity; the FI cannot waive its own obligation). When set to 0.0, `ConfirmCharityPayment` is permanently blocked (it asserts `charityAmount > 0.0`), leaving zombie charity contracts on the ledger.

**Fix**: Change `charityAmount : Decimal` to `charityAmount : Optional Decimal` (None = not yet set). `SetCharityAmount` must require `amount > 0.0`. `ConfirmCharityPayment` matches on `Some amount`.

### C-4 — `RejectDelivery` is Consuming with No Replacement Path
`RejectDelivery` is a consuming choice — it archives the `AssetPurchaseRecord`. After rejection, there is no path to a replacement asset purchase without restarting from a new `MurabahahWakala`. For defective goods scenarios (the most common rejection trigger), this forces a full lifecycle restart that is operationally untenable.

**Fix**: Make `RejectDelivery` nonconsuming. Add `CancelAcquisition` (consuming, bilateral borrower + FI, for deal abandonment) and `ProceedWithReplacement` (consuming, FI controller, creates a new `AssetPurchaseRecord` for the replacement asset).

### C-5 — No `GuaranteeAgreement` Template
Personal guarantees from business directors are a standard condition in virtually all SME Murabahah facilities. The `BusinessDirector` record captures director identity but there is no on-ledger instrument for a personal or corporate guarantee. Collateral enforcement (`RahnAgreement`) covers pledged assets only.

**Fix**: Add `GuaranteeAgreement` template (signatories: guarantor + FI, observer: vetify) with `EnforceGuarantee` (FI, gated on parent contract being Defaulted) and `ReleaseGuarantee` (FI, on closure).

### C-6 — Payment Schedule Stored on Every Contract Version (Scale Bloat)
`paymentSchedule : [PaymentScheduleEntry]` is carried on every version of `MurabahahContract`. `RecordPayment` creates a new contract version — each version contains the full 60-entry schedule for a 60-month facility. At end-of-life: 61 contract versions × 60 entries = 3,660 schedule-entry rows in PQS per facility. At 1,000 active facilities: 3.66M rows. Query performance degrades and storage costs compound.

**Fix**: Extract to `PaymentScheduleContract` (signatory FI, observer borrower + vetify + regulator). `MurabahahContract` holds `paymentScheduleCid : ContractId PaymentScheduleContract`. `RecordPayment` does `sched <- fetch paymentScheduleCid`.

---

## High Priority Issues (Must Fix Within Q1)

### H-1 — No Contract Key on `MurabahahContract`
No ledger-enforced uniqueness per borrower facility. With multiple facilities per borrower, the backend must maintain external CID references and cannot use `fetchByKey`. This is an operational and correctness risk at scale.

**Fix**: Add `facilityRef : Text` field. Add contract key `(borrower, financialInstitution, facilityRef)`. Propagate `facilityRef` to `RahnAgreement`, `DemandNotice`, `ShariahAuditRecord`, `ShariahException`.

### H-2 — No Maker-Checker on `WriteOffContract` and `CloseContract`
Both are terminal, irreversible actions exercisable by the FI alone without vetify confirmation. `CloseContract` requires `outstandingBalance <= 0.0` (good) but no second set of eyes. `WriteOffContract` can write off millions without any confirmation.

**Fix**: Add `PendingWriteOff` and `PendingContractClosure` maker-checker templates mirroring the `PendingContractDefault` pattern.

### H-3 — Incomplete Acquisition Cost Disclosure (AAOIFI §3/3)
`actualCost` captures only the purchase price. AAOIFI Standard No. 8, §3/3 requires the FI to disclose ALL acquisition costs: purchase price + freight + customs + insurance + other charges. The Murabahah sale price must reflect the true total cost of acquisition.

**Fix**: Add `freightCost`, `customsDuty`, `insurancePremium`, `otherAcquisitionCosts`, `totalAcquisitionCost` fields to `AssetPurchaseRecord`. Update `OfferMurabahah` guard: `murabahahTerms.assetCost == totalAcquisitionCost`.

### H-4 — No `IbraGrantRecord` (Ibra' Audit Trail)
`GrantIbra` and `GrantPartialIbra` both return `()`. The FI's decision to grant a rebate (and the approved amount) is stored nowhere on the ledger. The only audit evidence is the subsequent `RepaymentRecord` which does not record the approved rebate separately.

**Fix**: `GrantIbra` creates an `IbraGrantRecord` (signatory FI, observer vetify + borrower). `GrantPartialIbra` creates a `PartialIbraGrant` carrying `approvedSettlementAmount` and `rebateAmount`.

### H-5 — Missing Profit Rate Disclosure
`MurabahahTerms` carries `profitAmount : Decimal` (absolute) but no `profitRate` field. CBN NIFI Framework requires rate disclosure. The disclosed profit rate is also required for computing `PaymentAllocation.profitComponent` per installment.

**Fix**: Add `profitRate : Optional Decimal` (expressed as annualised rate, e.g., 0.15 for 15%) and `effectiveRate : Optional Decimal` (APR equivalent) to `MurabahahTerms`.

### H-6 — Regulator Blind to Collateral and Covenant Records
The regulator observes `MurabahahContract` and `PortfolioReport` but does not observe `RahnAgreement`, `CollateralValuationRecord`, `CollateralInspectionRecord`, `CreditCovenant`, or `CovenantMeasurementRecord`. CBN NIFI risk-based supervision requires access to collateral and covenant records.

**Fix**: Add `regulator : Party` field and `observer ... regulator` to all collateral and covenant templates.

### H-7 — `ShariahAuditRecord` / `ShariahException` Have No Hard Facility Link
Both templates use `cacRegNumber` as the facility link. For borrowers with multiple concurrent facilities, the audit trail is ambiguous — a Shariah exception cannot be unambiguously attributed to a specific `MurabahahContract`.

**Fix**: Add `facilityRef : Optional Text` to both templates. After C-6 / H-1 are implemented, this becomes a hard link.

---

## Medium Priority Issues

### M-1 — `MurabahahWakala` Has No Time Limit
An agency with no expiry exposes the FI to indefinite open-ended asset ownership risk. The borrower-as-agent could delay purchasing for months without triggering any ledger-enforced consequence.

**Fix**: Add `agencyExpiresAt : Optional Time` and `ExpireAgency` choice (controller vetify, gated on `now > agencyExpiresAt`).

### M-2 — Missing `principalComponent` / `profitComponent` on `PaymentScheduleEntry`
The schedule shows only `dueAmount`. AAOIFI transparency requires each installment to disclose the cost (Ras al-Mal) and profit (Ribh) portions. This also supports `PaymentAllocation` generation.

**Fix**: Add `principalComponent : Optional Decimal` and `profitComponent : Optional Decimal` to `PaymentScheduleEntry`.

### M-3 — `GrantMoratorium` Allows Multiple Active Moratoriums
A second call to `GrantMoratorium` when one is already active overwrites `activeMoratorium` silently and consumes the previous contract version. The previous `MoratoriumRecord` remains but the moratorium it represents has been superseded with no explicit event.

**Fix**: Add `assertMsg "A moratorium is already active" (activeMoratorium == None)` to `GrantMoratorium`. If extension of an existing moratorium is required, add `ExtendMoratorium` choice.

### M-4 — `IbraRebateProposal` On-Ledger Presence May Imply Pre-Agreement
AAOIFI Std No. 8 §6/1: Ibra' cannot be contractually stipulated. An `IbraRebateProposal` signed by vetify and visible to borrower and FI on the ledger could be used in dispute resolution to argue a pre-agreed rebate existed.

**Fix**: Add explicit AAOIFI disclaimer text to `rationale` validation: assert that `rationale` contains "Non-binding" or accept a structured `advisory : Bool` field that must be `True` for the contract to be creatable.

### M-5 — `DemandNotice` Carries Caller-Provided `demandDate` Not Ledger Time
The FI provides `demandDate : Date` manually. A backdated or future-dated demand notice would pass all current guards.

**Fix**: Remove `demandDate : Date` parameter. Capture `issuedAt : Time` via `getTime` in the `IssueDemandNotice` choice body.

### M-6 — Missing Audit Records for Several Actions
No immutable record is created for: `WithdrawWad`, `DeclineProposal`, `DeclineAgency`, `RejectRestructuring`, `GrantIbra` / `GrantPartialIbra` (covered by H-4 above). Each of these should create an immutable archive record.

**Fix**: See Batch D in the fix plan.

### M-7 — `SetCharityAmount` Allows `amount = 0.0`
Partially covered by C-3 above. Separately: the FI sets its own charity obligation with no borrower or regulatory validation of the amount. No approved charity formula or minimum amount is enforced on-ledger.

**Fix** (beyond C-3): Add `CharityOrganizationRegistry` template (signatory vetify, observer FI + regulator) as a reference for `ConfirmCharityPayment.charityOrganization` validation.

### M-8 — No `facilityRef` on `RahnAgreement` (Multi-Facility Collateral Ambiguity)
Covered under H-1 above but specifically: a borrower with two active facilities and two `RahnAgreement` contracts has no on-ledger mechanism to determine which collateral secures which facility.

### M-9 — Missing `agencyFee` on `MurabahahWakala`
If the borrower-as-agent is paid an Ujrah (agency fee), there is no field to record it. If gratuitous (most common in SME Murabahah), this should be explicitly stated as `agencyFee = 0.0` for Shariah transparency.

### M-10 — `DisputeRecord` Has No Duplication Guard
A borrower could raise the same dispute type (`disputeType = "PAYMENT_DISPUTE"`) multiple times. There is no on-ledger prevention — this is inherently a PQS + backend concern but should be noted.

---

## Low Priority Issues

### L-1 — Missing Empty-Reason Assertions
`WithdrawWad`, `DeclineProposal`, `DeclineAgency`, `DeclineIbra` all accept empty `reason : Text` with no assertion. Should add `assertMsg "Reason must not be empty" (reason /= "")` to each.

### L-2 — `IssueDemandNotice` Missing Chronological Guard
No assertion that `responseDeadline > demandDate`. A demand with a past-due response deadline would be created silently.

### L-3 — `RecordPayment` Does Not Validate Payment Date
No check that `paymentDate` is not in the future. Forward-dated payment records would pass all current guards.

### L-4 — Tuple Return Type on `RecordPayment`
Returns `(ContractId MurabahahContract, ContractId RepaymentRecord, Optional (ContractId LatePaymentCharity))`. The HTTP JSON API deserializes this as a nested JSON array. A named `RecordPaymentResult` record would be more ergonomic for the backend.

### L-5 — `SupplierDetails.bankAccountRef` Naming
The field is labeled "FI's internal reference to the payment instruction" but should be the supplier's bank account details for the FI to make payment. The field name implies the FI's own account rather than the supplier's.

### L-6 — `findings : [Text]` on Audit Records Is Unstructured
`InspectionRecord.findings`, `ShariahAuditRecord.findings`, `ShariahAuditRecord.recommendations` are `[Text]`. Unstructured text lists cannot be aggregated in PQS SQL for regulatory reporting.

### L-7 — Missing `expectedEndDate` on `MurabahahContract`
Derivable from `startDate + tenureMonths` but not stored. PQS queries for expiring contracts require date arithmetic.

---

## Missing Templates Summary

| Template | Priority | Rationale |
|---|---|---|
| `GuaranteeAgreement` | Critical | Personal/corporate director guarantee; universal in SME lending |
| `PaymentScheduleContract` | Critical | Performance: decouple schedule from every contract version |
| `IbraGrantRecord` | High | Immutable FI Ibra' decision; missing audit trail |
| `PartialIbraGrant` | High | Authorization record for `RecordEarlySettlement` at reduced amount |
| `PendingWriteOff` | High | Maker-checker for `WriteOffContract` |
| `PendingContractClosure` | High | Maker-checker for `CloseContract` |
| `WadWithdrawalRecord` | Medium | Audit trail for `WithdrawWad` |
| `ProposalDeclineRecord` | Medium | Audit trail for `DeclineProposal` |
| `AgencyWithdrawalRecord` | Medium | Audit trail for `DeclineAgency` |
| `RestructuringRejectionRecord` | Medium | Audit trail for `RejectRestructuring` |
| `HamishJiddiyyah` | Medium | Security deposit pre-Wa'd; AAOIFI §2/3 |
| `PurchaseOrder` | Medium | FI's formal instruction to supplier |
| `CapitalCallRecord` | Medium | Tranche drawdown for multi-draw facilities |
| `ForceMajeureDeclaration` | Medium | Portfolio-wide payment suspension |
| `CharityOrganizationRegistry` | Medium | Approved Sadaqah beneficiary registry |
| `RolloverRequest` | Low | Refinancing workflow for maturing facilities |
| `SupplierInvoice` | Low | Structured FI-received invoice |
| `InsuranceEndorsement` | Low | FI as Takaful beneficiary |
