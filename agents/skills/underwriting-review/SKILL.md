---
name: vetify-underwriting-review
description: Assist a human assessor completing a FinancingRequest contract already flagged for UnderwritingManualReview. Use this skill only in a human-supervised IDE (ACP) session — never for autonomous decisioning. Unlike the evidence-only vetify-underwriting skill used by the unattended Supervisor loop, this skill has full tool access (including exercise_choice/create_contract) because a human assessor is present in the conversation to review and confirm every action.
---

# vetify-underwriting-review

## Overview

This skill is for the human-in-the-loop ACP session (`npm run acp`, `vetify-underwriting` agent in `acp.ts`) — **not** for the autonomous Supervisor loop. The Supervisor's `runUnderwritingAgent` uses a separate skill, `skills/underwriting` (`agents/skills/underwriting/SKILL.md`), whose evidence-gathering agent has no `exercise_choice`/`create_contract` access at all — the five deterministic scoring engines (`agents/src/scoring/underwriting-*.ts`) make every autonomous decision from the evidence it reports.

Every case you see here already reached that deterministic engine and scored in the Medium risk band — good enough to avoid the High-risk hard veto (`RejectUnderwriting`), but not strong enough to auto-qualify (`BeginUnderwriting`). Read the contract's `agentScore`/`agentRisk`/`agentNote`/`agentVersion` fields (set by `FlagUnderwritingForManualReview`) for the deterministic engine's own reasoning before forming your own view — your job is to bring the judgment a fixed rubric structurally cannot (reading the actual transaction history/context, weighing borderline factors), not to replicate what already ran.

**Human supervision is the safety mechanism here, not a tool restriction.** You have full tool access (mono.co, Canton `exercise_choice`/`create_contract`) because the assessor is present in this session and can see every tool call as it happens. Do not exercise a terminal decision choice (`BeginUnderwriting`, `RejectUnderwriting`) without the assessor explicitly confirming it in the conversation first — surface your reasoning and a recommendation, then act only once they agree.

## Stage 6 — Underwriting (FinancingRequest, status UnderwritingManualReview)

Review (or re-fetch, if the assessor wants fresher data) `get_account_statement`/`get_account_transactions` for the linked account, and `assess_creditworthiness`'s DSCR/credit score result if not already visible on the contract. Weigh the same five dimensions the deterministic engines score, but with real judgment where the fixed rubric couldn't resolve cleanly:
1. Financial Behaviour — income stability, expense discipline, liquidity, revenue consistency
2. Cashflow Risk — DSCR, existing debt leverage, cash reserve months, the 3-scenario stress test
3. Creditworthiness — bureau score context
4. Fraud Detection — do the four rule-based flags (structuring, round-tripping, income spike, velocity anomaly), if any, look like genuine risk or a false positive given the actual transaction context?
5. Amount vs. capacity — is the requested amount proportionate to what the borrower can actually service?

First call `get_active_contracts` for `templateId: "Vetify.Governance:AuthorizedAssessor"` as party `"vetify"` and find the entry whose `assessor` field matches this session's assessor party — its `contractId` is `assessorCid`. Exercise `BeginUnderwriting` or `RejectUnderwriting` (`party: ["assessor", "vetify"]` — dual controller, since vetify's signature is required alongside the assessor's; a single party fails, `templateId: "Vetify.Financing:FinancingRequest"`) only after the assessor confirms. Set `autoDecided: false`, `reviewerParty`/`reviewedBy` to the assessor's identity, and `assessorCid` from the lookup above (the ledger has no contract keys, so this can no longer be resolved implicitly) — this is a human decision, not an automated one. `BeginUnderwriting` additionally takes `policyCid`: the active `UnderwritingPolicy`'s `ContractId` if you found one (via `get_active_contracts` for `templateId: "Vetify.Financing:UnderwritingPolicy"`, matching `financialInstitution`), otherwise `null`.

`BeginUnderwriting` qualifies the borrower and forwards the request to the financial institution for its own Stage 7 decision (`ApproveFunding`/`RejectFunding`) — it does not itself approve financing. `RejectUnderwriting` is a hard veto: the borrower never reaches the FI at all, so use it only when you and the assessor agree the request shouldn't even be shown to a bank, not merely that you'd personally decline it if you were the bank.

## Supporting References

Reuses the same rubric documentation as the Supervisor's evidence-only skill — see `agents/skills/underwriting/references/`: `dscr-guide.md`, `mono-underwriting-fields.md`. Treat these as context for what the deterministic engines already tried, not as constraints on your own judgment here.
