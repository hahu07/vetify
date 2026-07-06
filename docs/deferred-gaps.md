# Deferred Gaps

Gaps that were assessed and deliberately deferred. Each entry records what was deferred, why, and what prerequisite or product decision must be resolved before implementation.

Removed entries fall into two categories:
- **Implemented** — gap is closed; code and tests exist in the codebase.
- **Ledger-design resolution** — the Canton ledger, PQS transaction log, or existing observer model already provides the functionality; adding an on-ledger artefact would be a costly duplicate.

---

## Compliance Module (`daml/Vetify/Compliance.daml`)

### Gap 17 — Conflict-of-Interest Detection
**What**: Detect when a compliance officer has a relationship with the borrower (e.g., same employer, family member) and block or flag the review.
**Why deferred**: Requires a Conflict-of-Interest registry template (who is conflicted with whom) and a product decision on data source. The check itself is straightforward once the registry exists.
**Prerequisite**: Define the registry data model and the party/name matching strategy.

### Gap 18 — Compliance SLA Escalation
**What**: Flag a `ComplianceReview` as overdue when it has sat in `UnderReview` or `ManualReview` beyond a configurable SLA.
**Why deferred**: `CompliancePolicy` already has `escalationSlaHours`. The missing piece is an `EscalateCompliance` choice (analogous to `EscalateOverdue` on `BusinessOnboarding`) and a Monitoring Agent hook to call it.
**Prerequisite**: Monitoring Agent scope expansion.

### Gap 23 — Shariah Committee Escalation
**What**: Formal on-ledger escalation path when the Shariah Agent returns `REQUIRES_REVIEW` — route to a named Shariah committee and record their decision.
**Why deferred**: Requires a new `ShariahCommitteeReview` template with multi-party committee membership and a voting/consensus choice. Significant scope; the `ShariahAssessment.scholarDecision` field already captures the outcome string once it is resolved off-ledger.
**Prerequisite**: Committee composition, quorum rules, and scholar identity management design.

### Gap 24 — CDD Periodic Refresh
**What**: Trigger re-running CDD checks on an `ApprovedBorrower` on a schedule (e.g., annually) without requiring full recertification.
**Why deferred**: Requires a Monitoring Agent cron job to emit an on-ledger refresh request, and a new `CDDRefreshRecord` template. The `RequestRecertification` choice covers the full re-check path; periodic partial refresh is a lighter, separate workflow.
**Prerequisite**: Monitoring Agent scheduler design; product decision on what constitutes a partial vs. full refresh.

### Gap 26 — Regulatory Notification
**What**: Emit a `RegulatoryNotification` contract when a compliance decision triggers a CBN NIFI reporting obligation (e.g., SAR filing, NIFI breach).
**Why deferred**: Notification rules are jurisdiction-specific and require mapping each `RejectCompliance` reason to the applicable obligation. The `SARReport` template covers the most urgent case; a general notification workflow is a separate product feature.
**Prerequisite**: CBN NIFI reporting obligation matrix; notification template design.

### Gap 28 — Adverse Media Evidence Storage
**What**: Store structured adverse media findings (source, headline, severity, date) on `ComplianceResult` rather than just a Youverify reference ID.
**Why deferred**: Inlining the full payload would bloat the contract; the preferred approach is a separate `AdverseMediaRecord` contract keyed by reference.
**Prerequisite**: Define `AdverseMediaRecord` template with appropriate privacy (verifier signatory, vetify observer).

---

## Financing Module (`daml/Vetify/Financing.daml`)

### Gap F7 — Duplicate Request Prevention
**What**: Prevent a borrower from submitting multiple concurrent `FinancingRequest` contracts to the same FI for the same purpose.
**Why deferred**: `RequestFinancing` is intentionally `nonconsuming` to support repeat facilities. What counts as a duplicate is a business policy question with no obvious ledger-enforceable invariant without first defining the policy.
**Prerequisite**: Product decision on duplicate/concurrent facility rules; the per-institution policy surface for encoding such rules now exists on `UnderwritingPolicy` (`permittedSectors`, `maxLoanAmount`, etc.) if a duplicate-detection rule is agreed.

### Gap F16 — Credit Committee Approval Workflow
**What**: For high-value or high-risk financing requests, route the decision through a credit committee: `NominateCommittee` → multiple `CastVote` choices → `TallyVotes` → outcome feeds `ApproveFunding` or `RejectFunding`.
**Why deferred**: Multi-party governance workflow requiring committee membership management, quorum rules, and vote privacy. Independent enough to warrant its own template design pass. Note this is distinct from the two-officer maker-checker now on `ApproveFunding`/`WriteOffContract`/etc. (`Vetify.Governance`) — that's a fixed proposer/confirmer four-eyes check, not an N-member quorum vote; it doesn't reduce this gap's scope.
**Prerequisite**: Committee composition rules; quorum threshold; vote confidentiality requirements.

