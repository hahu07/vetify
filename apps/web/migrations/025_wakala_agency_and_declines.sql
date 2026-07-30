-- Phase 2, Twenty-Fourth Slice (web2-migration-design.md): closes the first
-- gap this migration ever named as deferred -- migrations/006's own header
-- ("Wakala agency detour... deliberately deferred") and lib/domain/
-- murabahah.ts's own comment on ProceedDirectly ("Path A, ProceedWithWakala,
-- is the deferred agency detour"), both untouched since the Second Slice.
-- Ports MurabahahWad.ProceedWithWakala/WithdrawWad, MurabahahWakala.
-- RecordAssetPurchase/DeclineAgency, and MurabahahProposal.DeclineProposal,
-- plus four audit templates (MurabahahWakala itself, WadWithdrawalRecord,
-- AgencyWithdrawalRecord, ProposalDeclineRecord).
--
-- Four templates ported, 55 templates now ported total.
--
-- `asset_purchase_record.murabahah_wad_id` is kept as the sole FK even for
-- the Wakala path (pointing at the *originating* Wad via murabahah_wakala's
-- own wad_id), not extended with a second nullable murabahah_wakala_id
-- column: the real Daml AssetPurchaseRecord template carries neither a
-- wadId nor a wakalaId field at all (that FK is already this migration's
-- own traceability addition, not a ported Daml field), and
-- `purchased_via_wakala` already exists to distinguish the two paths --
-- adding a second, mutually-exclusive-with-the-first FK column would be
-- schema complexity with no Daml field motivating it.
--
-- All three decline/withdrawal choices (WithdrawWad, DeclineAgency,
-- DeclineProposal) are consuming in the real Daml (no `nonconsuming`
-- keyword) and each creates a genuine successor audit record -- so all
-- three parent tables' existing archived_at/superseded_by_kind/
-- superseded_by_id columns (already present on murabahah_wad and
-- murabahah_proposal since the Second/original Stage 8 migrations) get a
-- real value on these paths for the first time, not left NULL-forever as
-- they have been.
--
-- Two real, disclosed RLS gaps found by checking each choice's controller
-- directly, not assumed symmetric with what was already ported:
-- 1. WithdrawWad's real Daml controller is `business`, but
--    `murabahah_wad_update` (migration 006) only ever granted UPDATE to
--    `financialInstitution` -- every consuming choice on Wad ported before
--    this slice (ProceedDirectly/ProceedWithWakala) was FI-controlled, so
--    nothing exercised the gap until now. `murabahah_proposal_update`
--    already covers `business` (DeclineProposal needed nothing new there).
-- 2. RecordAssetPurchase's real Daml controller is `business` too (the
--    business, as agent, records the completed purchase) -- but
--    `asset_purchase_record_insert` (migration 006) only ever granted
--    INSERT to `financialInstitution`, since ProceedDirectly (the only
--    prior writer into this table) is FI-controlled. Caught live by this
--    slice's own test, not by reading the source ahead of time: a genuine
--    `new row violates row-level security policy` error, not a silent
--    zero-rows-locked gap like the Twenty-First/Twenty-Second Slices' own
--    FOR UPDATE findings.
DROP POLICY murabahah_wad_update ON murabahah_wad;
CREATE POLICY murabahah_wad_update ON murabahah_wad
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('financialInstitution', 'business'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('financialInstitution', 'business'));

DROP POLICY asset_purchase_record_insert ON asset_purchase_record;
CREATE POLICY asset_purchase_record_insert ON asset_purchase_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) IN ('financialInstitution', 'business'));

CREATE TABLE murabahah_wakala (
  id                     BIGSERIAL PRIMARY KEY,
  murabahah_wad_id       BIGINT NOT NULL REFERENCES murabahah_wad(id),
  cac_reg_number         TEXT NOT NULL,
  business_name          TEXT NOT NULL,
  terms_amount           NUMERIC NOT NULL,
  terms_purpose          TEXT NOT NULL,
  terms_tenure_months    INTEGER NOT NULL,
  asset_description      TEXT NOT NULL,
  asset_supplier         TEXT NOT NULL,
  asset_supplier_ref     TEXT NOT NULL,
  asset_estimated_cost   NUMERIC NOT NULL CHECK (asset_estimated_cost > 0),
  agency_fee             NUMERIC,
  archived_at            TIMESTAMPTZ,
  superseded_by_kind     TEXT,  -- 'asset_purchase_record' | 'agency_withdrawal_record'
  superseded_by_id       BIGINT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE murabahah_wakala ENABLE ROW LEVEL SECURITY;
ALTER TABLE murabahah_wakala FORCE ROW LEVEL SECURITY;

-- signatory financialInstitution; observer business, vetify -- same
-- visibility set as murabahah_wad, the template it always originates from.
CREATE POLICY murabahah_wakala_select ON murabahah_wakala
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY murabahah_wakala_insert ON murabahah_wakala
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- Both RecordAssetPurchase and DeclineAgency (both business-controlled)
-- archive this row, so business needs UPDATE here alongside financialInstitution.
CREATE POLICY murabahah_wakala_update ON murabahah_wakala
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('financialInstitution', 'business'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('financialInstitution', 'business'));

-- ─── WadWithdrawalRecord (WithdrawWad on MurabahahWad) ─────────────────────

CREATE TABLE wad_withdrawal_record (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_wad_id      BIGINT NOT NULL REFERENCES murabahah_wad(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  reason                TEXT NOT NULL CHECK (reason <> ''),
  withdrawn_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE wad_withdrawal_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE wad_withdrawal_record FORCE ROW LEVEL SECURITY;

-- signatory business; observer financialInstitution, vetify.
CREATE POLICY wad_withdrawal_record_select ON wad_withdrawal_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY wad_withdrawal_record_insert ON wad_withdrawal_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'business');

-- ─── AgencyWithdrawalRecord (DeclineAgency on MurabahahWakala) ─────────────

CREATE TABLE agency_withdrawal_record (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_wakala_id   BIGINT NOT NULL REFERENCES murabahah_wakala(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  reason                TEXT NOT NULL CHECK (reason <> ''),
  declined_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agency_withdrawal_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_withdrawal_record FORCE ROW LEVEL SECURITY;

CREATE POLICY agency_withdrawal_record_select ON agency_withdrawal_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY agency_withdrawal_record_insert ON agency_withdrawal_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'business');

-- ─── ProposalDeclineRecord (DeclineProposal on MurabahahProposal) ──────────

CREATE TABLE proposal_decline_record (
  id                       BIGSERIAL PRIMARY KEY,
  murabahah_proposal_id    BIGINT NOT NULL REFERENCES murabahah_proposal(id),
  facility_ref             TEXT NOT NULL,
  cac_reg_number           TEXT NOT NULL,
  business_name            TEXT NOT NULL,
  reason                   TEXT NOT NULL CHECK (reason <> ''),
  declined_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE proposal_decline_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_decline_record FORCE ROW LEVEL SECURITY;

CREATE POLICY proposal_decline_record_select ON proposal_decline_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY proposal_decline_record_insert ON proposal_decline_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'business');
