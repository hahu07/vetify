# Murabahah Fix Plan — Batch Implementation

**Source**: `docs/murabahah-review.md`
**Files touched**: `daml/Vetify/Murabahah.daml`, `daml/Vetify/Types.daml`, `daml/Vetify/Tests/MurabahahTests.daml`

Each batch is designed to compile and pass all tests independently. Later batches depend on earlier ones where noted.

---

## Business Context Decisions

These product and regulatory decisions were made after the initial review and override specific recommendations in `murabahah-review.md`.

| # | Decision | Impact on Review |
|---|---|---|
| BD-1 | **Vetify does not participate in default decisions.** Vetify is a technology provider connecting borrowers to FIs. The credit decision to default a facility is between the FI and the borrower — vetify has no risk exposure and no authority to block or confirm it. | Reverses C-1: `DefaultContract` stays FI-only. Remove `ProposeDefault` / `PendingContractDefault` / `ConfirmDefault`. |
| BD-2 | **`agencyFee` on `MurabahahWakala` is `Optional Decimal`.** Wakala agency fees (Ujrah) are not practiced in Nigeria in the context of Murabahah acquisition: the borrower is the agent precisely because they know the supplier, and charging a fee would be circular. The field must exist for completeness but will almost always be `None`. | No new templates. One field-type change on `MurabahahWakala`. |
| BD-3 | **`HamishJiddiyyah` is truly optional.** Security deposits before the Wa'd are not universally practiced across Nigerian Islamic financial institutions. The template should exist in Batch F for FIs that require it but must never be a required step in the base lifecycle. | Batch F-1 already marks it as conditional; strengthen that framing. |
| BD-4 | **`IbraRebateProposal` is created by the FI, not vetify.** The rebate calculation is a credit decision made by the FI's financing team. Vetify (as platform) has no basis to propose how much profit the FI should waive. | Change `ProposeRebate` controller on `IbraRequest` from `vetify` to `financialInstitution`. Change signatory on `IbraRebateProposal` from `vetify` to `financialInstitution`. |
| BD-5 | **`regulator` is `Optional Party` across all templates.** Vetify is a technology platform. CBN regulatory oversight is not yet formalized for the platform itself. Templates must support a future regulator party without requiring one now. When CBN assigns a supervision party, set `regulator = Some cbnParty`; until then use `regulator = None`. | Significant structural change — see Batch G below. |

---

## Batch A — Governance & Safety (no new templates, ~1 day)

**Goal**: Close the dual default path, add the missing closure path, fix the charity amount nullification, and tighten all loose assertions. These are pure choice-body changes and field-type changes — no new templates, minimal test churn.

### A-1: Resolve the Dual Default Path (BD-1)

**Revised approach**: The review originally called for deprecating `DefaultContract` and routing all flows through `ProposeDefault → ConfirmDefault`. BD-1 reverses this: vetify has no authority over credit decisions. The correct resolution is to **remove `ProposeDefault`, `PendingContractDefault`, and `ConfirmDefault`** and keep `DefaultContract` as the sole FI-controlled path.

Changes to `Murabahah.daml`:
1. Delete the `ProposeDefault` nonconsuming choice from `MurabahahContract`.
2. Delete the `PendingContractDefault` template.
3. Keep `DefaultContract` exactly as-is (FI-only, status `Delinquent → Defaulted`).
4. Add a `ContractDefaultRecord` — an immutable audit record created by `DefaultContract` (see Batch D for the template; for now just create the stub).

```daml
-- Updated DefaultContract creates an immutable audit record.
choice DefaultContract : ContractId MurabahahContract
  with
    reason    : Text
    defaultedBy : Text   -- officer name for audit trail
  controller financialInstitution
  do
    assertMsg "Can only default a Delinquent contract" (status == Delinquent)
    assertMsg "Reason must not be empty" (reason /= "")
    create this with status = Defaulted
```

**Tests to update**: `testRecoveryWorkflow` — remove the `ProposeDefault → ConfirmDefault` steps; call `DefaultContract` directly. `testMakerCheckerCollateral` — the collateral maker-checker (`ProposeEnforceCollateral → ConfirmEnforce`) is unaffected and stays (collateral enforcement is a risk management action where vetify oversight is appropriate).

### A-2: Add `CloseDefaultedContract`

Add to `MurabahahContract` (after `WriteOffContract`):
```daml
choice CloseDefaultedContract : ContractId MurabahahContract
  with closingDate : Date
  controller financialInstitution
  do
    assertMsg "Only usable on a Defaulted contract" (status == Defaulted)
    assertMsg "Outstanding balance must be zero before closure" (outstandingBalance <= 0.0)
    create this with status = Completed
```

**New test**: `testCloseAfterFullRecovery` — FlagDelinquent → DefaultContract → RecordRecoveryPayment (full amount) → CloseDefaultedContract → status == Completed.

### A-3: Fix `LatePaymentCharity.charityAmount`

In `Types.daml` there is nothing to change (the type is `Decimal`). Changes are in `Murabahah.daml`:

1. Change `charityAmount : Decimal` → `charityAmount : Optional Decimal` on `LatePaymentCharity`.
2. Remove `charityAmount = 0.0` from `LatePaymentCharity` creation in `RecordPayment`; use `charityAmount = None`.
3. Update `SetCharityAmount`:
   ```daml
   choice SetCharityAmount : ContractId LatePaymentCharity
     with amount : Decimal
     controller financialInstitution
     do
       assertMsg "Charity amount must be positive" (amount > 0.0)
       assertMsg "Amount already settled" (not settled)
       create this with charityAmount = Some amount
   ```
4. Update `ConfirmCharityPayment`:
   ```daml
   case charityAmount of
     None -> assertFail "Charity amount has not been set yet"
     Some amt -> do
       assertMsg "Charity amount must be positive" (amt > 0.0)
       ...
   ```

**Tests to update**: `testLatePaymentCharityWorkflow` — update charity creation assertion to check `charityAmount == None`; update after `SetCharityAmount` to check `charityAmount == Some <amount>`.

### A-4: Tighten Loose Assertions

All of the following are one-line additions to existing choices:

| Choice | Addition |
|---|---|
| `WithdrawWad` | `assertMsg "Reason must not be empty" (reason /= "")` |
| `DeclineProposal` | `assertMsg "Reason must not be empty" (reason /= "")` |
| `DeclineAgency` | `assertMsg "Reason must not be empty" (reason /= "")` |
| `DeclineIbra` | (No reason parameter; no change needed) |
| `SetCharityAmount` | Already fixed in A-3 |
| `GrantMoratorium` | Add `assertMsg "A moratorium is already active" (activeMoratorium == None)` |
| `GrantMoratorium` | Add future-date guard on `moratoriumEnd` (use `getTime`, compare via `toDateUTC`) |
| `IssueDemandNotice` | Add `assertMsg "Response deadline must be after demand date" (responseDeadline > demandDate)` |

### A-5: Add `agencyFee : Optional Decimal` to `MurabahahWakala` (BD-2)

