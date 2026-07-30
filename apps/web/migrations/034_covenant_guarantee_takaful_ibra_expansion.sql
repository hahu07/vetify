-- Phase 2, Thirty-Third Slice -- Batch D: MurabahahContract-linked
-- financial instruments. CreditCovenant/GuaranteeAgreement/TakafulPolicy
-- are all created directly by financialInstitution -- no exercised choice
-- creates any of the three in the real Daml. IbraRebateProposal/
-- PartialIbraGrant round out the Ibra' cluster this migration already
-- partially ported (RequestIbra/GrantIbra/DeclineIbra) via ProposeRebate/
-- GrantPartialIbra on the already-ported IbraRequest.

-- ─── CreditCovenant ─────────────────────────────────────────────────────────
-- Created directly by financialInstitution. RecordCovenantMeasurement is
-- nonconsuming, controller **vetify** (not financialInstitution, despite
-- the covenant itself being FI-signed) -- caught by reading the choice
-- before writing SQL.
-- signatory financialInstitution; observer vetify, business, regulator.

CREATE TABLE credit_covenant (
  id                     BIGSERIAL PRIMARY KEY,
  murabahah_contract_id  BIGINT NOT NULL REFERENCES murabahah_contract(id),
  cac_reg_number         TEXT NOT NULL,
  business_name          TEXT NOT NULL,
  covenant_type          TEXT NOT NULL,
  threshold              NUMERIC NOT NULL CHECK (threshold > 0),
  measurement_frequency  TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE credit_covenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_covenant FORCE ROW LEVEL SECURITY;

CREATE POLICY credit_covenant_select ON credit_covenant
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY credit_covenant_insert ON credit_covenant
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── CovenantMeasurementRecord ──────────────────────────────────────────────
-- Created via nonconsuming RecordCovenantMeasurement, controller vetify.

CREATE TABLE covenant_measurement_record (
  id                  BIGSERIAL PRIMARY KEY,
  credit_covenant_id  BIGINT NOT NULL REFERENCES credit_covenant(id),
  cac_reg_number      TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  covenant_type       TEXT NOT NULL,
  threshold           NUMERIC NOT NULL,
  measured_value      NUMERIC NOT NULL,
  measure_date        DATE NOT NULL,
  measured_by         TEXT NOT NULL CHECK (measured_by <> ''),
  breached            BOOLEAN NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE covenant_measurement_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE covenant_measurement_record FORCE ROW LEVEL SECURITY;

CREATE POLICY covenant_measurement_record_select ON covenant_measurement_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY covenant_measurement_record_insert ON covenant_measurement_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── GuaranteeAgreement ─────────────────────────────────────────────────────
-- signatory guarantor, financialInstitution -- "guarantor" has no natural
-- session party role in this system (a one-off individual per facility,
-- not a recurring platform role like business/FI/vetify), so it's
-- collapsed to the guarantorName/guarantorId text fields already on the
-- template, same "Party -> Text" convention this migration used for
-- correctedBy/officer names elsewhere. Created directly by
-- financialInstitution. observer vetify only -- no business, no
-- regulator, unlike every other Murabahah-area table so far.

CREATE TABLE guarantee_agreement (
  id                     BIGSERIAL PRIMARY KEY,
  murabahah_contract_id  BIGINT NOT NULL REFERENCES murabahah_contract(id),
  cac_reg_number         TEXT NOT NULL,
  business_name          TEXT NOT NULL,
  facility_ref           TEXT NOT NULL,
  guarantee_type         TEXT NOT NULL CHECK (guarantee_type <> ''),
  guaranteed_amount      NUMERIC NOT NULL CHECK (guaranteed_amount > 0),
  guarantor_name         TEXT NOT NULL CHECK (guarantor_name <> ''),
  guarantor_id           TEXT NOT NULL CHECK (guarantor_id <> ''),
  effective_date         DATE NOT NULL,
  expiry_date            DATE,
  guarantee_status       TEXT NOT NULL DEFAULT 'GuaranteeActive' CHECK (guarantee_status IN (
    'GuaranteeActive', 'GuaranteeReleased', 'GuaranteeEnforced'
  )),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE guarantee_agreement ENABLE ROW LEVEL SECURITY;
ALTER TABLE guarantee_agreement FORCE ROW LEVEL SECURITY;

CREATE POLICY guarantee_agreement_select ON guarantee_agreement
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution'));

CREATE POLICY guarantee_agreement_insert ON guarantee_agreement
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY guarantee_agreement_update ON guarantee_agreement
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── TakafulPolicy ──────────────────────────────────────────────────────────
-- Created directly by financialInstitution. No choices at all in the real
-- Daml -- immutable, like ShariahAuditRecord/PortfolioRiskReport (Batch A).

CREATE TABLE takaful_policy (
  id                     BIGSERIAL PRIMARY KEY,
  murabahah_contract_id  BIGINT NOT NULL REFERENCES murabahah_contract(id),
  cac_reg_number         TEXT NOT NULL,
  business_name          TEXT NOT NULL,
  policy_number          TEXT NOT NULL,
  takaful_operator       TEXT NOT NULL,
  coverage_type          TEXT NOT NULL,
  coverage_amount        NUMERIC NOT NULL CHECK (coverage_amount > 0),
  premium_amount         NUMERIC NOT NULL CHECK (premium_amount > 0),
  start_date             DATE NOT NULL,
  expiry_date            DATE NOT NULL,
  asset_ref              TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT takaful_policy_dates_check CHECK (expiry_date > start_date)
);

ALTER TABLE takaful_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE takaful_policy FORCE ROW LEVEL SECURITY;

CREATE POLICY takaful_policy_select ON takaful_policy
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY takaful_policy_insert ON takaful_policy
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── IbraRebateProposal ─────────────────────────────────────────────────────
-- Created via nonconsuming ProposeRebate on IbraRequest, controller
-- financialInstitution. signatory financialInstitution; observer vetify, business.

CREATE TABLE ibra_rebate_proposal (
  id                  BIGSERIAL PRIMARY KEY,
  ibra_request_id     BIGINT NOT NULL REFERENCES ibra_request(id),
  facility_ref        TEXT NOT NULL,
  cac_reg_number      TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  outstanding_balance NUMERIC NOT NULL CHECK (outstanding_balance > 0),
  suggested_rebate    NUMERIC NOT NULL CHECK (suggested_rebate >= 0),
  rationale           TEXT NOT NULL CHECK (rationale <> ''),
  settlement_type     TEXT NOT NULL CHECK (settlement_type IN ('FullIbra', 'PartialIbra')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ibra_rebate_proposal ENABLE ROW LEVEL SECURITY;
ALTER TABLE ibra_rebate_proposal FORCE ROW LEVEL SECURITY;

CREATE POLICY ibra_rebate_proposal_select ON ibra_rebate_proposal
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY ibra_rebate_proposal_insert ON ibra_rebate_proposal
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── PartialIbraGrant ───────────────────────────────────────────────────────
-- Created via consuming GrantPartialIbra on IbraRequest -- same four-eyes
-- CreditOfficer/RiskOfficer shape as the already-ported GrantIbra.
-- signatory financialInstitution; observer vetify, business.

CREATE TABLE partial_ibra_grant (
  id                          BIGSERIAL PRIMARY KEY,
  ibra_request_id             BIGINT NOT NULL REFERENCES ibra_request(id),
  facility_ref                TEXT NOT NULL,
  cac_reg_number               TEXT NOT NULL,
  business_name                TEXT NOT NULL,
  outstanding_balance          NUMERIC NOT NULL,
  rebate_amount                NUMERIC NOT NULL CHECK (rebate_amount >= 0),
  approved_settlement_amount   NUMERIC NOT NULL CHECK (approved_settlement_amount > 0),
  effective_date                DATE NOT NULL,
  proposed_by_officer_id        TEXT NOT NULL,
  confirmed_by_officer_id       TEXT NOT NULL,
  granted_at                    TIMESTAMPTZ NOT NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partial_ibra_grant_settlement_check CHECK (approved_settlement_amount < outstanding_balance)
);

ALTER TABLE partial_ibra_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE partial_ibra_grant FORCE ROW LEVEL SECURITY;

CREATE POLICY partial_ibra_grant_select ON partial_ibra_grant
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY partial_ibra_grant_insert ON partial_ibra_grant
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
