# mono.co Underwriting Field Reference

## Honesty note on scope

`agents/src/mcp/mono-server.ts`'s `get_account_statement`/`get_account_transactions`/
`assess_creditworthiness` tools pass mono.co's raw JSON response straight through, unparsed
(`monoGet`/`monoPost` just `JSON.stringify` whatever mono.co returns — confirmed by reading the
tool implementations before writing this file). **No raw mono.co response schema is
independently verified or documented anywhere in this codebase.** The Underwriting Agent's LLM
component is relied upon to read mono.co's actual API response (using its own training
knowledge of mono.co's public API) and map it onto the normalized transaction shape below — a
relay/normalization task, not computation (see `agents/src/agents/underwriting.ts`'s own doc
comment on this). Do not treat any raw field name below as verified against a live mono.co
response; only the *normalized* output contract is something this codebase actually enforces
and tests.

## The Normalized Evidence Contract (verified — this is what the scoring engines consume)

This is the only part of the pipeline with a real, tested contract: `agents/src/scoring/types.ts`'s
`NormalizedTransaction`/`TransactionEvidence`/`CreditworthinessEvidence`, consumed by
`scoreUnderwriting()` (`agents/src/scoring/underwriting.ts`), which orchestrates five independent
engines (Financial Behaviour, Cashflow Risk, Creditworthiness, Fraud Detection, Final Decision —
each in its own `underwriting-*.ts` file).

| Field | Type | Derived from |
|---|---|---|
| `transactions[].date` | ISO 8601 string | `get_account_statement` / `get_account_transactions` |
| `transactions[].amount` | number, always positive (NGN) | same |
| `transactions[].direction` | `"credit"` \| `"debit"` | same |
| `transactions[].description` | string, optional | same |
| `transactions[].counterparty` | string, optional | same — used by the Fraud Detection engine's round-tripping check and the Cashflow Risk engine's recurring-debt detection (a debt-obligation group needs a named counterparty; a generic recurring expense with no counterparty is never classified as debt) |
| `transactions[].balanceAfter` | number, optional | same — ONLY if the statement actually reports a running/closing balance; never estimated. Feeds the Financial Behaviour engine's liquidity factor and the Cashflow Risk engine's cash-reserve-months factor, both best-effort (score 0 + a `*_UNAVAILABLE` flag when absent) |
| `dscr` | number, optional | `assess_creditworthiness` — see the webhook note below |
| `creditScore` | number, optional | `assess_creditworthiness` — bureau-backed score, if mono.co returns one |

The Underwriting Agent's system prompt (`agents/src/agents/underwriting.ts`) instructs the LLM to
report **exactly** this JSON shape — no more, no less, and critically, no aggregation. All
arithmetic (net cashflow, revenue variance, recurring-debt detection, fraud pattern matching)
happens deterministically in code from the raw transaction list
(`agents/src/scoring/underwriting-transactions.ts` and the five engine files), not in the LLM. It
must not report a score, risk category, or recommended limit; those are computed deterministically
from this evidence.

## assess_creditworthiness — Known Webhook Behavior

`assess_creditworthiness`'s own tool description says the result is "delivered via webhook."
This codebase's webhook receiver is `POST /api/webhooks/mono/creditworthiness`
(`backend/src/routes/webhooks.ts`), which persists incoming results keyed by the `reference`
mono.co echoes back from the initiating `assess_creditworthiness` call. The agent triggers the
check, then polls the backend for the persisted result for a bounded window (see
`agents/src/agents/underwriting.ts` — `pollCreditworthinessResult`) before giving up. If no
result arrives in time, `dscr` is reported as `null`/omitted rather than fabricated, and the
Cashflow Risk engine treats a missing DSCR the same principled way the Financial Behaviour engine
treats a missing `businessIncorporationDate`: contribute 0 to that factor and raise a
`DSCR_UNAVAILABLE` flag instead of guessing.

## Fraud Detection — Explicitly Rule-Based, Not ML

`agents/src/scoring/underwriting-fraud-detection.ts` runs four deterministic pattern checks over
the normalized transaction list — structuring, round-tripping, pre-application income spikes,
transaction velocity anomalies. There is no labeled fraud-outcome dataset for this platform (same
"no historical data yet" reasoning that keeps `RiskAssessment`'s PD/LGD/EAD fields unpopulated),
so a trained ML fraud model would have nothing to validate against. These heuristics are
explainable — each names exactly which transactions triggered it — at the cost of being far less
sensitive than a trained model. Treat the Fraud Detection score as a first-pass screen for a human
reviewer, not a final determination.

## What to Look For When Reading the Raw Statement/Transactions

Regardless of mono.co's exact raw field names, when mapping onto the normalized shape above, look
for and preserve:
- A counterparty name where the statement identifies one (recurring-debt and round-tripping
  detection both depend on it — a transaction with no counterparty is never classified as debt)
- Any running/closing balance the statement reports per transaction or per period (liquidity and
  cash-reserve scoring are best-effort and depend on this being present)
- Enough transaction density and date coverage across the full 6 months for the deterministic
  engines' own aggregation (variance, recurring-debt, fraud pattern windows) to be meaningful —
  don't silently truncate to only the most recent activity