```daml
template MurabahahWakala
  with
    ...
    agencyFee : Optional Decimal  -- Ujrah for the agency; None = gratuitous (standard Nigerian practice)
  where
    ...
```

Add to creation in `ProceedWithWakala`:
```daml
create MurabahahWakala with
  ...
  agencyFee = None  -- default; FI may override if an explicit fee is charged
```

No assertion needed — `None` is explicitly permissible and the common case. If `Some fee` is provided, the backend/agent layer should validate `fee > 0.0` before submission.

All tests that create `MurabahahWakala` directly must add `agencyFee = None`.

**Tests to add**: One test each for `WithdrawWad` and `DeclineProposal` that asserts failure on empty reason (use `tryCommands` or `submitMustFail`). One test for double-moratorium rejection.

---

## Batch B — Workflow Completeness (~1.5 days)

**Goal**: Fix the `RejectDelivery` dead-end, add the missing `GuaranteeAgreement`, add maker-checker for write-off and closure, and complete the Ibra' audit trail. Adds ~4 new templates.

**Depends on**: Batch A (for consistent `LatePaymentCharity` type and `DefaultContract` deprecation)

### B-1: Fix `RejectDelivery` — Nonconsuming + Replacement Path

Change `RejectDelivery` from consuming to nonconsuming. Add two new consuming choices to `AssetPurchaseRecord`:

```daml
-- Borrower confirms the asset is defective or incorrect — creates a record, contract stays live.
nonconsuming choice RejectDelivery : ContractId AssetRejectionRecord
  with
    reason            : Text
    defectDescription : Text
  controller borrower
  do
    assertMsg "Cannot reject an already-acknowledged delivery" (not deliveryAcknowledged)
    assertMsg "Rejection reason must not be empty" (reason /= "")
    t <- getTime
    create AssetRejectionRecord with ...

-- FI replaces the asset after a rejection — archives the old purchase record.
choice ProceedWithReplacement : ContractId AssetPurchaseRecord
  with
    newActualCost   : Decimal
    newPurchaseDate : Date
    newInvoiceRef   : Text
    replacementNote : Text
  controller financialInstitution
  do
    assertMsg "Replacement cost must be positive" (newActualCost > 0.0)
    assertMsg "Replacement note must not be empty" (replacementNote /= "")
    create this with
      actualCost           = newActualCost
      purchaseDate         = newPurchaseDate
      invoiceRef           = newInvoiceRef
      deliveryAcknowledged = False

-- Bilateral cancellation after a failed acquisition.
choice CancelAcquisition : ()
  with reason : Text
  controller borrower -- FI must co-sign; use actAs [borrower, fi] at submission
  do
    assertMsg "Cancellation reason must not be empty" (reason /= "")
    return ()
```

Note: `CancelAcquisition` should require both parties. In Daml, making both signatories co-controllers requires either: (a) a multi-party submission at the backend using `actAs [borrower, fi]`, or (b) a two-step proposal pattern (`BorrowerCancellationRequest` → FI `AcceptCancellation`). Use pattern (b) for explicit audit trail.

**Tests**: `testRejectAndReplace` — create APR → reject delivery (nonconsuming, APR still active) → proceed with replacement → new APR → acknowledge → offer Murabahah proceeds normally.

### B-2: Add `GuaranteeAgreement`

New template appended to `Murabahah.daml`:

```daml
template GuaranteeAgreement
  with
    guarantor            : Party   -- typically the borrower as personal guarantor
    financialInstitution : Party
    vetify               : Party
    businessName         : Text
    cacRegNumber         : Text
    facilityRef          : Text
    guaranteeType        : Text    -- "PERSONAL", "CORPORATE", "THIRD_PARTY"
    guaranteedAmount     : Decimal
    guarantorName        : Text    -- legal name if guarantor is not a Canton party
    guarantorId          : Text    -- NIN, passport, or company reg number
    effectiveDate        : Date
    expiryDate           : Optional Date
    guaranteeStatus      : GuaranteeStatus  -- Active, Released, Enforced
  where
    signatory guarantor, financialInstitution
    observer vetify
    ensure guaranteedAmount > 0.0

    choice EnforceGuarantee : ContractId GuaranteeAgreement
      with reason : Text
      controller financialInstitution
      do
        assertMsg "Can only enforce an Active guarantee" (guaranteeStatus == GuaranteeActive)
        create this with guaranteeStatus = GuaranteeEnforced

    choice ReleaseGuarantee : ContractId GuaranteeAgreement
      with note : Text
      controller financialInstitution
      do
        assertMsg "Can only release an Active guarantee" (guaranteeStatus == GuaranteeActive)
        create this with guaranteeStatus = GuaranteeReleased
```

Add `GuaranteeStatus` enum to `Types.daml`:
```daml
data GuaranteeStatus = GuaranteeActive | GuaranteeReleased | GuaranteeEnforced
  deriving (Eq, Show)
```

**Tests**: `testGuaranteeLifecycle` — create bilateral GuaranteeAgreement → EnforceGuarantee → status == GuaranteeEnforced. Separate test for ReleaseGuarantee path.

### B-3: Maker-Checker for `WriteOffContract` and `CloseContract` (BD-1 context)

Per BD-1, vetify does not participate in credit decisions. Write-off and contract closure are FI credit decisions. Vetify-confirmed maker-checker patterns are therefore inappropriate here, just as they are for `DefaultContract`.

**Revised approach**: `WriteOffContract` and `CloseContract` remain FI-only. The safeguard is not a vetify confirmation but an immutable audit record and strong assertion guards.

Specifically:
- `CloseContract`: keep as-is; the `outstandingBalance <= 0.0` guard is the ledger-enforced safeguard.
- `WriteOffContract`: add `writeOffApprovedBy : Text` (senior officer name for audit) and ensure it creates a `WriteOffRecord` (already implemented). The FI's internal dual-authorisation controls (off-ledger: four-eyes at the bank) govern who can submit this choice.

**What vetify DOES govern** (contrasting with credit decisions):
- `ProposeEnforceCollateral → ConfirmEnforce` on `RahnAgreement` — retained, because collateral enforcement is a risk-oversight action where vetify (as the platform coordinating the parties) adds value and prevents unilateral seizure without borrower visibility.
- `RegulatoryInspectionRequest` — vetify initiates, FI responds; retained.

**Tests**: No new maker-checker tests needed for write-off/close. Existing tests (`testCloseContract`, `testWriteOffContract`) remain FI-controlled.

### B-4: Add `IbraGrantRecord` and `PartialIbraGrant`; Move `IbraRebateProposal` to FI (BD-4)

**BD-4 change**: `ProposeRebate` on `IbraRequest` is currently controller `vetify`. Per BD-4, the FI proposes the rebate — it is the FI's credit decision how much profit to waive. Change:
- `ProposeRebate` controller: `vetify` → `financialInstitution`
- `IbraRebateProposal` signatory: `vetify` → `financialInstitution`; observer: `vetify, borrower` (vetify remains an observer for platform visibility)

