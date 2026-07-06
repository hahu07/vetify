# CDD Assessment Framework

## What CDD Evaluates

CDD determines whether the customer profile is coherent, the financing purpose is legitimate, and the risk level is acceptable for a non-interest financing transaction. It is a judgment call, not a lookup.

## Scoring Breakdown (100 points total)

### AML & Sanctions (35 points)
| Result | Points |
|---|---|
| Both business and director clear | 35 |
| One review_required, no confirmed sanctions | 15 |
| Confirmed not_cleared | 0 — immediate Reject |

### KYB & Business Profile Consistency (30 points)
| Result | Points |
|---|---|
| KYB active, name matches, director confirmed | 30 |
| KYB active, minor discrepancies | 20 |
| KYB inactive or name mismatch | 10 |
| KYB not found | 0 |

### Purpose & Profile Coherence — CDD Judgment (25 points)

Assess the following and award points:

| Factor | Points |
|---|---|
| Financing purpose matches declared business activity | +10 |
| Business age > 1 year (established) | +5 |
| Financing amount is proportionate to business size | +5 |
| Director profile is consistent with business type | +5 |

Deduct points for:
| Risk Factor | Deduction |
|---|---|
| Newly registered business (< 3 months) | -5 |
| Financing amount unusually large for business size | -10 |
| Business purpose is vague or inconsistent | -10 |
| Director has no apparent connection to business industry | -5 |

### Credit History (10 points)
| Result | Points |
|---|---|
| No negative credit history | 10 |
| 1–2 minor delinquencies, resolved | 7 |
| Multiple delinquencies or active defaults | 0 |

## Business Type Risk Classification

| Business Type | Risk Level | Notes |
|---|---|---|
| SoleProprietorship — retail/trade | Low | Common SME profile, well-understood risk |
| SoleProprietorship — professional services | Low | Low asset risk, predictable cash flows |
| LimitedCompany — established (>2 years) | Low-Medium | Check ownership structure carefully |
| LimitedCompany — newly registered (<6 months) | Medium-High | Limited financial history |

## Model C Thresholds

```
≥ 80  →  Auto-Approve
50–79  →  Flag for Human Review
< 50  →  Auto-Reject
```

## Hard Rules (Override Score)

| Condition | Mandatory Action |
|---|---|
| AML `not_cleared` on any party | Reject — no exceptions |
| AML `review_required` on any party | Flag — never auto-approve |
| KYB shows business struck off / dissolved | Reject |
| Financing purpose is explicitly prohibited under Shariah | Reject (e.g. alcohol, gambling, tobacco) |
| Director is a known PEP | Flag — human compliance officer must decide |
