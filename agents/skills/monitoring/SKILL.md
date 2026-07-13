---
name: vetify-monitoring
description: Gather Stage 9 transaction evidence from mono.co Connect for an active or delinquent Vetify MurabahahContract, as evidence only. Use this skill when checking a MurabahahContract with Active or Delinquent status during each Supervisor poll cycle. The delinquency decision (ResumeActive/FlagDelinquent/FlagForDelinquencyReview) is computed by a deterministic scoring engine, not by this skill.
---

# vetify-monitoring

## Overview

This skill guides the Delinquency Monitor's **evidence-gathering role only**. The agent
following this skill does **not** decide whether a borrower is delinquent, does **not** decide
whether to flag for human review, and does **not** have tool access to exercise any Canton
choice — those are handled deterministically, in code, by `agents/src/scoring/monitoring.ts`
(`scoreDelinquency`), from the exact evidence this skill instructs the agent to report.

This mirrors the same architecture already applied to Stage 2/3 (`agents/src/scoring/
verification.ts`, `compliance.ts`) and Stage 6 (`agents/src/scoring/underwriting-*.ts`): the
missed-installment math, the ambiguous-vs-clear-cut classification, and the choice dispatch all
happen in code, not by trusting an LLM to follow a natural-language rubric faithfully. Your only
job is to call `get_account_transactions` and report **exactly** the normalized transaction list
requested — never a delinquency verdict, a status, or a recommendation.

## Step-by-Step Workflow

### Step 1 — Retrieve Recent Transactions

Call `get_account_transactions` for the borrower's linked account, covering the last 14 days.
This is the only tool call you make — unlike Stage 6, there's no separate creditworthiness check
here.

### Step 2 — Relay, Don't Compute

Your only job is to RELAY the transactions, normalized — do not calculate months elapsed,
expected installments, or a delinquency verdict yourself. For every transaction, map mono.co's
fields onto:

```json
{
  "date": "<ISO 8601 date>",
  "amount": <number, always positive, NGN>,
  "direction": "credit" | "debit",
  "description": "<string, optional>",
  "counterparty": "<string, optional>"
}
```

### Step 3 — Report Evidence Only

Respond with **only** this JSON object — no delinquency verdict, no status, no recommendation:

```json
{
  "transactions": [ ...as above... ]
}
```

`agents/src/scoring/monitoring.ts` (`scoreDelinquency`) takes this evidence plus the contract's
own `startDate`/`installmentsPaid`/`murabahahTerms` fields, computes `missedCount`, and decides
`NoOp` / `ResumeActive` / `FlagDelinquent` / `FlagForDelinquencyReview`. `runDelinquencyMonitor`
(in code, not the LLM) then exercises the resulting choice.

## What the Deterministic Engine Does With This (for context only — not your job)

`scoreDelinquency` computes `expectedPaid = min(monthsElapsed, tenureMonths)` and `missedCount =
expectedPaid − installmentsPaid`. Unlike Stage 2/3/6's Medium band (genuinely insufficient or
conflicting evidence), one missed payment alone isn't ambiguous — it's just early. The engine
escalates to a human sentinel (`FlagForDelinquencyReview`) specifically when: exactly one
installment is missed (too early to be sure it's a real default), or two-or-more appear missed
but a bank credit roughly matching the installment amount was found within the last 7 days
(a plausible unrecorded payment). Two-or-more missed with no offsetting credit auto-flags
(`FlagDelinquent`); a borrower back on schedule auto-clears (`ResumeActive`) if the contract was
`Delinquent`/`DelinquencyManualReview`.

`FlagDelinquent`/`ResumeActive` are exercised as `["sentinel", "vetify"]` (dual controller,
gated by the `AuthorizedSentinel` registry — fails closed if the sentinel party isn't currently
registered and active). `FlagForDelinquencyReview` is `vetify` alone (pure escalation, no
sentinel decision made yet).

## Direct Debit and GSM

Direct Debit collection retries and GSM (Global Standing Mandate) escalation are **not** part of
this skill — they're sequential API-orchestration workflows, not a scored delinquency judgment,
handled by the separate Collections Agent (`skills/collections`, `runCollectionsAgent`).
