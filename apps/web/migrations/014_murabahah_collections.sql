-- Phase 2, ninth slice (web2-migration-design.md): Collections -- Direct
-- Debit mandate lifecycle + GSM (CBN/NIBSS Global Standing Mandate)
-- escalation. Procedural FI-driven workflow (the Collections Agent, per
-- CLAUDE.md), distinct from the sentinel's real FlagDelinquent/ResumeActive
-- decision already built (Stage 9-10, migration 008) -- no scored judgment
-- here, just sequential API-orchestration-style choices.
--
-- Daml source: daml/Vetify/Murabahah.daml's DirectDebitMandate (create +
-- SuspendMandate/ReinstateMandate/CancelMandate, ~line 3037),
-- DirectDebitCollectionAttempt (immutable record, no choices, ~line 3160),
-- MurabahahContract's RecordRecoveryPayment (~line 1296, needed since
-- GSMInvocation's RecordGSMSweep routes every balance change through it --
-- "does not hold an independent balance" per that template's own doc
-- comment), and GSMInvocation (create + RecordGSMSweep/CancelGSM, ~line
-- 3095).
--
-- Deliberately out of scope for this pass: WriteOffContract (a further
-- four-eyes RecoveryOfficer/RiskOfficer step beyond plain recovery --
-- DefaultContract/CloseDefaultedContract, migration 010, already covers the
-- write-off path this migration's scope needs; WriteOffContract's own
-- four-eyes variant is a separate, still-deferred piece). DirectDebitMandate
-- itself has no Daml choice that creates it -- like BusinessOnboarding/
-- RahnAgreement, it's a standalone create; here financialInstitution
-- creates it (mirroring pledgeCollateral's precedent of the FI-side party
-- inserting despite the Daml template's `signatory business,
-- financialInstitution` dual-signatory -- no real per-party cryptographic
-- signing exists in this Postgres port, only RLS gating).

-- ─── 1. DirectDebitMandate ─────────────────────────────────────────────────

CREATE TABLE direct_debit_mandate (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  mono_mandate_ref      TEXT NOT NULL CHECK (mono_mandate_ref <> ''),
  account_ref           TEXT NOT NULL CHECK (account_ref <> ''),
  bank_name             TEXT NOT NULL,
  max_collection_amount NUMERIC NOT NULL CHECK (max_collection_amount > 0),
  frequency             TEXT NOT NULL DEFAULT 'MONTHLY',
  mandate_start_date    DATE NOT NULL,
  mandate_end_date      DATE,
  gsm_consent_given     BOOLEAN NOT NULL DEFAULT false,
  gsm_consent_date      DATE,
  status                TEXT NOT NULL DEFAULT 'MandateActive'
                          CHECK (status IN ('MandateActive', 'MandateSuspended', 'MandateCancelled')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE direct_debit_mandate ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_debit_mandate FORCE ROW LEVEL SECURITY;

CREATE POLICY direct_debit_mandate_select ON direct_debit_mandate
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY direct_debit_mandate_insert ON direct_debit_mandate
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY direct_debit_mandate_update ON direct_debit_mandate
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 2. DirectDebitCollectionAttempt (immutable, no choices in Daml) ──────

CREATE TABLE direct_debit_collection_attempt (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  mono_collection_ref   TEXT NOT NULL CHECK (mono_collection_ref <> ''),
  installment_no        INTEGER NOT NULL,
  attempted_amount      NUMERIC NOT NULL CHECK (attempted_amount > 0),
  attempt_date          DATE NOT NULL,
  succeeded             BOOLEAN NOT NULL,
  failure_reason        TEXT,
  retry_count           INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE direct_debit_collection_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_debit_collection_attempt FORCE ROW LEVEL SECURITY;

CREATE POLICY direct_debit_collection_attempt_select ON direct_debit_collection_attempt
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY direct_debit_collection_attempt_insert ON direct_debit_collection_attempt
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 3. RecoveryPaymentRecord (MurabahahContract.RecordRecoveryPayment) ───

CREATE TABLE recovery_payment_record (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  amount_recovered      NUMERIC NOT NULL CHECK (amount_recovered > 0),
  recovery_date         DATE NOT NULL,
  recovery_source       TEXT NOT NULL CHECK (recovery_source <> ''),
  remaining_balance     NUMERIC NOT NULL CHECK (remaining_balance >= 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recovery_payment_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_payment_record FORCE ROW LEVEL SECURITY;

CREATE POLICY recovery_payment_record_select ON recovery_payment_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY recovery_payment_record_insert ON recovery_payment_record
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 4. GSMInvocation (create + RecordGSMSweep/CancelGSM) ─────────────────

CREATE TABLE gsm_invocation (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  business_bvn          TEXT NOT NULL CHECK (business_bvn <> ''),
  invoked_amount        NUMERIC NOT NULL CHECK (invoked_amount > 0),
  mono_gsm_ref          TEXT NOT NULL CHECK (mono_gsm_ref <> ''),
  invoked_at            TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL DEFAULT 'GSMActive'
                          CHECK (status IN ('GSMActive', 'GSMSettled', 'GSMCancelled')),
  last_sweep_ref        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gsm_invocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsm_invocation FORCE ROW LEVEL SECURITY;

CREATE POLICY gsm_invocation_select ON gsm_invocation
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY gsm_invocation_insert ON gsm_invocation
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY gsm_invocation_update ON gsm_invocation
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
