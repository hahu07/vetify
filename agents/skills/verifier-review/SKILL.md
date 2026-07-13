---
name: vetify-verifier-review
description: Assist a human verifier officer completing a BusinessOnboarding or ComplianceReview contract already flagged for ManualReview. Use this skill only in a human-supervised IDE (ACP) session — never for autonomous decisioning. Unlike the evidence-only vetify-verifier skill used by the unattended Supervisor loop, this skill has full tool access (including exercise_choice/create_contract) because a human officer is present in the conversation to review and confirm every action.
---

# vetify-verifier-review

## Overview

This skill is for the human-in-the-loop ACP session (`npm run acp`, `vetify-verifier` agent in `acp.ts`) — **not** for the autonomous Supervisor loop. The Supervisor's `runVerifierVerificationStage`/`runVerifierComplianceStage` use a separate skill, `skills/verifier` (`agents/skills/verifier/SKILL.md`), whose agent has *no* tool access beyond mono.co/Youverify evidence-gathering — a deterministic scoring engine (`agents/src/scoring/`) makes every autonomous decision from that evidence.

Every case you see here already reached that deterministic engine and it could **not** resolve it on its own — either:
- **Stage 2**: the score fell in the Medium band, one of identity/CAC failed but not both, or the CAC-registered name seriously mismatches the profile.
- **Stage 3**: `scoreCompliance` *by design* can never auto-approve — the CDD framework's "purpose & profile coherence" factors (financing purpose vs. declared activity, amount proportionality, director-industry fit) have no structured data source anywhere in the schema, so a human always closes that judgment out. It may also be here because the Shariah pre-check returned `REQUIRES_REVIEW`.

So your job is not to replicate what the deterministic engine already tried — it's to bring the judgment a fixed rubric structurally cannot: reading the actual evidence, weighing context, and reaching a defensible call *with the officer*, not for them.

**Human supervision is the safety mechanism here, not a tool restriction.** You have full tool access (mono.co, Youverify, Canton `exercise_choice`/`create_contract`) because the officer is present in this session and can see every tool call as it happens. Do not exercise a terminal decision choice (`Approve`, `Reject`, `ApproveCompliance`, `RejectCompliance`) without the officer explicitly confirming it in the conversation first — surface your reasoning and a recommendation, then act only once they agree.

## Stage 2 — Verification (BusinessOnboarding, status ManualReview)

Re-run or review whichever of `lookup_mashup` / `lookup_cac` / `lookup_tin` evidence is relevant to why this was flagged. Populate `VerificationChecks` (`identityVerified`, `cacRegistered`, `documentsValid`, `dataConsistent`) based on your own assessment — you are not bound by the deterministic engine's point table, since the whole reason this is here is that the fixed rubric didn't cleanly resolve it.

Before exercising, call `get_active_contracts` for `templateId: "Vetify.Onboarding:VerificationPolicy"` as party `"vetify"` — its first (and only) result's `contractId` is `policyCid`, or `null` if none is active. Exercise `Approve` or `Reject` (`party: ["verifier", "vetify"]` — dual controller, since vetify's signature is required alongside the verifier's; a single party here fails, `templateId: "Vetify.Onboarding:BusinessOnboarding"`) only after the officer confirms. Set `autoDecided: false`, `reviewedBy`/`reviewerParty` to the officer's identity, and `policyCid` from the lookup above (the ledger has no contract keys, so this can no longer be resolved implicitly) — this is a human decision, not an automated one, and the ledger's own `Onboarding.daml` assertions require exactly that when a human overrides or completes a flagged case.

If you Approve, also `create_contract` the initial `ComplianceReview` (`Vetify.Compliance:ComplianceReview`, `status: "Pending"`, `shariahVerdict: null`) — same payload shape the Supervisor's evidence-only path uses; see `agents/skills/verifier/SKILL.md` for the exact field list.

## Stage 3 — Compliance (ComplianceReview, status ManualReview or UnderReview)

Read `shariahVerdict` from the contract payload — it was already recorded by the standalone Shariah Agent via `RecordShariahPreCheck` before this stage runs; don't re-derive it.

Gather (or review already-gathered) AML (`aml_screen_business`/`aml_screen_individual`), adverse media (`adverse_media_screen`), credit history (`lookup_credit_history`), and KYB (`kyb_verify_business`) evidence for the business and every director. Then reason through the CDD judgment the deterministic engine explicitly cannot make:
1. Does the financing purpose match the declared business activity?
2. Is the business old enough / sized appropriately for the requested amount?
3. Does the director's profile make sense for this business?
4. Do adverse media or credit history findings change the picture?

For `ApproveCompliance`/`RejectCompliance`, first call `get_active_contracts` for `templateId: "Vetify.Compliance:AuthorizedReviewer"` as party `"vetify"` and find the entry whose `verifier` field matches this session's verifier party — its `contractId` is `reviewerAuthCid`, a required argument on both choices (the ledger has no contract keys, so this can no longer be resolved implicitly). For `FlagComplianceForManualReview`, call `get_active_contracts` for `templateId: "Vetify.Compliance:CompliancePolicy"` as party `"vetify"` — its first result's `contractId` is `policyCid`, or `null` if none is active. Exercise `ApproveCompliance` / `RejectCompliance` (`party: "verifier"`) or `FlagComplianceForManualReview` (`party: "vetify"`) only after the officer confirms. Set `autoDecided: false`, `reviewedBy`/`reviewerParty` to the officer's identity, and `overrideJustification` if the deterministic engine's flag note suggested a different lean than where you and the officer land.

### If an EDD case is open (G14)

Check whether an `EDDCase` (`templateId: "Vetify.Compliance:EDDCase"`) exists for this review — the Supervisor's autonomous path opens one via `OpenEddCase` whenever the AML evidence shows a PEP-only hit (`pepHit: true` — distinct from a sanctions hit, which already leans toward reject). If one is `Open`, **`ApproveCompliance` will hard-fail** unless you pass its `ContractId` as `eddCaseCid` AND it's `Closed` — the ledger itself enforces this, not just convention.

Work through the checklist with the officer via `UpdateEddChecklist` (`party: "verifier"`, nonconsuming — call it as many times as needed to progressively fill in fields):
- `sourceOfWealthVerified`/`sourceOfWealthNote` — has the source of the individual's/business's wealth been documented and does it hold up?
- `enhancedMediaSearchDone` — a deeper media search beyond the automated `adverse_media_screen` pass, specifically for PEP-relevant reputational risk
- `seniorManagementSignoff` — the compliance officer's or committee's name/reference approving the relationship
- `monitoringFrequency` — the ongoing monitoring cadence agreed for this relationship (e.g. `"quarterly"`)

Only exercise `CloseEddCase` (`party: "verifier"`, args `closedBy_`) once the officer confirms every item is genuinely complete — the Daml choice itself asserts all four are filled in, so an incomplete checklist cannot be closed, but don't treat that assertion as the review: the officer's actual judgment on each item is the point, not just satisfying the ledger check. Then pass the same case's `ContractId` as `ApproveCompliance`'s `eddCaseCid`.

## Supporting References

Reuses the same rubric documentation as the Supervisor's evidence-only skill — see `agents/skills/verifier/references/`: `risk-scoring-guide.md`, `mono-api-responses.md`, `aml-decision-guide.md`, `cdd-framework.md`. Treat these as context for what the deterministic engine already tried, not as constraints on your own judgment here.
