-- Phase 2, Twenty-Fifth Slice (web2-migration-design.md): closes the
-- remaining gaps in the MurabahahWad/MurabahahProposal area -- ported from
-- daml/Vetify/Murabahah.daml's AttachQuotation (MurabahahWad),
-- ExpireProposal and WithdrawProposal (both MurabahahProposal).
--
-- One template ported (SupplierQuotation), 56 templates now ported total.
--
-- ExpireProposal and WithdrawProposal both return `()` in the real Daml --
-- neither creates a successor record, unlike every other consuming choice
-- on MurabahahProposal ported so far (AcceptProposal -> MurabahahContract,
-- DeclineProposal -> ProposalDeclineRecord). No schema change needed for
-- either: murabahah_proposal already carries archived_at/superseded_by_kind/
-- superseded_by_id (Second Slice) and acceptance_expires_at (already
-- threaded through by OfferMurabahah, just never read by anything until
-- now) -- both choices simply archive with superseded_by_kind left NULL,
-- the "no successor" shape this migration's own DemandNotice.WithdrawDemand
-- port (Twenty-Third Slice) already established.
--
-- A real, disclosed RLS gap found live by this slice's own test:
-- ExpireProposal's real Daml controller is `vetify`, but
-- `murabahah_proposal_update` (migration 006) only ever granted UPDATE to
-- `business`/`financialInstitution` -- every consuming choice on
-- MurabahahProposal ported before this slice (AcceptProposal,
-- DeclineProposal) was business-controlled, so nothing exercised the gap
-- until now. Same class of finding as the Twenty-First/Twenty-Second/
-- Twenty-Fourth Slices' own SELECT-FOR-UPDATE-needs-a-real-policy gaps.
DROP POLICY murabahah_proposal_update ON murabahah_proposal;
CREATE POLICY murabahah_proposal_update ON murabahah_proposal
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'business', 'financialInstitution'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'business', 'financialInstitution'));

CREATE TABLE supplier_quotation (
  id                    BIGSERIAL PRIMARY KEY,
  murabahah_wad_id      BIGINT NOT NULL REFERENCES murabahah_wad(id),
  cac_reg_number        TEXT NOT NULL,
  business_name         TEXT NOT NULL,
  supplier_name         TEXT NOT NULL,
  quotation_ref         TEXT NOT NULL CHECK (quotation_ref <> ''),
  quoted_amount         NUMERIC NOT NULL CHECK (quoted_amount > 0),
  asset_description     TEXT NOT NULL,
  valid_until           DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supplier_quotation ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotation FORCE ROW LEVEL SECURITY;

-- signatory financialInstitution; observer vetify, business -- same
-- visibility set as murabahah_wad, the template AttachQuotation is
-- nonconsuming on (the Wa'd stays active; this is a side record).
CREATE POLICY supplier_quotation_select ON supplier_quotation
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY supplier_quotation_insert ON supplier_quotation
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
