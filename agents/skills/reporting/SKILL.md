---
name: vetify-reporting
description: Generate a PortfolioReport contract on the Canton ledger. Use this skill when producing a periodic regulatory portfolio report. Aggregates all MurabahahContract and RepaymentRecord data, calculates portfolio metrics (active count, total disbursed, outstanding balance, delinquency rate, completion rate), writes a 2-3 paragraph health summary, and creates a PortfolioReport contract visible to the financial institution and regulator.
---

# vetify-reporting

## Overview

This skill guides the Reporting Agent through generating a `PortfolioReport` — an on-ledger
regulatory record that the financial institution and the CBN regulator can observe.

Reports are produced periodically (monthly by default) and represent a point-in-time
snapshot of the entire Murabahah financing portfolio.

## Step-by-Step Workflow

### Step 1 — Query MurabahahContract Portfolio

Call `get_active_contracts` on `Onboarding:MurabahahContract`.

For each contract, record:
- `status`: Active / Delinquent / Completed / Defaulted
- `murabahahTerms.salePrice`: total obligation
- `outstandingBalance`: remaining balance
- `financialInstitution`: the FI party (use for the report)

### Step 2 — Query RepaymentRecord History

Call `get_active_contracts` on `Onboarding:RepaymentRecord`.

Sum `amountPaid` across all records to get total cash collected to date.

### Step 3 — Calculate Portfolio Metrics

```
totalActiveContracts = count(status == Active) + count(status == Delinquent)
totalDisbursed       = sum(murabahahTerms.salePrice) across ALL contracts
totalOutstanding     = sum(outstandingBalance) across Active + Delinquent contracts
totalRepaid          = totalDisbursed − totalOutstanding
delinquentCount      = count(status == Delinquent)
completedCount       = count(status == Completed)
delinquencyRate      = delinquentCount / totalActiveContracts × 100  (%)
```

### Step 4 — Write Portfolio Summary

The summary must be 2–3 paragraphs covering:

**Paragraph 1 — Portfolio Overview**
Total contracts created, currently active, total amount disbursed, total outstanding balance,
and total amount repaid to date.

**Paragraph 2 — Portfolio Health**
Delinquency rate as a percentage. Number of delinquent vs on-schedule contracts.
Completion rate (completedCount as % of total ever created).

**Paragraph 3 — Risk Notes (if applicable)**
Any concentration risk (one borrower holding > 20% of portfolio).
Trend in delinquency (improving or worsening vs previous period if data available).
Notable completed or defaulted contracts.

Example summary:

> As of 2026-06-26, the Vetify Murabahah portfolio comprises 12 active financing contracts
> with a total disbursed value of ₦48,500,000. Outstanding balance stands at ₦31,200,000,
> representing 64.3% of total disbursements. A total of ₦17,300,000 has been collected
> through 94 recorded repayment installments.
>
> The portfolio delinquency rate is 8.3% (1 of 12 active contracts flagged as Delinquent).
> Three contracts have been fully repaid and closed (completion rate: 20% of 15 total contracts
> ever created). No defaults have been recorded.
>
> No single-borrower concentration exceeds 15% of total outstanding. The delinquent contract
> (CAC RC-00045821) has been flagged for 6 weeks; the financial institution has been notified
> for potential restructuring. Overall portfolio health is satisfactory.

### Step 5 — Create the PortfolioReport Contract

Use `create_contract` with template `Onboarding:PortfolioReport`:

```json
{
  "templateId": "Onboarding:PortfolioReport",
  "payload": {
    "vetify": "vetify-party-id",
    "financialInstitution": "fi-party-id",
    "regulator": "regulator-party-id",
    "reportDate": "2026-06-26",
    "totalActiveContracts": 12,
    "totalDisbursed": 48500000.0,
    "totalOutstanding": 31200000.0,
    "delinquentCount": 1,
    "completedCount": 3,
    "summary": "..."
  }
}
```

## Reporting Schedule

The Supervisor triggers the Reporting Agent on the first day of each month.
Each report is a **new** `PortfolioReport` contract — previous reports are not archived,
allowing the regulator to see the full history on-ledger.

## Regulatory Context

The `PortfolioReport` is the primary regulatory disclosure mechanism for the CBN Non-Interest
Financial Institutions supervision framework. It must be generated even when the portfolio
is empty (0 active contracts). Never omit a scheduled report.