Updated `IbraRebateProposal`:
```daml
template IbraRebateProposal
  with
    financialInstitution : Party   -- signatory: FI proposes the rebate
    vetify               : Party
    borrower             : Party
    businessName         : Text
    cacRegNumber         : Text
    outstandingBalance   : Decimal
    suggestedRebate      : Decimal
    rationale            : Text
    settlementType       : IbraSettlementType
  where
    signatory financialInstitution
    observer vetify, borrower
    ensure suggestedRebate >= 0.0 && outstandingBalance > 0.0 && rationale /= ""
```

Updated `ProposeRebate` on `IbraRequest`:
```daml
nonconsuming choice ProposeRebate : ContractId IbraRebateProposal
  with
    suggestedRebate : Decimal
    rationale       : Text
  controller financialInstitution   -- was: vetify
  do ...
```

New `IbraGrantRecord` and `PartialIbraGrant` templates (immutable evidence of the grant decision):

```daml
template IbraGrantRecord
  with
    financialInstitution : Party
    vetify               : Party
    borrower             : Party
    businessName         : Text
    cacRegNumber         : Text
    outstandingBalance   : Decimal
    rebateAmount         : Decimal
    effectiveDate        : Date
    grantedAt            : Time
  where
    signatory financialInstitution
    observer vetify, borrower
    ensure rebateAmount >= 0.0 && rebateAmount <= outstandingBalance

template PartialIbraGrant
  with
    financialInstitution     : Party
    vetify                   : Party
    borrower                 : Party
    businessName             : Text
    cacRegNumber             : Text
    outstandingBalance       : Decimal
    rebateAmount             : Decimal
    approvedSettlementAmount : Decimal
    effectiveDate            : Date
    grantedAt                : Time
  where
    signatory financialInstitution
    observer vetify, borrower
    ensure approvedSettlementAmount > 0.0
        && approvedSettlementAmount < outstandingBalance
        && rebateAmount >= 0.0
```

Update `GrantIbra` → creates `IbraGrantRecord` (requires `t <- getTime`). Update `GrantPartialIbra` → creates `PartialIbraGrant`.

**Tests**: Update `testIbraRebateProposal` — change `submit p.vetify do exerciseCmd ibraReqCid ProposeRebate ...` to `submit p.fi do ...`. Verify `IbraGrantRecord` is created after `GrantIbra`.

---

## Batch C — Data Model & Disclosure (~2 days)

**Goal**: Add `facilityRef` and contract key, full acquisition cost disclosure fields, profit rate, regulator visibility on collateral/covenant templates, and `PaymentScheduleEntry` principal/profit split. These are breaking field additions — all tests creating affected templates must be updated.

**Depends on**: Batch A (for stable base before adding fields)

### C-1: Add `facilityRef` and Contract Key to `MurabahahContract`

Add `facilityRef : Text` field. Add contract key:
```daml
key (borrower, financialInstitution, facilityRef) : (Party, Party, Text)
maintainer financialInstitution
```

Propagate `facilityRef` as a field to every template that references a facility by `cacRegNumber` alone: `RahnAgreement`, `DemandNotice`, `RecoveryPaymentRecord`, `WriteOffRecord`, `ShariahAuditRecord`, `ShariahException`, `IbraGrantRecord`, `PartialIbraGrant`, `MonitoringAlert`.

Pass `facilityRef` through the creation chain: `MurabahahProposal` → `AcceptProposal` → `MurabahahContract`. `MurabahahProposal` receives `facilityRef` in `OfferMurabahah`.

**Test churn**: High. Every test that creates a `MurabahahProposal` or `MurabahahContract` directly must add `facilityRef`. All helper functions (`activeContractDirect`, `activeContractViaWakala`) must be updated. Plan ~2–3 hours of test updates.

### C-2: Full Acquisition Cost Disclosure

Add to `AssetPurchaseRecord`:
```daml
freightCost             : Decimal   -- 0.0 if not applicable
customsDuty             : Decimal   -- 0.0 if not applicable
insurancePremium        : Decimal   -- 0.0 if not applicable
otherAcquisitionCosts   : Decimal   -- 0.0 if none
totalAcquisitionCost    : Decimal   -- = actualCost + freightCost + customsDuty + insurancePremium + otherAcquisitionCosts
```

Add `ensure` clause: `totalAcquisitionCost == actualCost + freightCost + customsDuty + insurancePremium + otherAcquisitionCosts`.

Update `OfferMurabahah` guard: change `murabahahTerms.assetCost == actualCost` to `murabahahTerms.assetCost == totalAcquisitionCost`.

Update `ProceedDirectly` and `RecordAssetPurchase` to accept and pass the new fields. For backwards-compatible test helpers, default all cost fields to `0.0` in fixture helpers.

### C-3: Add `profitRate` and `effectiveRate` to `MurabahahTerms`

```daml
data MurabahahTerms = MurabahahTerms
  with
    assetCost          : Decimal
    profitAmount       : Decimal
    salePrice          : Decimal
    installmentAmount  : Decimal
    tenureMonths       : Int
    profitRate         : Optional Decimal  -- annualised rate, e.g. 0.15 for 15%
    effectiveRate      : Optional Decimal  -- APR equivalent
  deriving (Eq, Show)
```

All test fixtures that create `MurabahahTerms` must add `profitRate = None` (or a real rate for financial accuracy).

### C-4: Add `principalComponent` / `profitComponent` to `PaymentScheduleEntry`

```daml
data PaymentScheduleEntry = PaymentScheduleEntry
  with
    installmentNo      : Int
    dueDate            : Date
    dueAmount          : Decimal
    principalComponent : Optional Decimal
    profitComponent    : Optional Decimal
  deriving (Eq, Show)
```

All test fixtures that build `samplePaymentSchedule` must be updated to add `principalComponent = None; profitComponent = None` (or real values).

### C-5: Add `regulator` to Collateral and Covenant Templates

Add `regulator : Party` field and `observer ... regulator` to: `RahnAgreement`, `CollateralValuationRecord`, `CollateralInspectionRecord`, `CreditCovenant`, `CovenantMeasurementRecord`, `TakafulPolicy`.

All tests that create these templates must pass a `regulator` party. All tests that verify observer visibility must include regulator visibility checks.

---

## Batch D — Audit Trail Completeness (~1 day)

**Goal**: Create immutable records for every significant action that currently produces no persistent artefact. Pure additions — no changes to existing choices except to make them create records.

**Depends on**: Batch A (for `facilityRef`), Batch C-1 (for `facilityRef` field on new records)

### D-1: `WadWithdrawalRecord`

```daml
template WadWithdrawalRecord
  with
    borrower             : Party
    financialInstitution : Party
    vetify               : Party
    businessName         : Text
    cacRegNumber         : Text
    reason               : Text
    withdrawnAt          : Time
  where
    signatory borrower
    observer financialInstitution, vetify
    ensure reason /= ""
```

Update `WithdrawWad` to: `t <- getTime; create WadWithdrawalRecord with ...; return ()`.

### D-2: `ProposalDeclineRecord`

