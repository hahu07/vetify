-- Phase 2, first vertical slice (web2-migration-design.md): Stage 5-7 of the
-- Murabahah lifecycle -- Financing Request, AI Underwriting, Financing
-- Review. Ported from daml/Vetify/Financing.daml. Scoped the same way
-- Phase 1 was: core state-machine choices only, policy/registry/governance
-- dependencies deliberately deferred (see below).
--
-- Deliberately out of scope for this pass (deferred, not forgotten):
-- AssignAssessor (needs the AuthorizedOfficer registry), WithdrawRequest/
-- ExpireRequest/CancelRequest/ProposeAmendment (process/ops choices, same
-- tier as Onboarding's RequestAmendment/EscalateOverdue), UnderwritingPolicy
-- + its maker-checker flow (same tier as VerificationPolicy/CompliancePolicy),
-- OverrideUnderwriting/IssueCorrection/UnderwritingCorrection (audit
-- correction, same tier as Supersede), RecordGovernanceAssessment/
-- FundingGovernanceRecord. ApproveFunding is ported in simplified form: it
-- records the FinancingDecision and transitions status, but does NOT create
-- a real MurabahahWad row or check ApprovedProvider/AuthorizedOfficer --
-- the 64-template Murabahah module and the Governance registries are both
-- out of scope for this pass entirely.
--
-- Addendum A applied from the start this time (not retrofitted): terms.amount
-- (Decimal) and assessment.recommendedLimit/probabilityOfDefault/
-- lossGivenDefault/exposureAtDefault (Decimal) all get real NUMERIC columns,
-- never buried in a jsonb blob.
--
-- Addendum C lessons (bugs #2/#3) applied from the start: every write policy
-- is FOR INSERT / FOR UPDATE explicitly, never FOR ALL; no write policy
-- re-derives per-choice authorization (that stays in
-- lib/auth/withAuthorization.ts) -- it's a coarse "recognized role" check.

ALTER TABLE users DROP CONSTRAINT users_party_role_check;
ALTER TABLE users ADD CONSTRAINT users_party_role_check
  CHECK (party_role IN ('business', 'vetify', 'verifier', 'assessor', 'financialInstitution'));

-- ─── Stage 5: Financing Request ────────────────────────────────────────────
-- Daml: template FinancingRequest (daml/Vetify/Financing.daml)

CREATE TABLE financing_request (
  id                   BIGSERIAL PRIMARY KEY,
  cac_reg_number       TEXT NOT NULL,
  business_name        TEXT NOT NULL,
  terms_amount         NUMERIC NOT NULL CHECK (terms_amount > 0),
  terms_purpose        TEXT NOT NULL,
  terms_tenure_months  INTEGER NOT NULL CHECK (terms_tenure_months > 0),
  status               TEXT NOT NULL DEFAULT 'Submitted'
                         CHECK (status IN ('Submitted', 'UnderwritingManualReview', 'Underwriting',
                                            'FinancingApproved', 'FinancingRejected')),
  financing_ref        TEXT NOT NULL,
  verification_ref     TEXT,
  compliance_ref       TEXT,
  submitted_at         TIMESTAMPTZ,
  business_sector      TEXT NOT NULL,
  incorporation_date   DATE NOT NULL,
  expires_at           TIMESTAMPTZ,
  agent_score          INTEGER CHECK (agent_score IS NULL OR (agent_score BETWEEN 0 AND 100)),
  agent_risk           TEXT CHECK (agent_risk IS NULL OR agent_risk IN ('Low', 'Medium', 'High')),
  agent_note           TEXT,
  agent_version        TEXT,
  archived_at          TIMESTAMPTZ,
  superseded_by_kind   TEXT,
  superseded_by_id     BIGINT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financing_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_request FORCE ROW LEVEL SECURITY;

CREATE POLICY financing_request_select ON financing_request
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'assessor', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY financing_request_insert ON financing_request
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'business');

CREATE POLICY financing_request_update ON financing_request
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'assessor', 'financialInstitution'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'assessor', 'financialInstitution'));

CREATE TRIGGER trg_financing_request_history
  AFTER UPDATE ON financing_request
  FOR EACH ROW EXECUTE FUNCTION record_entity_history();

