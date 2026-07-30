-- Phase 2, Twenty-Eighth Slice -- the maker-checker variant of
-- EnforceCollateral: RahnAgreement.ProposeEnforceCollateral (nonconsuming,
-- financialInstitution) creates PendingCollateralEnforcement; vetify then
-- exercises ConfirmEnforce (nested-exercises the real EnforceCollateral) or
-- RejectEnforce on it.

-- ─── PendingCollateralEnforcement ──────────────────────────────────────────
-- signatory financialInstitution; observer vetify, business.

CREATE TABLE pending_collateral_enforcement (
  id                     BIGSERIAL PRIMARY KEY,
  rahn_agreement_id      BIGINT NOT NULL REFERENCES rahn_agreement(id),
  cac_reg_number         TEXT NOT NULL,
  business_name          TEXT NOT NULL,
  reason                 TEXT NOT NULL CHECK (reason <> ''),
  gsm_exhausted          BOOLEAN NOT NULL DEFAULT false,
  gsm_ref                TEXT,
  proposed_by_officer_id TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Rejected')),
  resolved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pending_collateral_enforcement ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_collateral_enforcement FORCE ROW LEVEL SECURITY;

CREATE POLICY pending_collateral_enforcement_select ON pending_collateral_enforcement
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY pending_collateral_enforcement_insert ON pending_collateral_enforcement
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ConfirmEnforce/RejectEnforce are both vetify-controlled.
CREATE POLICY pending_collateral_enforcement_update ON pending_collateral_enforcement
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── RLS gap: ConfirmEnforce's nested EnforceCollateral runs as vetify ─────
-- rahn_agreement_update (migration 011) only ever granted financialInstitution
-- -- every consuming choice on RahnAgreement ported before this slice
-- (ReleaseCollateral, EnforceCollateral itself) was FI-controlled. The real
-- Daml ConfirmEnforce nested-exercises EnforceCollateral while authorized as
-- vetify (its own controller), so the app-level UPDATE this slice performs
-- runs under app.current_party_role = 'vetify' -- caught by reading the
-- Daml source before writing any code, same as the Twenty-Fourth Slice's
-- WithdrawWad finding.
DROP POLICY rahn_agreement_update ON rahn_agreement;
CREATE POLICY rahn_agreement_update ON rahn_agreement
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('financialInstitution', 'vetify'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('financialInstitution', 'vetify'));
