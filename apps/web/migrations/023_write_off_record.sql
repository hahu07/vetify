-- Phase 2, Twenty-Second Slice (web2-migration-design.md): WriteOffContract
-- -- ported from daml/Vetify/Murabahah.daml's MurabahahContract choice of
-- the same name, plus its WriteOffRecord audit template. Closes out the
-- Default -> RecordRecoveryPayment -> WriteOffContract lifecycle: the first
-- two legs (default_record, recovery_payment_record) were already ported
-- (Fifth/Ninth Slices); this is the missing terminal step.
--
-- One template ported, 49 templates now ported total.
--
-- Four-eyes segregation of duties, reusing the shared checkFourEyes()
-- helper (lib/domain/murabahah.ts) GrantIbra/ReleaseCollateral/
-- EnforceCollateral already established: a RecoveryOfficer proposes, a
-- distinct RiskOfficer confirms, and the confirming officer's registered
-- name must match writeOffApprovedBy -- the same "approvedByName must
-- match the registered officer" pattern the Thirteenth Slice's
-- ApproveFunding wiring already applied.

CREATE TABLE write_off_record (
  id                     BIGSERIAL PRIMARY KEY,
  murabahah_contract_id  BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref           TEXT NOT NULL,
  cac_reg_number         TEXT NOT NULL,
  business_name          TEXT NOT NULL,
  total_financed         NUMERIC NOT NULL,
  total_recovered        NUMERIC NOT NULL CHECK (total_recovered >= 0),
  amount_written_off     NUMERIC NOT NULL CHECK (amount_written_off >= 0),
  write_off_date         DATE NOT NULL,
  write_off_ref          TEXT NOT NULL CHECK (write_off_ref <> ''),
  write_off_approved_by  TEXT NOT NULL CHECK (write_off_approved_by <> ''),
  proposed_by_officer_id TEXT NOT NULL,
  confirmed_by_officer_id TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE write_off_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE write_off_record FORCE ROW LEVEL SECURITY;

-- signatory financialInstitution; observer vetify, (optional) regulator --
-- same visibility set as recovery_payment_record, the choice immediately
-- preceding this one in the real lifecycle.
CREATE POLICY write_off_record_select ON write_off_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY write_off_record_insert ON write_off_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
