-- Phase 2, Thirty-Second Slice -- Batch C: FinancingRequest/FinancingDecision
-- area. WithdrawRequest/ExpireRequest/CancelRequest are all CONSUMING on
-- FinancingRequest (archive it, create a successor) -- same
-- archive-with-successor shape this migration has used since the Second
-- Slice, not a status transition on financing_request itself (the real
-- Daml's FinancingStatus does carry Withdrawn/Expired/Cancelled values, but
-- those only ever appear as the *successor* record's `outcome`, never
-- written back onto the archived FinancingRequest). ProposeAmendment is
-- nonconsuming; AcceptAmendment archives+recreates FinancingRequest with
-- new terms -- same keyless field-replace shape as ProceedWithReplacement/
-- Revalue, collapsed to a plain UPDATE.

-- ─── RLS gap: business was never granted UPDATE on financing_request ──────
-- Every choice on FinancingRequest ported before this slice
-- (BeginUnderwriting, ApproveFunding, RejectFunding, etc.) is
-- assessor/vetify/financialInstitution-controlled -- WithdrawRequest
-- (business, archives the row) and AcceptAmendment (business, keyless
-- field-replace) are the first business-controlled writes to this table.
-- Caught by reading both choices' controllers before writing any SQL, same
-- discipline as the Twenty-Ninth/Thirtieth/Thirty-First Slices.
DROP POLICY financing_request_update ON financing_request;
CREATE POLICY financing_request_update ON financing_request
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'assessor', 'financialInstitution', 'business'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'assessor', 'financialInstitution', 'business'));

-- AcceptAmendment needs financing_request's own amendment history/count --
-- fields the real Daml FinancingRequest already carries but this migration
-- never populated since no amendment path existed until now.
ALTER TABLE financing_request ADD COLUMN term_history JSONB NOT NULL DEFAULT '[]';
ALTER TABLE financing_request ADD COLUMN amendment_count INTEGER NOT NULL DEFAULT 0;

-- ─── WithdrawalRecord ───────────────────────────────────────────────────────
-- Created via consuming WithdrawRequest, controller business.
-- signatory business; observer vetify, financialInstitution.

CREATE TABLE withdrawal_record (
  id                    BIGSERIAL PRIMARY KEY,
  financing_request_id  BIGINT NOT NULL REFERENCES financing_request(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  financing_ref         TEXT NOT NULL,
  reason                TEXT NOT NULL CHECK (reason <> ''),
  withdrawn_at          TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE withdrawal_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_record FORCE ROW LEVEL SECURITY;

CREATE POLICY withdrawal_record_select ON withdrawal_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY withdrawal_record_insert ON withdrawal_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'business');

-- ─── RequestClosureRecord ───────────────────────────────────────────────────
-- Created via consuming ExpireRequest/CancelRequest, controller vetify.
-- signatory vetify; observer business, financialInstitution.

CREATE TABLE request_closure_record (
  id                    BIGSERIAL PRIMARY KEY,
  financing_request_id  BIGINT NOT NULL REFERENCES financing_request(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  financing_ref         TEXT NOT NULL,
  outcome               TEXT NOT NULL CHECK (outcome IN ('Expired', 'Cancelled')),
  reason                TEXT,
  closed_at             TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE request_closure_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_closure_record FORCE ROW LEVEL SECURITY;

CREATE POLICY request_closure_record_select ON request_closure_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY request_closure_record_insert ON request_closure_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── FinancingAmendment ─────────────────────────────────────────────────────
-- Created via nonconsuming ProposeAmendment, controller financialInstitution.
-- AcceptAmendment/DeclineAmendment (both business-controlled) resolve it --
-- modeled as a status column (Pending/Accepted/Declined), not
-- archived_at/superseded_by_kind, since AcceptAmendment's real effect is
-- modifying the *same* FinancingRequest row in place, not creating a
-- genuinely new contract to point a successor FK at (same reasoning
-- PendingCollateralEnforcement/AcquisitionCancellationRequest already used).
-- signatory financialInstitution; observer business, vetify.

CREATE TABLE financing_amendment (
  id                       BIGSERIAL PRIMARY KEY,
  financing_request_id     BIGINT NOT NULL REFERENCES financing_request(id),
  cac_reg_number           TEXT NOT NULL,
  business_name            TEXT NOT NULL,
  financing_ref            TEXT NOT NULL,
  original_amount          NUMERIC NOT NULL,
  original_purpose         TEXT NOT NULL,
  original_tenure_months   INTEGER NOT NULL,
  proposed_amount          NUMERIC NOT NULL CHECK (proposed_amount > 0),
  proposed_purpose         TEXT NOT NULL,
  proposed_tenure_months   INTEGER NOT NULL CHECK (proposed_tenure_months > 0),
  proposed_at              TIMESTAMPTZ NOT NULL,
  proposal_note            TEXT,
  status                   TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Declined')),
  decline_reason           TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financing_amendment ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_amendment FORCE ROW LEVEL SECURITY;

CREATE POLICY financing_amendment_select ON financing_amendment
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY financing_amendment_insert ON financing_amendment
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY financing_amendment_update ON financing_amendment
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'business')
  WITH CHECK (current_setting('app.current_party_role', true) = 'business');

-- ─── FundingGovernanceRecord ────────────────────────────────────────────────
-- Created via nonconsuming RecordGovernanceAssessment on FinancingDecision,
-- controller financialInstitution. signatory financialInstitution; observer
-- business, vetify.

CREATE TABLE funding_governance_record (
  id                          BIGSERIAL PRIMARY KEY,
  financing_decision_id       BIGINT NOT NULL REFERENCES financing_decision(id),
  cac_reg_number              TEXT NOT NULL,
  business_name               TEXT NOT NULL,
  financing_ref               TEXT NOT NULL,
  decision_outcome            TEXT NOT NULL,
  ai_recommendation_followed  BOOLEAN NOT NULL,
  governance_note             TEXT,
  assessed_by                 TEXT NOT NULL CHECK (assessed_by <> ''),
  assessed_at                 TIMESTAMPTZ NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE funding_governance_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_governance_record FORCE ROW LEVEL SECURITY;

CREATE POLICY funding_governance_record_select ON funding_governance_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY funding_governance_record_insert ON funding_governance_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