```daml
template ProposalDeclineRecord
  with
    borrower             : Party
    financialInstitution : Party
    vetify               : Party
    businessName         : Text
    cacRegNumber         : Text
    reason               : Text
    declinedAt           : Time
  where
    signatory borrower
    observer financialInstitution, vetify
    ensure reason /= ""
```

Update `DeclineProposal` accordingly.

### D-3: `AgencyWithdrawalRecord`

```daml
template AgencyWithdrawalRecord
  with
    borrower             : Party
    financialInstitution : Party
    vetify               : Party
    businessName         : Text
    cacRegNumber         : Text
    reason               : Text
    declinedAt           : Time
  where
    signatory borrower
    observer financialInstitution, vetify
    ensure reason /= ""
```

Update `DeclineAgency` accordingly.

### D-4: `RestructuringRejectionRecord`

```daml
template RestructuringRejectionRecord
  with
    financialInstitution : Party
    vetify               : Party
    borrower             : Party
    businessName         : Text
    cacRegNumber         : Text
    reason               : Text
    rejectedAt           : Time
  where
    signatory financialInstitution
    observer borrower, vetify
    ensure reason /= ""
```

Update `RejectRestructuring` to create this record (requires `t <- getTime`) and return its `ContractId`. Update the choice return type from `()` to `ContractId RestructuringRejectionRecord`.

### D-5: Return Named Result Types for Key Choices

Create a `RecordPaymentResult` record in `Types.daml`:
```daml
data RecordPaymentResult = RecordPaymentResult
  with
    updatedContract   : ContractId MurabahahContract
    repaymentRecord   : ContractId RepaymentRecord
    charityObligation : Optional (ContractId LatePaymentCharity)
  deriving (Eq, Show)
```

Update `RecordPayment` return type from the 3-tuple to `RecordPaymentResult`. Update all tests that destructure the tuple.

---

## Batch E — Scale & Performance (~2 days, significant refactor)

**Goal**: Extract `PaymentScheduleContract` to eliminate per-version schedule duplication. This is the highest-impact performance fix but also the highest churn.

**Depends on**: Batch C-1 (for `facilityRef` to serve as the schedule key)

### E-1: `PaymentScheduleContract`

```daml
template PaymentScheduleContract
  with
    financialInstitution : Party
    vetify               : Party
    borrower             : Party
    regulator            : Party
    facilityRef          : Text
    cacRegNumber         : Text
    entries              : [PaymentScheduleEntry]
  where
    signatory financialInstitution
    observer borrower, vetify, regulator
    key (financialInstitution, facilityRef) : (Party, Text)
    maintainer financialInstitution
    ensure not (null entries)
```

### E-2: Update `MurabahahContract`

Replace `paymentSchedule : [PaymentScheduleEntry]` with `paymentScheduleCid : ContractId PaymentScheduleContract`.

### E-3: Update Downstream Choices

`RecordPayment`, `RequestRestructuring`, `ApproveRestructuring` — all fetch the schedule via `sched <- fetch paymentScheduleCid`. `ApproveRestructuring` creates a new `PaymentScheduleContract` and updates `paymentScheduleCid` on the new contract version.

### E-4: Update Proposal Flow

`OfferMurabahah` creates a `PaymentScheduleContract` first, then creates `MurabahahProposal` with `paymentScheduleCid`. `AcceptProposal` carries the CID through to `MurabahahContract`.

**Test churn**: Very high. Every test that builds a `samplePaymentSchedule` list and passes it to a contract creation must be refactored to: (a) create a `PaymentScheduleContract` first, (b) pass its CID to the proposal/contract. All fixture helpers must be updated. Budget 3–4 hours of test refactoring.

---

## Batch F — Additional Product Features (conditional, ~2–3 days)

**Goal**: Features dependent on FI product team sign-off. Implement only when business requirements are confirmed. None of these are default lifecycle steps — they are opt-in additions for FIs that practice them.

**Depends on**: Batch C (for `facilityRef` and full data model)

### F-1: `HamishJiddiyyah` (Security Deposit) — FI-Discretionary (BD-3)

AAOIFI §2/3 — FI *may* require a deposit before executing the Wa'd to cover actual losses on withdrawal. **This is entirely optional.** Not all Nigerian Islamic FIs practice it, and those that do apply it selectively (high-value facilities, first-time borrowers). It must never be a required step in the standard lifecycle.

The template is FI-initiated (`HamishJiddiyyah` signatory: `financialInstitution`, observer: `borrower, vetify`). The FI creates it independently before or alongside the `MurabahahWad`, not as a precondition enforced by the ledger. The base `MurabahahWad` has no reference to `HamishJiddiyyah`.

AAOIFI §2/3 — FI may require a deposit before executing the Wa'd to cover actual losses on withdrawal.

```daml
template HamishJiddiyyah
  with
    borrower             : Party
    financialInstitution : Party
    vetify               : Party
    businessName         : Text
    cacRegNumber         : Text
    depositAmount        : Decimal
    depositRef           : Text        -- bank transfer or receipt reference
    depositDate          : Date
    returnDeadline       : Date        -- if Wa'd proceeds, FI returns the deposit
    actualLossDeducted   : Optional Decimal  -- set on forfeiture
    status               : HamishStatus  -- Held, Returned, Forfeited
  where
    signatory financialInstitution
    observer borrower, vetify
    ensure depositAmount > 0.0

    choice ReturnDeposit : ContractId HamishJiddiyyah
      with transferRef : Text
      controller financialInstitution
      do
        assertMsg "Can only return a Held deposit" (status == HamishHeld)
        create this with status = HamishReturned

    choice ForfeitDeposit : ContractId HamishJiddiyyah
      with actualLoss : Decimal; reason : Text
      controller financialInstitution
      do
        assertMsg "Can only forfeit a Held deposit" (status == HamishHeld)
        assertMsg "Forfeited amount cannot exceed deposit" (actualLoss <= depositAmount)
        create this with
          status             = HamishForfeited
          actualLossDeducted = Some actualLoss
```

Add `HamishStatus = HamishHeld | HamishReturned | HamishForfeited` to `Types.daml`.

### F-2: `PurchaseOrder`

FI's formal binding instruction to the supplier before disbursement.

```daml
template PurchaseOrder
  with
    financialInstitution : Party
    vetify               : Party
    borrower             : Party
    businessName         : Text
    cacRegNumber         : Text
    facilityRef          : Text
    supplierName         : Text
    supplierDetails      : SupplierDetails
    orderedItems         : [AssetLineItem]
    totalOrderValue      : Decimal
    deliveryDeadline     : Date
    poRef                : Text
    issuedAt             : Time
    status               : POStatus  -- Issued, Confirmed, PartiallyFulfilled, Fulfilled, Cancelled
  where
    signatory financialInstitution
    observer borrower, vetify
    ensure totalOrderValue > 0.0 && poRef /= ""

    choice ConfirmPO : ContractId PurchaseOrder
      with confirmationRef : Text
      controller financialInstitution
      do create this with status = POConfirmed

    choice CancelPO : ContractId PurchaseOrder
      with reason : Text
      controller financialInstitution
      do create this with status = POCancelled
```