### Gap F18 — Pre-Disbursement Risk Monitoring
**What**: Monitor an approved-but-not-yet-disbursed `FinancingRequest` for borrower deterioration events (new sanctions hit, adverse media, credit score drop) between `ApproveFunding` and `AcceptProposal`.
**Why deferred**: Monitoring Agent scope item. The Monitoring Agent currently tracks `MurabahahContract` delinquency; extending it to the pre-disbursement window is a separate agent work item.
**Prerequisite**: Monitoring Agent extension; define which events in the pre-disbursement window trigger a re-underwriting flag.

### Gap F25 — ApprovedBorrower Validation in BeginUnderwriting
**What**: Verify that the borrower still holds an `ApprovedBorrower` contract before `BeginUnderwriting` begins.
**Why deferred**: Would require `Financing.daml` to import `Compliance.daml`, creating a circular dependency (`Compliance → Financing → Compliance`). Architecturally blocked.
**Prerequisite**: Architectural refactor extracting a standalone `Vetify.BorrowerStatus` module that both `Compliance` and `Financing` can import without a cycle.

### Gap F38 — Sanctions Refresh Before Approval
**What**: Re-run a Youverify sanctions/PEP check on the borrower immediately before `ApproveFunding` to catch changes since Stage 3.
**Why deferred**: Coupling a ledger choice to a real-time external API call is architecturally undesirable. The Compliance Agent should run the check off-ledger before presenting `ApproveFunding` to the ledger.
**Prerequisite**: Monitoring Agent extension for periodic/pre-event sanctions refresh; off-ledger orchestration by the Compliance Agent.

---

## Murabahah Module (`daml/Vetify/Murabahah.daml`)

### Gap M-PV — Purchase Variance Controls
**What**: Enforce a configurable variance limit (e.g., ±10 %) between `estimatedCost` on `MurabahahWad` and `actualCost` on `AssetPurchaseRecord`. Excess variance should require fresh borrower consent before `OfferMurabahah`.
**Why deferred**: The acquisition chain already enforces `assetCost == actualCost` inside `OfferMurabahah`. Adding a variance check mid-chain requires changing signatures on three choices and 10+ test call sites. `Financing.UnderwritingPolicy` is the natural home for a configurable threshold field, but Murabahah cannot import Financing without an import cycle — any check would have to be threaded in as a choice argument (the same pattern used for `maxRestructurings` on `ApproveRestructuring`).
**Prerequisite**: Product decision on whether excess variance triggers re-consent or a hard block.

### Gap M-SP — Supplier as First-Class Canton Party
**What**: Model the supplier as a named Canton party rather than a `Text` string, enabling on-ledger supplier authorisation for `AssetPurchaseRecord`.
**Why deferred**: Major architectural change — supplier would be a signatory/observer on `AssetPurchaseRecord`, `MurabahahWakala`, and `SupplierFailureRecord`, requiring backend JWT provisioning per supplier and a supplier onboarding workflow. `SupplierDetails` already captures structured identity for audit.
**Prerequisite**: Supplier onboarding workflow design; Canton party provisioning for external suppliers; product decision on ledger invariant vs. off-ledger attestation.

### Gap M-RS — Periodic AML/KYC Rescreening During Active Contracts
**What**: Trigger re-running Youverify AML/PEP checks at configurable intervals while a `MurabahahContract` is active. A failed check should surface an `AMLFlag` `MonitoringAlert`.
**Why deferred**: `Compliance.daml` concern — adding it to `Murabahah.daml` would violate the import DAG (`Compliance → Financing → Murabahah`). Belongs alongside Gap 24 (CDD Periodic Refresh) as a `Compliance.daml` extension.
**Prerequisite**: Monitoring Agent scheduler; `Compliance.daml` extension (Gap 24 pattern); product decision on whether a failed rescreen blocks `RecordPayment`.

### Gap M-MC — Multi-Currency and Payment Calendar
**What**: Support contracts denominated in currencies other than NGN and configurable payment calendars (Islamic calendar alignment, Nigerian public holidays, business day conventions).
**Why deferred**: Currency propagates through `MurabahahTerms`, `RepaymentRecord`, `PaymentScheduleEntry`, and `SettlementAccount`, rippling through all downstream invariants. Calendar logic belongs in the backend/agent layer against an external calendar service.
**Prerequisite**: Multi-currency business case from FI product team; calendar provider integration; product decision on FX risk allocation.

