# Verification Risk Scoring Guide

## Score Allocation (Total: 100 points)

| Check | Tool | Max Points |
|---|---|---|
| Identity (NIN + BVN) | `lookup_mashup` | 40 |
| CAC Business Registration | `lookup_cac` | 35 |
| Tax ID (TIN) | `lookup_tin` | 25 |

---

## Step 1: Identity Score (lookup_mashup)

No date-of-birth cross-check exists — nothing in the onboarding flow collects a
director's DOB to compare against. Instead, mono.co's own `data.match.name`
field cross-checks the name attached to the NIN record against the name
attached to the BVN record — the real signal that NIN and BVN belong to the
same person, not just two independently-real IDs.

| Result | Points | identityVerified | Flags? |
|---|---|---|---|
| NIN valid, BVN valid, names match | 40 | true | no |
| NIN valid, BVN valid, names don't match | 10 | true | **always flags**, regardless of score — a real identity-fraud signal |
| NIN valid, BVN not found | 15 | false | no |
| NIN not found | 0 | false | no |
| API error / timeout | 0 | false → Flag, do not Reject | yes |

---

## Step 2: CAC Registration Score (lookup_cac)

| Result | Points | cacRegistered |
|---|---|---|
| Found, status = active, name exact match | 35 | true |
| Found, status = active, name close match (minor spelling) | 28 | true |
| Found, status = active, name mismatch | 10 | true |
| Found, status = inactive / struck off | 10 | true |
| Found, status = pending / in-progress | 20 | true |
| Not found in registry | 0 | false |
| API error / timeout | 0 | false → Flag, do not Reject |

**Note:** A CAC RC number that exists but belongs to a different legal name is a serious mismatch — score 10 and always Flag regardless of total score.

---

## Step 3: Tax ID Score (lookup_tin)

| Result | channel | Points | dataConsistent |
|---|---|---|---|
| TIN verified and matches CAC RC number | cac | 25 | true |
| TIN verified but filed under different entity | cac | 10 | true |
| TIN not found in FIRS records | tin | 5 | false |
| API error / timeout | — | 10 | true → assume consistent, Flag if total is borderline |

---

## Model C Risk Thresholds

```
≥ 80  →  Low     →  Auto-Approve
50–79  →  Medium  →  Flag for Manual Review
< 50  →  High    →  Auto-Reject
```

## Override Rules (regardless of total score)

| Condition | Action |
|---|---|
| `identityVerified = false` AND `cacRegistered = false` | Always Reject |
| `identityVerified = false` OR `cacRegistered = false` (not both) | Always Flag, never auto-approve |
| CAC name is completely different from business profile name | Always Flag |
| Any mono.co call returns HTTP 5xx | Flag — do not penalise score |
