-- Phase 2, Sixteenth Slice (web2-migration-design.md): AuthorizedReviewer --
-- ported from daml/Vetify/Compliance.daml. Gates ApproveCompliance/
-- RejectCompliance as `verifier`; both choices already carry a *mandatory*
-- (not Optional) `reviewerAuthCid : ContractId AuthorizedReviewer` argument
-- in the real Daml source, confirmed by reading the choice signatures
-- directly -- this migration's already-ported approveComplianceImpl/
-- rejectComplianceImpl (lib/domain/compliance.ts) never checked it at all,
-- the same class of under-enforcement the Thirteenth Slice found and fixed
-- for ApprovedProvider/AuthorizedOfficer on ApproveFunding.
--
-- One template ported, 44 templates now ported total.
--
-- Shape note: unlike AuthorizedOfficer/Assessor/Sentinel/Advisor (all
-- Register + Deactivate + Reactivate), the real Daml AuthorizedReviewer has
-- only a single one-way `Deauthorize` choice -- no Reactivate exists at all
-- ("archives the record, immediately removing approval rights", per its own
-- doc comment). Ported as a plain `archived_at` presence check, not an
-- `active` boolean + Deactivate/Reactivate pair, since copying the other
-- four registries' fuller lifecycle here would be inventing a Reactivate
-- path the Daml template was deliberately never given.
--
-- Identity note: the real template's `verifier : Party` field is the same
-- "single shared party per role" simplification already applied everywhere
-- else in this migration (CLAUDE.md's "many users share one Canton party")
-- -- there is exactly one `verifier` session role, so no per-individual
-- identity column was added; `reviewerAuthCid`'s real job in Daml (proving
-- *a* registered reviewer credential exists and matches this verifier
-- party) collapses to "does this row exist and remain unarchived."

CREATE TABLE authorized_reviewer (
  id            BIGSERIAL PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role <> ''),
  authorized_by TEXT NOT NULL CHECK (authorized_by <> ''),
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ,
  -- Kept alongside authorized_at (redundant here, same as policy_approver's
  -- own shape) so this table can go through governance.ts's generic
  -- listRegistry() reader, which ORDER BY created_at DESC across every
  -- registry uniformly.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE authorized_reviewer ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_reviewer FORCE ROW LEVEL SECURITY;

-- signatory vetify, observer verifier -- a direct match, no extra grant.
CREATE POLICY authorized_reviewer_select ON authorized_reviewer
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));

CREATE POLICY authorized_reviewer_insert ON authorized_reviewer
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- Deauthorize's real Daml controller is vetify alone.
CREATE POLICY authorized_reviewer_update ON authorized_reviewer
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
