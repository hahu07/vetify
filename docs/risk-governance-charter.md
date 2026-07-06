# Vetify Risk & Credit Governance Charter

**Status**: Draft — pending committee sign-off
**Version**: 0.1
**Owner**: Bob Adeyemi (Head of Risk)
**Last reviewed**: 2026-07-05

---

## 1. Purpose

Vetify is a technology platform connecting Nigerian SME borrowers with licensed non-interest financial institutions (NIFIs). Vetify itself is not directly licensed by CBN or SEC — but its AI-driven verification, compliance, and scoring engine produces the risk assessments that licensed FI partners rely on to make their own regulated credit decisions. This charter establishes independent oversight of that engine, proportionate to Vetify's stage, so:

- No single individual can unilaterally change the rules that decide who gets financed.
- Vetify can demonstrate to FI partners' vendor-risk/compliance teams (and, indirectly, their CBN examiners) that the platform they depend on has real governance behind it.
- The organization is positioned to scale this structure formally as transaction volume and regulatory scrutiny grow.

## 2. Scope of Authority

The Risk & Credit Governance Committee ("the Committee") has sole authority to:

1. **Approve or reject changes to Stage 2/3 scoring policy** — the point-weight tables (`VerificationScoringWeights`, `ComplianceScoringWeights`) and Model C thresholds (`autoApproveMin`, `autoRejectMax`) carried on the on-ledger `VerificationPolicy`/`CompliancePolicy` contracts. In practice, this means the Committee is the source of who is authorized to appear as `proposedBy`/`approvedBy` on a `PendingVerificationPolicy`/`PendingCompliancePolicy` proposal, and no policy change should reach `ApprovePolicyChange` without going through the process in §4.
2. **Own the Shariah sector-classification table** (`agents/src/scoring/shariah-policy.ts`) — additions, removals, or reclassifications of sectors/financing-structures in the maintained keyword table, and review of individual `REQUIRES_REVIEW` cases the table cannot resolve.
3. **Review model performance on a standing cadence** — approval/rejection rate trends, the volume and disposition of `ManualReview` cases, and any indication of drift or unintended bias in outcomes.
4. **Escalate** any finding that suggests the deterministic engine or its policy inputs are producing outcomes inconsistent with this charter's intent, up to and including recommending a policy rollback.

Engineering/product/ops retain authority over *implementation* (code, deployment, infrastructure) but do not have unilateral authority to change scoring weights or thresholds — that separation is the entire point of this charter.

## 3. Composition

| Role | Responsibility | Name |
|---|---|---|
| Chair (Head of Risk / fractional CRO) | Convenes the Committee; final tie-break | Bob Adeyemi |
| Independent member (compliance lead / advisor / board member) | Must be organizationally distinct from engineering/ops | Aisha Bello |
| Shariah advisory representative | May be shared with an external Shariah scholar/advisor | Imam Yusuf Abdullahi |

Minimum quorum for a policy-change approval: **two members, and the approver must not be the same individual who proposed the change** (mirrors the `proposedBy /= approvedBy` check already enforced on `PendingVerificationPolicy`/`PendingCompliancePolicy`).

## 4. Decision Process

1. **Propose**: any team member identifies a need to change scoring weights/thresholds and drafts the change with a written rationale.
2. **Committee review**: circulated to the Committee; discussed at a standing or ad hoc meeting.
3. **Approve/Reject**: a Committee member *other than the proposer* approves or rejects. On approval, the change is submitted on-ledger as a `PendingVerificationPolicy`/`PendingCompliancePolicy` → `ApprovePolicyChange`, with `proposedBy`/`approvedBy` recording the real individuals who took each step. On rejection, `RejectPolicyChange` is exercised with the reason on record.
4. **Record**: every proposal, decision, and rationale is logged in the Committee's minutes (§6), independent of the on-ledger record — the two should always agree.

## 5. Shariah `REQUIRES_REVIEW` Escalation

Any `ComplianceReview` where the Shariah pre-check returns `REQUIRES_REVIEW` (sector/financing-structure not recognized by the maintained table) is escalated to the Shariah advisory representative for review before a human verifier officer completes the compliance decision. Recurring or clearly-classifiable cases should prompt a proposal (§4) to add the sector to the maintained table, rather than being re-escalated indefinitely.

## 6. Meeting Cadence & Records

- **Standing review**: monthly, covering model performance (§2.3) even when no policy change is pending.
- **Ad hoc**: within 3 business days of any proposed policy change.
- **Minutes**: recorded for every meeting — attendees, proposals discussed, decisions, and rationale. Retained indefinitely; this is the artifact produced on request during an FI partner's vendor due-diligence review.

## 7. Amending This Charter

This charter is itself subject to Committee approval to amend, requiring the same distinct-proposer/approver discipline as §4. Version and date every revision.

---

## Appendix: Known Limitation (in plain English)

The system checks two things now: that "proposed by" and "approved by" are different names, **and** that the "approved by" name is on an official list of registered Committee members (kept up to date by whoever administers the system — see the operational note below). Inventing a fake approver name no longer works — the system will refuse it.

What the system still cannot do is verify that the person *actually typing* an approval is really the Committee member whose name they entered. If someone has access to Vetify's system, nothing stops them from entering a real Committee member's name without that person actually having reviewed anything. What stops that, right now, is this charter: everyone with access agrees to actually follow the process in §4 — the named person really does review and approve — rather than exploiting the fact that the system can't yet tell the difference between "this specific registered person reviewed and approved it" and "someone typed their name."

**Operational note**: the official list isn't automatic — someone has to actually register each real Committee member in the system (and remove them when they leave the Committee) before this check does any good. If the list is empty, out of date, or contains names no longer on the Committee, the check is only as good as that list.

**This is one step in a longer roadmap, not the whole fix.** Even with the official-list check, nothing stops two real, registered Committee members from agreeing between themselves to approve something they shouldn't — no technology anywhere stops that; it's why audits and multi-person sign-off exist as separate controls. The full breakdown of what's built, what's planned, and what's accepted as a permanent risk is tracked in `docs/deferred-gaps.md` under "Policy-Approval Security Roadmap" — worth a read for the Committee, since it's the honest picture of where the technical guardrails currently end and where this charter's own discipline has to carry the rest.
