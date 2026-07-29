-- Phase 2, sixth slice (web2-migration-design.md): RahnAgreement collateral
-- pledge (AAOIFI Std No. 39) -- ReleaseCollateral (on closure) and
-- EnforceCollateral (on default), both real four-eyes controls reusing the
-- authorized_officer registry (Governance), the same cross-slice dependency
-- GrantIbra introduced in the fifth slice -- ReleaseCollateral needs a
-- distinct OperationsOfficer (proposer) + RiskOfficer (confirmer);
-- EnforceCollateral needs a distinct RecoveryOfficer (proposer) +
-- RiskOfficer (confirmer).
--
-- No Daml choice anywhere creates a fresh RahnAgreement -- like
-- BusinessOnboarding in Phase 1, it's a direct creation (here: the FI
-- pledging collateral against a facility), not the output of some other
-- choice's create-this. Modeled as a plain FI-insertable row, matching
-- MurabahahContract's own precedent of "business inserts despite being
-- dual-signatory" (migration 006) -- here the FI is the natural
-- last-to-act party instead.
--
-- Deliberately out of scope: Revalue (collateral revaluation + its
-- CollateralValuationRecord), CollateralInspectionRecord/InspectionResponse,
-- PendingCollateralEnforcement (a maker-checker staging step ahead of
-- EnforceCollateral this pass skips, mirroring how Ibra's GrantPartialIbra
-- was deferred alongside GrantIbra).

CREATE TABLE rahn_agreement (
  id                        BIGSERIAL PRIMARY KEY,
  murabahah_contract_id     BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref              TEXT NOT NULL,
  cac_reg_number            TEXT NOT NULL,
  business_name             TEXT NOT NULL,
  collateral_description    TEXT NOT NULL,
  collateral_value          NUMERIC NOT NULL CHECK (collateral_value > 0),
  collateral_status         TEXT NOT NULL DEFAULT 'CollateralActive'
                              CHECK (collateral_status IN ('CollateralActive', 'CollateralReleased', 'CollateralEnforced')),
  release_evidence          TEXT,
  proposed_by_officer_id    TEXT,
  confirmed_by_officer_id   TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rahn_agreement ENABLE ROW LEVEL SECURITY;
ALTER TABLE rahn_agreement FORCE ROW LEVEL SECURITY;

CREATE POLICY rahn_agreement_select ON rahn_agreement
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY rahn_agreement_insert ON rahn_agreement
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY rahn_agreement_update ON rahn_agreement
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
