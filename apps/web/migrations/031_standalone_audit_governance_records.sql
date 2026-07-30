-- Phase 2, Thirtieth Slice -- a batch of seven standalone audit/governance
-- templates, none of which depend on any existing choice body: vetify or
-- the FI creates each one directly (no exercised choice on another
-- template creates them), so this slice is purely additive and touches
-- nothing already tested. Grouped into one larger slice per the "bigger
-- batches, same rigor" plan agreed after the Twenty-Ninth Slice -- each
-- still gets its own full migration/RLS/tests/live-verify treatment, just
-- landed together instead of one tiny cluster per turn.
--
-- Three of the seven (PortfolioRiskReport, ForceMajeureDeclaration,
-- CharityOrganizationRegistry) are genuinely portfolio-/FI-wide, not
-- per-business -- they carry no cacRegNumber/businessName at all in the
-- real Daml, unlike every other template ported so far in this migration.

-- ─── ShariahAuditRecord ─────────────────────────────────────────────────────
-- signatory vetify; observer financialInstitution, regulator. No `business`
-- observer, no further choices -- immutable once created.

CREATE TABLE shariah_audit_record (
  id                BIGSERIAL PRIMARY KEY,
  cac_reg_number    TEXT NOT NULL,
  business_name     TEXT NOT NULL,
  facility_ref      TEXT,
  audit_date        DATE NOT NULL,
  audit_period      TEXT NOT NULL,
  auditor_ref       TEXT NOT NULL,
  findings          JSONB NOT NULL DEFAULT '[]',
  overall_compliant BOOLEAN NOT NULL,
  recommendations   JSONB NOT NULL DEFAULT '[]',
  next_audit_date   DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shariah_audit_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE shariah_audit_record FORCE ROW LEVEL SECURITY;

CREATE POLICY shariah_audit_record_select ON shariah_audit_record
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY shariah_audit_record_insert ON shariah_audit_record
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── ShariahException ───────────────────────────────────────────────────────
-- signatory vetify; observer financialInstitution, regulator.
-- ResolveException (vetify, keyless field-replace) collapses to UPDATE.

CREATE TABLE shariah_exception (
  id              BIGSERIAL PRIMARY KEY,
  cac_reg_number  TEXT NOT NULL,
  business_name   TEXT NOT NULL,
  facility_ref    TEXT,
  exception_type  TEXT NOT NULL,
  description     TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('MinorException', 'MajorException', 'CriticalException')),
  detected_at     TIMESTAMPTZ NOT NULL,
  resolution_note TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shariah_exception ENABLE ROW LEVEL SECURITY;
ALTER TABLE shariah_exception FORCE ROW LEVEL SECURITY;

CREATE POLICY shariah_exception_select ON shariah_exception
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY shariah_exception_insert ON shariah_exception
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

CREATE POLICY shariah_exception_update ON shariah_exception
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── MurabahahStatement ─────────────────────────────────────────────────────
-- signatory vetify; observer business, financialInstitution, regulator --
-- the only one of the seven with `business` visibility, so this is the
-- only table below that carries the usual business tenant-scoped SELECT
-- clause. No further choices -- immutable once created.

CREATE TABLE murabahah_statement (
  id                  BIGSERIAL PRIMARY KEY,
  cac_reg_number      TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  statement_date      DATE NOT NULL,
  statement_period    TEXT NOT NULL,
  total_financed      NUMERIC NOT NULL CHECK (total_financed > 0),
  total_repaid        NUMERIC NOT NULL CHECK (total_repaid >= 0),
  outstanding_balance NUMERIC NOT NULL CHECK (outstanding_balance >= 0),
  installments_paid   INTEGER NOT NULL,
  total_installments  INTEGER NOT NULL,
  contract_status     TEXT NOT NULL,
  shariah_audit_ref   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE murabahah_statement ENABLE ROW LEVEL SECURITY;
ALTER TABLE murabahah_statement FORCE ROW LEVEL SECURITY;

CREATE POLICY murabahah_statement_select ON murabahah_statement
  FOR SELECT
  USING (
    current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator')
    OR (
      current_setting('app.current_party_role', true) = 'business'
      AND cac_reg_number = current_setting('app.current_cac_reg_number', true)
    )
  );

CREATE POLICY murabahah_statement_insert ON murabahah_statement
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── MonitoringAlert ─────────────────────────────────────────────────────────
-- signatory vetify; observer financialInstitution, regulator.
-- DismissAlert (vetify, keyless field-replace) collapses to UPDATE.

CREATE TABLE monitoring_alert (
  id                BIGSERIAL PRIMARY KEY,
  cac_reg_number    TEXT NOT NULL,
  business_name     TEXT NOT NULL,
  facility_ref      TEXT,
  alert_type        TEXT NOT NULL CHECK (alert_type IN (
    'DelinquencyRisk', 'CollateralDeterioration', 'AMLFlag', 'FraudSignal',
    'SupplierRisk', 'EarlyWarningSignal', 'MandateCancellation', 'GSMExhausted'
  )),
  alert_severity    TEXT NOT NULL CHECK (alert_severity IN ('SeverityLow', 'SeverityMedium', 'SeverityHigh', 'SeverityCritical')),
  alert_description TEXT NOT NULL CHECK (alert_description <> ''),
  detected_at       TIMESTAMPTZ NOT NULL,
  dismissed         BOOLEAN NOT NULL DEFAULT false,
  dismissal_note    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE monitoring_alert ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alert FORCE ROW LEVEL SECURITY;

CREATE POLICY monitoring_alert_select ON monitoring_alert
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY monitoring_alert_insert ON monitoring_alert
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

CREATE POLICY monitoring_alert_update ON monitoring_alert
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── PortfolioRiskReport ─────────────────────────────────────────────────────
-- signatory vetify; observer financialInstitution, regulator. Portfolio-wide
-- -- no cacRegNumber/businessName. No further choices.

CREATE TABLE portfolio_risk_report (
  id                       BIGSERIAL PRIMARY KEY,
  report_date              DATE NOT NULL,
  report_period            TEXT NOT NULL,
  probability_of_default   NUMERIC NOT NULL,
  loss_given_default       NUMERIC NOT NULL,
  expected_loss            NUMERIC NOT NULL,
  exposure_at_default      NUMERIC NOT NULL,
  concentration_risk       NUMERIC NOT NULL,
  sector_concentration     TEXT NOT NULL,
  delinquency_rate         NUMERIC NOT NULL,
  active_contract_count    INTEGER NOT NULL CHECK (active_contract_count >= 0),
  generated_by_agent       TEXT NOT NULL,
  model_version            TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_risk_report_ead_check CHECK (exposure_at_default >= 0),
  CONSTRAINT portfolio_risk_report_el_check CHECK (expected_loss >= 0)
);

ALTER TABLE portfolio_risk_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_risk_report FORCE ROW LEVEL SECURITY;

CREATE POLICY portfolio_risk_report_select ON portfolio_risk_report
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY portfolio_risk_report_insert ON portfolio_risk_report
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── ForceMajeureDeclaration ─────────────────────────────────────────────────
-- signatory vetify; observer financialInstitution, regulator. Portfolio-wide
-- -- no cacRegNumber/businessName. LiftDeclaration (vetify, keyless
-- field-replace) collapses to UPDATE.

CREATE TABLE force_majeure_declaration (
  id                BIGSERIAL PRIMARY KEY,
  declaration_ref   TEXT NOT NULL CHECK (declaration_ref <> ''),
  event_description TEXT NOT NULL CHECK (event_description <> ''),
  affected_region   TEXT NOT NULL,
  suspension_start  DATE NOT NULL,
  suspension_end    DATE NOT NULL,
  regulatory_basis  TEXT NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT force_majeure_declaration_dates_check CHECK (suspension_end > suspension_start)
);

ALTER TABLE force_majeure_declaration ENABLE ROW LEVEL SECURITY;
ALTER TABLE force_majeure_declaration FORCE ROW LEVEL SECURITY;

CREATE POLICY force_majeure_declaration_select ON force_majeure_declaration
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY force_majeure_declaration_insert ON force_majeure_declaration
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

CREATE POLICY force_majeure_declaration_update ON force_majeure_declaration
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'vetify')
  WITH CHECK (current_setting('app.current_party_role', true) = 'vetify');

-- ─── CharityOrganizationRegistry ─────────────────────────────────────────────
-- signatory financialInstitution; observer vetify, regulator. FI-wide, one
-- per institution -- no cacRegNumber/businessName. UpdateRegistry
-- (financialInstitution, keyless field-replace) collapses to UPDATE.

CREATE TABLE charity_organization_registry (
  id                     BIGSERIAL PRIMARY KEY,
  approved_organizations JSONB NOT NULL,
  shariah_board_ref      TEXT NOT NULL CHECK (shariah_board_ref <> ''),
  effective_date         DATE NOT NULL,
  version                TEXT NOT NULL CHECK (version <> ''),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE charity_organization_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE charity_organization_registry FORCE ROW LEVEL SECURITY;

CREATE POLICY charity_organization_registry_select ON charity_organization_registry
  FOR SELECT USING (current_setting('app.current_party_role', true) IN ('vetify', 'financialInstitution', 'regulator'));

CREATE POLICY charity_organization_registry_insert ON charity_organization_registry
  FOR INSERT WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');

CREATE POLICY charity_organization_registry_update ON charity_organization_registry
  FOR UPDATE
  USING (current_setting('app.current_party_role', true) = 'financialInstitution')
  WITH CHECK (current_setting('app.current_party_role', true) = 'financialInstitution');
