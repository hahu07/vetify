-- Phase 2, seventh slice (web2-migration-design.md): collateral valuation
-- document upload -- a business-driven addition on top of RahnAgreement
-- (sixth slice), requested directly rather than found in
-- daml/Vetify/Murabahah.daml's own choice set.
--
-- The real Daml `Revalue` choice (deferred, migration 011's header) is
-- FI-controlled and actually updates RahnAgreement.collateralValue --
-- deliberately NOT what this table does. This is evidence the *business*
-- submits (a professional valuer's report it commissioned), not a formal
-- FI revaluation decision -- letting the pledging party unilaterally set
-- their own collateral's value would be a real security hole, so
-- collateral_value on rahn_agreement is untouched by this upload. The FI
-- (and vetify, in an oversight capacity) can see the submitted valuation
-- and its stated amount, but only a future Revalue-equivalent choice
-- (still out of scope) would ever act on it.
--
-- Document fields (doc_type/content_hash/storage_ref/file_size) mirror the
-- existing DocumentRef pattern already used by Onboarding's KYC upload
-- (app/business/onboarding/page.tsx's hashFile()) -- a real client-computed
-- SHA-256 hash, no actual server-side file storage (a pre-existing,
-- already-documented limitation of this migration, not new here).

CREATE TABLE collateral_valuation_document (
  id                  BIGSERIAL PRIMARY KEY,
  rahn_agreement_id   BIGINT NOT NULL REFERENCES rahn_agreement(id),
  cac_reg_number      TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  valuator_ref        TEXT NOT NULL CHECK (valuator_ref <> ''),
  valuation_amount     NUMERIC NOT NULL CHECK (valuation_amount > 0),
  valuation_date       DATE NOT NULL,
  notes               TEXT,
  doc_type            TEXT NOT NULL,
  content_hash        TEXT NOT NULL,
  storage_ref         TEXT NOT NULL,
  file_size           INTEGER,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE collateral_valuation_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE collateral_valuation_document FORCE ROW LEVEL SECURITY;

CREATE POLICY collateral_valuation_document_select ON collateral_valuation_document
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

-- Only the business can submit -- the whole point is independent evidence
-- the pledging party provides, not something the FI or vetify authors.
CREATE POLICY collateral_valuation_document_insert ON collateral_valuation_document
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'business');
