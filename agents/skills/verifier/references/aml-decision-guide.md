# AML Decision Guide

## Youverify AML Response Status Values

| Status | Meaning | Action |
|---|---|---|
| `"clear"` | No matches found in any database | Set `amlCleared: true`, continue |
| `"review_required"` | Potential matches found — may be false positives | Set `amlCleared: false`, **Flag** |
| `"not_cleared"` | Confirmed sanctions or PEP hit | Set `amlCleared: false`, **Reject** |

## Understanding the Response Data

```json
{
  "data": {
    "status": "review_required",
    "sanctions": [...],   // Confirmed sanctions matches
    "pep": [...],         // PEP matches
    "totalEntity": 2,
    "categoryCount": { "sanction": 1, "pep": 1 }
  }
}
```

- `sanctions` array populated → serious — lean toward Reject
- Only `pep` array populated → PEP hit — always Flag (PEPs are not automatically disqualified)
- `totalEntity: 0` → truly clear

## Common False Positive Scenarios

- Common Nigerian names (e.g. "Ibrahim Musa") may match international watchlists — check the nationality and country fields in the match record
- Business names that partially match sanctioned entities — check full legal name and registration country
- If a match is for a different country and no other risk indicators exist — Flag, do not auto-Reject

## Adverse Media Severity Classification

| Severity | Examples | Impact on CDD Score |
|---|---|---|
| High | Criminal conviction, regulatory shutdown, fraud confirmed | -30 points |
| Medium | Ongoing investigation, regulatory warning, tax dispute | -15 points |
| Low | Reputational dispute, civil litigation (unresolved) | -5 points |
| None | No adverse media found | 0 (no penalty) |

## Database Coverage (Youverify)

Youverify screens against:
- OFAC (US Office of Foreign Assets Control)
- UN Security Council consolidated list
- EU consolidated sanctions list
- HMT (UK His Majesty's Treasury)
- NFIU (Nigerian Financial Intelligence Unit)
- Interpol notices
- PEP databases (global government officials and their associates)
