---
name: vetify-collections
description: Manage Direct Debit collection retries and GSM (Global Standing Mandate) escalation for a Vetify MurabahahContract. Used by the Collections Agent (runCollectionsAgent), dispatched alongside the Delinquency Monitor for every Active/Delinquent contract. Sequential API-orchestration workflow, not a scored judgment call — kept separate from the deterministic delinquency-flagging decision.
---

# vetify-collections

## Overview

This skill guides the Collections Agent — Direct Debit retries and GSM escalation for Stage 9.
Unlike delinquency detection (`skills/monitoring`), these are sequential API-orchestration
workflows: given a mandate/collection status, there's a fixed procedural response, not a
judgment call a deterministic scoring engine needs to weigh. This agent keeps full Canton +
mono.co tool access accordingly.

## Acting Party (critical — the wrong party fails ledger authorization)

| Ledger action | Party |
|---|---|
| Create `DirectDebitCollectionAttempt`, `GSMInvocation` (both FI-signed) | `create_contract` with `party: "financialInstitution"` |
| Exercise `SuspendMandate`/`ReinstateMandate`/`CancelMandate`, `RecordGSMSweep`/`CancelGSM`, `RecordPayment` (all FI-controlled) | `exercise_choice` as `"financialInstitution"` |
| Create `MonitoringAlert` (vetify-signed) | `create_contract` as `"vetify"` (the default) |

## Direct Debit Collection Management

When a `MurabahahContract` has an active `DirectDebitMandate` (status = `MandateActive`):

1. On each installment due date, call `initiate_collection` with the mandate ID, installment
   amount, and a unique `facilityRef`+`installmentNo` reference.
2. After initiating, call `get_collection_status` to check the result:
   - **SUCCESS**: call `exercise_choice` `RecordPayment` on `MurabahahContract` with
     `directDebitRef` set to the `monoCollectionRef`, and `existingGuardCid: null` — each
     collection uses a fresh, unique reference (step 1), so there is never an existing
     `PaymentIdempotencyGuard` to pass here. This records the payment on-ledger.
   - **FAILED**: create a `DirectDebitCollectionAttempt` contract (`succeeded = false`,
     `failureReason` = mono.co's failure code). If `retryCount < 3`, retry the next business
     day. After 3 failures, alert the FI via a `MonitoringAlert` contract (`alertType =
     MandateCancellation`) and suspend the mandate via `SuspendMandate`.
3. If the borrower cancels a mandate without FI consent (status changes to `MandateCancelled`
   on-ledger without a `SuspendMandate` or `CancelMandate` from the FI), raise a
   `MonitoringAlert` with `alertType = MandateCancellation` and notify the FI immediately.

## GSM Escalation

The CBN Global Standing Mandate (GSM) is a last-resort cross-bank sweep. Invoke it only when
**all** of the following are true:

| Condition | How to verify |
|---|---|
| `MurabahahContract.status = Defaulted` | contract payload |
| `DemandNotice.gsmEligible = True` | fetch `DemandNotice` for this `facilityRef` |
| `DemandNotice.responseDeadline` has passed | compare with today's date |
| `DirectDebitMandate.gsmConsentGiven = True` | fetch `DirectDebitMandate` for this `facilityRef` |

**Steps:**

1. Call `initiate_gsm` with `bvn` (from onboarding), `amountKobo` (outstanding balance × 100), a
   unique `reference` (`<facilityRef>-GSM-001`), and a clear `narration`.
2. Create a `GSMInvocation` contract on Canton with the returned `monoGsmRef`, `status =
   GSMActive`, `invokedAmount = outstandingBalance`.
3. Poll `get_gsm_status` every 48 hours. When a sweep is confirmed (status contains a completed
   sweep):
   - Exercise `RecordGSMSweep` on the `GSMInvocation` contract with the sweep amount and NIBSS
     reference. This internally posts a `RecordRecoveryPayment` on the `MurabahahContract`.
4. When `get_gsm_status` reports all sweeps exhausted and the balance is still > 0:
   - Exercise `CancelGSM` on the `GSMInvocation` contract.
   - Create a `MonitoringAlert` with `alertType = GSMExhausted` to trigger Rahn enforcement
     review by the FI.

## Delinquency Detection

Not in scope for this skill — that's the separate Delinquency Monitor's responsibility
(`skills/monitoring` for the autonomous evidence-only path, `skills/monitoring-review` for the
human-supervised ACP session), a deterministically-scored decision rather than procedural
orchestration.
