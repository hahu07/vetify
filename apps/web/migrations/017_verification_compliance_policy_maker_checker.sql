-- Phase 2, Fourteenth Slice (web2-migration-design.md): the VerificationPolicy/
-- CompliancePolicy maker-checker chain -- ported from daml/Vetify/Onboarding.daml
-- (VerificationPolicy, PendingVerificationPolicy) and daml/Vetify/Compliance.daml
-- (CompliancePolicy, PendingCompliancePolicy). Deferred, unchanged, by every
-- slice since Phase 1's own header comment ("VerificationPolicy/CompliancePolicy
-- + the maker-checker PendingPolicy flow (riskCommittee party)").
--
-- Four templates ported, 41 templates now ported total. Reuses the
-- PolicyApprover registry already ported in the Governance codegen slice --
-- ApprovePolicyChange's `requireActivePolicyApprover` gate is the first
-- consumer of that registry from a module other than Governance itself.
--
-- New party role: `riskCommittee` -- a genuinely independent Canton party
-- (same trust framing as `advisor`, not "vetify's own team" the way
-- verifier/assessor/sentinel are), whose own separately-signed
-- EndorseByRiskCommittee transaction is Layer 2 of CLAUDE.md's
-- "Policy-Approval Security Roadmap". Added to the users table CHECK
-- constraint here; lib/db.ts's PartyRole union updated in the same pass.
-- No frontend page yet for this role in this pass (see the design doc's
-- Fourteenth Slice entry for what's deferred) -- a riskCommittee session
-- can drive EndorseByRiskCommittee via the API today, same as this
-- migration's very first slices before their own UI passes existed.
--
-- Deliberately out of scope for this pass: AuthorizedReviewer (a separate
-- Compliance.daml registry gating who may exercise ApproveCompliance/
-- RejectCompliance as verifier -- CLAUDE.md lists it alongside
-- PolicyApprover in the same governance table, but it gates a different
-- choice entirely, not part of the maker-checker chain itself); wiring the
-- resulting VerificationPolicy/CompliancePolicy rows' scoringWeights into
-- onboarding.ts's/compliance.ts's Approve/Reject/Flag choices (this
-- migration has no LLM/scoring-engine integration at all yet -- Phase 4 is
-- still not started, same reasoning ProviderVerificationPolicy's own
-- migration note already gave); EscalateOverdue's SLA read of the active
-- policy.

ALTER TABLE users DROP CONSTRAINT users_party_role_check;
ALTER TABLE users ADD CONSTRAINT users_party_role_check
  CHECK (party_role IN ('business', 'vetify', 'verifier', 'assessor', 'financialInstitution', 'advisor', 'sentinel', 'regulator', 'riskCommittee'));

-- ─── VerificationPolicy ─────────────────────────────────────────────────────

CREATE TABLE verification_policy (
  id                 BIGSERIAL PRIMARY KEY,
  max_amendments     INTEGER NOT NULL CHECK (max_amendments > 0),
  sla_hours          INTEGER NOT NULL CHECK (sla_hours > 0),
  auto_approve_min   INTEGER NOT NULL CHECK (auto_approve_min >= 0 AND auto_approve_min <= 100),
  auto_reject_max    INTEGER NOT NULL CHECK (auto_reject_max >= 0),
  required_doc_types JSONB NOT NULL DEFAULT '[]',
  policy_version     TEXT NOT NULL CHECK (policy_version <> ''),
  scoring_weights    JSONB NOT NULL,  -- VerificationScoringWeights
  archived_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (auto_approve_min > auto_reject_max)
);

ALTER TABLE verification_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_policy FORCE ROW LEVEL SECURITY;

-- signatory vetify, no observer clause -- vetify-only, same as
-- ProviderVerificationPolicy's own visibility.
CREATE POLICY verification_policy_select ON verification_policy
  FOR SELECT USING (current_setting('app.current_party_role', true) = 'vetify');
CREATE POLICY verification_policy_insert ON verification_policy
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
CREATE POLICY verification_policy_update ON verification_policy
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── PendingVerificationPolicy ──────────────────────────────────────────────

CREATE TABLE pending_verification_policy (
  id                        BIGSERIAL PRIMARY KEY,
  max_amendments            INTEGER NOT NULL CHECK (max_amendments > 0),
  sla_hours                 INTEGER NOT NULL CHECK (sla_hours > 0),
  auto_approve_min          INTEGER NOT NULL CHECK (auto_approve_min >= 0 AND auto_approve_min <= 100),
  auto_reject_max           INTEGER NOT NULL CHECK (auto_reject_max >= 0),
  required_doc_types        JSONB NOT NULL DEFAULT '[]',
  policy_version            TEXT NOT NULL CHECK (policy_version <> ''),
  scoring_weights           JSONB NOT NULL,
  proposed_by               TEXT NOT NULL CHECK (proposed_by <> ''),
  reason                    TEXT NOT NULL CHECK (reason <> ''),
  proposed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  risk_committee_endorsed_by TEXT,
  risk_committee_endorsed_at TIMESTAMPTZ,
  -- Archived-contract-implies-terminal-state: set by ApprovePolicyChange
  -- (successor = verification_policy) or RejectPolicyChange (no
  -- successor). EndorseByRiskCommittee stays a plain UPDATE on this same
  -- row (design doc §3's "create this with" collapse rule), so no status
  -- column is needed beyond archived_at/superseded_by_kind.
  archived_at               TIMESTAMPTZ,
  superseded_by_kind        TEXT,
  superseded_by_id          BIGINT,
  CHECK (auto_approve_min > auto_reject_max)
);

ALTER TABLE pending_verification_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_verification_policy FORCE ROW LEVEL SECURITY;

-- signatory vetify, observer riskCommittee -- a direct match: vetify
-- INSERTs and UPDATEs (ApprovePolicyChange/RejectPolicyChange), riskCommittee
-- UPDATEs (EndorseByRiskCommittee), so both roles need SELECT too (RLS
-- write/select symmetry -- see check-rls-symmetry.ts).
CREATE POLICY pending_verification_policy_select ON pending_verification_policy
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'riskCommittee'));
CREATE POLICY pending_verification_policy_insert ON pending_verification_policy
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
CREATE POLICY pending_verification_policy_update ON pending_verification_policy
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'riskCommittee'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'riskCommittee'));

