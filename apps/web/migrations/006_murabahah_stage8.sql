-- Phase 2, second slice (web2-migration-design.md): Stage 8, the Murabahah
-- acquisition chain -- ported from daml/Vetify/Murabahah.daml. Scoped the
-- same way as every prior pass: core happy-path state machine only.
--
-- Deliberately out of scope for this pass (deferred, not forgotten):
-- MurabahahWakala/RecordAssetPurchase/DeclineAgency (the FI-appoints-
-- business-as-agent detour -- this pass only ports MurabahahWad.ProceedDirectly,
-- the FI-buys-directly path), AttachQuotation/WithdrawWad/ExpireWad,
-- RejectDelivery/ProceedWithReplacement/RequestCancellation/
-- ConfirmCancellation/RecordDeliveryMilestone/RecordSupplierFailure/
-- RecordSupplierPayment/RegisterDocument (all supporting/exception choices
-- on AssetPurchaseRecord), ExpireProposal/WithdrawProposal/DeclineProposal
-- (alternate paths on MurabahahProposal), RevokeCertification (audit
-- correction tier, mirrors Supersede). PaymentScheduleContract is folded
-- into a jsonb column on murabahah_proposal/murabahah_contract rather than
-- given its own table -- it's a pure value-type carrier in the Daml
-- original (`paymentScheduleCid` is just a pointer to it), never itself
-- exercised. Stage 9-10 (RecordPayment, FlagDelinquent/ResumeActive,
-- CloseContract, IbraRequest, etc.) are a separate later pass entirely --
-- this migration only carries the acquisition chain through to a live,
-- Active MurabahahContract.
--
-- New party role: `advisor` (the genuinely independent Shari'a Supervisory
-- Board -- see CLAUDE.md's participants table; framed differently from
-- vetify/verifier/assessor, which are all "vetify's own team").
--
-- Addendum A/C lessons applied from the start again: Decimal fields
-- (actualCost, freightCost, totalAcquisitionCost, murabahahTerms.*,
-- outstandingBalance, etc.) are real NUMERIC columns; every write policy is
-- FOR INSERT/FOR UPDATE explicitly, never FOR ALL.

ALTER TABLE users DROP CONSTRAINT users_party_role_check;
ALTER TABLE users ADD CONSTRAINT users_party_role_check
  CHECK (party_role IN ('business', 'vetify', 'verifier', 'assessor', 'financialInstitution', 'advisor'));

