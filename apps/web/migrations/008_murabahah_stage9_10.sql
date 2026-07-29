-- Phase 2, third slice (web2-migration-design.md): Stage 9-10, the
-- Murabahah repayment lifecycle -- ported from the RecordPayment/
-- FlagDelinquent/ResumeActive/CloseContract choices on
-- daml/Vetify/Murabahah.daml's MurabahahContract template.
--
-- Scope for this pass (core happy-path state machine only, same discipline
-- as every prior slice):
--   - RecordPayment: sequence/overpayment/status guards, running-balance
--     update, wasLate flag (simplified -- no GrantMoratorium in this pass,
--     so lateness is a flat `paymentDate > dueDate`, matching
--     isPaymentLate's `None` branch), RepaymentRecord creation, and
--     LatePaymentCharity creation on a late *completing* payment (AAOIFI
--     Std No. 8, S2/4/20).
--   - FlagDelinquent / ResumeActive: wired to the sentinel registry gate
--     (requireActiveSentinel, added to lib/domain/governance.ts alongside
--     this migration -- Phase 2's Governance codegen pass wrote
--     registerSentinel/deactivateSentinel/reactivateSentinel but never
--     wrote requireActiveSentinel itself, unlike its assessor/advisor
--     counterparts). Creates an AuditEvent, mirroring the Daml original.
--   - CloseContract: FI closes a fully repaid Active/Delinquent contract.
--
-- Deliberately deferred: FlagForDelinquencyReview (pure vetify escalation,
-- no new mechanics beyond what FlagDelinquent already exercises),
-- DefaultContract/CloseDefaultedContract (the write-off path and its
-- DefaultRecord template), RequestIbra/GrantIbra/DeclineIbra (early
-- settlement rebate), LatePaymentCharity's SetCharityAmount/
-- ConfirmCharityPayment (so charity rows are created but never settled
-- this pass), GrantMoratorium, restructuring, GSM sweeps, and
-- RecordPayment's allocation/settlementAccount/directDebitRef +
-- PaymentIdempotencyGuard dedup (a caller-side-only guard in the Daml
-- original even there -- see CLAUDE.md's SDK-downgrade note -- so skipping
-- it here loses no ledger-enforced guarantee that existed to begin with).
--
-- Addendum A/C lessons applied from the start again: outstanding_balance
-- etc. are real NUMERIC columns; every write policy is FOR INSERT/FOR
-- UPDATE explicitly, never FOR ALL.

-- murabahah_contract had no UPDATE policy yet (migration 006 only wired
-- select+insert -- Stage 8 never updated a MurabahahContract post-creation).
-- 'sentinel' is already in the users.party_role CHECK (migration 007) but
-- was never added to murabahah_contract's own SELECT policy -- caught live
-- while testing this migration: a sentinel session got "MurabahahContract
-- not found" on FlagDelinquent/ResumeActive because RLS silently filtered
-- the row out of the FOR UPDATE SELECT before the domain function's own
-- "not found" check ever had a real absence to report. Fixed by
-- re-creating the select policy with 'sentinel' included, alongside the
-- new update policy.
DROP POLICY murabahah_contract_select ON murabahah_contract;
CREATE POLICY murabahah_contract_select ON murabahah_contract
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'sentinel')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY murabahah_contract_update ON murabahah_contract
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('financialInstitution', 'sentinel', 'vetify'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('financialInstitution', 'sentinel', 'vetify'));

-- ─── 1. RepaymentRecord ─────────────────────────────────────────────────────
-- Daml: template RepaymentRecord (signatory business, financialInstitution)

CREATE TABLE repayment_record (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  installment_no        INTEGER NOT NULL,
  due_date              DATE NOT NULL,
  payment_date          DATE NOT NULL,
  amount_paid           NUMERIC NOT NULL CHECK (amount_paid > 0),
  remaining_balance     NUMERIC NOT NULL CHECK (remaining_balance >= 0),
  was_late              BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE repayment_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE repayment_record FORCE ROW LEVEL SECURITY;

CREATE POLICY repayment_record_select ON repayment_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY repayment_record_insert ON repayment_record
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 2. LatePaymentCharity (Sadaqah obligation, created but not settled) ───
-- Daml: template LatePaymentCharity (signatory financialInstitution)

CREATE TABLE late_payment_charity (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  repayment_record_id   BIGINT NOT NULL REFERENCES repayment_record(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  installment_no        INTEGER NOT NULL,
  due_date              DATE NOT NULL,
  payment_date          DATE NOT NULL,
  charity_amount        NUMERIC CHECK (charity_amount IS NULL OR charity_amount > 0),
  settled               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE late_payment_charity ENABLE ROW LEVEL SECURITY;
ALTER TABLE late_payment_charity FORCE ROW LEVEL SECURITY;

CREATE POLICY late_payment_charity_select ON late_payment_charity
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY late_payment_charity_insert ON late_payment_charity
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 3. AuditEvent ──────────────────────────────────────────────────────────
-- Daml: template AuditEvent (signatory vetify, observer financialInstitution
-- -- business is NOT an observer, unlike every other table in this slice).

CREATE TABLE audit_event (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  event_type            TEXT NOT NULL CHECK (event_type <> ''),
  description           TEXT NOT NULL CHECK (description <> ''),
  acted_by              TEXT NOT NULL CHECK (acted_by <> ''),
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event FORCE ROW LEVEL SECURITY;

-- 'sentinel' is included here too, even though the Daml original's
-- AuditEvent has no sentinel signatory/observer clause at all (only vetify
-- signs, financialInstitution observes) -- caught live, a second instance
-- of the "INSERT ... RETURNING requires the row to also pass the table's
-- SELECT policy" gotcha first found in the Stage 8 pass: sentinel's own
-- INSERT ... RETURNING id (issued while it holds insert authority via
-- FlagDelinquent/ResumeActive's dual controller) fails RLS on the
-- RETURNING step without this, even though its INSERT's WITH CHECK alone
-- passes. A real Daml AuditEvent wouldn't grant sentinel ongoing read
-- access to the contract it just helped create -- this is a REST-layer
-- concession to let the actor read back the row it authored, not a
-- privacy-model match.
CREATE POLICY audit_event_select ON audit_event
  FOR SELECT
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'sentinel'));

CREATE POLICY audit_event_insert ON audit_event
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'sentinel'));
