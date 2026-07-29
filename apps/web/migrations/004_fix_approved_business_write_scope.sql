-- Fixes another real bug found live (not hypothetical): 003 restricted
-- approved_business's INSERT/UPDATE policies to party_role = 'vetify' only,
-- copying ApprovedBusiness's Daml signatory (vetify) directly into the RLS
-- check. But the row is actually created by ApproveCompliance, whose Daml
-- controller is `verifier` alone -- Daml authorizes that `create
-- ApprovedBusiness with vetify=...` because exercising a choice on a
-- `ComplianceReview` contract (signed by vetify) grants the acting
-- controller vetify's authority for that choice's body. There is no
-- equivalent "propagated authority" concept in a plain SQL WITH CHECK
-- clause, so requiring the literal session role to equal the *template
-- signatory* was the wrong translation.
--
-- The correct translation, consistent with every other table in this
-- slice: RLS write policies are a coarse "some recognized session" backstop
-- (closing the "unauthenticated connection can write nothing" gap), not a
-- re-implementation of per-choice authorization -- that's what
-- lib/auth/withAuthorization.ts's role check already enforces per domain
-- function (approveComplianceImpl is wrapped with
-- withAuthorization(["verifier"], ...), which is the actual gate here).

DROP POLICY approved_business_insert ON approved_business;
CREATE POLICY approved_business_insert ON approved_business
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));

DROP POLICY approved_business_update ON approved_business;
CREATE POLICY approved_business_update ON approved_business
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));
