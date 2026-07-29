-- Phase 2, eighth slice (web2-migration-design.md): two independent
-- choice-families that hang directly off MurabahahContract and were named
-- as deferred since the Stage 8 migration's own header --
-- RequestRestructuring/ApproveRestructuring/RejectRestructuring, and
-- RaiseDispute/EscalateToArbitration/RecordArbitrationOutcome. Both are
-- self-contained (no new registry, no four-eyes) -- a deliberately
-- different shape from the fifth/sixth slices' officer-gated choices.
--
-- Deliberately out of scope for this pass: Collections (DirectDebitMandate/
-- GSMInvocation/DirectDebitCollectionAttempt) -- CLAUDE.md frames that as a
-- separate procedural workflow (the Collections Agent), not a scored
-- decision, and it's a larger, differently-shaped piece of work than these
-- two choice-families; left for a future slice.
--
-- Daml source: daml/Vetify/Murabahah.daml's MurabahahContract choices
-- RequestRestructuring/ApproveRestructuring/RejectRestructuring (lines
-- ~1103-1178), RaiseDispute (~1233), DisputeRecord's EscalateToArbitration
-- (~2106), ArbitrationRequest's RecordArbitrationOutcome (~2145).
--
-- ApproveRestructuring in Daml archives the old PaymentScheduleContract and
-- creates a new one plus a new MurabahahContract version (schedule_version++,
-- restructuring_count++). This Postgres port never modeled a separate
-- PaymentScheduleContract table (migration 006 stored payment_schedule as a
-- JSONB column directly on murabahah_contract), so ApproveRestructuring here
-- is a straightforward UPDATE of that column plus the two new counter
-- columns added below -- no separate schedule-history table, matching how
-- RecordPayment already updates murabahah_contract in place rather than
-- versioning it.
--
-- EscalateToArbitration is a *consuming* choice on DisputeRecord (no
-- `nonconsuming` keyword in the Daml source) -- mirrored here the same way
-- ibra_request/collateral_valuation_document handle their own "consumed by
-- a later choice" cases: archived_at + superseded_by_kind/superseded_by_id
-- on dispute_record, rather than a DELETE.
--
-- RecordArbitrationOutcome does `create this with outcome = ...` in Daml
-- (an in-place field update, not archive+create-new) -- mirrored as a plain
-- UPDATE on arbitration_request, the same shape ResolveException/
-- ConfirmCharityPayment already use in this migration for in-place choices.

-- ─── 0. New MurabahahContract columns for restructuring bookkeeping ───────

ALTER TABLE murabahah_contract
  ADD COLUMN schedule_version    INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN restructuring_count INTEGER NOT NULL DEFAULT 0;

-- ─── 1. RestructuringRequest (business's proposed new schedule) ───────────

CREATE TABLE restructuring_request (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  outstanding_balance   NUMERIC NOT NULL CHECK (outstanding_balance >= 0),
  proposed_schedule     JSONB NOT NULL,
  reason                TEXT NOT NULL CHECK (reason <> ''),
  request_date          DATE NOT NULL,
  archived_at           TIMESTAMPTZ,
  superseded_by_kind    TEXT,
  superseded_by_id      BIGINT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE restructuring_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE restructuring_request FORCE ROW LEVEL SECURITY;

CREATE POLICY restructuring_request_select ON restructuring_request
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY restructuring_request_insert ON restructuring_request
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'business');

CREATE POLICY restructuring_request_update ON restructuring_request
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 2. RestructuringRejectionRecord (FI's rejection, immutable) ──────────

CREATE TABLE restructuring_rejection_record (
  id                       BIGSERIAL PRIMARY KEY,
  restructuring_request_id BIGINT NOT NULL REFERENCES restructuring_request(id),
  facility_ref             TEXT NOT NULL,
  cac_reg_number           TEXT NOT NULL,
  business_name            TEXT NOT NULL,
  reason                   TEXT NOT NULL CHECK (reason <> ''),
  rejected_at              TIMESTAMPTZ NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE restructuring_rejection_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE restructuring_rejection_record FORCE ROW LEVEL SECURITY;

CREATE POLICY restructuring_rejection_record_select ON restructuring_rejection_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY restructuring_rejection_record_insert ON restructuring_rejection_record
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── 3. DisputeRecord (business's formal dispute against the FI) ─────────

CREATE TABLE dispute_record (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_contract_id BIGINT NOT NULL REFERENCES murabahah_contract(id),
  facility_ref          TEXT NOT NULL,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  dispute_type          TEXT NOT NULL CHECK (dispute_type IN ('PaymentDispute', 'ContractTermsDispute', 'AssetDefectDispute')),
  description           TEXT NOT NULL CHECK (description <> ''),
  evidence_ref          TEXT,
  raised_at             TIMESTAMPTZ NOT NULL,
  archived_at           TIMESTAMPTZ,
  superseded_by_kind    TEXT,
  superseded_by_id      BIGINT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dispute_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_record FORCE ROW LEVEL SECURITY;

CREATE POLICY dispute_record_select ON dispute_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY dispute_record_insert ON dispute_record
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'business');

CREATE POLICY dispute_record_update ON dispute_record
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── 4. ArbitrationRequest (vetify-signed escalation + outcome) ───────────
-- No facilityRef in the real Daml template (it links back only via the
-- dispute's own cacRegNumber/businessName) -- mirrored exactly here.

CREATE TABLE arbitration_request (
  id                  BIGSERIAL PRIMARY KEY,
  dispute_record_id   BIGINT NOT NULL REFERENCES dispute_record(id),
  cac_reg_number      TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  arbitrator          TEXT NOT NULL CHECK (arbitrator <> ''),
  dispute_description TEXT NOT NULL CHECK (dispute_description <> ''),
  escalated_at        TIMESTAMPTZ NOT NULL,
  outcome             TEXT CHECK (outcome IS NULL OR outcome IN ('BusinessPrevails', 'FIPrevails', 'SettlementAgreed')),
  resolution          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE arbitration_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitration_request FORCE ROW LEVEL SECURITY;

CREATE POLICY arbitration_request_select ON arbitration_request
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY arbitration_request_insert ON arbitration_request
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

CREATE POLICY arbitration_request_update ON arbitration_request
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
