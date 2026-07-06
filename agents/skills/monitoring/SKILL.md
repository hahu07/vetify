---
name: vetify-monitoring
description: Monitor an active Vetify MurabahahContract for missed installment payments and delinquency. Use this skill when checking a MurabahahContract with Active status during each Supervisor poll cycle. Calculates expected vs actual installments, verifies with mono.co transaction data if needed, and exercises FlagDelinquent on the Canton ledger when a borrower has missed more than one payment cycle.
---

# vetify-monitoring

## Overview

This skill guides the Monitoring Agent through Stage 9 delinquency detection. The agent runs
on every Supervisor poll cycle for each Active `MurabahahContract`. It is idempotent — running
it multiple times on the same contract produces the same outcome.

A borrower is **DELINQUENT** when they are more than one full installment cycle behind schedule.
One missed payment triggers a WATCH state (logged but no action). Two or more missed payments
triggers `FlagDelinquent`.

## Step-by-Step Workflow

### Step 1 — Parse the Contract

From the contract payload, extract:

| Field | Used for |
|---|---|
| `startDate` | Calculate months elapsed |
| `murabahahTerms.tenureMonths` | Maximum installment count |
| `murabahahTerms.installmentAmount` | Expected per-period payment |
| `installmentsPaid` | Actual payment count recorded on-ledger |
| `outstandingBalance` | Current balance |
| `cacRegNumber` | Identify borrower for RepaymentRecord query |

### Step 2 — Calculate Payment Schedule Position

```
today          = current date
monthsElapsed  = months from startDate to today (round down to complete months)
expectedPaid   = min(monthsElapsed, tenureMonths)
actualPaid     = installmentsPaid from contract
missedCount    = expectedPaid − actualPaid
```

| missedCount | State | Action |
|---|---|---|
| ≤ 0 | CURRENT | No action |
| 1 | WATCH | Log only — one grace period |
| ≥ 2 | DELINQUENT | Exercise `FlagDelinquent` |

### Step 3 — Query RepaymentRecords (optional verification)

Call `get_active_contracts` on `Onboarding:RepaymentRecord` filtered by `cacRegNumber`
to cross-check the on-ledger payment history. This guards against stale `installmentsPaid`
counts if a `RecordPayment` choice was recently exercised.

If RepaymentRecord count matches `installmentsPaid` → contract state is consistent.

### Step 4 — Verify with mono.co (optional)

If the borrower appears delinquent but the missed payment is recent (< 5 days), call
`get_account_transactions` to check for a bank credit that hasn't been recorded on-ledger yet.

If a matching credit is found (amount ≈ `installmentAmount`, date within last 7 days):
→ Log the finding and skip `FlagDelinquent` (payment may be in processing)

### Step 5 — Exercise FlagDelinquent

If DELINQUENT and no recent bank credit found:

```json
{
  "choice": "FlagDelinquent",
  "argument": {
    "reason": "Borrower has missed 2 installment(s). Expected 6 payments by 2026-06-01, only 4 recorded on-ledger. No unrecorded bank credits found via mono.co."
  },
  "party": "vetify"
}
```

### Step 6 — No-Op Cases

Do NOT exercise any choice if:
- Contract is already `Delinquent` (status check in agent entry point)
- Contract is `Completed` or `Defaulted`
- `missedCount` ≤ 1
- A recent unrecorded bank credit was found

## Delinquency Escalation Path

```
Active (on schedule)
    ↓  miss 1 payment
Active (WATCH — logged, no Canton action)
    ↓  miss 2nd payment
Active → FlagDelinquent → Delinquent
    ↓  payment received
Delinquent → RecordPayment → Active (restored by FI)
    ↓  sustained non-payment (manual FI decision)
Delinquent → Defaulted (manual FI action, outside agent scope)
```

---

## Direct Debit Collection

Automated installment collection runs via mono.co Direct Debit when a `DirectDebitMandate`
contract (status = `MandateActive`) exists for the borrower.

**On each installment due date:**

1. Call `initiate_collection` with the `monoMandateRef`, installment amount (Kobo), and
   a unique reference: `<facilityRef>-INST-<installmentNo>`.
2. Call `get_collection_status` to confirm success or failure.
3. **On SUCCESS**: exercise `RecordPayment` on `MurabahahContract` with `directDebitRef`
   set to the `monoCollectionRef`. The FI reviews the auto-recorded payment.
4. **On FAILURE**: create a `DirectDebitCollectionAttempt` with `succeeded = False` and
   the mono.co failure code in `failureReason`.
   - Retry up to 3 times on successive business days.
   - After 3 failures: exercise `SuspendMandate` on `DirectDebitMandate`, then
     create a `MonitoringAlert` with `alertType = MandateCancellation` so the FI's
     operations team can intervene.

**Mandate cancellation by borrower (without FI consent):**
If you observe `DirectDebitMandate.status = MandateCancelled` but no `SuspendMandate`
or `CancelMandate` was exercised by the FI, raise a `MonitoringAlert` immediately.

---

## GSM Escalation

The CBN Global Standing Mandate (GSM) is a last-resort cross-bank sweep. Invoke it only
when **all** of the following are true:

| Condition | How to verify |
|---|---|
| `MurabahahContract.status = Defaulted` | contract payload |
| `DemandNotice.gsmEligible = True` | fetch DemandNotice for this facilityRef |
| `DemandNotice.responseDeadline` has passed | compare with today's date |
| `DirectDebitMandate.gsmConsentGiven = True` | fetch DirectDebitMandate for this facilityRef |

**Steps:**

1. Call `initiate_gsm` with `bvn` (from onboarding), `amountKobo` (outstanding balance × 100),
   a unique `reference` (`<facilityRef>-GSM-001`), and a clear `narration`.
2. Create a `GSMInvocation` contract on Canton with the returned `monoGsmRef`,
   `status = GSMActive`, `invokedAmount = outstandingBalance`.
3. Poll `get_gsm_status` every 48 hours. When a sweep is confirmed (status contains a
   completed sweep):
   - Exercise `RecordGSMSweep` on the `GSMInvocation` contract with the sweep amount and
     NIBSS reference. This internally posts a `RecordRecoveryPayment` on the `MurabahahContract`.
4. When `get_gsm_status` reports all sweeps exhausted and the balance is still > 0:
   - Exercise `CancelGSM` on the `GSMInvocation` contract.
   - Create a `MonitoringAlert` with `alertType = GSMExhausted` to trigger Rahn enforcement
     review by the FI.
