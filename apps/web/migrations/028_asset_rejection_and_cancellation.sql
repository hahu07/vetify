-- Phase 2, Twenty-Seventh Slice -- the pre-Qabdh rejection/replacement/
-- cancellation cluster on AssetPurchaseRecord, deferred since migration
-- 006's own header ("supporting/exception choices" and "everything past
-- contract formation" were both named out of scope at the time). Ports
-- RejectDelivery, ProceedWithReplacement, RequestCancellation, and
-- ConfirmCancellation, plus two new record templates: AssetRejectionRecord
-- and AcquisitionCancellationRequest.
--
-- No changes to asset_purchase_record itself -- it already carries
-- archived_at/superseded_by_kind/superseded_by_id (added for the
-- AcknowledgeDelivery->OfferMurabahah supersession in migration 006), and
-- its UPDATE/INSERT policies already cover both business and
-- financialInstitution (RecordAssetPurchase's Wakala-path INSERT already
-- needed business, AcknowledgeDelivery/OfferMurabahah's UPDATE already
-- needed both) -- so this slice, unlike most of its predecessors, needs no
-- RLS gap fix at all.

-- ─── AssetRejectionRecord ───────────────────────────────────────────────────
-- Created via nonconsuming RejectDelivery on AssetPurchaseRecord.
-- signatory business; observer financialInstitution, vetify.

CREATE TABLE asset_rejection_record (
  id                       BIGSERIAL PRIMARY KEY,
  asset_purchase_record_id BIGINT NOT NULL REFERENCES asset_purchase_record(id),
  cac_reg_number           TEXT NOT NULL,
  business_name            TEXT NOT NULL,
  reason                   TEXT NOT NULL CHECK (reason <> ''),
  defect_description       TEXT NOT NULL,
  rejected_at              TIMESTAMPTZ NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE asset_rejection_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_rejection_record FORCE ROW LEVEL SECURITY;

CREATE POLICY asset_rejection_record_select ON asset_rejection_record
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY asset_rejection_record_insert ON asset_rejection_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'business');

-- ─── AcquisitionCancellationRequest ─────────────────────────────────────────
-- Created via nonconsuming RequestCancellation on AssetPurchaseRecord.
-- signatory business; observer financialInstitution, vetify. The real Daml
-- template's own AcceptCancellation/RejectCancellation choices are folded
-- into ConfirmCancellation/(a direct reject route) below rather than ported
-- as a separate exercise on this row -- ConfirmCancellation's real Daml body
-- exercises AcceptCancellation itself as an atomic sub-step, so there is no
-- independent caller-visible state for "accepted but not yet confirmed."

CREATE TABLE acquisition_cancellation_request (
  id                       BIGSERIAL PRIMARY KEY,
  asset_purchase_record_id BIGINT NOT NULL REFERENCES asset_purchase_record(id),
  cac_reg_number           TEXT NOT NULL,
  business_name            TEXT NOT NULL,
  reason                   TEXT NOT NULL CHECK (reason <> ''),
  status                   TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Rejected')),
  resolved_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE acquisition_cancellation_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_cancellation_request FORCE ROW LEVEL SECURITY;

CREATE POLICY acquisition_cancellation_request_select ON acquisition_cancellation_request
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY acquisition_cancellation_request_insert ON acquisition_cancellation_request
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'business');

-- ConfirmCancellation/RejectCancellation both flip status -- financialInstitution only.
CREATE POLICY acquisition_cancellation_request_update ON acquisition_cancellation_request
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
