-- Phase 2, Twenty-First Slice (web2-migration-design.md): post-hoc audit
-- corrections for Stage 2/3/6 decisions -- ported from daml/Vetify/
-- Onboarding.daml's VerificationResult.Supersede, Compliance.daml's
-- ComplianceResult.Supersede, and Financing.daml's UnderwritingResult.
-- IssueCorrection, plus their three audit templates (VerificationCorrection,
-- ComplianceCorrection, UnderwritingCorrection). Mirrors the
-- SupersedeShariahVerdict/ShariahVerdictCorrection pattern migration 018
-- already shipped -- same shape, three more decision points.
--
-- Three templates ported, 48 templates now ported total.
--
-- Two real gaps confirmed by reading the Daml source directly, not assumed,
-- and closed here rather than worked around:
--   1. `verification_result` (migration 001) never carried an `archived_at`
--      column. VerificationResult.Supersede is a *consuming* choice in the
--      real Daml ("archives this VerificationResult and creates an
--      immutable VerificationCorrection") -- unlike ComplianceResult's own
--      Supersede, which is explicitly `nonconsuming` ("both the original
--      and the correction coexist"). Added here so the consuming/
--      nonconsuming distinction between the two is actually representable,
--      not silently flattened to "insert a correction row" for both.
--   2. `compliance_result` (migration 001) never carried a `reviewed_by`
--      column, even though `ApproveComplianceArgs`/`RejectComplianceArgs`
--      (lib/domain/compliance.ts) have accepted a `reviewedBy` argument
--      since Phase 1 -- silently dropped on every INSERT. The real Daml
--      ComplianceResult.Supersede's maker-checker check ("corrector cannot
--      be the same as the original human reviewer") depends on this field
--      existing; it can't be ported faithfully without it. Backfilled here;
--      lib/domain/compliance.ts's approve/reject now actually persist it.
--
-- `correctedBy` is `Party` in VerificationResult.Supersede's real Daml
-- signature (the only one of the three not already `Text`) but ported as
-- TEXT here, same "Party representing an individual human, not a genuine
-- multi-tenant Canton party" collapse this migration has applied everywhere
-- else (officer names, reviewer names, ShariahVerdictCorrection's own
-- corrected_by) -- there is no per-individual Party in this system's
-- session model, only per-role.
--
-- Deliberately out of scope, named explicitly: UnderwritingResult.
-- OverrideUnderwriting (a separate, larger feature -- the FI overriding the
-- AI recommendation with a human decision, gated on a registered, active
-- UnderwritingOfficer via AuthorizedOfficer -- a real FI-side RBAC check,
-- not an audit-correction concern); a frontend for any of these three
-- choices (matches this migration's now-established backend-first pattern
-- for a new choice, same as Slices 11/14/15/17 before their own UI passes).

-- ─── Backfill: archived_at on verification_result, reviewed_by on compliance_result ──
--
-- A third real gap, found live while writing this slice's own tests, not
-- assumed: `underwriting_result` (migration 005) never got an UPDATE
-- policy at all, unlike verification_result/compliance_result (which both
-- have one, migration 001) -- nothing before IssueCorrection ever needed
-- to `SELECT ... FOR UPDATE` this table. Postgres RLS requires a passing
-- UPDATE policy to lock a row via `FOR UPDATE`/`FOR SHARE`, even when the
-- transaction never actually runs an UPDATE statement against it (as here
-- -- IssueCorrection is nonconsuming, matching ComplianceResult's own
-- Supersede) -- confirmed live: the correction choice's own `SELECT ...
-- FOR UPDATE` silently returned zero rows without this policy, surfacing
-- as a wrong "Underwriting result not found" error.
CREATE POLICY underwriting_result_update ON underwriting_result
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

ALTER TABLE verification_result ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE compliance_result ADD COLUMN reviewed_by TEXT;

-- ─── VerificationCorrection (audit record for VerificationResult.Supersede) ──

CREATE TABLE verification_correction (
  id                     BIGSERIAL PRIMARY KEY,
  verification_result_id BIGINT NOT NULL REFERENCES verification_result(id),
  business_name          TEXT NOT NULL,
  cac_reg_number         TEXT NOT NULL,
  original_ref           TEXT NOT NULL,
  original_outcome       TEXT NOT NULL CHECK (original_outcome IN ('Approved', 'Rejected')),
  correction_ref         TEXT NOT NULL CHECK (correction_ref <> ''),
  corrected_outcome      TEXT NOT NULL CHECK (corrected_outcome IN ('Approved', 'Rejected')),
  reason                 TEXT NOT NULL CHECK (reason <> ''),
  corrected_by           TEXT NOT NULL CHECK (corrected_by <> ''),
  corrected_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE verification_correction ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_correction FORCE ROW LEVEL SECURITY;

-- signatory vetify; observer business, verifier -- direct match to the
-- real template, plus the usual tenant scoping for the business's own
-- correction record.
CREATE POLICY verification_correction_select ON verification_correction
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'verifier')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY verification_correction_insert ON verification_correction
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── ComplianceCorrection (audit record for ComplianceResult.Supersede) ────

CREATE TABLE compliance_correction (
  id                       BIGSERIAL PRIMARY KEY,
  compliance_result_id     BIGINT NOT NULL REFERENCES compliance_result(id),
  business_name            TEXT NOT NULL,
  cac_reg_number           TEXT NOT NULL,
  verification_ref         TEXT NOT NULL,
  original_compliance_ref  TEXT NOT NULL,
  original_outcome         TEXT NOT NULL CHECK (original_outcome IN ('Approved', 'Rejected')),
  correction_ref           TEXT NOT NULL CHECK (correction_ref <> ''),
  corrected_outcome        TEXT NOT NULL CHECK (corrected_outcome IN ('Approved', 'Rejected')),
  reason                   TEXT NOT NULL CHECK (reason <> ''),
  corrected_by             TEXT NOT NULL CHECK (corrected_by <> ''),
  corrected_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE compliance_correction ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_correction FORCE ROW LEVEL SECURITY;

-- signatory vetify; observer business, verifier -- direct match, same
-- tenant scoping as verification_correction above.
CREATE POLICY compliance_correction_select ON compliance_correction
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'verifier')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY compliance_correction_insert ON compliance_correction
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── UnderwritingCorrection (audit record for UnderwritingResult.IssueCorrection) ──

CREATE TABLE underwriting_correction (
  id                     BIGSERIAL PRIMARY KEY,
  underwriting_result_id BIGINT NOT NULL REFERENCES underwriting_result(id),
  business_name          TEXT NOT NULL,
  cac_reg_number         TEXT NOT NULL,
  financing_ref          TEXT NOT NULL,
  original_assessment    JSONB NOT NULL,  -- RiskAssessment snapshot, same jsonb-snapshot pattern as shariah_verdict_correction
  corrected_assessment   JSONB NOT NULL,
  correction_ref         TEXT NOT NULL CHECK (correction_ref <> ''),
  corrected_outcome      TEXT NOT NULL,
  reason                 TEXT NOT NULL CHECK (reason <> ''),
  corrected_by           TEXT NOT NULL CHECK (corrected_by <> ''),
  corrected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_auto_decided  BOOLEAN NOT NULL
);

ALTER TABLE underwriting_correction ENABLE ROW LEVEL SECURITY;
ALTER TABLE underwriting_correction FORCE ROW LEVEL SECURITY;

-- signatory vetify; observer financialInstitution, business -- direct
-- match to the real template (no assessor observer on the correction
-- itself, matching the Daml original's own field list exactly, even
-- though assessor observes the underlying UnderwritingResult).
CREATE POLICY underwriting_correction_select ON underwriting_correction
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY underwriting_correction_insert ON underwriting_correction
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
