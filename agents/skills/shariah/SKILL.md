---
name: vetify-shariah
description: Produce a citation-backed narrative explaining why a Nigerian SME business's sector/activity needs human Shariah review. Invoked only when Vetify's maintained Shariah policy table (a deterministic keyword classifier) has no match for the business — a genuinely novel sector. The verdict is already fixed to REQUIRES_REVIEW; this skill does not decide it.
---

# vetify-shariah

## Overview

Shariah classification at Vetify is decided by a **maintained, deterministic keyword table**
(`agents/src/scoring/shariah-policy.ts`, ported from `references/prohibited-sectors.md`), not
by this skill. Any sector the table recognizes — prohibited, mixed/ambiguous, or permissible —
resolves without ever invoking an LLM. This skill only runs for the residual case: a sector the
table has never seen before.

Even then, this skill's output does **not** set the verdict. The verdict for a
table-no-match case is always fixed to `REQUIRES_REVIEW`, before this skill is ever invoked —
your job is only to write a citation-backed narrative that helps a human Shariah officer assess
the case, not to decide COMPLIANT or NON_COMPLIANT. Never include a `"verdict"` field in your
response; if you do, it is ignored.

## Authorities

| Authority | Scope |
|---|---|
| AAOIFI Shari'a Standard No. 8 | Murabahah structure requirements |
| AAOIFI Shari'a Standard No. 28 | Prohibited business activities list |
| AAOIFI Shari'a Standard No. 40 | Profit distribution in Islamic finance |
| CBN NIFI Framework (2011, 2017) | Nigerian regulatory Shariah requirements |

## Step-by-Step Workflow

### Step 1 — Query the Knowledge Base

Call `query_shariah_ruling` with the business sector, activity, and financing purpose.

This retrieves the most relevant passages from the AAOIFI/CBN vector store.

### Step 2 — Check Specific Sector if Useful

Call `check_prohibited_sector` with the sector name if it helps surface more targeted
passages — this is for context in your narrative, not for you to render a verdict.

### Step 3 — Explain Why This Case Is Ambiguous

Reason over the retrieved passages and explain, for a human reviewer:
- What about this business's sector/activity made it fall outside the maintained policy table
- Which AAOIFI/CBN passages are most relevant to assessing it
- Anything about the Murabahah structure (asset specificity, real purchase transaction,
  disclosed profit margin) worth flagging for the reviewer's attention

### Step 4 — Return Narrative with Citations

Return ONLY this JSON object — no `"verdict"` field:
```json
{
  "reasoning": "Explanation of why this sector is ambiguous, referencing retrieved passages",
  "citations": ["AAOIFI Standard No. 8, Clause 2/1 — ...", "CBN NIFI Framework, Section 3.4 — ..."]
}
```

## Supporting References

- `references/prohibited-sectors.md` — the source table now implemented deterministically in
  `agents/src/scoring/shariah-policy.ts`; useful for understanding what's already covered
  without an LLM call, and why a given case wasn't
- `references/aaoifi-standards-index.md` — index of which AAOIFI standard covers which topic