### F-3: `CapitalCallRecord` (Tranche Disbursement)

For multi-draw facilities where financing is disbursed in tranches.

```daml
template CapitalCallRecord
  with
    financialInstitution : Party
    vetify               : Party
    borrower             : Party
    regulator            : Party
    businessName         : Text
    cacRegNumber         : Text
    facilityRef          : Text
    trancheNumber        : Int
    trancheAmount        : Decimal
    disbursementDate     : Date
    purposeOfTranche     : Text
    disbursementRef      : Text
    cumulativeDisbursed  : Decimal
    remainingFacility    : Decimal
  where
    signatory financialInstitution
    observer borrower, vetify, regulator
    ensure trancheAmount > 0.0 && disbursementRef /= ""
```

### F-4: `ForceMajeureDeclaration`

Portfolio-wide payment suspension for systemic events (pandemic, flood, regulatory order).

```daml
template ForceMajeureDeclaration
  with
    vetify               : Party
    financialInstitution : Party
    regulator            : Party
    declarationRef       : Text
    eventDescription     : Text
    affectedRegion       : Text
    suspensionStart      : Date
    suspensionEnd        : Date
    regulatoryBasis      : Text  -- e.g. "CBN Circular FPR/DIR/GEN/CIR/07/004"
    isActive             : Bool
  where
    signatory vetify
    observer financialInstitution, regulator
    ensure suspensionEnd > suspensionStart && declarationRef /= ""

    choice LiftDeclaration : ContractId ForceMajeureDeclaration
      with note : Text
      controller vetify
      do
        assertMsg "Declaration is already lifted" isActive
        create this with isActive = False
```

### F-5: `CharityOrganizationRegistry`

**Amended business decision (BD-6)**: Vetify is a technology platform that connects borrowers to FIs and does NOT maintain a charity organization registry. The approved Sadaqah beneficiary list is each FI's own responsibility, established in line with their Shariah board resolution and CBN NIFI guidelines. Vetify has no basis to centralize or validate charity registrations.

The template is therefore FI-owned and FI-signed. Each FI maintains its own registry independently. Vetify and the regulator are observers only.

```daml
template CharityOrganizationRegistry
  with
    financialInstitution  : Party   -- FI creates and owns the registry per their Shariah board
    vetify                : Party   -- platform observer only
    regulator             : Party   -- CBN/regulatory oversight
    approvedOrganizations : [(Text, Text)]  -- (orgName, registrationRef)
    shariahBoardRef       : Text    -- Shariah board resolution reference approving this list
    effectiveDate         : Date
    version               : Text
  where
    signatory financialInstitution
    observer vetify, regulator
    ensure not (null approvedOrganizations) && shariahBoardRef /= ""

    -- FI updates its approved list when the Shariah board amends it.
    choice UpdateRegistry : ContractId CharityOrganizationRegistry
      with
        newOrganizations : [(Text, Text)]
        newVersion       : Text
        updatedBoardRef  : Text
      controller financialInstitution
      do
        assertMsg "Updated list must not be empty" (not (null newOrganizations))
        assertMsg "New version must not be empty" (newVersion /= "")
        create this with
          approvedOrganizations = newOrganizations
          version               = newVersion
          shariahBoardRef       = updatedBoardRef
```

Update `ConfirmCharityPayment` to optionally take a `registryCid : Optional (ContractId CharityOrganizationRegistry)` and validate `charityOrganization` against the FI's own registry when provided. When `registryCid = None`, no registry validation is performed — permitting FIs that maintain a manual off-ledger Shariah board list.

The `ConfirmCharityPayment` validation fetches the registry to confirm the FI created it (`registry.financialInstitution == financialInstitution`) before accepting the CID, preventing cross-FI registry misuse.

---

## Batch G — Regulator Optionality (~1.5 days, significant structural change) (BD-5)

**Goal**: Make `regulator : Optional Party` across all templates. Vetify is a technology platform and CBN regulatory oversight is not yet formalized. Deploying without a live regulator party should be the default configuration.

**Depends on**: Batch C (because `facilityRef` and field additions happen there; do G after C to avoid double-churn)

### G-1: `Optional Party` Pattern in Daml

Daml observer lists accept list expressions. The pattern for optional observer:

```daml
observer [borrower, vetify, financialInstitution] ++ (case regulator of None -> []; Some r -> [r])
```

Or using the stdlib helper: `observer [borrower, vetify, financialInstitution] ++ optionalToList regulator`

Every template field `regulator : Party` becomes `regulator : Optional Party`. Every creation site passes `regulator = None` initially. When CBN assigns a regulator party, pass `regulator = Some cbnParty`.

### G-2: Templates to Update

All templates currently carrying `regulator : Party`:

| Template | Current usage | Change |
|---|---|---|
| `MurabahahContract` | Bilateral signatory chain | `regulator : Optional Party` + conditional observer |
| `RepaymentRecord` | Bilateral signatory | Same |
| `RestructuringRequest` | Observer | Same |
| `DemandNotice` | Observer | Same |
| `RecoveryPaymentRecord` | Observer | Same |
| `WriteOffRecord` | Observer | Same |
| `RegulatoryInspectionRequest` | Observer | Same |
| `InspectionResponse` | Observer | Same |
| `InspectionRecord` | Observer (signatory vetify) | Same |
| `SARReport` | Observer (confidential) | Same |
| `MurabahahStatement` | Observer | Same |
| `PortfolioRiskReport` | Observer | Same |
| `TakafulPolicy` | Observer | Same |
| `DisputeRecord` | Observer | Same |
| `ArbitrationRequest` | Observer | Same |
| `MonitoringAlert` | Observer | Same |
| `LegalEscalation` | Observer | Same |
| `AuditEvent` | Observer | Same |
| `PaymentScheduleContract` (Batch E) | Observer | Design with `Optional` from the start |

### G-3: Propagation Through the Creation Chain

`regulator` is threaded from `OfferMurabahah` → `MurabahahProposal` → `AcceptProposal` → `MurabahahContract` → downstream records. All these choices must be updated to carry `regulator : Optional Party`.

In `OfferMurabahah`:
```daml
choice OfferMurabahah : ContractId MurabahahProposal
  with
    ...
    regulator : Optional Party   -- was: Party
    ...
```

### G-4: `RegulatoryInspectionRequest` with Optional Regulator

The `RegulatoryInspectionRequest` workflow is initiated by vetify in response to a CBN inspection notice. If `regulator = None`, this entire template should not be creatable (no point issuing an inspection request when there is no regulator). Add:

```daml
ensure inspectionRef /= "" && regulator /= None  -- cannot issue inspection without a regulator party
```

### G-5: Test Updates

All tests that pass `regulator = p.regulator` (a live party) continue to work — `Some p.regulator` is the new form. The `setupMParties` helper in `MurabahahTests.daml` should optionally allocate a regulator:

```daml
-- Option A: always allocate (keeps existing tests working with minimal change)
regulator <- allocateParty "Regulator"
pure MParties with regulator = Some regulator; ...

-- Option B: no regulator for base tests; create a separate setup for regulatory tests
pure MParties with regulator = None; ...
```

