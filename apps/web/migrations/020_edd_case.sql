-- Phase 2, Seventeenth Slice (web2-migration-design.md): EDDCase (G14) --
-- ported from daml/Vetify/Compliance.daml's OpenEddCase (nonconsuming, on
-- ComplianceReview), UpdateEddChecklist, CloseEddCase. Closes the last
-- Compliance-module item on Phase 1's original deferred list besides the
-- now-done VerificationPolicy/CompliancePolicy maker-checker,
-- RecordShariahPreCheck/SupersedeShariahVerdict, and AuthorizedReviewer.
--
-- One template ported (EDDCase), 45 templates now ported total.
--
-- G14's real purpose (CLAUDE.md): a PEP hit needs documented source-of-
-- wealth verification, enhanced media search, and senior-management
-- sign-off -- not just a bare ManualReview note. `ApproveCompliance`'s hard
-- gate (wired in this same migration's domain-layer companion,
-- lib/domain/compliance.ts) only accepts a Closed EDD case, and closing one
-- requires every checklist item complete first -- so a PEP relationship
-- cannot be waved through on an open or partially-filled case.
--
-- Structural notes:
-- - `EddChecklist` (a value record in Daml, five fields) is flattened
--   directly onto edd_case as its own columns rather than a jsonb blob --
--   every field is individually read/written by UpdateEddChecklist's
--   partial-update semantics (each arg is Optional, `None` keeps the
--   existing value), which is far more natural against real columns than
--   a read-modify-write on a jsonb object for every partial update.
-- - No Decimal fields anywhere in EddChecklist -- addendum A doesn't apply.
-- - `verifier`/`business` observer parties collapse to this migration's
--   usual role-based visibility (single shared verifier role, tenant-scoped
--   business via cac_reg_number) -- same simplification as every other
--   ComplianceReview-adjacent table.

CREATE TABLE edd_case (
  id                          BIGSERIAL PRIMARY KEY,
  compliance_review_id        BIGINT NOT NULL REFERENCES compliance_review(id),
  business_name                TEXT NOT NULL,
  cac_reg_number               TEXT NOT NULL,
  trigger_reason                TEXT NOT NULL CHECK (trigger_reason <> ''),
  source_of_wealth_verified     BOOLEAN NOT NULL DEFAULT false,
  source_of_wealth_note         TEXT,
  enhanced_media_search_done    BOOLEAN NOT NULL DEFAULT false,
  senior_management_signoff     TEXT,
  monitoring_frequency          TEXT,
  status                         TEXT NOT NULL DEFAULT 'EddOpen' CHECK (status IN ('EddOpen', 'EddClosed')),
  opened_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at                      TIMESTAMPTZ,
  closed_by                      TEXT
);

ALTER TABLE edd_case ENABLE ROW LEVEL SECURITY;
ALTER TABLE edd_case FORCE ROW LEVEL SECURITY;

-- signatory vetify; observer verifier, business -- direct match, plus the
-- usual tenant scoping for the business's own case.
CREATE POLICY edd_case_select ON edd_case
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'verifier')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

-- OpenEddCase's real controller is vetify alone.
CREATE POLICY edd_case_insert ON edd_case
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- UpdateEddChecklist/CloseEddCase's real controller is verifier alone.
CREATE POLICY edd_case_update ON edd_case
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'verifier')
  WITH CHECK (current_setting('app.current_party_role', true) = 'verifier');

CREATE TRIGGER trg_edd_case_history
  AFTER UPDATE ON edd_case FOR EACH ROW EXECUTE FUNCTION record_entity_history();
