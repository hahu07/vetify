---
name: vetify-underwriting
description: Gather Stage 6 transaction and creditworthiness evidence from mono.co Connect/Creditworthiness for a Vetify FinancingRequest, as the `vetify` party. Use this skill when processing a FinancingRequest contract in Submitted status. Scoring, risk categorization, and the recommended limit are computed by five independent deterministic engines, not by this skill.
---

# vetify-underwriting

## Overview

This skill guides the Underwriting Agent's **evidence-gathering role only**. The agent following
this skill does **not** compute any risk score, does **not** decide the risk category, does
**not** calculate the recommended limit, and does **not** have tool access to exercise any Canton
choice — those are handled deterministically, in code, by five independent scoring engines
(`agents/src/scoring/underwriting-*.ts`, orchestrated by `underwriting.ts`), from the exact
evidence this skill instructs the agent to report.

This is a deliberate architecture, matching Stages 2/3 (`agents/src/scoring/verification.ts`,
`compliance.ts`): it makes underwriting outcomes reproducible from a fixed rubric instead of
depending on how faithfully an LLM follows natural-language scoring instructions. Your only job is
to call the right tools and **relay** transaction data — never aggregate, average, or score it
yourself.

The financial institution, not this agent, makes the final funding decision (Stage 7,
`ApproveFunding`/`RejectFunding`) — this agent's output only informs that decision.

## Step-by-Step Workflow

### Step 1 — Retrieve Bank Statement

Call `get_account_statement` with:
- `accountId`: from the contract payload (or derived from `cacRegNumber` if not available)
- `startDate`: 6 months before today
- `endDate`: today

### Step 2 — Retrieve Transactions

Call `get_account_transactions` with the same account ID.

### Step 3 — Assess Creditworthiness

Call `assess_creditworthiness` with the account ID. Mono.co returns `dscr` (Debt Service
Coverage Ratio) and `creditScore` (bureau-backed) — usually via webhook (see below), not
synchronously.

**Known behavior**: mono-server.ts's own tool description states this result is "delivered via
webhook." `backend/src/routes/webhooks.ts` receives it; report the `reference` from this call's
response exactly as given — code polls the webhook receiver using that reference. Report
`dscr`/`creditScore` yourself ONLY if the synchronous response happens to include them; never
invent a value if it doesn't.

### Step 4 — Normalize and Relay Transactions (do not aggregate)

For every transaction in the last 6 months (cap at the 300 most recent if there are more), map
mono.co's raw fields onto this normalized shape — no computation, just relaying:

```json
{
  "date": "2026-04-15T00:00:00.000Z",
  "amount": 850000,
  "direction": "credit",
  "description": "Sales revenue",
  "counterparty": "Acme Traders",
  "balanceAfter": 2500000
}
```

- `amount` is always positive; `direction` is `"credit"` or `"debit"`.
- `description`/`counterparty` are optional — include them when the statement identifies them.
- `balanceAfter` is optional — include it ONLY if the statement actually reports a running/closing
  balance for that transaction; do not estimate or compute one.

This is a deliberate change from an earlier version of this skill, which asked you to derive
`averageMonthlyNetInflow`/`revenueVarianceRatio`/`existingMonthlyDebtObligations` yourself. That
required real arithmetic over "dozens of raw transaction records" — a categorically different (and
harder to verify) task than Stage 2/3's evidence-gathering, which only does categorical bucketing
of a single API field. Relaying a normalized list is a lower-trust task: you're not computing
anything, just mapping fields, and every engine below derives its own numbers deterministically
from the same list in code.

### Step 5 — Report Evidence Only

Respond with **only** this JSON object — no score, no risk category, no recommended limit, no
recommendation text:

```json
{
  "transactions": [ ...as in Step 4... ],
  "creditworthinessReference": "mono-ref-abc123",
  "dscr": 1.3,
  "creditScore": 640
}
```

`agents/src/scoring/underwriting.ts` (`scoreUnderwriting`) takes this evidence and computes the
score, risk category, and recommended limit, then `runUnderwritingAgent` (in code, not the LLM)
exercises `BeginUnderwriting` with the result.

## What the Five Deterministic Engines Do With This (for context only — not your job)

Stage 6 is scored by five independent engines, not one flat formula:

- **Financial Behaviour** (`underwriting-financial-behaviour.ts`) — revenue consistency, business
  age, expense discipline (burn rate), and liquidity (balance-derived buffer, best-effort).
  Populates `RiskAssessment.behaviouralScore`.
- **Cashflow Risk** (`underwriting-cashflow-risk.ts`) — DSCR, existing-debt leverage, cash reserve
  months (best-effort), and a 3-scenario stress test (-10%/-25%/-40% revenue haircuts against
  existing debt plus an estimated installment). Populates `cashflowRiskScore`.
- **Creditworthiness** (`underwriting-creditworthiness.ts`) — bands the bureau `creditScore`.
  Populates `creditworthinessScore`.
- **Fraud Detection** (`underwriting-fraud-detection.ts`) — four rule-based transaction pattern
  checks (structuring, round-tripping, pre-application income spikes, transaction velocity
  anomalies). Explicitly heuristic, **not** machine learning — there's no labeled fraud-outcome
  dataset for this platform yet. Populates `fraudScore`.
- **Final Decision** (`underwriting-final-decision.ts`) — combines the four sub-scores with
  policy-configurable engine-level weights into the composite score/riskCategory, computes the
  recommended limit, and forces High risk if the Fraud Detection score falls below a review
  threshold regardless of the weighted composite.

**Known data gaps, handled the same principled way throughout**: an unrecognized/missing
incorporation date scores 0 for business age and flags `BUSINESS_AGE_UNKNOWN` (not a confirmed
new business); an unavailable DSCR scores 0 and flags `DSCR_UNAVAILABLE` (not a confirmed
sub-1.0 DSCR); missing balance data scores 0 for liquidity/cash-reserve and flags
`*_UNAVAILABLE`. Never fabricated, never silently treated as the worst confirmed case.