---

## Cross-Cutting Deferred Items

### Compliance — Gap 14: Appeals Process
**What**: A formal on-ledger appeals workflow allowing a rejected borrower to contest a `ComplianceResult` or `FinancingDecision`.
**Why deferred**: Full sub-workflow requiring new templates (`AppealRequest`, `AppealReview`, `AppealOutcome`), new parties (appeals committee), and escalation paths.
**Prerequisite**: Appeals process product design; authority matrix for appeals committee.

### Cross-Cutting — Policy-Approval Security Roadmap

`PendingVerificationPolicy`/`PendingCompliancePolicy`'s `ApprovePolicyChange` today only asserts `approvedBy /= proposedBy` — two differing `Text` values recorded in the same transaction, not two independently-verified individuals (see `docs/risk-governance-charter.md`'s appendix for the plain-English version of this limitation). Closing it fully is not a single gap but a sequence of layers, each closing a specific weakness and each with a real cost — tracked here so progress is visible rather than the whole thing sitting as one vague "TODO: harden this."

| Layer | Closes | Status |
|---|---|---|
| 0 — Distinct-name maker-checker | A single signature approving its own proposal with no second party involved at all | ✅ **Done** — `proposedBy /= approvedBy` assertion, `PendingVerificationPolicy`/`PendingCompliancePolicy` |
| 1 — Registry-gating | `approvedBy` being any invented string rather than a real, currently-active approver | ✅ **Done** — `PolicyApprover` registry (`Vetify.Governance`) + `requireActivePolicyApprover`, gating `ApprovePolicyChange` on both `PendingVerificationPolicy` and `PendingCompliancePolicy`. `DeactivatePolicyApprover`/`ReactivatePolicyApprover` mirror `AuthorizedOfficer`'s lifecycle. Registry entries should be populated from `docs/risk-governance-charter.md` §3's named Committee membership |
| 2 — Two-party cryptographic enforcement | One Canton party's credentials alone being sufficient to bypass the whole workflow via a direct `create` | ✅ **Done** — a new `riskCommittee` Canton party (genuinely distinct from `vetify`) must exercise `EndorseByRiskCommittee` on `PendingVerificationPolicy`/`PendingCompliancePolicy`, its own separate ledger transaction, before `ApprovePolicyChange` will succeed (`riskCommitteeEndorsedBy /= None` is asserted). Deliberately **two separate single-controller choices** (`EndorseByRiskCommittee` controller `riskCommittee`, then `ApprovePolicyChange` controller `vetify`), not one `controller vetify, riskCommittee` exercise — a single combined exercise only proves whoever submitted the command held authority for both parties, which is meaningless if one backend process holds every party's JWT (as this one does, in `canton.ts`'s `PARTY_JWTS`). Two separate transactions, each requiring that party's own JWT, is what actually establishes non-repudiation. Routes: `POST /api/policy/verification/:id/endorse`, `POST /api/policy/compliance/:id/endorse` (new `CANTON_RISK_COMMITTEE_JWT`/`CANTON_RISK_COMMITTEE_PARTY_ID`). **Only a real improvement in production if `CANTON_RISK_COMMITTEE_JWT` is actually held/managed by the Risk Committee's own system** — that's an ops/secrets-custody discipline this code cannot enforce, same caveat as Layer 1's registry (see Residual row below) |
| 3 — Per-individual signing | Not knowing *which* member of a team approved when multiple people share one party's credentials | ✅ **Done (app-layer variant)** — a real human login (`backend/src/auth.ts`/`appdb.ts`: bcrypt-hashed `users` table, JWT session tokens distinct from Canton party JWTs) now gates `/verification\|compliance/:id/endorse\|approve\|reject`. `endorsedBy`/`approvedBy`/`rejectedBy` are *derived from the authenticated session*, not accepted from the request body — closes the "type any name" hole Layers 0–2 never addressed. Every action is written to an append-only `audit_log` table (`GET /api/auth/audit-log`), which is where individual, non-repudiable attribution actually lives — **the Canton ledger itself still only ever sees the shared `vetify`/`riskCommittee` party**, so this control is only as strong as "the ledger API is unreachable except through this backend" (a network-level firewall rule, not something this code enforces). The one-Canton-party-per-individual variant (heavier: new party + JWT + registry entry per person, repeated across every governance role) remains undone — deliberately not chosen, since on-ledger individual attribution wasn't the gap being closed here. Doesn't touch credential-theft risk (phishing, password reuse) — that's Layer 4 |
| 4 — Hardware-backed keys + MFA | A stolen credential file (password) being sufficient to impersonate an approver | ✅ **Done (TOTP/software-MFA half only)** — RFC 6238 TOTP now available per user (`backend/src/auth.ts`: `generateTotpSecret`/`totpKeyUri`/`verifyTotpCode`, `otplib`), opt-in via `POST /api/auth/mfa/enroll-init`+`/enroll-verify` (QR code via `qrcode`). Once enabled, `POST /api/auth/login` no longer issues a real session on password alone — it returns a short-lived `mfa_pending` token (deliberately unable to satisfy `requireAuth`, verified by a `type` discriminator on the JWT payload) that only `POST /api/auth/mfa/verify-login` can exchange for a real session, after checking the TOTP code. **Hardware keys (WebAuthn/FIDO2) specifically were not built** — this test environment has no way to drive a real or virtual FIDO2 authenticator through browser automation (no CDP virtual-authenticator support in the available tooling, no physical key), and shipping that code without being able to verify it actually works would break this project's own verification discipline. TOTP was chosen instead because it's fully testable end-to-end (a code can be computed programmatically from the same secret and typed into the real UI) and genuinely closes the stated weakness (password alone no longer suffices) even though it isn't literally "hardware-backed." Revisit WebAuthn specifically if a real deployment needs phishing-resistant auth, ideally tested against a real device or a proper CI environment with CDP/Playwright virtual-authenticator support |
| Residual — Collusion / key-custody negligence | *Not closable by technology.* Two genuinely distinct, individually-identified, MFA-protected people can still agree between themselves to approve something they shouldn't — and Layer 2 specifically cannot stop the same backend/ops team from holding both `vetify`'s and `riskCommittee`'s JWTs in the same `.env`, which silently degrades Layer 2 back to Layer 1's guarantee. Layer 3/4's audit log and login are similarly bypassable by anyone who can reach the Canton ledger API directly, skipping this backend entirely. | ⚠️ **Accepted risk** — mitigated only by non-technical controls: more-than-two-person sign-off for the highest-stakes changes, independent audit sampling after the fact (including periodically confirming who actually holds `CANTON_RISK_COMMITTEE_JWT`, and that the ledger API isn't reachable except through this backend), whistleblower/reporting channels, personal legal/contractual accountability. Every serious financial institution's control framework has this same floor. |

