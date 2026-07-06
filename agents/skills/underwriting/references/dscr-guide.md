# DSCR (Debt Service Coverage Ratio) Guide

Source: `agents/src/scoring/underwriting-cashflow-risk.ts` (the authoritative implementation) and
`agents/skills/underwriting/SKILL.md`. This file documents the same formulas in narrative form
for anyone reading the skill without also reading the TypeScript.

DSCR is one factor scored by the **Cashflow Risk engine** — one of five independent engines that
make up Stage 6 (`agents/src/scoring/underwriting.ts` orchestrates Financial Behaviour, Cashflow
Risk, Creditworthiness, Fraud Detection, and a Final Decision combinator).

## What DSCR Measures

DSCR = Net Operating Income / Total Debt Service

In this platform's context (SME Murabahah financing), mono.co's `assess_creditworthiness`
computes DSCR from the linked bank account's cash flow: net income available each month,
divided by the total monthly debt obligations (existing debt plus the proposed installment).
A DSCR of 1.0 means income exactly covers debt service with nothing left over; above 1.0 means
there's a cushion; below 1.0 means the borrower cannot fully cover payments from income alone.

## DSCR Risk Bands (used by `scoreDscr` in underwriting-cashflow-risk.ts)

| DSCR | Risk | Points (of 40 max) |
|---|---|---|
| ≥ 1.5 | Low | 40 (full) |
| 1.0 – 1.5 | Medium | 22 (partial) |
| < 1.0 | High | 0 |

DSCR is 40 of the Cashflow Risk engine's own 100 points (the engine's other three factors —
existing-debt leverage 25, cash reserve months 20, and the 3-scenario stress test 15 — also
matter). The Cashflow Risk engine itself is then one of four engines combined by the Final
Decision engine (default weight 35 of the overall composite) — see
`agents/src/scoring/underwriting-final-decision.ts`.

## Recommended Limit Formula

Computed by the Final Decision engine, not the Cashflow Risk engine itself:

```
recommendedLimit = min(requestedAmount, multiplier × averageMonthlyNetInflow)
multiplier = 3 if DSCR < 1.0 or unavailable, else 6
```

Rounded to the nearest ₦100,000. The multiplier drops from 6x to 3x specifically when DSCR
signals the borrower is already at or past their coverage limit (or is unknown, treated
conservatively) — halving the ceiling on how much more can be responsibly recommended,
independent of the requested amount.

## The 3-Scenario Stress Test

A genuinely new factor (15 of the Cashflow Risk engine's 100 points): recomputes an affordability
check at three revenue haircuts — -10%, -25%, -40% — against existing debt obligations plus an
*estimated* installment (`requestedAmount / tenureMonths`, principal-only, since the real
Murabahah installment including profit margin isn't set until Stage 8). Scored by how many of the
three scenarios still clear:

| Scenarios Passed | Points (of 15 max) | Flag |
|---|---|---|
| All 3 | 15 | — |
| 1–2 | 7 | `STRESS_TEST_PARTIAL` |
| 0 | 0 | `STRESS_TEST_FAILED` |
| N/A (no tenure) | 0 | `STRESS_TEST_UNAVAILABLE` |

## Interpreting Revenue Variance Alongside DSCR

A single-month DSCR snapshot can look healthy even for a highly seasonal business if the
assessment window happens to fall in a strong month. That's why `revenueVarianceRatio`
(coefficient of variation of monthly inflows across the 6-month statement, now computed
deterministically in code from the raw transaction list, not derived by the LLM) is scored by the
**Financial Behaviour engine** as its own factor (30 of that engine's 100 points) rather than
folded into DSCR — a business with DSCR 1.6 but 50% revenue variance is a materially different
risk than one with DSCR 1.6 and 10% variance, even though mono.co's single DSCR figure wouldn't
distinguish them.

| Variance Ratio | Band | Points (of 30 max, Financial Behaviour engine) |
|---|---|---|
| < 0.20 | Consistent | 30 |
| 0.20 – 0.40 | Moderate | 15 |
| > 0.40 | Volatile | 0 (also raises the `HIGH_REVENUE_VARIANCE` flag) |

## Known Limitation

`assess_creditworthiness`'s own tool description (`agents/src/mcp/mono-server.ts`) states the
result is delivered via webhook, not returned synchronously from the API call.
`backend/src/routes/webhooks.ts` receives it and `agents/src/agents/underwriting.ts`'s
`pollCreditworthinessResult` polls for it with a bounded timeout. If nothing arrives, `dscr` is
passed through as `undefined` — never fabricated — and the Cashflow Risk engine scores that
factor 0 with a `DSCR_UNAVAILABLE` flag, distinct from a confirmed `DSCR_BELOW_ONE` finding.
