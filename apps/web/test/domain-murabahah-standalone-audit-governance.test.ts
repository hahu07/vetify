// Unit/integration tests for lib/domain/murabahah.ts's Thirtieth Slice
// additions: seven standalone audit/governance records, none of which
// depend on any existing choice body -- vetify or the FI creates each one
// directly, so no acquisition-chain fixture is needed here at all.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import {
  createShariahAuditRecord,
  createShariahException,
  resolveException,
  createMurabahahStatement,
  listMurabahahStatements,
  createMonitoringAlert,
  dismissAlert,
  createPortfolioRiskReport,
  createForceMajeureDeclaration,
  liftDeclaration,
  createCharityOrganizationRegistry,
  updateRegistry,
} from "@/lib/domain/murabahah";

function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
}
function fiSession(): SessionContext {
  return { userId: 5, username: "test-fi", displayName: "Test FI", partyRole: "financialInstitution", cacRegNumber: null };
}
function businessSession(cacRegNumber: string): SessionContext {
  return { userId: 1, username: "test-business", displayName: "Test Business", partyRole: "business", cacRegNumber };
}

const fixtureClient = new Client({
  host: process.env.WEB_POSTGRES_HOST ?? "localhost",
  port: Number(process.env.WEB_POSTGRES_PORT ?? 5434),
  user: process.env.WEB_POSTGRES_USER ?? "vetify_web",
  password: process.env.WEB_POSTGRES_PASSWORD ?? "vetify_web",
  database: process.env.WEB_POSTGRES_DATABASE ?? "vetify_web",
});

before(async () => {
  await fixtureClient.connect();
});
after(async () => {
  await fixtureClient.end();
  await pool.end();
});

// ─── ShariahAuditRecord ─────────────────────────────────────────────────────

test("createShariahAuditRecord: business cannot create it, happy path is immutable", async () => {
  await assert.rejects(
    () =>
      createShariahAuditRecord(businessSession("RC6000001"), {
        cacRegNumber: "RC6000001", businessName: "Test Co", auditDate: "2026-06-30", auditPeriod: "2026-H1",
        auditorRef: "Internal Shariah Audit", findings: [], overallCompliant: true, recommendations: [],
      }),
    (err: unknown) => err instanceof Error && err.message.includes("not authorized"),
  );

  const result = await createShariahAuditRecord(vetifySession(), {
    cacRegNumber: "RC6000001", businessName: "Test Co", auditDate: "2026-06-30", auditPeriod: "2026-H1",
    auditorRef: "Internal Shariah Audit", findings: ["Qabdh evidence present"], overallCompliant: true, recommendations: [],
  });
  try {
    assert.ok(result.shariahAuditRecordId);
    const { rows } = await fixtureClient.query("SELECT overall_compliant, findings FROM shariah_audit_record WHERE id = $1", [
      result.shariahAuditRecordId,
    ]);
    assert.equal(rows[0].overall_compliant, true);
    assert.equal(rows[0].findings.length, 1);
  } finally {
    await fixtureClient.query("DELETE FROM shariah_audit_record WHERE id = $1", [result.shariahAuditRecordId]);
  }
});

// ─── ShariahException ───────────────────────────────────────────────────────