-- ─── 1. MurabahahWad (business's irrevocable promise) ──────────────────────
-- Daml: template MurabahahWad

CREATE TABLE murabahah_wad (
  id                    BIGSERIAL PRIMARY KEY,
  financing_request_id  BIGINT REFERENCES financing_request(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  terms_amount          NUMERIC NOT NULL,
  terms_purpose         TEXT NOT NULL,
  terms_tenure_months   INTEGER NOT NULL,
  asset_description     TEXT NOT NULL,
  asset_supplier        TEXT NOT NULL,
  asset_supplier_ref    TEXT NOT NULL,
  asset_estimated_cost  NUMERIC NOT NULL CHECK (asset_estimated_cost > 0),
  financing_ref         TEXT,
  offer_expires_at      TIMESTAMPTZ,
  archived_at           TIMESTAMPTZ,
  superseded_by_kind    TEXT,
  superseded_by_id      BIGINT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE murabahah_wad ENABLE ROW LEVEL SECURITY;
ALTER TABLE murabahah_wad FORCE ROW LEVEL SECURITY;

CREATE POLICY murabahah_wad_select ON murabahah_wad
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY murabahah_wad_insert ON murabahah_wad
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY murabahah_wad_update ON murabahah_wad
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 2. AssetPurchaseRecord (FI ownership evidence + Qabdh gate) ───────────
-- Daml: template AssetPurchaseRecord

CREATE TABLE asset_purchase_record (
  id                       BIGSERIAL PRIMARY KEY,
  murabahah_wad_id         BIGINT NOT NULL REFERENCES murabahah_wad(id),
  cac_reg_number           TEXT NOT NULL,
  business_name            TEXT NOT NULL,
  terms_amount             NUMERIC NOT NULL,
  terms_purpose            TEXT NOT NULL,
  terms_tenure_months      INTEGER NOT NULL,
  asset_description        TEXT NOT NULL,
  asset_supplier           TEXT NOT NULL,
  asset_supplier_ref       TEXT NOT NULL,
  asset_estimated_cost     NUMERIC NOT NULL,
  actual_cost              NUMERIC NOT NULL CHECK (actual_cost > 0),
  purchase_date            DATE NOT NULL,
  invoice_ref              TEXT NOT NULL,
  freight_cost             NUMERIC NOT NULL DEFAULT 0 CHECK (freight_cost >= 0),
  customs_duty             NUMERIC NOT NULL DEFAULT 0 CHECK (customs_duty >= 0),
  insurance_premium        NUMERIC NOT NULL DEFAULT 0 CHECK (insurance_premium >= 0),
  other_acquisition_costs  NUMERIC NOT NULL DEFAULT 0 CHECK (other_acquisition_costs >= 0),
  total_acquisition_cost   NUMERIC NOT NULL,
  purchased_via_wakala     BOOLEAN NOT NULL DEFAULT false,
  delivery_acknowledged    BOOLEAN NOT NULL DEFAULT false,
  archived_at              TIMESTAMPTZ,
  superseded_by_kind       TEXT,
  superseded_by_id         BIGINT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT total_acquisition_cost_check CHECK (
    total_acquisition_cost = actual_cost + freight_cost + customs_duty + insurance_premium + other_acquisition_costs
  )
);

ALTER TABLE asset_purchase_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_purchase_record FORCE ROW LEVEL SECURITY;

CREATE POLICY asset_purchase_record_select ON asset_purchase_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY asset_purchase_record_insert ON asset_purchase_record
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY asset_purchase_record_update ON asset_purchase_record
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('business', 'financialInstitution'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('business', 'financialInstitution'));

CREATE TRIGGER trg_asset_purchase_record_history
  AFTER UPDATE ON asset_purchase_record
  FOR EACH ROW EXECUTE FUNCTION record_entity_history();

-- ─── 3. MurabahahProposal (Ijab -- formal sale offer) ──────────────────────
-- Daml: template MurabahahProposal

CREATE TABLE murabahah_proposal (
  id                        BIGSERIAL PRIMARY KEY,
  asset_purchase_record_id  BIGINT NOT NULL REFERENCES asset_purchase_record(id),
  facility_ref              TEXT NOT NULL,
  cac_reg_number            TEXT NOT NULL,
  business_name             TEXT NOT NULL,
  terms_amount              NUMERIC NOT NULL,
  terms_purpose             TEXT NOT NULL,
  terms_tenure_months       INTEGER NOT NULL,
  asset_description         TEXT NOT NULL,
  asset_supplier            TEXT NOT NULL,
  asset_supplier_ref        TEXT NOT NULL,
  asset_estimated_cost      NUMERIC NOT NULL,
  actual_cost               NUMERIC NOT NULL,
  asset_cost                NUMERIC NOT NULL CHECK (asset_cost > 0),
  profit_amount             NUMERIC NOT NULL CHECK (profit_amount >= 0),
  sale_price                NUMERIC NOT NULL,
  installment_amount        NUMERIC NOT NULL CHECK (installment_amount > 0),
  murabahah_tenure_months   INTEGER NOT NULL,
  profit_rate               NUMERIC,
  effective_rate            NUMERIC,
  payment_schedule          JSONB NOT NULL DEFAULT '[]',
  start_date                DATE NOT NULL,
  acceptance_expires_at     TIMESTAMPTZ,
  archived_at               TIMESTAMPTZ,
  superseded_by_kind        TEXT,
  superseded_by_id          BIGINT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sale_price_check CHECK (sale_price = asset_cost + profit_amount),
  CONSTRAINT asset_cost_matches_actual_cost CHECK (asset_cost = actual_cost)
);

ALTER TABLE murabahah_proposal ENABLE ROW LEVEL SECURITY;
ALTER TABLE murabahah_proposal FORCE ROW LEVEL SECURITY;

CREATE POLICY murabahah_proposal_select ON murabahah_proposal
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'advisor')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY murabahah_proposal_insert ON murabahah_proposal
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY murabahah_proposal_update ON murabahah_proposal
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('business', 'financialInstitution'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('business', 'financialInstitution'));

-- ─── 4. ShariahContractCertification (G11 -- advisor's per-contract sign-off) ──
-- Daml: template ShariahContractCertification

CREATE TABLE shariah_contract_certification (
  id                       BIGSERIAL PRIMARY KEY,
  murabahah_proposal_id    BIGINT NOT NULL REFERENCES murabahah_proposal(id),
  facility_ref             TEXT NOT NULL,
  cac_reg_number           TEXT NOT NULL,
  business_name            TEXT NOT NULL,
  certified_sale_price     NUMERIC NOT NULL,
  certified_asset_cost     NUMERIC NOT NULL,
  certified_profit_amount  NUMERIC NOT NULL,
  certified_tenure_months  INTEGER NOT NULL,
  certification_ref        TEXT NOT NULL,
  verdict                  TEXT NOT NULL DEFAULT 'COMPLIANT',
  aaoifi_standards         JSONB NOT NULL DEFAULT '[]',
  rationale                TEXT NOT NULL,
  certified_by             TEXT NOT NULL,
  certified_at             TIMESTAMPTZ NOT NULL,
  archived_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT certified_sale_price_check CHECK (certified_sale_price = certified_asset_cost + certified_profit_amount)
);

ALTER TABLE shariah_contract_certification ENABLE ROW LEVEL SECURITY;
ALTER TABLE shariah_contract_certification FORCE ROW LEVEL SECURITY;

CREATE POLICY shariah_contract_certification_select ON shariah_contract_certification
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'advisor')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY shariah_contract_certification_insert ON shariah_contract_certification
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) IN ('advisor', 'vetify'));