Recommendation: Option A — allocate a regulator party in all tests so existing tests continue to exercise the regulator-visible path. The `None` path is for production deployment configuration, not test coverage.

**Test churn**: High (every contract creation passes `regulator`). Plan alongside Batch C to avoid double-churn.

---

## Batch Sequencing and Dependencies

```
Batch A  (Governance & Safety)          — standalone; start here
   │
   ├──► Batch B  (Workflow Completeness) — needs A-3 (LatePaymentCharity type)
   │
   └──► Batch C  (Data Model & Disclosure) — breaking field additions
             │
             ├──► Batch D  (Audit Trail)    — needs facilityRef from C-1
             │
             ├──► Batch E  (Performance)    — needs facilityRef from C-1; highest churn
             │                               — implement last among C-group
             │
             └──► Batch G  (Regulator Optional) — do alongside C to avoid double-churn
                                                  — or immediately after C

Batch F  (Product Features) — conditional on FI sign-off; depends on C (facilityRef)

Batch H  (Direct Debit & GSM) — depends on A-2 (CloseDefaultedContract)
                                 — coordinate with C on RecordPayment field additions
```

Recommended execution order: **A → B → C+G (parallel if possible) → D → H → E → F**

Batch A and Batch B can overlap: B does not depend on A except for A-3. Batch H can start after A-2 is merged and should be coordinated with C (both touch `RecordPayment`). In single-engineer mode, execute A fully before starting B or H.

---

## Batch H — Direct Debit & GSM Integration (~2.5 days)

**Goal**: Integrate mono.co Direct Debit (automated installment collection) and Global Standing Mandate / GSM (post-default cross-bank sweep recovery) into the Murabahah lifecycle and collateral workflow. Covers Daml templates, Types, the mono MCP server, and the Monitoring Agent.

**Depends on**: Batch A-2 (`CloseDefaultedContract` — required for the full-GSM-recovery closure path)
**Coordinate with**: Batch C (both add fields to `RecordPayment` / `RepaymentRecord`)

---

### H-1: New Enumerations in `Types.daml`

```daml
data DirectDebitStatus
  = MandateActive
  | MandateSuspended
  | MandateCancelled
  deriving (Eq, Show)

data GSMStatus
  = GSMActive
  | GSMSettled
  | GSMCancelled
  deriving (Eq, Show)
```

Add two new values to `MonitoringAlertType`:
```daml
data MonitoringAlertType
  = DelinquencyRisk
  | CollateralDeterioration
  | AMLFlag
  | FraudSignal
  | SupplierRisk
  | EarlyWarningSignal
  | MandateCancellation   -- borrower's Direct Debit mandate cancelled without FI consent
  | GSMExhausted          -- GSM sweeps exhausted; outstanding balance remains; escalate to Rahn
  deriving (Eq, Show)
```

---

### H-2: `DirectDebitMandate` Template

New bilateral template created at Stage 8 alongside or just after `AcceptProposal`. Captures the borrower's authorisation for automated collection AND their GSM consent in a single on-ledger instrument.

```daml
template DirectDebitMandate
  with
    borrower             : Party
    financialInstitution : Party
    vetify               : Party
    businessName         : Text
    cacRegNumber         : Text
    facilityRef          : Text           -- links to MurabahahContract (after C-1 lands)
    monoMandateRef       : Text           -- mono.co mandate ID returned by create_direct_debit_mandate
    accountRef           : Text           -- borrower's NUBAN (the declared repayment account)
    bankName             : Text
    maxCollectionAmount  : Decimal        -- per-instalment cap (≥ MurabahahTerms.installmentAmount)
    frequency            : Text           -- "MONTHLY"
    mandateStartDate     : Date
    mandateEndDate       : Optional Date  -- mirrors facility tenure end date
    gsmConsentGiven      : Bool           -- True = borrower consents to cross-bank CBN/NIBSS sweep
    gsmConsentDate       : Optional Date  -- date GSM consent was recorded with CBN/NIBSS
    status               : DirectDebitStatus
  where
    signatory borrower, financialInstitution
    observer vetify
    ensure monoMandateRef /= "" && maxCollectionAmount > 0.0 && accountRef /= ""

    choice SuspendMandate : ContractId DirectDebitMandate
      with reason : Text
      controller financialInstitution
      do
        assertMsg "Can only suspend an Active mandate" (status == MandateActive)
        assertMsg "Reason must not be empty" (reason /= "")
        create this with status = MandateSuspended

    choice ReinstateMandate : ContractId DirectDebitMandate
      controller financialInstitution
      do
        assertMsg "Can only reinstate a Suspended mandate" (status == MandateSuspended)
        create this with status = MandateActive

    choice CancelMandate : ContractId DirectDebitMandate
      with reason : Text
      controller financialInstitution
      do
        assertMsg "Reason must not be empty" (reason /= "")
        create this with status = MandateCancelled
```

---

### H-3: `GSMInvocation` Template

Created by the FI after `DefaultContract` + `IssueDemandNotice` + response deadline has passed and `gsmConsentGiven = True` on the `DirectDebitMandate`. The `GSMInvocation` is an audit and coordination record — **it does not hold an independent balance**. All balance changes route through `RecordRecoveryPayment` on `MurabahahContract` (see H-4).

```daml
template GSMInvocation
  with
    financialInstitution : Party
    vetify               : Party
    regulator            : Optional Party
    businessName         : Text
    cacRegNumber         : Text
    facilityRef          : Text
    borrowerBvn          : Text           -- BVN submitted to CBN/NIBSS via mono.co
    invokedAmount        : Decimal        -- outstanding balance at time of invocation
    monoGsmRef           : Text           -- mono.co / NIBSS reference
    invokedAt            : Time
    status               : GSMStatus
    lastSweepRef         : Optional Text  -- NIBSS reference of the most recent sweep
  where
    signatory financialInstitution
    observer vetify, (optionalToList regulator)
    ensure monoGsmRef /= "" && invokedAmount > 0.0 && borrowerBvn /= ""

    -- Each NIBSS sweep: routes recovery through the contract (single source of truth for balance).
    -- contractCid is passed explicitly — same pattern as ConfirmDefault (Daml cannot access self CID).
    choice RecordGSMSweep
        : (ContractId GSMInvocation, ContractId MurabahahContract, ContractId RecoveryPaymentRecord)
      with
        contractCid   : ContractId MurabahahContract
        sweepAmount   : Decimal
        sweepDate     : Date
        nibssSweepRef : Text
      controller financialInstitution
      do
        assertMsg "NIBSS reference must not be empty" (nibssSweepRef /= "")
        assertMsg "Sweep amount must be positive" (sweepAmount > 0.0)
        -- Balance guard is enforced inside RecordRecoveryPayment — not duplicated here.
        (updatedContract, recoveryRecord) <-
          exercise contractCid RecordRecoveryPayment with
            amountRecovered = sweepAmount
            recoveryDate    = sweepDate
            recoverySource  = "GSM_NIBSS"
        updatedGsm <- create this with lastSweepRef = Some nibssSweepRef
        return (updatedGsm, updatedContract, recoveryRecord)

    choice CancelGSM : ContractId GSMInvocation
      with reason : Text
      controller financialInstitution
      do
        assertMsg "Reason must not be empty" (reason /= "")
        create this with status = GSMCancelled
```