-- ─── Stage 6: Underwriting Result ──────────────────────────────────────────
-- Daml: template UnderwritingResult (daml/Vetify/Financing.daml)

CREATE TABLE underwriting_result (
  id                              BIGSERIAL PRIMARY KEY,
  financing_request_id           BIGINT NOT NULL REFERENCES financing_request(id),
  cac_reg_number                  TEXT NOT NULL,
  business_name                   TEXT NOT NULL,
  financing_ref                   TEXT NOT NULL,
  assessment_score                 INTEGER NOT NULL CHECK (assessment_score BETWEEN 0 AND 100),
  assessment_risk_category        TEXT NOT NULL CHECK (assessment_risk_category IN ('Low', 'Medium', 'High')),
  assessment_recommended_limit     NUMERIC NOT NULL,
  assessment_recommendation        TEXT NOT NULL,
  assessment_probability_of_default NUMERIC,
  assessment_loss_given_default     NUMERIC,
  assessment_exposure_at_default    NUMERIC,
  assessment_behavioural_score      INTEGER CHECK (assessment_behavioural_score IS NULL OR (assessment_behavioural_score BETWEEN 0 AND 100)),
  assessment_cashflow_risk_score    INTEGER CHECK (assessment_cashflow_risk_score IS NULL OR (assessment_cashflow_risk_score BETWEEN 0 AND 100)),
  assessment_creditworthiness_score INTEGER CHECK (assessment_creditworthiness_score IS NULL OR (assessment_creditworthiness_score BETWEEN 0 AND 100)),
  assessment_fraud_score            INTEGER CHECK (assessment_fraud_score IS NULL OR (assessment_fraud_score BETWEEN 0 AND 100)),
  auto_decided                     BOOLEAN NOT NULL,
  underwriting_started_at         TIMESTAMPTZ,
  valid_until                     TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE underwriting_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE underwriting_result FORCE ROW LEVEL SECURITY;

CREATE POLICY underwriting_result_select ON underwriting_result
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'assessor', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY underwriting_result_insert ON underwriting_result
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'assessor'));

-- ─── Stage 6: Underwriting Rejection ───────────────────────────────────────
-- Daml: template UnderwritingRejection (daml/Vetify/Financing.daml)

CREATE TABLE underwriting_rejection (
  id             BIGSERIAL PRIMARY KEY,
  financing_request_id BIGINT NOT NULL REFERENCES financing_request(id),
  cac_reg_number TEXT NOT NULL,
  business_name  TEXT NOT NULL,
  financing_ref  TEXT NOT NULL,
  reason         TEXT NOT NULL,
  auto_decided   BOOLEAN NOT NULL,
  reviewer_party TEXT,
  reviewed_by    TEXT,
  decided_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE underwriting_rejection ENABLE ROW LEVEL SECURITY;
ALTER TABLE underwriting_rejection FORCE ROW LEVEL SECURITY;

CREATE POLICY underwriting_rejection_select ON underwriting_rejection
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'assessor', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY underwriting_rejection_insert ON underwriting_rejection
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'assessor'));

-- ─── Stage 7: Financing Decision ───────────────────────────────────────────
-- Daml: template FinancingDecision (daml/Vetify/Financing.daml)

CREATE TABLE financing_decision (
  id                BIGSERIAL PRIMARY KEY,
  financing_request_id BIGINT NOT NULL REFERENCES financing_request(id),
  cac_reg_number    TEXT NOT NULL,
  business_name     TEXT NOT NULL,
  financing_ref     TEXT NOT NULL,
  outcome           TEXT NOT NULL CHECK (outcome IN ('FinancingApproved', 'FinancingRejected')),
  reason            TEXT,
  decided_at        TIMESTAMPTZ NOT NULL,
  decided_by_name   TEXT,
  reason_code       TEXT,
  decision_factors  JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financing_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_decision FORCE ROW LEVEL SECURITY;

CREATE POLICY financing_decision_select ON financing_decision
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'assessor', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY financing_decision_insert ON financing_decision
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- New roles need the same baseline grants vetify_web_app already has on
-- every other table (migrations/002_app_role.sql's ALTER DEFAULT PRIVILEGES
-- already covers new tables automatically -- this migration only needed to
-- widen the users.party_role CHECK constraint above).