-- ─── 5. MurabahahContract (Active bilateral contract) ──────────────────────
-- Daml: template MurabahahContract (dual-signatory: business, financialInstitution)

CREATE TABLE murabahah_contract (
  id                        BIGSERIAL PRIMARY KEY,
  murabahah_proposal_id     BIGINT NOT NULL REFERENCES murabahah_proposal(id),
  facility_ref              TEXT NOT NULL,
  cac_reg_number            TEXT NOT NULL,
  business_name             TEXT NOT NULL,
  terms_amount              NUMERIC NOT NULL,
  terms_purpose             TEXT NOT NULL,
  terms_tenure_months       INTEGER NOT NULL,
  asset_description         TEXT NOT NULL,
  asset_supplier            TEXT NOT NULL,
  asset_supplier_ref        TEXT NOT NULL,
  asset_estimated_cost      NUMERIC NOT NULL,
  asset_cost                NUMERIC NOT NULL,
  profit_amount             NUMERIC NOT NULL,
  sale_price                NUMERIC NOT NULL,
  installment_amount        NUMERIC NOT NULL,
  murabahah_tenure_months   INTEGER NOT NULL,
  payment_schedule          JSONB NOT NULL DEFAULT '[]',
  start_date                DATE NOT NULL,
  outstanding_balance       NUMERIC NOT NULL,
  installments_paid         INTEGER NOT NULL DEFAULT 0,
  pending_installment_paid  NUMERIC NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'Active'
                              CHECK (status IN ('Active', 'Delinquent', 'Completed', 'Defaulted', 'DelinquencyManualReview')),
  shariah_certification_ref TEXT NOT NULL,
  shariah_certified_by      TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE murabahah_contract ENABLE ROW LEVEL SECURITY;
ALTER TABLE murabahah_contract FORCE ROW LEVEL SECURITY;

-- Dual-signatory (business, financialInstitution) -- both are "the real
-- parties," not signatory + observer, so the select policy ORs their
-- respective conditions rather than treating financialInstitution as a
-- blanket-visibility role the way it is on the earlier single-FI tables.
-- (This slice has only one financialInstitution role/tenant, so in
-- practice this is equivalent either way -- but written this way now
-- since it's the semantically correct shape for when multi-FI tenancy is
-- eventually added, per the design's dynamic-FI-tenant discussion.)
CREATE POLICY murabahah_contract_select ON murabahah_contract
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY murabahah_contract_insert ON murabahah_contract
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'business');

CREATE TRIGGER trg_murabahah_contract_history
  AFTER UPDATE ON murabahah_contract
  FOR EACH ROW EXECUTE FUNCTION record_entity_history();
