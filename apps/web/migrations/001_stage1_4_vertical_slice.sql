-- Phase 1 vertical slice (web2-migration-design.md): Stage 1-4 of the
-- Murabahah lifecycle -- Business Onboarding, Verification, Compliance
-- Review, Approved Business. Ported from daml/Vetify/Onboarding.daml and
-- daml/Vetify/Compliance.daml.
--
-- Deliberately out of scope for this proof-of-concept slice (deferred, not
-- forgotten -- would be added when generalizing to the remaining ~90
-- templates in Phase 2): EDDCase / RecordShariahPreCheck / SupersedeShariahVerdict
-- (advisor party), CompliancePolicy/VerificationPolicy + the maker-checker
-- PendingPolicy flow (riskCommittee party), AuthorizedReviewer registry,
-- EscalateOverdue SLA choices, RequestAmendment/Amend. Only the core
-- Draft->UnderReview->(Approved|Rejected|ManualReview) lifecycle is ported
-- here, since proving that translation pattern end-to-end is this slice's
-- entire purpose (see the design doc's Phase 1 go/no-go gate).

-- ─── Users (ported from infra/postgres/init.sql, simplified) ───────────────

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  -- Which of the three roles exercised in this slice this user acts as.
  -- 'business' additionally requires cac_reg_number (their tenant key).
  party_role    TEXT NOT NULL CHECK (party_role IN ('business', 'vetify', 'verifier')),
  cac_reg_number TEXT UNIQUE,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Generic row-level audit history (addendum B) ──────────────────────────
-- Replaces the field-level history Canton's contract immutability gave for
-- free. One shared table + one trigger function, applied to every table
-- below, rather than hand-authoring a _history table per template.

CREATE TABLE entity_history (
  id           BIGSERIAL PRIMARY KEY,
  table_name   TEXT NOT NULL,
  row_id       BIGINT NOT NULL,
  action       TEXT NOT NULL,
  before       JSONB NOT NULL,
  after        JSONB NOT NULL,
  changed_role TEXT,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_entity_history_lookup ON entity_history (table_name, row_id);

CREATE OR REPLACE FUNCTION record_entity_history() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO entity_history (table_name, row_id, action, before, after, changed_role)
  VALUES (
    TG_TABLE_NAME,
    OLD.id,
    'UPDATE',
    to_jsonb(OLD),
    to_jsonb(NEW),
    current_setting('app.current_party_role', true)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Stage 1: Business Onboarding ──────────────────────────────────────────
-- Daml: template BusinessOnboarding (daml/Vetify/Onboarding.daml)

CREATE TABLE business_onboarding (
  id               BIGSERIAL PRIMARY KEY,
  -- Pulled out of the `kyc` jsonb blob into its own column because RLS and
  -- the uniqueness index both need to key on it directly.
  cac_reg_number   TEXT NOT NULL,
  profile          JSONB NOT NULL,  -- BusinessProfile (name, address, directors[], ...)
  kyc              JSONB NOT NULL,  -- BusinessKyc (cacRegNumber, taxId)
  status           TEXT NOT NULL DEFAULT 'Draft'
                     CHECK (status IN ('Draft', 'UnderReview', 'ManualReview', 'Approved', 'Rejected')),
  agent_score      INTEGER CHECK (agent_score IS NULL OR (agent_score BETWEEN 0 AND 100)),
  agent_risk       TEXT CHECK (agent_risk IS NULL OR agent_risk IN ('Low', 'Medium', 'High')),
  agent_note       TEXT,
  agent_version    TEXT,
  documents        JSONB NOT NULL DEFAULT '[]',  -- DocumentRef[]
  submitted_at     TIMESTAMPTZ,
  onboarding_ref   TEXT,
  -- Archived-contract-implies-terminal-state (web2-migration-design.md §3):
  -- Approve/Reject archive this row (it doesn't recreate under Daml either)
  -- and point at the VerificationResult row created in its place.
  archived_at         TIMESTAMPTZ,
  superseded_by_kind  TEXT,
  superseded_by_id    BIGINT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stronger than the status quo: Daml's own comment on this template notes
-- (business, kyc.cacRegNumber) uniqueness is an unenforced, caller-side-only
-- convention on SDK 3.4.11/LF 2.2 (no contract keys). A partial unique index
-- makes it a real, ledger-... er, database-enforced invariant.
CREATE UNIQUE INDEX one_active_onboarding_per_cac
  ON business_onboarding (cac_reg_number) WHERE archived_at IS NULL;

ALTER TABLE business_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_onboarding FORCE ROW LEVEL SECURITY; -- closes the table-owner-bypasses-RLS gap

CREATE POLICY business_onboarding_select ON business_onboarding
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'verifier')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

-- Write-side authorization for *which* choice may run is enforced by the
-- withAuthorization wrapper in lib/auth/withAuthorization.ts (addendum D) --
-- this policy only ensures a session with no recognized role at all cannot
-- write anything, mirroring "RLS enforces visibility, not business rules"
-- from the original design review.
CREATE POLICY business_onboarding_write ON business_onboarding
  FOR ALL
  USING (current_setting('app.current_party_role', true) IN ('business', 'vetify', 'verifier'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('business', 'vetify', 'verifier'));

CREATE TRIGGER trg_business_onboarding_history
  AFTER UPDATE ON business_onboarding
  FOR EACH ROW EXECUTE FUNCTION record_entity_history();

-- ─── Stage 2: Verification Result ──────────────────────────────────────────
-- Daml: template VerificationResult (daml/Vetify/Onboarding.daml)
-- Immutable audit record -- no UPDATE choice exists on this template in Daml
-- either (only Supersede, which creates a *different* correction template --
-- out of scope for this slice), so no history trigger is needed here.

CREATE TABLE verification_result (
  id                    BIGSERIAL PRIMARY KEY,
  business_onboarding_id BIGINT NOT NULL REFERENCES business_onboarding(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  checks                JSONB NOT NULL,  -- VerificationChecks
  risk_score            INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level            TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
  outcome               TEXT NOT NULL CHECK (outcome IN ('Approved', 'Rejected')),
  auto_decided          BOOLEAN NOT NULL,
  verification_ref      TEXT NOT NULL,
  reviewer_party        TEXT,
  reviewed_by           TEXT,
  note                  TEXT,
  decided_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE verification_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_result FORCE ROW LEVEL SECURITY;

CREATE POLICY verification_result_select ON verification_result
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'verifier')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY verification_result_write ON verification_result
  FOR ALL
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));

-- ─── Stage 3: Compliance Review ────────────────────────────────────────────
-- Daml: template ComplianceReview (daml/Vetify/Compliance.daml)

CREATE TABLE compliance_review (
  id                      BIGSERIAL PRIMARY KEY,
  verification_result_id  BIGINT NOT NULL REFERENCES verification_result(id),
  cac_reg_number          TEXT NOT NULL,
  business_name           TEXT NOT NULL,
  business_sector         TEXT NOT NULL,
  business_activity       TEXT NOT NULL,
  incorporation_date      DATE NOT NULL,
  verification_ref        TEXT NOT NULL,
  compliance_ref          TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'Pending'
                            CHECK (status IN ('Pending', 'UnderReview', 'ManualReview', 'Approved', 'Rejected')),
  checks                  JSONB,  -- ComplianceCheck, once recorded
  agent_score             INTEGER CHECK (agent_score IS NULL OR (agent_score BETWEEN 0 AND 100)),
  agent_risk              TEXT CHECK (agent_risk IS NULL OR agent_risk IN ('Low', 'Medium', 'High')),
  agent_note              TEXT,
  agent_version           TEXT,
  review_started_at       TIMESTAMPTZ,
  archived_at             TIMESTAMPTZ,
  superseded_by_kind      TEXT,
  superseded_by_id        BIGINT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE compliance_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_review FORCE ROW LEVEL SECURITY;

CREATE POLICY compliance_review_select ON compliance_review
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'verifier')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY compliance_review_write ON compliance_review
  FOR ALL
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));

CREATE TRIGGER trg_compliance_review_history
  AFTER UPDATE ON compliance_review
  FOR EACH ROW EXECUTE FUNCTION record_entity_history();

-- ─── Stage 3: Compliance Result ────────────────────────────────────────────
-- Daml: template ComplianceResult (daml/Vetify/Compliance.daml)

CREATE TABLE compliance_result (
  id                     BIGSERIAL PRIMARY KEY,
  compliance_review_id   BIGINT NOT NULL REFERENCES compliance_review(id),
  cac_reg_number         TEXT NOT NULL,
  business_name          TEXT NOT NULL,
  verification_ref       TEXT NOT NULL,
  compliance_ref         TEXT NOT NULL,
  outcome                TEXT NOT NULL CHECK (outcome IN ('Approved', 'Rejected')),
  checks                 JSONB NOT NULL,  -- ComplianceCheck
  risk_score             INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level             TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
  auto_decided           BOOLEAN NOT NULL,
  reason                 TEXT,
  decided_at             TIMESTAMPTZ NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE compliance_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_result FORCE ROW LEVEL SECURITY;

CREATE POLICY compliance_result_select ON compliance_result
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'verifier')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY compliance_result_write ON compliance_result
  FOR ALL
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));

-- ─── Stage 4: Approved Business ────────────────────────────────────────────
-- Daml: template ApprovedBusiness (daml/Vetify/Compliance.daml)

CREATE TABLE approved_business (
  id                  BIGSERIAL PRIMARY KEY,
  cac_reg_number      TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  business_sector     TEXT NOT NULL,
  business_activity   TEXT NOT NULL,
  incorporation_date  DATE NOT NULL,
  verification_ref    TEXT NOT NULL,
  compliance_ref      TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'BusinessActive'
                        CHECK (status IN ('BusinessActive', 'BusinessSuspended', 'BusinessExpired')),
  approved_at         TIMESTAMPTZ NOT NULL,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_active_approved_business_per_cac
  ON approved_business (cac_reg_number) WHERE archived_at IS NULL;

ALTER TABLE approved_business ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_business FORCE ROW LEVEL SECURITY;

CREATE POLICY approved_business_select ON approved_business
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'verifier')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY approved_business_write ON approved_business
  FOR ALL
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

CREATE TRIGGER trg_approved_business_history
  AFTER UPDATE ON approved_business
  FOR EACH ROW EXECUTE FUNCTION record_entity_history();