test("createShariahException + resolveException: rejects an empty note, happy path resolves once", async () => {
  const created = await createShariahException(vetifySession(), {
    cacRegNumber: "RC6000002", businessName: "Test Co", exceptionType: "PROHIBITED_STRUCTURE_DETECTED",
    description: "Working-capital financing purpose slipped past the pre-check", severity: "MajorException",
  });
  try {
    assert.ok(created.shariahExceptionId);

    await assert.rejects(
      () => resolveException(vetifySession(), Number(created.shariahExceptionId), { note: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Resolution note must not be empty",
    );

    const resolved = await resolveException(vetifySession(), Number(created.shariahExceptionId), {
      note: "Reviewed and corrected; facility re-underwritten",
    });
    assert.equal(Number(resolved.shariahExceptionId), Number(created.shariahExceptionId));

    await assert.rejects(
      () => resolveException(vetifySession(), Number(created.shariahExceptionId), { note: "Again" }),
      (err: unknown) => err instanceof DomainError && err.message === "Exception is already resolved",
    );

    const { rows } = await fixtureClient.query("SELECT resolution_note, resolved_at FROM shariah_exception WHERE id = $1", [
      created.shariahExceptionId,
    ]);
    assert.ok(rows[0].resolved_at);
  } finally {
    await fixtureClient.query("DELETE FROM shariah_exception WHERE id = $1", [created.shariahExceptionId]);
  }
});

// ─── MurabahahStatement ─────────────────────────────────────────────────────

test("createMurabahahStatement: rejects a non-positive totalFinanced, happy path is immutable", async () => {
  await assert.rejects(
    () =>
      createMurabahahStatement(vetifySession(), {
        cacRegNumber: "RC6000003", businessName: "Test Co", statementDate: "2026-06-30", statementPeriod: "2026-Q2",
        totalFinanced: 0, totalRepaid: 0, outstandingBalance: 0, installmentsPaid: 0, totalInstallments: 12, contractStatus: "Active",
      }),
    (err: unknown) => err instanceof DomainError && err.message === "totalFinanced must be positive",
  );

  const result = await createMurabahahStatement(vetifySession(), {
    cacRegNumber: "RC6000003", businessName: "Test Co", statementDate: "2026-06-30", statementPeriod: "2026-Q2",
    totalFinanced: 500_000, totalRepaid: 250_000, outstandingBalance: 250_000, installmentsPaid: 6, totalInstallments: 12,
    contractStatus: "Active",
  });
  try {
    assert.ok(result.murabahahStatementId);
    const { rows } = await fixtureClient.query("SELECT installments_paid, contract_status FROM murabahah_statement WHERE id = $1", [
      result.murabahahStatementId,
    ]);
    assert.equal(rows[0].installments_paid, 6);
    assert.equal(rows[0].contract_status, "Active");
  } finally {
    await fixtureClient.query("DELETE FROM murabahah_statement WHERE id = $1", [result.murabahahStatementId]);
  }
});

test("murabahah_statement: business can read its own statement, not another business's", async () => {
  const own = await createMurabahahStatement(vetifySession(), {
    cacRegNumber: "RC6000004", businessName: "Owner Co", statementDate: "2026-06-30", statementPeriod: "2026-Q2",
    totalFinanced: 500_000, totalRepaid: 250_000, outstandingBalance: 250_000, installmentsPaid: 6, totalInstallments: 12,
    contractStatus: "Active",
  });
  try {
    const ownView = await listMurabahahStatements(businessSession("RC6000004"));
    assert.ok(ownView.some((r: Record<string, unknown>) => String(r.id) === String(own.murabahahStatementId)));

    const otherView = await listMurabahahStatements(businessSession("RC6000099"));
    assert.ok(!otherView.some((r: Record<string, unknown>) => String(r.id) === String(own.murabahahStatementId)));
  } finally {
    await fixtureClient.query("DELETE FROM murabahah_statement WHERE id = $1", [own.murabahahStatementId]);
  }
});

// ─── MonitoringAlert ─────────────────────────────────────────────────────────

test("createMonitoringAlert + dismissAlert: rejects an empty description/dismissNote, happy path dismisses once", async () => {
  await assert.rejects(
    () =>
      createMonitoringAlert(vetifySession(), {
        cacRegNumber: "RC6000005", businessName: "Test Co", alertType: "DelinquencyRisk", alertSeverity: "SeverityHigh",
        alertDescription: "",
      }),
    (err: unknown) => err instanceof DomainError && err.message === "Alert description must not be empty",
  );

  const created = await createMonitoringAlert(vetifySession(), {
    cacRegNumber: "RC6000005", businessName: "Test Co", alertType: "GSMExhausted", alertSeverity: "SeverityCritical",
    alertDescription: "GSM sweeps exhausted; outstanding balance remains",
  });
  try {
    await assert.rejects(
      () => dismissAlert(vetifySession(), Number(created.monitoringAlertId), { dismissNote: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Dismissal note must not be empty",
    );

    await dismissAlert(vetifySession(), Number(created.monitoringAlertId), { dismissNote: "Escalated to Rahn enforcement" });

    await assert.rejects(
      () => dismissAlert(vetifySession(), Number(created.monitoringAlertId), { dismissNote: "Again" }),
      (err: unknown) => err instanceof DomainError && err.message === "Alert is already dismissed",
    );

    const { rows } = await fixtureClient.query("SELECT dismissed, dismissal_note FROM monitoring_alert WHERE id = $1", [
      created.monitoringAlertId,
    ]);
    assert.equal(rows[0].dismissed, true);
    assert.equal(rows[0].dismissal_note, "Escalated to Rahn enforcement");
  } finally {
    await fixtureClient.query("DELETE FROM monitoring_alert WHERE id = $1", [created.monitoringAlertId]);
  }
});

// ─── PortfolioRiskReport ─────────────────────────────────────────────────────

test("createPortfolioRiskReport: rejects negative exposureAtDefault, happy path is immutable", async () => {
  const validMetrics = {
    probabilityOfDefault: 0.05, lossGivenDefault: 0.4, expectedLoss: 20_000, exposureAtDefault: 1_000_000,
    concentrationRisk: 0.15, sectorConcentration: "Retail Trade", delinquencyRate: 0.03, activeContractCount: 42,
  };

  await assert.rejects(
    () =>
      createPortfolioRiskReport(vetifySession(), {
        reportDate: "2026-09-30", reportPeriod: "2026-Q3", generatedByAgent: "vetify-reporting", modelVersion: "v1.0",
        metrics: { ...validMetrics, exposureAtDefault: -1 },
      }),
    (err: unknown) => err instanceof DomainError && err.message === "exposureAtDefault must be non-negative",
  );

  const result = await createPortfolioRiskReport(vetifySession(), {
    reportDate: "2026-09-30", reportPeriod: "2026-Q3", generatedByAgent: "vetify-reporting", modelVersion: "v1.0",
    metrics: validMetrics,
  });
  try {
    assert.ok(result.portfolioRiskReportId);
    const { rows } = await fixtureClient.query(
      "SELECT active_contract_count, sector_concentration FROM portfolio_risk_report WHERE id = $1",
      [result.portfolioRiskReportId],
    );
    assert.equal(rows[0].active_contract_count, 42);
    assert.equal(rows[0].sector_concentration, "Retail Trade");
  } finally {
    await fixtureClient.query("DELETE FROM portfolio_risk_report WHERE id = $1", [result.portfolioRiskReportId]);
  }
});

// ─── ForceMajeureDeclaration ─────────────────────────────────────────────────

test("createForceMajeureDeclaration + liftDeclaration: rejects a bad date range, happy path lifts once", async () => {
  await assert.rejects(
    () =>
      createForceMajeureDeclaration(vetifySession(), {
        declarationRef: "FMD-TEST-1", eventDescription: "Flooding", affectedRegion: "North-East Nigeria",
        suspensionStart: "2026-08-01", suspensionEnd: "2026-07-01", regulatoryBasis: "CBN Circular",
      }),
    (err: unknown) => err instanceof DomainError && err.message === "suspensionEnd must be later than suspensionStart",
  );

  const created = await createForceMajeureDeclaration(vetifySession(), {
    declarationRef: "FMD-TEST-2", eventDescription: "Nationwide fuel scarcity disrupting collections",
    affectedRegion: "Nationwide", suspensionStart: "2026-08-01", suspensionEnd: "2026-09-01",
    regulatoryBasis: "CBN Circular FPR/DIR/GEN/CIR/07/004",
  });
  try {
    const lifted = await liftDeclaration(vetifySession(), Number(created.forceMajeureDeclarationId), { note: "Event resolved" });
    assert.equal(Number(lifted.forceMajeureDeclarationId), Number(created.forceMajeureDeclarationId));

    await assert.rejects(
      () => liftDeclaration(vetifySession(), Number(created.forceMajeureDeclarationId), { note: "Again" }),
      (err: unknown) => err instanceof DomainError && err.message === "Declaration has already been lifted",
    );

    const { rows } = await fixtureClient.query("SELECT is_active FROM force_majeure_declaration WHERE id = $1", [
      created.forceMajeureDeclarationId,
    ]);
    assert.equal(rows[0].is_active, false);
  } finally {
    await fixtureClient.query("DELETE FROM force_majeure_declaration WHERE id = $1", [created.forceMajeureDeclarationId]);
  }
});

// ─── CharityOrganizationRegistry ────────────────────────────────────────────

test("createCharityOrganizationRegistry + updateRegistry: rejects an empty list, happy path updates it", async () => {
  await assert.rejects(
    () =>
      createCharityOrganizationRegistry(fiSession(), {
        approvedOrganizations: [], shariahBoardRef: "SBR-2026-01", effectiveDate: "2026-01-01", version: "1.0",
      }),
    (err: unknown) => err instanceof DomainError && err.message === "Updated list must not be empty",
  );

  const created = await createCharityOrganizationRegistry(fiSession(), {
    approvedOrganizations: [["Sadaqah Foundation Nigeria", "REG-001"]], shariahBoardRef: "SBR-2026-01",
    effectiveDate: "2026-01-01", version: "1.0",
  });
  try {
    await assert.rejects(
      () =>
        updateRegistry(fiSession(), Number(created.charityOrganizationRegistryId), {
          newOrganizations: [], newVersion: "1.1", updatedBoardRef: "SBR-2026-02",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Updated list must not be empty",
    );

    const updated = await updateRegistry(fiSession(), Number(created.charityOrganizationRegistryId), {
      newOrganizations: [["Sadaqah Foundation Nigeria", "REG-001"], ["Islamic Relief Nigeria", "REG-002"]],
      newVersion: "1.1", updatedBoardRef: "SBR-2026-02",
    });
    assert.equal(Number(updated.charityOrganizationRegistryId), Number(created.charityOrganizationRegistryId));

    const { rows } = await fixtureClient.query("SELECT approved_organizations, version FROM charity_organization_registry WHERE id = $1", [
      created.charityOrganizationRegistryId,
    ]);
    assert.equal(rows[0].approved_organizations.length, 2);
    assert.equal(rows[0].version, "1.1");
  } finally {
    await fixtureClient.query("DELETE FROM charity_organization_registry WHERE id = $1", [created.charityOrganizationRegistryId]);
  }
});
