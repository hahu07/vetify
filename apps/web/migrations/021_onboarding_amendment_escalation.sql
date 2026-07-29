-- Phase 2, Eighteenth Slice (web2-migration-design.md): RequestAmendment/
-- Amend and EscalateOverdue -- the last two items on Phase 1's own original
-- deferred list (see migrations/001's header: "RequestAmendment/Amend...
-- EscalateOverdue SLA choices"). Both ported from
-- daml/Vetify/Onboarding.daml's BusinessOnboarding template.
--
-- No new templates -- these are choices on the already-ported
-- BusinessOnboarding, 45 templates still ported total.
--
-- `Amend`'s real Daml body appends the *current* documents to
-- `documentHistory` before replacing them ("preserve current doc
-- snapshot"), so every prior document set survives an amendment cycle, not
-- just the latest one -- document_history is a JSONB array-of-arrays for
-- exactly that reason, not a single JSONB blob overwritten each time.
--
-- EscalateOverdue reads `VerificationPolicy.slaHours` when an active policy
-- is supplied, falling back to a caller-supplied slaHours otherwise --
-- wiring this up was only possible once the Fourteenth Slice's
-- VerificationPolicy landed; no schema change needed here since
-- verification_policy.sla_hours already exists.

ALTER TABLE business_onboarding DROP CONSTRAINT business_onboarding_status_check;
ALTER TABLE business_onboarding ADD CONSTRAINT business_onboarding_status_check
  CHECK (status IN ('Draft', 'UnderReview', 'ManualReview', 'PendingAmendment', 'Approved', 'Rejected'));

ALTER TABLE business_onboarding
  ADD COLUMN amendment_count   INTEGER NOT NULL DEFAULT 0 CHECK (amendment_count >= 0),
  ADD COLUMN document_history  JSONB NOT NULL DEFAULT '[]';
