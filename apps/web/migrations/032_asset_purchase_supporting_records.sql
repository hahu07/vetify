-- Phase 2, Thirty-First Slice -- Batch B: six AssetPurchaseRecord-area
-- supporting templates. Four are choices on the already-ported
-- AssetPurchaseRecord (RecordDeliveryMilestone, RecordSupplierFailure,
-- RecordSupplierPayment, RegisterDocument); the other two (PurchaseOrder,
-- CapitalCallRecord) are created directly by financialInstitution -- no
-- exercised choice creates either in the real Daml (confirmed against
-- MurabahahTests.daml's F-2/F-3 tests, both bare `createCmd`s), and neither
-- depends on an existing AssetPurchaseRecord fixture at all, only a
-- `facilityRef` text field for traceability.
--
-- asset_purchase_record's own INSERT/UPDATE policies already cover both
-- business and financialInstitution (established since the Twenty-Fourth/
-- Twenty-Seventh Slices), so RecordSupplierFailure's archive-on-consume
-- (financialInstitution) needs no policy change there.

-- ─── DeliveryMilestone ──────────────────────────────────────────────────────
-- Created via nonconsuming RecordDeliveryMilestone, controller business.
-- signatory financialInstitution; observer business, vetify (no regulator).

CREATE TABLE delivery_milestone (
  id                        BIGSERIAL PRIMARY KEY,
  asset_purchase_record_id  BIGINT NOT NULL REFERENCES asset_purchase_record(id),
  cac_reg_number            TEXT NOT NULL,
  business_name             TEXT NOT NULL,
  milestone_description     TEXT NOT NULL CHECK (milestone_description <> ''),
  quantity_delivered        NUMERIC NOT NULL CHECK (quantity_delivered > 0),
  milestone_date            DATE NOT NULL,
  evidence_ref              TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE delivery_milestone ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_milestone FORCE ROW LEVEL SECURITY;

CREATE POLICY delivery_milestone_select ON delivery_milestone
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY delivery_milestone_insert ON delivery_milestone
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'business');

-- ─── SupplierFailureRecord ──────────────────────────────────────────────────
-- Created via consuming RecordSupplierFailure, controller financialInstitution.

CREATE TABLE supplier_failure_record (
  id                        BIGSERIAL PRIMARY KEY,
  asset_purchase_record_id  BIGINT NOT NULL REFERENCES asset_purchase_record(id),
  cac_reg_number            TEXT NOT NULL,
  business_name             TEXT NOT NULL,
  failure_type              TEXT NOT NULL CHECK (failure_type IN ('SupplierCancelled', 'SupplierBankrupt', 'RefundIssued')),
  failure_description       TEXT NOT NULL CHECK (failure_description <> ''),
  refund_amount             NUMERIC,
  failed_at                 TIMESTAMPTZ NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier_failure_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_failure_record FORCE ROW LEVEL SECURITY;

CREATE POLICY supplier_failure_record_select ON supplier_failure_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY supplier_failure_record_insert ON supplier_failure_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── SupplierPaymentRecord ──────────────────────────────────────────────────
-- Created via nonconsuming RecordSupplierPayment, controller financialInstitution.

CREATE TABLE supplier_payment_record (
  id                        BIGSERIAL PRIMARY KEY,
  asset_purchase_record_id  BIGINT NOT NULL REFERENCES asset_purchase_record(id),
  cac_reg_number            TEXT NOT NULL,
  business_name             TEXT NOT NULL,
  supplier_details          JSONB,
  amount_paid               NUMERIC NOT NULL CHECK (amount_paid > 0),
  payment_date              DATE NOT NULL,
  payment_ref               TEXT NOT NULL CHECK (payment_ref <> ''),
  bank_confirmation_ref     TEXT,
  purchased_via_wakala      BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier_payment_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payment_record FORCE ROW LEVEL SECURITY;

CREATE POLICY supplier_payment_record_select ON supplier_payment_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY supplier_payment_record_insert ON supplier_payment_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── DocumentEntry ──────────────────────────────────────────────────────────
-- Created via nonconsuming RegisterDocument, controller financialInstitution.
-- Managed lifecycle: VerifyDocument (vetify) and SupersedeDocument
-- (financialInstitution) are both keyless field-replace choices on the
-- DocumentEntry itself -- both roles are granted UPDATE from the start
-- since both controllers are known up front from the Daml source.
-- document_ref stored as JSONB matching this migration's own simplified
-- DocumentRef shape ({docType, contentHash, storageRef} -- lib/types.ts),
-- not the real Daml's fuller 8-field record, same simplification
-- BusinessOnboarding's own `documents` column already made.

CREATE TABLE document_entry (
  id                        BIGSERIAL PRIMARY KEY,
  asset_purchase_record_id  BIGINT NOT NULL REFERENCES asset_purchase_record(id),
  cac_reg_number            TEXT NOT NULL,
  business_name             TEXT NOT NULL,
  document_ref              JSONB NOT NULL,
  registered_by             TEXT NOT NULL CHECK (registered_by <> ''),
  uploaded_at               TIMESTAMPTZ NOT NULL,
  verified_at               TIMESTAMPTZ,
  superseded                BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_entry FORCE ROW LEVEL SECURITY;

CREATE POLICY document_entry_select ON document_entry
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY document_entry_insert ON document_entry
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY document_entry_update ON document_entry
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution'));

-- ─── PurchaseOrder ──────────────────────────────────────────────────────────
-- Created directly by financialInstitution -- no exercised choice creates
-- it. ConfirmPO/MarkPartiallyFulfilled/MarkFulfilled/CancelPO are all
-- financialInstitution-controlled keyless field-replace choices.

CREATE TABLE purchase_order (
  id                BIGSERIAL PRIMARY KEY,
  cac_reg_number    TEXT NOT NULL,
  business_name     TEXT NOT NULL,
  facility_ref      TEXT NOT NULL,
  supplier_name     TEXT NOT NULL,
  supplier_details  JSONB NOT NULL,
  ordered_items     JSONB NOT NULL,
  total_order_value NUMERIC NOT NULL CHECK (total_order_value > 0),
  delivery_deadline DATE NOT NULL,
  po_ref            TEXT NOT NULL CHECK (po_ref <> ''),
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            TEXT NOT NULL DEFAULT 'POIssued' CHECK (status IN (
    'POIssued', 'POConfirmed', 'POPartiallyFulfilled', 'POFulfilled', 'POCancelled'
  )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE purchase_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order FORCE ROW LEVEL SECURITY;

CREATE POLICY purchase_order_select ON purchase_order
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY purchase_order_insert ON purchase_order
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY purchase_order_update ON purchase_order
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

-- ─── CapitalCallRecord ──────────────────────────────────────────────────────
-- Created directly by financialInstitution -- no exercised choice creates
-- it, and no further choices of its own (immutable, like ShariahAuditRecord).

CREATE TABLE capital_call_record (
  id                    BIGSERIAL PRIMARY KEY,
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  facility_ref          TEXT NOT NULL,
  tranche_number        INTEGER NOT NULL,
  tranche_amount        NUMERIC NOT NULL CHECK (tranche_amount > 0),
  disbursement_date     DATE NOT NULL,
  purpose_of_tranche    TEXT NOT NULL CHECK (purpose_of_tranche <> ''),
  disbursement_ref      TEXT NOT NULL CHECK (disbursement_ref <> ''),
  cumulative_disbursed  NUMERIC NOT NULL,
  remaining_facility    NUMERIC NOT NULL CHECK (remaining_facility >= 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT capital_call_record_cumulative_check CHECK (cumulative_disbursed >= tranche_amount)
);

ALTER TABLE capital_call_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_call_record FORCE ROW LEVEL SECURITY;

CREATE POLICY capital_call_record_select ON capital_call_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY capital_call_record_insert ON capital_call_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