Key design decision: `RecordGSMSweep` calls `exercise contractCid RecordRecoveryPayment`. The `MurabahahContract.outstandingBalance` is the authoritative balance. This prevents double-recovery when both GSM and Rahn enforcement are active simultaneously — both paths call `RecordRecoveryPayment`, and the contract's own guard (`amountRecovered <= outstandingBalance`) is the single enforcement point.

---

### H-4: `DirectDebitCollectionAttempt` Template

Immutable record of each mono.co collection attempt. Provides the Monitoring Agent with retry history and an audit trail for failed collections.

```daml
template DirectDebitCollectionAttempt
  with
    financialInstitution : Party
    vetify               : Party
    businessName         : Text
    cacRegNumber         : Text
    facilityRef          : Text
    monoCollectionRef    : Text     -- mono.co collection reference
    installmentNo        : Int
    attemptedAmount      : Decimal
    attemptDate          : Date
    succeeded            : Bool
    failureReason        : Optional Text   -- mono.co failure code, e.g. "INSUFFICIENT_FUNDS"
    retryCount           : Int
  where
    signatory financialInstitution
    observer vetify
    ensure attemptedAmount > 0.0 && monoCollectionRef /= ""
```

---

### H-5: Updates to Existing Templates

**`RecordPayment` on `MurabahahContract`** — add `directDebitRef : Optional Text` parameter. Carry it into `RepaymentRecord`. (Coordinate with Batch C which also touches this choice.)

**`RepaymentRecord`** — add `directDebitRef : Optional Text` field. Distinguishes automated DI collections from manually-submitted FI payments for audit.

**`IssueDemandNotice`** — add `gsmEligible : Bool` field. The FI attests at demand time that a valid GSM consent exists. Gates downstream `GSMInvocation` creation.

**`ProposeEnforceCollateral`** — add `gsmExhausted : Bool` and `gsmRef : Optional Text`. FI explicitly attests whether GSM was attempted before escalating to Rahn enforcement. Carried through to `PendingCollateralEnforcement`.

**`PendingCollateralEnforcement`** — add corresponding `gsmExhausted : Bool` and `gsmRef : Optional Text` fields so vetify sees the attestation when confirming enforcement.

**`CollateralInspectionRecord`** — add `mandateStatus : Optional Text` and `estimatedGsmRecoverable : Optional Decimal`. Monitoring Agent populates these during quarterly security reviews, giving the FI a consolidated view of all security layers at each inspection.

---

### H-6: Six New Tools in `agents/src/mcp/mono-server.ts`

```typescript
// ── DIRECT DEBIT ─────────────────────────────────────────────────────────────

server.registerTool("create_direct_debit_mandate", {
  description: "Create a Direct Debit mandate on a borrower's bank account for automated monthly installment collection. Call this at Stage 8 after AcceptProposal.",
  inputSchema: z.object({
    accountId:   z.string().describe("Mono Connect account ID linked at onboarding"),
    amount:      z.number().describe("Maximum per-collection amount in Kobo (NGN × 100)"),
    frequency:   z.enum(["monthly", "weekly", "daily"]),
    startDate:   z.string().describe("YYYY-MM-DD — date of first collection (first installment due date)"),
    endDate:     z.string().optional().describe("YYYY-MM-DD — mandate expiry, set to facility end date"),
    reference:   z.string().describe("FI internal facility reference for idempotency"),
    narration:   z.string().describe("Description shown on borrower's bank statement"),
  }),
  async handler({ accountId, amount, frequency, startDate, endDate, reference, narration }) {
    return monoPost(`${V2}/direct-debit/mandates`, {
      account_id: accountId, amount, frequency,
      start_date: startDate, end_date: endDate,
      reference, narration,
    });
  },
});

server.registerTool("collect_direct_debit", {
  description: "Trigger a one-off collection against an existing Direct Debit mandate. Use on each installment due date.",
  inputSchema: z.object({
    mandateId: z.string().describe("mono.co mandate ID from create_direct_debit_mandate"),
    amount:    z.number().describe("Collection amount in Kobo"),
    narration: z.string().describe("E.g. 'Murabahah Instalment 3 of 24'"),
    reference: z.string().describe("Unique idempotency key for this specific collection attempt"),
  }),
  async handler({ mandateId, amount, narration, reference }) {
    return monoPost(`${V2}/direct-debit/mandates/${mandateId}/debit`, { amount, narration, reference });
  },
});

server.registerTool("get_mandate_status", {
  description: "Check the current status of a Direct Debit mandate. Use in Monitoring Agent health checks.",
  inputSchema: z.object({ mandateId: z.string() }),
  async handler({ mandateId }) {
    return monoGet(`${V2}/direct-debit/mandates/${mandateId}`);
  },
});

server.registerTool("cancel_direct_debit_mandate", {
  description: "Cancel an active Direct Debit mandate. Call on contract closure, full GSM recovery, or early settlement.",
  inputSchema: z.object({
    mandateId: z.string(),
    reason:    z.string(),
  }),
  async handler({ mandateId, reason }) {
    return monoPost(`${V2}/direct-debit/mandates/${mandateId}/cancel`, { reason });
  },
});

// ── GLOBAL STANDING MANDATE ───────────────────────────────────────────────────

server.registerTool("initiate_gsm", {
  description: "Activate the CBN Global Standing Mandate against a defaulting borrower. Sweeps any Nigerian bank account linked to their BVN via NIBSS. Only call after DefaultContract + IssueDemandNotice deadline has passed and gsmConsentGiven = true.",
  inputSchema: z.object({
    bvn:              z.string().length(11).describe("Borrower BVN — NIBSS resolves all accounts"),
    outstandingAmount: z.number().describe("Amount to recover in Kobo"),
    loanReference:    z.string().describe("Facility reference for NIBSS records"),
    narration:        z.string().describe("Reason for GSM invocation"),
  }),
  async handler({ bvn, outstandingAmount, loanReference, narration }) {
    return monoPost(`${V2}/gsm/initiate`, {
      bvn, amount: outstandingAmount,
      loan_reference: loanReference, narration,
    });
  },
});

server.registerTool("check_gsm_status", {
  description: "Check the status of an active GSM invocation and retrieve completed sweep records.",
  inputSchema: z.object({ gsmRef: z.string().describe("mono.co GSM reference from initiate_gsm") }),
  async handler({ gsmRef }) {
    return monoGet(`${V2}/gsm/${gsmRef}`);
  },
});
```

---

### H-7: Monitoring Agent — Direct Debit Collection Role

Add a second role to the Monitoring Agent system prompt and task logic. The agent currently only detects delinquency; it must now also drive collection and respond to mandate health.

**New system prompt section** (append to `SYSTEM_PROMPT` in `monitoring.ts`):

