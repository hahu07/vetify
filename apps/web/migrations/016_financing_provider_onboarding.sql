-- Phase 2, Eleventh Slice (web2-migration-design.md): Stage 0 -- financing-
-- provider self-registration and vetify approval. Ported from
-- daml/Vetify/FinancingProvider.daml -- a leaf module never touched by any
-- prior slice. Every party wishing to offer financing on the platform must
-- complete this before it can exercise ApproveFunding on a FinancingRequest
-- (Vetify.Financing) -- NOT wired into lib/domain/financing.ts's
-- approveFundingImpl in this pass (its own header already documents that gap
-- as deliberately deferred from the original Financing slice; this slice
-- only ports Stage 0's own three templates, not that follow-on wiring).
--
-- Three templates ported: FinancingProviderOnboarding, ApprovedProvider,
-- ProviderVerificationPolicy -- 37 templates now ported total.
--
-- Deliberately out of scope for this pass: the real off-ledger Stage 0
-- scorer (agents/src/scoring/provider-verification.ts doesn't exist in the
-- agents package yet, and this migration has no LLM/agent integration at
-- all -- Phase 4 is still not started) -- so RecordProviderScore/
-- RejectProvider's `policyId` consistency check is ported as a plain
-- optional guard with no real scorer ever populating it; AuthorizedOfficer's
-- own approval-limit gate on ApproveFunding (a separate, already-ported
-- registry) is also not newly wired here, matching financing.ts's existing
-- scope line exactly.
--
-- provider_rejection_record follows the same audit-trail convention already
-- established for RejectRestructuring/DeclineIbra (restructuring_rejection_
-- record / ibra_decline_record): the real Daml RejectProvider choice is a
-- bare `()`-returning archive with no successor template, but every other
-- terminal-reject choice in this port creates a small record table anyway
-- for a readable audit trail, so this one does too.

ALTER TABLE users DROP CONSTRAINT users_party_role_check;
ALTER TABLE users ADD CONSTRAINT users_party_role_check
  CHECK (party_role IN ('business', 'vetify', 'verifier', 'assessor', 'financialInstitution', 'advisor', 'sentinel', 'regulator'));

-- ─── FinancingProviderOnboarding ────────────────────────────────────────────

CREATE TABLE financing_provider_onboarding (
  id                   BIGSERIAL PRIMARY KEY,
  provider_name        TEXT NOT NULL CHECK (provider_name <> ''),
  address              TEXT NOT NULL,
  cac_reg_number       TEXT NOT NULL CHECK (cac_reg_number <> ''),
  provider_type        TEXT NOT NULL
                          CHECK (provider_type IN ('CBNLicensedNIFI', 'SECFundManager', 'PenComPensionManager',
                            'CooperativeSociety', 'InvestmentClub', 'WaqfFund', 'ZakatFund', 'Philanthropy')),
  -- `None` for unregulated providers (CooperativeSociety/InvestmentClub/WaqfFund/ZakatFund/Philanthropy).
  regulatory_body      TEXT CHECK (regulatory_body IS NULL OR regulatory_body IN
                          ('CBN', 'SEC', 'PenCom', 'CAC', 'StateCooperativeRegistry', 'SelfGoverned', 'Unregulated')),
  license_number       TEXT,
  governing_doc_ref    JSONB NOT NULL,  -- DocumentRef
  declared_instruments JSONB NOT NULL CHECK (jsonb_array_length(declared_instruments) > 0),  -- FinancingInstrument[]
  status               TEXT NOT NULL DEFAULT 'Draft'
                          CHECK (status IN ('Draft', 'UnderReview', 'ManualReview', 'PendingAmendment', 'Approved', 'Rejected')),
  submitted_at         TIMESTAMPTZ,
  amendment_count      INTEGER NOT NULL DEFAULT 0 CHECK (amendment_count >= 0),
  -- Off-ledger deterministic scoring output (never populated by a real
  -- scorer in this migration -- see header). Mirrors business_onboarding's
  -- agent_* columns exactly.
  agent_score          INTEGER CHECK (agent_score IS NULL OR agent_score BETWEEN 0 AND 100),
  agent_risk           TEXT CHECK (agent_risk IS NULL OR agent_risk IN ('Low', 'Medium', 'High')),
  agent_note           TEXT,
  agent_version        TEXT,
  archived_at          TIMESTAMPTZ,
  superseded_by_kind   TEXT,
  superseded_by_id     BIGINT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stronger than the status quo -- the Daml original's own doc comment notes
-- ledger-enforced uniqueness of (financialInstitution, vetify) is no longer
-- guaranteed on SDK 3.4.11/LF 2.2. Same pattern as business_onboarding's own
-- one_active_onboarding_per_cac.
CREATE UNIQUE INDEX one_active_provider_onboarding_per_cac
  ON financing_provider_onboarding (cac_reg_number) WHERE archived_at IS NULL;

ALTER TABLE financing_provider_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_provider_onboarding FORCE ROW LEVEL SECURITY;

-- signatory financialInstitution, observer vetify -- a direct match, no
-- extra grant needed (this system has exactly one FI tenant, same
-- single-tenant simplification every prior FI-facing table already makes).
CREATE POLICY financing_provider_onboarding_select ON financing_provider_onboarding
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('financialInstitution', 'vetify'));

CREATE POLICY financing_provider_onboarding_insert ON financing_provider_onboarding
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY financing_provider_onboarding_update ON financing_provider_onboarding
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) IN ('financialInstitution', 'vetify'))
  WITH CHECK (current_setting('app.current_party_role', true) IN ('financialInstitution', 'vetify'));

