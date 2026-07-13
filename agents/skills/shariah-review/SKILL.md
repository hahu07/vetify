---
name: vetify-shariah-review
description: Assist a human Shariah advisor with two tasks — (1) reviewing a ComplianceReview's recorded Shariah pre-check verdict (especially REQUIRES_REVIEW cases), and (2) certifying the actual financial terms of a specific MurabahahProposal before execution (G11). Use this skill only in a human-supervised IDE (ACP) session — never for autonomous decisioning. Exercises SupersedeShariahVerdict, CertifyShariahTerms, and RevokeCertification only after the advisor confirms.
---

# vetify-shariah-review

## Overview

This skill is for the human-in-the-loop ACP session (`npm run acp`, `vetify-shariah` agent in
`acp.ts`) — **not** for the autonomous Supervisor loop. The Supervisor dispatches the standalone
Shariah Agent (`agents/src/agents/shariah.ts`) directly, before the Verifier Agent's compliance
stage runs; that agent has no ledger-write access at all — `classifyShariahCompliance()` (a
maintained keyword table, `agents/src/scoring/shariah-policy.ts`) is the verdict authority, and
the RAG/LLM pipeline only ever produces a narrative on a table miss, never a verdict. The
Supervisor itself records the result via `RecordShariahPreCheck` (dual-controller
`[advisor, vetify]`, gated by the `AuthorizedAdvisor` registry).

Every case you see here already has a recorded verdict — your job is not to re-run that pipeline,
but to review whether it was **right**, especially for:
- `REQUIRES_REVIEW` verdicts (a table miss, or a mixed/ambiguous-sector keyword match) — the case
  the deterministic table explicitly could not resolve on its own.
- Any verdict an advisor has independent reason to question (a keyword table entry that's
  outdated, a business whose actual activity doesn't match its declared sector).

**Human supervision is the safety mechanism here, not a tool restriction.** You have `shariah`
(RAG) and `canton` MCP tool access because the advisor is present in this session watching
every tool call. Do not exercise `SupersedeShariahVerdict` without the advisor explicitly
confirming it in the conversation first.

## Reviewing a Recorded Verdict

1. Read the `ComplianceReview` contract's `shariahVerdict` field (`ShariahAssessment`) — note
   `verdict`, `activitiesScreened`, `prohibitedRevenuePct`, `aaoifiStandards`, and `rationale`.
2. If useful, re-run `query_shariah_ruling`/`check_prohibited_sector` for fresher AAOIFI/CBN
   citations, or to check a specific activity the original pass may have under-weighted.
3. Weigh what the fixed table can't: does the business's actual activity mix genuinely match the
   matched keyword, or is this a borderline/mixed case the table's coarse matching missed? For
   `prohibitedRevenuePct`-relevant mixed-business cases, is the estimate reasonable given what you
   can observe?

## Correcting a Verdict

If the advisor disagrees with the recorded verdict, exercise `SupersedeShariahVerdict` on
the `ComplianceReview` contract (`templateId: "Vetify.Compliance:ComplianceReview"`,
`party: "vetify"` — **not** `advisor`: this choice is deliberately controller-`vetify`-alone,
the same "the party that made the original call shouldn't unilaterally correct its own past
decision" principle already applied to `Supersede` on `VerificationResult`/`ComplianceResult`).
Arguments: `correctionRef` (a unique reference, e.g. `"SHR-COR-2026-000001"`), `newVerdict` (a
full `ShariahAssessment` with the corrected `verdict`/`rationale`/etc.), `reason` (why the
original was wrong), `correctedBy` (the advisor's name).

This creates a `ShariahVerdictCorrection` audit record (preserving the original verdict
alongside the correction) and updates `shariahVerdict` on the review itself — usable regardless
of the review's current `status`, since it's a documented correction for the record, not a
reversal of whatever already happened downstream (mirrors `Supersede`'s own scope exactly).

## Certifying a Contract's Executed Terms (G11)

The Stage-3 pre-check above clears the *business's line of activity*. It does **not** sign off on
the *financial structure of a specific facility* — the disclosed cost, profit amount, sale price,
and tenure the borrower is about to be bound to. AAOIFI GSIFI No. 1/2 governance expects the SSB
to certify that structure at execution time. On the ledger this is a **hard gate**: the borrower's
`AcceptProposal` fetches your certification and rejects execution unless its snapshot still matches
the proposal's exact terms, so an uncertified — or stale, or revoked — proposal cannot become a
binding `MurabahahContract`.

When the advisor is reviewing a `MurabahahProposal` (`templateId:
"Vetify.Murabahah:MurabahahProposal"`) and confirms its terms are Shari'a-compliant:

1. Read the proposal's `murabahahTerms` (`assetCost`, `profitAmount`, `salePrice`,
   `tenureMonths`), `actualCost`, and `assetDetails`. Confirm the disclosed cost equals the true
   acquisition cost and the profit/sale-price arithmetic is sound and within policy.
2. Call `get_active_contracts` for `templateId: "Vetify.Governance:AuthorizedAdvisor"` as party
   `"vetify"` and find the entry whose `advisor` field matches this session's advisor party — its
   `contractId` is `advisorCid` below. Exercise `CertifyShariahTerms` on the proposal, `party:
   ["advisor", "vetify"]` (dual-controller — vetify co-signs the `requireActiveAdvisor` check,
   same authorization shape as `RecordShariahPreCheck`). Arguments: `certificationRef` (unique,
   e.g. `"SSB-CERT-2026-000123"`), `aaoifiStandards` (e.g. `["Std No. 8", "Std No. 40"]`),
   `rationale`, `certifiedBy` (the signing member's name), `advisorCid` (from the lookup above —
   the ledger has no contract keys, so this can no longer be resolved implicitly). This creates a
   `ShariahContractCertification` the borrower then presents to `AcceptProposal`.
3. If terms change after you've certified, or you find an error before acceptance, exercise
   `RevokeCertification` on the `ShariahContractCertification` (`templateId:
   "Vetify.Murabahah:ShariahContractCertification"`, `party: "advisor"`) with `revocationRef`,
   `reason`, `revokedBy`. Archiving it blocks `AcceptProposal` until you issue a fresh certificate.

Do not exercise `CertifyShariahTerms` on terms the advisor has not explicitly approved in the
session — the whole point of the gate is that a real SSB member stands behind the recorded figures.

## Supporting References

Reuses the same knowledge base as the standalone Shariah Agent — see `agents/skills/shariah/`:
AAOIFI Shari'a Standard No. 8 (Murabahah), No. 28 (Prohibited Activities), No. 40 (Distribution of
Profit); CBN NIFI Framework. `agents/skills/shariah/references/prohibited-sectors.md` documents
the maintained keyword table this verdict was checked against.
