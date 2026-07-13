---
name: vetify-monitoring-review
description: Assist a human sentinel resolving a MurabahahContract already flagged for DelinquencyManualReview. Use this skill only in a human-supervised IDE (ACP) session — never for autonomous decisioning. Unlike the evidence-only vetify-monitoring skill used by the unattended Supervisor loop, this skill has full tool access (including exercise_choice) because a human sentinel is present in the conversation to review and confirm every action.
---

# vetify-monitoring-review

## Overview

This skill is for the human-in-the-loop ACP session (`npm run acp`, `vetify-monitoring` agent in
`acp.ts`) — **not** for the autonomous Supervisor loop. The Supervisor's `runDelinquencyMonitor`
uses a separate skill, `skills/monitoring` (`agents/skills/monitoring/SKILL.md`), whose
evidence-gathering agent has no `exercise_choice` access at all — `scoreDelinquency`
(`agents/src/scoring/monitoring.ts`) makes every autonomous decision from the evidence it
reports.

Every case you see here already reached that deterministic engine and came back ambiguous — not
"clearly fine" (which would have stayed `Active` or auto-resolved via `ResumeActive`), and not
"clearly delinquent with no offsetting evidence" (which would have auto-flagged via
`FlagDelinquent`). Specifically, either: exactly one installment is missed (too early to be sure
it's a real default vs. a processing delay), or two-or-more appear missed but a bank credit
roughly matching the installment amount was found within the last 7 days. Read the contract's
recent `RepaymentRecord`s and `get_account_transactions` yourself before forming a view — your
job is to bring the judgment a fixed rule can't (is that matching credit actually this
borrower's payment, or a coincidence? is a single missed payment a pattern or a one-off?), not to
replicate what the engine already tried.

**Human supervision is the safety mechanism here, not a tool restriction.** You have full tool
access (mono.co, Canton `exercise_choice`) because the sentinel is present in this session and
can see every tool call as it happens. Do not exercise a terminal decision choice
(`FlagDelinquent`, `ResumeActive`) without the sentinel explicitly confirming it in the
conversation first — surface your reasoning and a recommendation, then act only once they agree.

## Stage 9 — Delinquency Review (MurabahahContract, status DelinquencyManualReview)

1. Re-fetch `get_account_transactions` for the linked account if the sentinel wants fresher data
   than what's already on record.
2. Query recent `RepaymentRecord` contracts for this borrower (`cacRegNumber`) to see the actual
   payment history the ledger has recorded.
3. Weigh what the fixed rule couldn't: does the flagged transaction genuinely look like this
   borrower's missing installment (matching amount, plausible timing, recognizable
   counterparty/description), or does it look coincidental? Is the borrower's broader payment
   pattern (from `RepaymentRecord` history) consistent with a genuine lapse, or an isolated
   delay?
4. Call `get_active_contracts` for `templateId: "Vetify.Governance:AuthorizedSentinel"` as party
   `"vetify"` and find the entry whose `sentinel` field matches this session's sentinel party —
   its `contractId` is `sentinelCid`, a required argument on both choices below (the ledger has
   no contract keys, so this can no longer be resolved implicitly). Exercise `FlagDelinquent` or
   `ResumeActive` (`party: ["sentinel", "vetify"]` — dual controller, gated by the
   `AuthorizedSentinel` registry; `templateId: "Vetify.Murabahah:MurabahahContract"`) only after
   the sentinel confirms.

`FlagDelinquent` moves the contract to `Delinquent` (the FI can then act via `RecordPayment`,
`DefaultContract`, etc.). `ResumeActive` clears the flag back to `Active` — use it when the
sentinel agrees the missed-payment signal was a false positive (e.g. a genuinely unrecorded
payment, or a data lag that has since resolved), not merely that the borrower promises to pay.

## Direct Debit and GSM

Not in scope for this skill — those are the separate Collections Agent's responsibility
(`skills/collections`, `runCollectionsAgent`), a sequential API-orchestration workflow rather
than a delinquency judgment call.
