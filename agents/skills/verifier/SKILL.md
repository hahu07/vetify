---
name: vetify-verifier
description: Gather Stage 2 identity/KYC evidence (mono.co) and Stage 3 AML/KYB/credit-history evidence (Youverify + mono.co) for the Vetify platform, as the unified `verifier` party. Use this skill when processing a BusinessOnboarding contract in UnderReview status (Stage 2) or a ComplianceReview contract in Pending status (Stage 3). Scoring and Canton ledger decisions are made by a deterministic scoring engine, not by this skill.
---

# vetify-verifier

## Overview

This skill guides the Verifier Agent's **evidence-gathering role only** — Stage 2 identity/KYC
verification and Stage 3 AML/KYB/CDD compliance review are both, ultimately, the same
real-world job performed by one Canton party, `verifier`. But the agent following this skill
does **not** score the application, does **not** decide Approve/Reject/Flag, and does **not**
have tool access to exercise any Canton choice — those are handled deterministically, in code,
by `agents/src/scoring/verification.ts` and `agents/src/scoring/compliance.ts`, from the exact
evidence this skill instructs the agent to report.

This is a deliberate architecture, not a missing feature: it makes verification/compliance
outcomes reproducible from a fixed rubric instead of depending on how faithfully an LLM follows
natural-language instructions. Your only job is to call the right tools and report **exactly**
what they returned, in the JSON shape specified below — do not soften, round, reinterpret, or
add judgment to any field.

The Shariah pre-check is a fully separate, standalone step dispatched by the Supervisor before
Stage 3 ever runs (`agents/src/scoring/shariah-policy.ts` + `agents/src/agents/shariah.ts`) —
this skill's Stage 3 evidence gathering does not touch it at all.

---

## Stage 2 — Verification evidence (BusinessOnboarding, status UnderReview)

Call, in order:
1. `lookup_mashup` — the director's `ninNumber` and `bvn`
2. `lookup_cac` — the CAC registration number (`BusinessKyc.cacRegNumber`)
3. `lookup_tin` — the tax ID, `channel: "cac"`

Then reply with **only** this JSON object — no other text before or after it:
```json
{
  "mashup": { "ninVerified": true, "bvnVerified": true },
  "cac": { "found": true, "status": "Active", "nameMatch": "exact" },
  "tin": { "outcome": "verifiedMatchesCac" }
}
```
If any call fails or times out, report that field as `{ "error": true, "httpStatus": <code> }`
instead — do not guess a value or silently retry with fabricated data.

- `cac.status` is one of `"Active" | "Inactive" | "Struck Off" | "Pending"` — use the value
  `lookup_cac` actually returned, verbatim.
- `cac.nameMatch` is `"exact"` (matches `BusinessProfile.name` exactly), `"close"` (minor
  spelling difference), or `"mismatch"` (different legal name entirely).
- `tin.outcome` is `"verifiedMatchesCac"`, `"verifiedDifferentEntity"` (TIN found but filed
  under a different entity), or `"notFound"`.

Refer to `references/risk-scoring-guide.md` and `references/mono-api-responses.md` for the
exact scoring engine behavior and mono.co's raw response field names — you don't need to apply
the scoring table yourself, but they explain what each evidence field means.

---

## Stage 3 — Compliance evidence (ComplianceReview, status Pending)

Screen **both** the business entity **and** every director listed under `business.director`.
Call:
1. `aml_screen_business` — the business name
2. `aml_screen_individual` — each director's full name
3. `adverse_media_screen` — the business name, `type: "all"`
4. `lookup_credit_history` — the director's BVN and phone number
5. `kyb_verify_business` — `cacRegNumber`, `registrationName`, `countryCode: "NG"`

Then reply with **only** this JSON object — no other text before or after it:
```json
{
  "amlBusinessStatus": "clear",
  "amlDirectorStatus": "clear",
  "amlScreeningRef": "yv-aml-12345",
  "adverseMediaSummary": "none found",
  "creditHistory": "clean",
  "kybStatus": "active_full_match"
}
```
- `amlBusinessStatus` / `amlDirectorStatus`: `"clear" | "review_required" | "not_cleared"`,
  verbatim from Youverify's `status` field. See `references/aml-decision-guide.md`.
- `adverseMediaSummary`: one sentence describing anything found (or `"none found"`) — this is
  passed through as context for a human reviewer, it does not feed the deterministic score.
- `creditHistory`: `"clean" | "minor_resolved" | "delinquent_or_default"`.
- `kybStatus`: `"active_full_match"` (active, name matches, director confirmed),
  `"active_minor_discrepancy"` (active but with some mismatch), `"inactive_or_mismatch"`,
  `"not_found"`, or `"struck_off_or_dissolved"`.

Refer to `references/cdd-framework.md` for how these feed the deterministic scorer, and note
its central limitation: there is no structured data source for financing-purpose-vs-activity
coherence, amount proportionality, or director-industry fit, so the scorer can never auto-
approve on its own — it can only auto-reject on a clear hard-rule violation (confirmed AML hit,
struck-off business, Shariah `NON_COMPLIANT`) or flag for a human, who alone closes out that
qualitative judgment.

## Supporting References

- `references/risk-scoring-guide.md` — Stage 2 scoring table implemented in `scoring/verification.ts`
- `references/mono-api-responses.md` — mono.co response field definitions and error codes
- `references/aml-decision-guide.md` — Youverify AML status values and edge cases
- `references/cdd-framework.md` — CDD scoring criteria implemented (where quantifiable) in `scoring/compliance.ts`
