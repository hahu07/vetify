-- Phase 2, Thirty-Fifth Slice -- the last item from the original template
-- survey: UnderwritingPolicy. Unlike VerificationPolicy/CompliancePolicy
-- (Fourteenth/Nineteenth Slices), the real Daml has NO maker-checker layer
-- here at all -- just a single vetify-controlled UpdatePolicy choice, no
-- PendingUnderwritingPolicy/riskCommittee endorsement. Confirmed by reading
-- Financing.daml directly: no such template exists.
--
-- Keyed `(vetify, financialInstitution)` in the real Daml -- one policy per
-- distinct FI party. This migration has only one `financialInstitution`
-- session role (no per-institution parties, and financing_request itself
-- carries no institution-identifying column at all -- confirmed by
-- inspecting the table), so this is ported as a vetify-wide singleton, the
-- same simplification VerificationPolicy/CompliancePolicy already made.
--
-- scoringWeights' real `ensure` clause is a ~40-line cross-field validation
-- (band-boundary ordering, engine-weight sum-to-100, etc.) -- not
-- replicated here, same simplification this migration's own
-- VerificationPolicy/CompliancePolicy already made (opaque JSONB blob, no
-- per-field enforcement) rather than hand-maintaining a huge duplicate
-- validation surface for demo/PoC scoring weights.
--
-- UpdatePolicy's real Daml body is a plain `create this with ...` -- the
-- exact same keyless field-replace shape as ProviderVerificationPolicy's
-- own UpdatePolicy (migrations/016), which this table's shape mirrors
-- directly: a single row, updated in place, no archived_at/history
-- versioning (same convention as AuthorizedOfficer's active-flag flip).

CREATE TABLE underwriting_policy (
  id                             BIGSERIAL PRIMARY KEY,
  policy_version                 TEXT NOT NULL CHECK (policy_version <> ''),
  auto_approve_min               INTEGER NOT NULL,
  auto_reject_max                INTEGER NOT NULL,
  min_dscr_ratio                 NUMERIC,
  min_loan_amount                NUMERIC CHECK (min_loan_amount IS NULL OR min_loan_amount > 0),
  max_loan_amount                NUMERIC,
  indicative_profit_margin_pct   NUMERIC,
  request_sla_hours              INTEGER NOT NULL CHECK (request_sla_hours > 0),
  offer_validity_days            INTEGER NOT NULL CHECK (offer_validity_days > 0),
  effective_from                 TIMESTAMPTZ NOT NULL,
  effective_to                   TIMESTAMPTZ,
  write_off_threshold_amount     NUMERIC CHECK (write_off_threshold_amount IS NULL OR write_off_threshold_amount > 0),
  max_restructurings_per_facility INTEGER CHECK (max_restructurings_per_facility IS NULL OR max_restructurings_per_facility > 0),
  permitted_sectors              JSONB,
  required_collateral_types      JSONB NOT NULL DEFAULT '[]',
  max_sector_concentration_pct   NUMERIC,
  scoring_weights                JSONB NOT NULL,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT underwriting_policy_approve_reject_check CHECK (auto_approve_min > auto_reject_max),
  CONSTRAINT underwriting_policy_loan_amount_check CHECK (min_loan_amount IS NULL OR max_loan_amount IS NULL OR min_loan_amount <= max_loan_amount)
);

ALTER TABLE underwriting_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE underwriting_policy FORCE ROW LEVEL SECURITY;

CREATE POLICY underwriting_policy_select ON underwriting_policy
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'assessor'));

CREATE POLICY underwriting_policy_insert ON underwriting_policy
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

CREATE POLICY underwriting_policy_update ON underwriting_policy
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── Wiring into BeginUnderwriting / FlagUnderwritingForManualReview ───────
-- resolveUnderwritingPolicy's snapshot needs somewhere to land on
-- UnderwritingResult; financing_request.expires_at already exists
-- (threaded by ExpireRequest, Thirty-Second Slice) and is reused for the
-- computed SLA expiry rather than adding a duplicate column.

ALTER TABLE underwriting_result ADD COLUMN policy_snapshot JSONB;