CREATE TRIGGER trg_pending_verification_policy_history
  AFTER UPDATE ON pending_verification_policy FOR EACH ROW EXECUTE FUNCTION record_entity_history();

-- ─── CompliancePolicy ───────────────────────────────────────────────────────

CREATE TABLE compliance_policy (
  id                     BIGSERIAL PRIMARY KEY,
  auto_approve_min       INTEGER NOT NULL CHECK (auto_approve_min >= 0 AND auto_approve_min <= 100),
  auto_reject_max        INTEGER NOT NULL CHECK (auto_reject_max >= 0 AND auto_reject_max <= 100),
  escalation_sla_hours   INTEGER NOT NULL CHECK (escalation_sla_hours > 0),
  shariah_policy_version TEXT NOT NULL CHECK (shariah_policy_version <> ''),
  policy_version         TEXT NOT NULL CHECK (policy_version <> ''),
  effective_from         TIMESTAMPTZ NOT NULL,
  effective_to           TIMESTAMPTZ,
  scoring_weights        JSONB NOT NULL,  -- ComplianceScoringWeights
  archived_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (auto_approve_min > auto_reject_max),
  CHECK (effective_to IS NULL OR effective_from < effective_to)
);

ALTER TABLE compliance_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_policy FORCE ROW LEVEL SECURITY;

CREATE POLICY compliance_policy_select ON compliance_policy
  FOR SELECT USING (current_setting('app.current_party_role', true) = 'vetify');
CREATE POLICY compliance_policy_insert ON compliance_policy
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
CREATE POLICY compliance_policy_update ON compliance_policy
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── PendingCompliancePolicy ────────────────────────────────────────────────

CREATE TABLE pending_compliance_policy (
  id                        BIGSERIAL PRIMARY KEY,
  auto_approve_min          INTEGER NOT NULL CHECK (auto_approve_min >= 0 AND auto_approve_min <= 100),
  auto_reject_max           INTEGER NOT NULL CHECK (auto_reject_max >= 0 AND auto_reject_max <= 100),
  escalation_sla_hours      INTEGER NOT NULL CHECK (escalation_sla_hours > 0),
  shariah_policy_version    TEXT NOT NULL CHECK (shariah_policy_version <> ''),
  policy_version            TEXT NOT NULL CHECK (policy_version <> ''),
  effective_from            TIMESTAMPTZ NOT NULL,
  effective_to              TIMESTAMPTZ,
  scoring_weights           JSONB NOT NULL,
  proposed_by               TEXT NOT NULL CHECK (proposed_by <> ''),
  reason                    TEXT NOT NULL CHECK (reason <> ''),
  proposed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  risk_committee_endorsed_by TEXT,
  risk_committee_endorsed_at TIMESTAMPTZ,
  archived_at               TIMESTAMPTZ,
  superseded_by_kind        TEXT,
  superseded_by_id          BIGINT,
  CHECK (auto_approve_min > auto_reject_max),
  CHECK (effective_to IS NULL OR effective_from < effective_to)
);

ALTER TABLE pending_compliance_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_compliance_policy FORCE ROW LEVEL SECURITY;

CREATE POLICY pending_compliance_policy_select ON pending_compliance_policy
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'riskCommittee'));
CREATE POLICY pending_compliance_policy_insert ON pending_compliance_policy
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
CREATE POLICY pending_compliance_policy_update ON pending_compliance_policy
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'riskCommittee'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'riskCommittee'));

CREATE TRIGGER trg_pending_compliance_policy_history
  AFTER UPDATE ON pending_compliance_policy FOR EACH ROW EXECUTE FUNCTION record_entity_history();
