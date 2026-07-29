-- Phase 2, Fifteenth Slice (web2-migration-design.md): the standalone Shariah
-- pre-check on ComplianceReview -- ported from daml/Vetify/Compliance.daml's
-- RecordShariahPreCheck and SupersedeShariahVerdict choices, plus the
-- ShariahVerdictCorrection audit template. Named as the most consequential
-- remaining gap in the Fourteenth Slice's own "Net" note: `advisor` has
-- existed as a real party since the Murabahah acquisition slice
-- (CertifyShariahTerms, G11) but could not yet do the one thing CLAUDE.md
-- frames as its actual Stage 3 role -- record the real Shariah pre-check
-- verdict on a ComplianceReview.
--
-- Two choices + one audit template ported, 43 templates now ported total.
-- ApproveCompliance/RejectCompliance (already ported, unchanged) already
-- assert `completedChecks.shariahCompliant` -- a caller-supplied boolean the
-- Verifier Agent derives from this verdict off-ledger, per CLAUDE.md's own
-- architecture description -- so no change was needed there; this slice
-- only had to make the verdict itself real and recordable.
--
-- Deliberately out of scope, named explicitly: EDDCase/OpenEddCase/
-- UpdateEddChecklist/CloseEddCase (G14's PEP-hit enhanced-due-diligence
-- workflow -- a distinct sub-feature, not required by RecordShariahPreCheck
-- or SupersedeShariahVerdict); the AuthorizedReviewer registry (gates
-- ApproveCompliance/RejectCompliance, not this pass's two choices);
-- the deterministic keyword-table classifier itself
-- (agents/src/scoring/shariah-policy.ts) and the RAG/LLM pipeline for a
-- table-miss narrative -- this migration has no LLM/agent integration at
-- all (Phase 4 untouched), so every verdict here is entered directly by a
-- real advisor session, mirroring how a human Shari'a advisor's
-- `skills/shariah-review` ACP path already works in the real system.
--
-- Pragmatic addendum-A deviation, named rather than silently taken:
-- ShariahAssessment's one Decimal field (`prohibitedRevenuePct`) gets a real
-- NUMERIC column on compliance_review itself (the live verdict), but
-- shariah_verdict_correction stores its *two* full verdict snapshots
-- (original + corrected) as jsonb rather than 14 flattened columns --
-- prohibitedRevenuePct here is a narrative/evidentiary estimate, never fed
-- into any downstream arithmetic the way MurabahahTerms.assetCost/salePrice
-- are (which addendum A's NUMERIC rule exists specifically to protect), so
-- the float-precision risk that rule guards against doesn't apply to an
-- audit-only percentage estimate inside a correction record nobody sums.

-- ─── ComplianceReview: the live Shariah pre-check verdict ──────────────────

ALTER TABLE compliance_review
  ADD COLUMN shariah_verdict                TEXT CHECK (shariah_verdict IS NULL OR shariah_verdict IN ('COMPLIANT', 'REQUIRES_REVIEW', 'NON_COMPLIANT')),
  ADD COLUMN shariah_activities_screened     JSONB,
  ADD COLUMN shariah_prohibited_revenue_pct  NUMERIC,
  ADD COLUMN shariah_aaoifi_standards        JSONB,
  ADD COLUMN shariah_scholar_decision        TEXT,
  ADD COLUMN shariah_rationale               TEXT,
  ADD COLUMN shariah_screened_at             TIMESTAMPTZ;

-- RecordShariahPreCheck's real Daml controller is `advisor, vetify` -- the
-- existing compliance_review_select/_update policies (migration 003) only
-- covered vetify/verifier. Adding advisor to both, per RLS write/select
-- symmetry (check-rls-symmetry.ts): a role that can UPDATE must also be
-- covered by SELECT, or its own UPDATE ... RETURNING fails RLS on the
-- RETURNING step (the recurring lesson from Phase 1 and Stage 9-10).
DROP POLICY compliance_review_select ON compliance_review;
CREATE POLICY compliance_review_select ON compliance_review
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'verifier', 'advisor')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

DROP POLICY compliance_review_update ON compliance_review;
CREATE POLICY compliance_review_update ON compliance_review
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'verifier', 'advisor'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier', 'advisor'));

-- ─── ShariahVerdictCorrection (audit record for SupersedeShariahVerdict) ───

CREATE TABLE shariah_verdict_correction (
  id                   BIGSERIAL PRIMARY KEY,
  compliance_review_id BIGINT NOT NULL REFERENCES compliance_review(id),
  business_name        TEXT NOT NULL,
  cac_reg_number       TEXT NOT NULL,
  compliance_ref       TEXT NOT NULL,
  original_verdict     JSONB NOT NULL,  -- ShariahAssessment snapshot -- see header
  correction_ref       TEXT NOT NULL CHECK (correction_ref <> ''),
  corrected_verdict    JSONB NOT NULL,  -- ShariahAssessment snapshot -- see header
  reason               TEXT NOT NULL CHECK (reason <> ''),
  corrected_by         TEXT NOT NULL CHECK (corrected_by <> ''),
  corrected_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shariah_verdict_correction ENABLE ROW LEVEL SECURITY;
ALTER TABLE shariah_verdict_correction FORCE ROW LEVEL SECURITY;

-- signatory vetify; observer verifier, business, advisor -- same visibility
-- set as compliance_review itself, single-tenant business scoping omitted
-- here since this is a low-volume audit record, same simplification
-- already made for other audit-only tables in this migration (e.g.
-- provider_rejection_record).
CREATE POLICY shariah_verdict_correction_select ON shariah_verdict_correction
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'verifier', 'business', 'advisor'));

CREATE POLICY shariah_verdict_correction_insert ON shariah_verdict_correction
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