CREATE TRIGGER trg_financing_provider_onboarding_history
  AFTER UPDATE ON financing_provider_onboarding FOR EACH ROW EXECUTE FUNCTION record_entity_history();

-- ─── ApprovedProvider (the ledger credential ApproveFunding will eventually require) ──

CREATE TABLE approved_provider (
  id                                BIGSERIAL PRIMARY KEY,
  financing_provider_onboarding_id BIGINT NOT NULL REFERENCES financing_provider_onboarding(id),
  provider_name                    TEXT NOT NULL,
  provider_type                    TEXT NOT NULL,
  regulatory_body                  TEXT,
  license_number                   TEXT,
  approved_instruments             JSONB NOT NULL CHECK (jsonb_array_length(approved_instruments) > 0),
  approved_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Supervisory observer name; `NULL` if the provider is unregulated. Kept
  -- as plain text (not a party-role FK) -- same simplification
  -- portfolio_report's blanket regulator-role SELECT policy already makes.
  regulator                        TEXT,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE approved_provider ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_provider FORCE ROW LEVEL SECURITY;

-- signatory vetify; observer financialInstitution + (when regulated) regulator.
CREATE POLICY approved_provider_select ON approved_provider
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

-- No UPDATE policy: ApprovedProvider has zero choices in the Daml original
-- (a terminal, write-once credential) -- same INSERT-only shape as
-- portfolio_report.
CREATE POLICY approved_provider_insert ON approved_provider
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── ProviderRejectionRecord (audit trail for RejectProvider -- see header) ──

CREATE TABLE provider_rejection_record (
  id                                BIGSERIAL PRIMARY KEY,
  financing_provider_onboarding_id BIGINT NOT NULL REFERENCES financing_provider_onboarding(id),
  provider_name                    TEXT NOT NULL,
  cac_reg_number                   TEXT NOT NULL,
  reason                            TEXT NOT NULL,
  agent_score                      INTEGER,
  agent_risk                       TEXT,
  agent_version                    TEXT,
  rejected_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE provider_rejection_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_rejection_record FORCE ROW LEVEL SECURITY;

CREATE POLICY provider_rejection_record_select ON provider_rejection_record
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution'));

CREATE POLICY provider_rejection_record_insert ON provider_rejection_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── ProviderVerificationPolicy (Stage 0 scoring policy, vetify-wide singleton) ──
-- The first policy-singleton table in this migration -- VerificationPolicy/
-- CompliancePolicy/UnderwritingPolicy are all still deferred (see every
-- prior slice's own "out of scope" notes), so there's no existing precedent
-- to mirror here. UpdatePolicy's Daml body is a plain `create this with
-- ...` (same-template field replace, no new successor shape) -- collapses
-- to a plain UPDATE per the design doc's §3 convention, same as
-- AuthorizedOfficer's active-flag flip. No archived_at/history versioning
-- beyond the generic entity_history trigger.

CREATE TABLE provider_verification_policy (
  id               BIGSERIAL PRIMARY KEY,
  policy_version   TEXT NOT NULL CHECK (policy_version <> ''),
  auto_reject_max  INTEGER NOT NULL CHECK (auto_reject_max >= 0),
  effective_from   TIMESTAMPTZ NOT NULL,
  scoring_weights  JSONB NOT NULL,  -- ProviderVerificationScoringWeights
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE provider_verification_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_verification_policy FORCE ROW LEVEL SECURITY;

-- signatory vetify, no observer clause at all -- vetify-only, same as the
-- (not-yet-ported) VerificationPolicy/CompliancePolicy's own visibility.
CREATE POLICY provider_verification_policy_select ON provider_verification_policy
  FOR SELECT USING (current_setting('app.current_party_role', true) = 'vetify');

CREATE POLICY provider_verification_policy_insert ON provider_verification_policy
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

CREATE POLICY provider_verification_policy_update ON provider_verification_policy
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

CREATE TRIGGER trg_provider_verification_policy_history
  AFTER UPDATE ON provider_verification_policy FOR EACH ROW EXECUTE FUNCTION record_entity_history();