```
DIRECT DEBIT COLLECTION ROLE (runs on each due date):
1. Identify installments due today from the MurabahahContract paymentSchedule.
2. Check if a DirectDebitMandate exists for this facilityRef with status == MandateActive.
3. If due and not yet collected: call collect_direct_debit with the mandate ref, due amount, and
   a unique reference (facilityRef + installmentNo).
4. Create a DirectDebitCollectionAttempt on the Canton ledger recording the attempt.
5. On webhook success: exercise RecordPayment on the MurabahahContract with the directDebitRef.
6. On webhook failure:
   a. If retryCount < 2: schedule retry after 24 hours (update DirectDebitCollectionAttempt).
   b. If retryCount >= 2 and still failed: exercise FlagDelinquent. Create MonitoringAlert
      (alertType = DelinquencyRisk, severity = HIGH).

MANDATE HEALTH CHECK (runs on every monitoring cycle):
1. For each active DirectDebitMandate: call get_mandate_status to confirm mono.co status matches ledger.
2. If mono.co shows mandate as cancelled/inactive but ledger shows MandateActive:
   a. Exercise SuspendMandate on the DirectDebitMandate.
   b. Create MonitoringAlert with alertType = MandateCancellation, severity = HIGH.
   c. Log: "Mandate cancelled by borrower without FI consent — possible early warning signal."

GSM MONITORING ROLE (runs post-default):
1. Detect MurabahahContracts in Defaulted status where:
   - IssueDemandNotice exists with responseDeadline in the past
   - DirectDebitMandate.gsmConsentGiven = True
   - No active GSMInvocation exists yet
2. Alert FI that GSM eligibility conditions are met. FI exercises initiate_gsm manually or
   through an automated approval flow.
3. For active GSMInvocations: poll check_gsm_status for new sweeps.
4. For each new sweep: exercise RecordGSMSweep (passing contractCid + sweep details).
5. When MurabahahContract.outstandingBalance == 0.0 after a sweep:
   a. Exercise CloseDefaultedContract on the MurabahahContract.
   b. Look up active RahnAgreement for this facilityRef; exercise ReleaseCollateral
      with note "Released: full recovery via GSM" and releaseDocumentRef = gsmRef.
   c. Exercise CancelMandate on the DirectDebitMandate.
   d. Create AuditEvent: eventType = "FULL_RECOVERY_VIA_GSM".
6. If check_gsm_status shows GSMSettled/GSMCancelled with outstanding balance still > 0:
   Create MonitoringAlert with alertType = GSMExhausted, severity = CRITICAL.
   Alert FI to escalate to ProposeEnforceCollateral (Rahn enforcement).
```

---

### H-8: `skills/monitoring/SKILL.md` — New Sections

Append two reference sections to the existing monitoring skill:

**Section: Direct Debit Collection Workflow**
- Retry policy: max 2 retries over 48 hours before flagging delinquency
- Idempotency: check if `RepaymentRecord` with same `directDebitRef` already exists before submitting `RecordPayment`
- What to do if `DirectDebitMandate.status != MandateActive`: do NOT attempt collection; fall back to delinquency detection only; create `MandateCancellation` alert if status changed without FI action
- Concurrency: if borrower makes a manual payment (FI records it) between two collection attempts, check `installmentsPaid` before triggering another collection for the same installment

**Section: GSM Recovery Workflow**
- GSM eligibility checklist: `DefaultContract` exercised, `IssueDemandNotice` created with `gsmEligible = True`, `responseDeadline` has passed, `DirectDebitMandate.gsmConsentGiven = True`, no active `GSMInvocation` yet
- Sweep reconciliation: `RecordGSMSweep` routes through `RecordRecoveryPayment` — the contract's `outstandingBalance` is authoritative
- Recovery sequence: GSM first (fast, automated) → if `GSMExhausted`: escalate to `ProposeEnforceCollateral` (Rahn) → if still outstanding: `WriteOffContract`
- Full recovery closure: `CloseDefaultedContract` + `ReleaseCollateral` + `CancelMandate` must all be called in sequence; the agent handles this atomically
- What GSM cannot collect: fixed assets, pledged property — only liquid bank account balances; Rahn covers the rest

---

## Batch Sequencing and Dependencies

```
Batch A  (Governance & Safety)          — standalone; start here
   │
   ├──► Batch B  (Workflow Completeness) — needs A-3 (LatePaymentCharity type)
   │
   ├──► Batch H  (Direct Debit & GSM)   — needs A-2 (CloseDefaultedContract)
   │         └── coordinate with C on RecordPayment/RepaymentRecord field additions
   │
   └──► Batch C  (Data Model & Disclosure) — breaking field additions
             │
             ├──► Batch D  (Audit Trail)    — needs facilityRef from C-1
             │
             ├──► Batch E  (Performance)    — needs facilityRef from C-1; highest churn
             │                               — implement last among C-group
             │
             └──► Batch G  (Regulator Optional) — do alongside C to avoid double-churn
                                                  — or immediately after C

Batch F  (Product Features) — conditional on FI sign-off; depends on C (facilityRef)
```

Recommended execution order: **A → B+H (parallel after A-2) → C+G (parallel) → D → E → F**

---

## Test Strategy Per Batch

| Batch | New Tests | Updated Tests | Migration Required |
|---|---|---|---|
| A | 4–5 (empty-reason guards, double-moratorium, close-after-recovery) | 1 (`testRecoveryWorkflow` — remove ProposeDefault steps) | Remove `ProposeDefault`/`PendingContractDefault` usages |
| B | 5–6 (reject-replace, guarantee lifecycle, Ibra' grant record, BD-4 FI-ProposeRebate) | 2–3 (Ibra' test controller change, charity type) | Minimal |
| C | 2–3 (facilityRef key lookup, full cost disclosure, profit rate) | High — all contract creation tests | Add `facilityRef` everywhere |
| D | 4–5 (one per new audit record type) | 1 (RecordPayment tuple → named result) | Named result destructuring |
| E | 1 (schedule contract creation and fetch) | Very high — all schedule construction | Full schedule extraction |
| F | 1 per feature | Minimal | Minimal |
| G | 1 (None regulator path, verify no visibility leak) | High — all templates carrying regulator | `Party` → `Optional Party` + `optionalToList` |
| H | 6 (mandate lifecycle, collection attempt, GSM sweep via contract, full GSM closure, mandate-cancellation alert, GSM-exhausted alert) | 2 (RecordPayment + CollateralInspectionRecord — new fields) | Coordinate with C on RecordPayment changes |

---

## Tracking

| Batch | Status | Notes |
|---|---|---|
| A — Governance & Safety | Not started | |
| B — Workflow Completeness | Not started | |
| C — Data Model & Disclosure | Not started | Highest test churn; do before G |
| D — Audit Trail | Not started | |
| E — Performance (Schedule Extraction) | Not started | Implement last |
| F — Product Features | Not started | Awaiting FI sign-off |
| G — Regulator Optionality | Not started | Do alongside or immediately after C |
| H — Direct Debit & GSM | Not started | Start after A-2; coordinate with C on RecordPayment |
