-- Fixes a real cross-tenant data leak found while verifying RLS end-to-end
-- (confirmed live, not hypothetical): 001's `..._write` policies were all
-- `FOR ALL`, which applies their USING clause to SELECT as well as INSERT/
-- UPDATE/DELETE. Postgres combines multiple applicable *permissive* policies
-- with OR, so `..._write`'s role-only check (no tenant scoping at all) was
-- silently widening every SELECT past the dedicated tenant-scoped
-- `..._select` policy: any session with party_role = 'business' could read
-- ANY business's row, not just their own -- confirmed against
-- business_onboarding by having business2 (BN7654321) successfully read
-- business1's (RC1234567) row, including director NIN/BVN, over the live
-- API before this fix.
--
-- Fix: split FOR ALL into FOR INSERT (WITH CHECK only, no USING -- INSERT
-- has nothing to filter, only a new-row check) and FOR UPDATE (USING +
-- WITH CHECK). Neither one applies to SELECT. No FOR DELETE policy is added
-- deliberately -- this schema never physically deletes rows (see
-- "Archived-contract-implies-terminal-state" in web2-migration-design.md
-- §3), so leaving DELETE with zero permissive policies denies it outright.

DROP POLICY business_onboarding_write ON business_onboarding;
CREATE POLICY business_onboarding_insert ON business_onboarding
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) IN ('business', 'vetify', 'verifier'));
CREATE POLICY business_onboarding_update ON business_onboarding
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('business', 'vetify', 'verifier'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('business', 'vetify', 'verifier'));

DROP POLICY verification_result_write ON verification_result;
CREATE POLICY verification_result_insert ON verification_result
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));
CREATE POLICY verification_result_update ON verification_result
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));

DROP POLICY compliance_review_write ON compliance_review;
CREATE POLICY compliance_review_insert ON compliance_review
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));
CREATE POLICY compliance_review_update ON compliance_review
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));

DROP POLICY compliance_result_write ON compliance_result;
CREATE POLICY compliance_result_insert ON compliance_result
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));
CREATE POLICY compliance_result_update ON compliance_result
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('vetify', 'verifier'));

DROP POLICY approved_business_write ON approved_business;
CREATE POLICY approved_business_insert ON approved_business
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
CREATE POLICY approved_business_update ON approved_business
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
