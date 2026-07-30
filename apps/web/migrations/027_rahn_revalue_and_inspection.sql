-- Phase 2, Twenty-Sixth Slice (web2-migration-design.md): closes two more
-- explicitly-named deferred gaps on RahnAgreement -- ported from
-- daml/Vetify/Murabahah.daml's Revalue and RecordInspection choices, plus
-- their two audit templates (CollateralValuationRecord,
-- CollateralInspectionRecord).
--
-- `Revalue` was named as deferred directly in migrations/012's own header
-- ("The real Daml Revalue choice (deferred, migration 011's header) is
-- FI-controlled and actually updates RahnAgreement.collateralValue --
-- deliberately NOT what this table does") when that slice built the
-- business-driven valuation *document upload* instead -- a deliberately
-- separate, lower-stakes feature (the business submitting a valuer's
-- report vs. the FI's own formal revaluation decision). This slice ports
-- the real thing migration 012 explicitly declined to build.
--
-- Two templates ported, 58 templates now ported total.
--
-- `Revalue` does `create this with collateralValue = newValue` on the real
-- Daml RahnAgreement (no contract key on SDK 3.4.11/LF 2.2) -- a keyless
-- field-replace, collapsed to a plain UPDATE, same rule as every other
-- such choice already ported. `rahn_agreement_update` already covers
-- `financialInstitution` (both Revalue and RecordInspection's controller),
-- so no RLS policy change is needed this time -- unlike the last several
-- slices, which each found a real gap.

CREATE TABLE collateral_valuation_record (
  id                    BIGSERIAL PRIMARY KEY,
  rahn_agreement_id     BIGINT NOT NULL REFERENCES rahn_agreement(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  previous_value        NUMERIC NOT NULL,
  valuation_amount       NUMERIC NOT NULL CHECK (valuation_amount > 0),
  valuation_date         DATE NOT NULL,
  valuator_ref           TEXT NOT NULL CHECK (valuator_ref <> ''),
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE collateral_valuation_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE collateral_valuation_record FORCE ROW LEVEL SECURITY;

-- signatory financialInstitution; observer business, vetify, (optional)
-- regulator -- same visibility set as rahn_agreement itself.
CREATE POLICY collateral_valuation_record_select ON collateral_valuation_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY collateral_valuation_record_insert ON collateral_valuation_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── CollateralInspectionRecord (RecordInspection on RahnAgreement) ────────

CREATE TABLE collateral_inspection_record (
  id                          BIGSERIAL PRIMARY KEY,
  rahn_agreement_id           BIGINT NOT NULL REFERENCES rahn_agreement(id),
  cac_reg_number              TEXT NOT NULL,
  business_name                TEXT NOT NULL,
  inspection_date              DATE NOT NULL,
  inspected_by                 TEXT NOT NULL CHECK (inspected_by <> ''),
  condition                    TEXT NOT NULL CHECK (condition IN ('Satisfactory', 'RequiresAttention', 'Impaired')),
  inspection_notes             TEXT,
  next_inspection_date         DATE,
  mandate_status                TEXT,
  estimated_gsm_recoverable    NUMERIC,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE collateral_inspection_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE collateral_inspection_record FORCE ROW LEVEL SECURITY;

CREATE POLICY collateral_inspection_record_select ON collateral_inspection_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY collateral_inspection_record_insert ON collateral_inspection_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
