-- Phase 2, Thirty-Fourth Slice -- Batch E, closing out the original
-- survey's remainder. Five items, only four of which are real ports:
--
-- 1. RevocationRecord -- created via consuming Revoke on ApprovedBusiness
--    (controller vetify), the same archive-with-successor shape as every
--    other decline/withdraw/cancel choice in this migration.
-- 2. SARReport -- created directly by vetify, no exercised choice, no
--    business observer at all (confidential regulatory filing).
-- 3. ShariahCertificationRevocation -- created via consuming
--    RevokeCertification on ShariahContractCertification (controller
--    advisor), named as deferred in this migration's very first slice
--    header and never built until now.
-- 4. PaymentIdempotencyGuard -- ported as a REAL Postgres UNIQUE constraint
--    on direct_debit_ref, which is strictly MORE atomic than the current
--    production Canton/backend's caller-side-check workaround (SDK 3.4.11
--    lost contract keys, so the ledger itself can no longer enforce this
--    atomically -- see CLAUDE.md's residual-risk note). Postgres never lost
--    that capability, so this migration closes a gap production still has.
-- 5. PaymentScheduleContract -- NOT ported. The real Daml only needs this
--    template to avoid embedding `[PaymentScheduleEntry]` directly in every
--    version of MurabahahContract/MurabahahProposal -- a Daml-specific
--    concern about contract size/versioning that has no Postgres analogue.
--    This migration already stores payment_schedule as a plain JSONB column
--    on murabahah_contract/murabahah_proposal from the Second Slice onward.
--    Confirmed already covered, not a gap -- no table added for it.

-- ─── RevocationRecord ───────────────────────────────────────────────────────
-- signatory vetify; observer business.

ALTER TABLE approved_business ADD COLUMN superseded_by_kind TEXT;
ALTER TABLE approved_business ADD COLUMN superseded_by_id BIGINT;

CREATE TABLE revocation_record (
  id                  BIGSERIAL PRIMARY KEY,
  approved_business_id BIGINT NOT NULL REFERENCES approved_business(id),
  cac_reg_number      TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  verification_ref    TEXT NOT NULL,
  compliance_ref      TEXT NOT NULL,
  reason              TEXT NOT NULL CHECK (reason <> ''),
  revoked_by          TEXT NOT NULL CHECK (revoked_by <> ''),
  revoked_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE revocation_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE revocation_record FORCE ROW LEVEL SECURITY;

CREATE POLICY revocation_record_select ON revocation_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) = 'vetify'
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY revocation_record_insert ON revocation_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── SARReport ──────────────────────────────────────────────────────────────
-- Created directly by vetify. signatory vetify; observer financialInstitution,
-- regulator -- no business observer at all (confidential filing).

CREATE TABLE sar_report (
  id                  BIGSERIAL PRIMARY KEY,
  cac_reg_number      TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  sar_ref             TEXT NOT NULL CHECK (sar_ref <> ''),
  suspicious_activity TEXT NOT NULL CHECK (suspicious_activity <> ''),
  report_date         DATE NOT NULL,
  reported_by_party   TEXT NOT NULL,
  confidential        BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sar_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE sar_report FORCE ROW LEVEL SECURITY;

CREATE POLICY sar_report_select ON sar_report
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY sar_report_insert ON sar_report
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── ShariahCertificationRevocation ─────────────────────────────────────────
-- Created via consuming RevokeCertification on ShariahContractCertification,
-- controller advisor. shariah_contract_certification never had an UPDATE
-- policy at all (only INSERT/SELECT) -- the first choice on it since the
-- certification itself was ported.

ALTER TABLE shariah_contract_certification ADD COLUMN superseded_by_kind TEXT;
ALTER TABLE shariah_contract_certification ADD COLUMN superseded_by_id BIGINT;

CREATE POLICY shariah_contract_certification_update ON shariah_contract_certification
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'advisor')
  WITH CHECK (current_setting('app.current_party_role', true) = 'advisor');

CREATE TABLE shariah_certification_revocation (
  id                                BIGSERIAL PRIMARY KEY,
  shariah_contract_certification_id BIGINT NOT NULL REFERENCES shariah_contract_certification(id),
  facility_ref                      TEXT NOT NULL,
  cac_reg_number                    TEXT NOT NULL,
  business_name                     TEXT NOT NULL,
  original_certification_ref        TEXT NOT NULL,
  revocation_ref                    TEXT NOT NULL CHECK (revocation_ref <> ''),
  reason                            TEXT NOT NULL CHECK (reason <> ''),
  revoked_by                        TEXT NOT NULL CHECK (revoked_by <> ''),
  revoked_at                        TIMESTAMPTZ NOT NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shariah_certification_revocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE shariah_certification_revocation FORCE ROW LEVEL SECURITY;

CREATE POLICY shariah_certification_revocation_select ON shariah_certification_revocation
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'advisor')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY shariah_certification_revocation_insert ON shariah_certification_revocation
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'advisor');

-- ─── PaymentIdempotencyGuard ─────────────────────────────────────────────────
-- One guard row per directDebitRef prevents a replayed payment webhook/
-- collection event from creating a duplicate RepaymentRecord under the same
-- external reference -- only created when directDebitRef is provided;
-- manual/cash payments are not deduplicated this way. A real UNIQUE
-- constraint, atomic under Postgres MVCC.

ALTER TABLE repayment_record ADD COLUMN direct_debit_ref TEXT;

CREATE TABLE payment_idempotency_guard (
  id               BIGSERIAL PRIMARY KEY,
  direct_debit_ref TEXT NOT NULL UNIQUE CHECK (direct_debit_ref <> ''),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payment_idempotency_guard ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_idempotency_guard FORCE ROW LEVEL SECURITY;

CREATE POLICY payment_idempotency_guard_select ON payment_idempotency_guard
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution'));

CREATE POLICY payment_idempotency_guard_insert ON payment_idempotency_guard
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
