-- Phase 2, tenth slice (web2-migration-design.md): two more independent,
-- FI-controlled, non-scored optional-product-feature choices --
-- GrantMoratorium/EndMoratorium (payment holiday) on MurabahahContract, and
-- HamishJiddiyyah (security deposit, AAOIFI Std No. 8 S2/3) with its
-- ReturnDeposit/ForfeitDeposit lifecycle. Both are self-contained: no new
-- registry, no four-eyes.
--
-- Daml source: daml/Vetify/Murabahah.daml's MurabahahContract choices
-- GrantMoratorium/EndMoratorium (~line 1363), MoratoriumRecord (~line 2790),
-- and HamishJiddiyyah (~line 3194, a standalone create -- no Daml choice
-- creates it, same shape as RahnAgreement/DirectDebitMandate before it).
--
-- Closes a documented simplification: migration 006/008's recordPaymentImpl
-- has carried a comment since Stage 9-10 -- "Simplified isPaymentLate -- no
-- GrantMoratorium in this pass, so this is always the None branch of the
-- Daml original" -- because murabahah_contract had no active_moratorium
-- column at all until now. This migration adds that column and the
-- domain-layer change to lib/domain/murabahah.ts wires
-- isPaymentLate's real two-branch logic (Optional Date -> Date -> Date ->
-- Bool, line ~39 of the Daml source) into recordPaymentImpl instead of the
-- previous always-None simplification.
--
-- HamishJiddiyyah's own doc comment says it's created "before the Wa'd
-- proceeds" (i.e. conceptually pre-MurabahahContract), but its own
-- `facilityRef` field is only ever assigned at OfferMurabahah time in the
-- real acquisition chain -- so, mirroring RahnAgreement's precedent, this
-- migration anchors it to an existing murabahah_contract_id (the FI's
-- contract detail page, where RahnAgreement is already pledged) rather than
-- inventing a pre-facilityRef anchor this migration's UI has no page for.

-- ─── 1. Moratorium (GrantMoratorium/EndMoratorium) ────────────────────────

ALTER TABLE murabahah_contract ADD COLUMN active_moratorium DATE;

CREATE TABLE moratorium_record (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  moratorium_end        DATE NOT NULL,
  reason                TEXT NOT NULL CHECK (reason <> ''),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE moratorium_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE moratorium_record FORCE ROW LEVEL SECURITY;

CREATE POLICY moratorium_record_select ON moratorium_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY moratorium_record_insert ON moratorium_record
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 2. HamishJiddiyyah (security deposit) ────────────────────────────────

CREATE TABLE hamish_jiddiyyah (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  deposit_amount        NUMERIC NOT NULL CHECK (deposit_amount > 0),
  deposit_ref           TEXT NOT NULL CHECK (deposit_ref <> ''),
  deposit_date          DATE NOT NULL,
  return_deadline       DATE NOT NULL,
  actual_loss_deducted  NUMERIC,
  status                TEXT NOT NULL DEFAULT 'HamishHeld'
                          CHECK (status IN ('HamishHeld', 'HamishReturned', 'HamishForfeited')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hamish_jiddiyyah ENABLE ROW LEVEL SECURITY;
ALTER TABLE hamish_jiddiyyah FORCE ROW LEVEL SECURITY;

CREATE POLICY hamish_jiddiyyah_select ON hamish_jiddiyyah
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY hamish_jiddiyyah_insert ON hamish_jiddiyyah
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY hamish_jiddiyyah_update ON hamish_jiddiyyah
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