**Layers 0–4 are now done** (Layer 4 as the TOTP/software-MFA half — see above for why WebAuthn/hardware keys weren't built in this pass). Layer 2 shipped once the org side (`docs/risk-governance-charter.md`) confirmed a genuinely distinct Risk & Credit Governance Committee keyholder exists. Layers 3 and 4 both shipped as exploratory builds, scoped and confirmed worthwhile before writing code, same pattern both times.
**Deployment note for Layer 2**: this repository's `backend/.env.example` documents `CANTON_RISK_COMMITTEE_JWT` alongside every other party's JWT purely for local-dev convenience (one process necessarily holds everything in dev). In production, provisioning that specific credential to the Risk Committee's own system — not this backend's shared config — is the whole point; skipping that step means Layer 2's code runs but adds no real security over Layer 1.
**Deployment note for Layer 3/4**: `SESSION_JWT_SECRET` in `.env.example` is a dev-only placeholder — generate a real random secret for anything beyond local dev. `npm run seed:users` (`backend/src/scripts/seedUsers.ts`) is a one-time dev-convenience script with no password-recovery flow; a real deployment needs a proper user-management/reset process before relying on this. MFA enrollment (`totp_secret`/`totp_enabled` on `users`) is per-user and opt-in — nothing forces a governance user to enable it, so an unenrolled account is still exactly at Layer 3's security level until someone walks through the enrollment flow for them.
**Operational note for Layer 1**: the registry only constrains *who can be named* as an approver — someone still has to actually register each real Committee member (and deactivate them when they leave). `backend/src/routes/policy.ts` exposes this (`POST /api/policy/approvers`, `/deactivate`, `/reactivate`), plus the `VerificationPolicy`/`CompliancePolicy` propose→approve/reject workflow itself (`/api/policy/verification/*`, `/api/policy/compliance/*`). Both the Daml/ledger side and the full HTTP layer on top are now verified end-to-end against a real local sandbox — see `docs/production-readiness-backlog.md`'s "✅ Resolved" entry (the v1→v2 JSON API migration this uncovered and required).
