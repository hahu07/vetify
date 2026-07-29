-- Phase 2, fourth slice (web2-migration-design.md): Reporting -- the one
-- module this entire migration hadn't touched at all until now. Ported from
-- daml/Vetify/Reporting.daml's PortfolioReport (vetify-signed, observed by
-- financialInstitution and optionally regulator) plus
-- agents/src/scoring/reporting.ts's aggregatePortfolio() -- the deterministic
-- metrics engine, ported verbatim into lib/scoring/reporting.ts rather than
-- re-derived, since it's already unit-tested in the agents package.
--
-- New party role: `regulator` -- a genuinely new, read-only role for this
-- app (no write choices anywhere name it as a controller), added now purely
-- to observe PortfolioReport. Unlike sentinel/advisor/assessor, this role
-- needs no registry -- Daml's own `regulator : Optional Party` on
-- MurabahahContract/PortfolioReport is a plain observer field, not gated by
-- an AuthorizedX registry.
--
-- Deliberately out of scope: report scheduling/cursoring (the real
-- Supervisor derives a monthly cursor from the ledger's latest
-- PortfolioReport.reportDate to avoid duplicate reports on restart --
-- irrelevant here since report generation is a manual vetify button, not an
-- autonomous poll loop), and the LLM-authored narrative `summary` (no LLM in
-- this migration at all; a deterministic templated sentence is used instead,
-- matching this migration's "never fabricate a narrative to look real"
-- discipline).

ALTER TABLE users DROP CONSTRAINT users_party_role_check;
ALTER TABLE users ADD CONSTRAINT users_party_role_check
  CHECK (party_role IN ('business', 'vetify', 'verifier', 'assessor', 'financialInstitution', 'advisor', 'sentinel', 'regulator'));

CREATE TABLE portfolio_report (
  id                       BIGSERIAL PRIMARY KEY,
  report_date              DATE NOT NULL,
  total_active_contracts   INTEGER NOT NULL CHECK (total_active_contracts >= 0),
  total_disbursed          NUMERIC NOT NULL CHECK (total_disbursed >= 0),
  total_outstanding        NUMERIC NOT NULL CHECK (total_outstanding >= 0),
  delinquent_count         INTEGER NOT NULL CHECK (delinquent_count >= 0),
  completed_count          INTEGER NOT NULL CHECK (completed_count >= 0),
  defaulted_count          INTEGER NOT NULL CHECK (defaulted_count >= 0),
  summary                  TEXT NOT NULL CHECK (summary <> ''),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE portfolio_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_report FORCE ROW LEVEL SECURITY;

-- Blanket visibility for vetify/financialInstitution/regulator -- no business
-- observer at all, matching the Daml original's signatory/observer clause
-- exactly (business is never an observer of PortfolioReport).
CREATE POLICY portfolio_report_select ON portfolio_report
  FOR SELECT
  USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY portfolio_report_insert ON portfolio_report
  FOR INSERT
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');
