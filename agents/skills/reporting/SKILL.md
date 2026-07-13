---
name: vetify-reporting
description: Write the narrative summary for a regulatory PortfolioReport from pre-computed portfolio metrics. Use this skill when producing a periodic regulatory portfolio report. All counts and sums (active count, total disbursed, outstanding balance, delinquency rate, completion rate) are computed deterministically in code (agents/src/scoring/reporting.ts) before this skill runs — this skill only turns those numbers into a 2-3 paragraph narrative, and has no tool access to write anything to the ledger.
---

# vetify-reporting

## Overview

This skill guides the Reporting Agent's **narrative-writing role only**. The agent following
this skill does **not** query the ledger, does **not** count or sum contracts itself, and does
**not** have tool access to create anything — `aggregatePortfolio()`
(`agents/src/scoring/reporting.ts`) computes every number in code, and `runReportingAgent`
(`agents/src/agents/reporting.ts`) creates the `PortfolioReport` contract directly from that
result plus the narrative this skill produces.

This mirrors the same architecture already applied to Stage 6/9: the LLM previously counted and
summed across every `MurabahahContract` itself before writing the report straight to the ledger
— a categorically different (and harder-to-verify) task than turning already-computed numbers
into prose. A miscounted or mis-summed regulatory report is a real risk; the arithmetic now lives
in code, not in an LLM's reasoning about "dozens of raw contract records."

Unlike Stage 2/3/6/9, there's no new party or human-review escalation for this stage — portfolio
aggregation isn't a judgment call with a "who is accountable for this decision" question to
close. `vetify` remains the signatory of `PortfolioReport`.

## Your Job

You will be given the following pre-computed metrics as input:

- `totalActiveContracts` — count of Active/Delinquent/DelinquencyManualReview contracts
- `totalDisbursed` — sum of `salePrice` across every contract ever created
- `totalOutstanding` — sum of `outstandingBalance` across active contracts
- `totalRepaid` — `totalDisbursed − totalOutstanding`
- `delinquentCount` — count of confirmed `Delinquent` contracts (excludes the ambiguous
  `DelinquencyManualReview` state — see `scoring/monitoring.ts`'s same distinction)
- `completedCount`, `defaultedCount`
- `delinquencyRatePct`, `completionRatePct`

Write **only** a 2-3 paragraph narrative from these numbers — no JSON, no recomputation, no
invented figures:

1. **Portfolio overview** — total contracts created, currently active, total disbursed, total
   outstanding, total repaid to date.
2. **Portfolio health** — delinquency rate as a percentage, delinquent vs on-schedule contracts,
   completion rate.
3. **Risk notes** (only if the numbers actually suggest something notable — a non-trivial
   delinquency rate, defaults present). Do not invent concentration risk, trend claims, or
   specific facility references the given numbers don't support — a short closing sentence is
   fine when there's nothing notable.

Example narrative, given `totalActiveContracts: 12, totalDisbursed: 48_500_000,
totalOutstanding: 31_200_000, totalRepaid: 17_300_000, delinquentCount: 1, completedCount: 3,
defaultedCount: 0, delinquencyRatePct: 8.3, completionRatePct: 20`:

> As of the report date, the Vetify Murabahah portfolio comprises 12 active financing contracts
> with a total disbursed value of ₦48,500,000. Outstanding balance stands at ₦31,200,000, with
> ₦17,300,000 collected to date.
>
> The portfolio delinquency rate is 8.3% (1 of 12 active contracts). Three contracts have been
> fully repaid and closed (a 20% completion rate). No defaults have been recorded.
>
> Overall portfolio health is satisfactory, with no defaults and a single delinquent facility
> under monitoring.

## Reporting Schedule

The Supervisor triggers the Reporting Agent on the first day of each month. Each report is a
**new** `PortfolioReport` contract — previous reports are not archived, allowing the regulator to
see the full history on-ledger. A report is generated even when the portfolio is empty (0 active
contracts) — never omit a scheduled report.

## Regulatory Context

`PortfolioReport` (`Vetify.Reporting:PortfolioReport`) is the primary regulatory disclosure
mechanism for the CBN Non-Interest Financial Institutions supervision framework.
