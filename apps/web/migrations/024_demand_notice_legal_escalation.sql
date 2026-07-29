-- Phase 2, Twenty-Third Slice (web2-migration-design.md): late-stage
-- recovery escalation -- ported from daml/Vetify/Murabahah.daml's
-- IssueDemandNotice (MurabahahContract), EscalateToLegal/WithdrawDemand
-- (DemandNotice), and RecordCourtOrder/ResolveLegal (LegalEscalation).
-- Sits in the same collections/default section as RecordRecoveryPayment
-- (Ninth Slice) and WriteOffContract (Twenty-Second Slice) -- IssueDemandNotice
-- is the FI's formal written demand issued on a Defaulted contract, ahead of
-- (not instead of) either of those two.
--
-- Two templates ported (DemandNotice, LegalEscalation), 51 templates now
-- ported total.
--
-- Consuming/nonconsuming read from the Daml source directly, not assumed
-- uniform: IssueDemandNotice is `nonconsuming` on MurabahahContract (own
-- comment: "the Defaulted contract stays alive for recovery tracking").
-- EscalateToLegal and WithdrawDemand are both consuming on DemandNotice
-- (no `nonconsuming` keyword) -- a demand notice is either escalated
-- (terminal, replaced by a LegalEscalation) or withdrawn (terminal, no
-- replacement) -- so demand_notice gets the same archived_at/
-- superseded_by_kind/superseded_by_id shape every other consuming-choice
-- successor relationship in this migration already uses (e.g.
-- business_onboarding). RecordCourtOrder/ResolveLegal are both `create this
-- with` field-replacements on LegalEscalation (no key on SDK 3.4.11/LF 2.2)
-- -- collapsed to plain UPDATEs, same rule as every other keyless
-- field-replace choice already ported.

CREATE TABLE demand_notice (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  demand_date           DATE NOT NULL,
  outstanding_amount    NUMERIC NOT NULL,
  demand_ref            TEXT NOT NULL CHECK (demand_ref <> ''),
  response_deadline     DATE NOT NULL,
  gsm_eligible          BOOLEAN NOT NULL,
  archived_at           TIMESTAMPTZ,
  superseded_by_kind    TEXT,  -- 'legal_escalation' | NULL (withdrawn with no successor)
  superseded_by_id      BIGINT,
  withdrawal_note       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE demand_notice ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_notice FORCE ROW LEVEL SECURITY;

-- signatory financialInstitution; observer vetify, business, (optional)
-- regulator -- same visibility set as default_record/recovery_payment_record.
CREATE POLICY demand_notice_select ON demand_notice
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY demand_notice_insert ON demand_notice
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY demand_notice_update ON demand_notice
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── LegalEscalation (created via EscalateToLegal on DemandNotice) ─────────

CREATE TABLE legal_escalation (
  id                     BIGSERIAL PRIMARY KEY,
  demand_notice_id       BIGINT NOT NULL REFERENCES demand_notice(id),
  business_name          TEXT NOT NULL,
  cac_reg_number         TEXT NOT NULL,
  escalation_date        DATE NOT NULL,
  solicitor_ref          TEXT NOT NULL CHECK (solicitor_ref <> ''),
  legal_action           TEXT NOT NULL CHECK (legal_action <> ''),
  outstanding_amount     NUMERIC NOT NULL,
  court_ref              TEXT,
  resolved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE legal_escalation ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_escalation FORCE ROW LEVEL SECURITY;

-- signatory financialInstitution; observer vetify, (optional) regulator --
-- no business observer on the real Daml template (unlike DemandNotice).
CREATE POLICY legal_escalation_select ON legal_escalation
  FOR SELECT
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY legal_escalation_insert ON legal_escalation
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY legal_escalation_update ON legal_escalation
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
