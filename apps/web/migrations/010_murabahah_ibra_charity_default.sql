-- Phase 2, fifth slice (web2-migration-design.md): deepening Murabahah
-- coverage past the happy path already built in migrations 006/008 --
-- IbraRequest (early settlement rebate, AAOIFI Std No. 8 S6/1),
-- LatePaymentCharity settlement (SetCharityAmount/ConfirmCharityPayment,
-- closing a gap left open since migration 008 -- charity obligations were
-- created but never settleable), and DefaultContract/CloseDefaultedContract
-- (the write-off path -- Defaulted was a reachable status with no choice
-- that could ever reach it until now).
--
-- Deliberately out of scope for this pass: GrantPartialIbra/ProposeRebate
-- (the partial-settlement variant and the FI-internal advisory tool --
-- GrantIbra/DeclineIbra cover the full-settlement path only), and every
-- choice already deferred by migrations 006/008's own headers (Wakala,
-- quotations, delivery milestones, restructuring, GSM sweeps, moratorium).
--
-- GrantIbra reuses the *existing* authorized_officer table (Governance
-- slice) for its real four-eyes check (a CreditOfficer proposes, a
-- different RiskOfficer confirms) -- the first choice in this migration to
-- actually consume a registry built in an earlier, unrelated slice, not
-- just add a new one.
--
-- Addendum A/C lessons applied from the start again: NUMERIC for every
-- Decimal; FOR INSERT/FOR UPDATE explicit, never FOR ALL; sentinel/business
-- symmetry between INSERT and SELECT policies checked by
-- scripts/check-rls-symmetry.ts before this migration was considered done.

-- ─── 1. IbraRequest (business's early-settlement request) ─────────────────

CREATE TABLE ibra_request (
  id                        BIGSERIAL PRIMARY KEY,
  murabahah_contract_id     BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref              TEXT NOT NULL,
  cac_reg_number            TEXT NOT NULL,
  business_name             TEXT NOT NULL,
  outstanding_balance       NUMERIC NOT NULL CHECK (outstanding_balance >= 0),
  requested_settlement_date DATE NOT NULL,
  settlement_type           TEXT NOT NULL CHECK (settlement_type IN ('FullIbra', 'PartialIbra')),
  requested_amount          NUMERIC CHECK (requested_amount IS NULL OR requested_amount > 0),
  archived_at               TIMESTAMPTZ,
  superseded_by_kind        TEXT,
  superseded_by_id          BIGINT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ibra_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE ibra_request FORCE ROW LEVEL SECURITY;

CREATE POLICY ibra_request_select ON ibra_request
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY ibra_request_insert ON ibra_request
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'business');

CREATE POLICY ibra_request_update ON ibra_request
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 2. IbraGrantRecord / IbraDeclineRecord (FI's decision, immutable) ─────

CREATE TABLE ibra_grant_record (
  id                    BIGSERIAL PRIMARY KEY,
  ibra_request_id       BIGINT NOT NULL REFERENCES ibra_request(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  outstanding_balance   NUMERIC NOT NULL,
  rebate_amount         NUMERIC NOT NULL CHECK (rebate_amount >= 0),
  effective_date        DATE NOT NULL,
  proposed_by_officer_id  TEXT NOT NULL,
  confirmed_by_officer_id TEXT NOT NULL,
  granted_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ibra_grant_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE ibra_grant_record FORCE ROW LEVEL SECURITY;

CREATE POLICY ibra_grant_record_select ON ibra_grant_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY ibra_grant_record_insert ON ibra_grant_record
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE TABLE ibra_decline_record (
  id                  BIGSERIAL PRIMARY KEY,
  ibra_request_id     BIGINT NOT NULL REFERENCES ibra_request(id),
  facility_ref        TEXT NOT NULL,
  cac_reg_number      TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  outstanding_balance NUMERIC NOT NULL,
  reason              TEXT NOT NULL CHECK (reason <> ''),
  declined_at         TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ibra_decline_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE ibra_decline_record FORCE ROW LEVEL SECURITY;

CREATE POLICY ibra_decline_record_select ON ibra_decline_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY ibra_decline_record_insert ON ibra_decline_record
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 3. LatePaymentCharity settlement (SetCharityAmount / ConfirmCharityPayment) ──
-- late_payment_charity already exists (migration 008) -- just needs an
-- UPDATE policy now that it's actually mutated (Stage 9-10 only ever
-- created it, never updated it).

CREATE POLICY late_payment_charity_update ON late_payment_charity
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('financialInstitution', 'business'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('financialInstitution', 'business'));

CREATE TABLE charity_payment_record (
  id                    BIGSERIAL PRIMARY KEY,
  late_payment_charity_id BIGINT NOT NULL REFERENCES late_payment_charity(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  installment_no        INTEGER NOT NULL,
  charity_amount        NUMERIC NOT NULL CHECK (charity_amount > 0),
  charity_ref           TEXT NOT NULL,
  charity_organization  TEXT NOT NULL CHECK (charity_organization <> ''),
  confirmed_at          TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE charity_payment_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE charity_payment_record FORCE ROW LEVEL SECURITY;

CREATE POLICY charity_payment_record_select ON charity_payment_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY charity_payment_record_insert ON charity_payment_record
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'business');

-- ─── 4. DefaultRecord (FI's write-off, financialInstitution-signed) ────────

CREATE TABLE default_record (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  reason                TEXT NOT NULL CHECK (reason <> ''),
  defaulted_by          TEXT NOT NULL CHECK (defaulted_by <> ''),
  defaulted_at          TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE default_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_record FORCE ROW LEVEL SECURITY;

CREATE POLICY default_record_select ON default_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY default_record_insert ON default_record
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
