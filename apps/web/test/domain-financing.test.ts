// Unit/integration tests for lib/domain/financing.ts's ported assertMsg
// guards (Phase 2, Stage 5-7 -- mirrors test/domain-onboarding.test.ts's
// pattern exactly). Fixtures (approved_business rows) inserted directly via
// a superuser client; the choice functions under test always go through the
// real withAuthorization-wrapped exports.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { AuthorizationError, DomainError } from "@/lib/errors";
import {
  requestFinancing,
  beginUnderwriting,
  flagUnderwritingForManualReview,
  rejectUnderwriting,
  approveFunding,
  rejectFunding,
} from "@/lib/domain/financing";
import type { RiskAssessment } from "@/lib/types-financing";
import { ensureStage0ApprovalFixtures } from "./stage0-fixtures";

function businessSession(cacRegNumber: string): SessionContext {
  return { userId: 1, username: "test-business", displayName: "Test Business", partyRole: "business", cacRegNumber };
}
function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
}
function assessorSession(): SessionContext {
  return { userId: 4, username: "test-assessor", displayName: "Test Assessor", partyRole: "assessor", cacRegNumber: null };
}
function fiSession(): SessionContext {
  return { userId: 5, username: "test-fi", displayName: "Test FI", partyRole: "financialInstitution", cacRegNumber: null };
}

const fixtureClient = new Client({
  host: process.env.WEB_POSTGRES_HOST ?? "localhost",
  port: Number(process.env.WEB_POSTGRES_PORT ?? 5434),
  user: process.env.WEB_POSTGRES_USER ?? "vetify_web",
  password: process.env.WEB_POSTGRES_PASSWORD ?? "vetify_web",
  database: process.env.WEB_POSTGRES_DATABASE ?? "vetify_web",
});

let stage0: { approvedProviderId: number; approvingOfficerId: string };

before(async () => {
  await fixtureClient.connect();
  stage0 = await ensureStage0ApprovalFixtures(fixtureClient);
});
after(async () => {
  await fixtureClient.end();
  await pool.end();
});

async function makeApprovedBusiness(cac: string) {
  await fixtureClient.query(
    `INSERT INTO approved_business
       (cac_reg_number, business_name, business_sector, business_activity,
        incorporation_date, verification_ref, compliance_ref, approved_at, status)
     VALUES ($1, 'Test Co', 'Retail Trade', 'Retail sale', '2020-01-01', $2, $3, now(), 'BusinessActive')`,
    [cac, `VER-${cac}`, `COM-${cac}`],
  );
}

// Stage 0/Governance gates approveFunding now checks (see migrations/016 +
// financing.ts's own header) are satisfied via the shared
// ensureStage0ApprovalFixtures() helper (test/stage0-fixtures.ts), same as
// every Murabahah test file.
async function cleanup(cac: string) {
  await fixtureClient.query(`DELETE FROM murabahah_wad WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_decision WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM underwriting_rejection WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM underwriting_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_request WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM approved_business WHERE cac_reg_number = $1`, [cac]);
}

const validAssessment: RiskAssessment = {
  score: 90,
  riskCategory: "Low",
  recommendedLimit: 1_000_000,
  recommendation: "Approve at requested terms",
};

// ─── requestFinancing ───────────────────────────────────────────────────────

test("requestFinancing: withAuthorization rejects a non-business session", async () => {
  await assert.rejects(
    () =>
      requestFinancing(vetifySession(), {
        terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
        financingRef: "FIN-TEST-1",
        businessSector: "Retail Trade",
      }),
    AuthorizationError,
  );
});

test("requestFinancing: rejects a non-positive amount", async () => {
  const cac = "RC4000001";
  await assert.rejects(
    () =>
      requestFinancing(businessSession(cac), {
        terms: { amount: 0, purpose: "Inventory", tenureMonths: 12 },
        financingRef: "FIN-TEST-2",
        businessSector: "Retail Trade",
      }),
    (err: unknown) => err instanceof DomainError && err.message === "Financing amount must be positive",
  );
});

test("requestFinancing: requires an active approved business for the caller's CAC", async () => {
  const cac = "RC4000002";
  await assert.rejects(
    () =>
      requestFinancing(businessSession(cac), {
        terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
        financingRef: "FIN-TEST-3",
        businessSector: "Retail Trade",
      }),
    (err: unknown) => err instanceof DomainError && err.message === "No active approved business found for this CAC number",
  );
});

test("requestFinancing: full happy path creates a Submitted request", async () => {
  const cac = "RC4000003";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: "FIN-TEST-4",
      businessSector: "Retail Trade",
    });
    assert.equal(created.status, "Submitted");
  } finally {
    await cleanup(cac);
  }
});

// ─── beginUnderwriting ──────────────────────────────────────────────────────

test("beginUnderwriting: withAuthorization rejects a business session", async () => {
  await assert.rejects(
    () => beginUnderwriting(businessSession("RC4000004"), 1, { assessment: validAssessment, autoDecided: false }),
    AuthorizationError,
  );
});

test("beginUnderwriting: High-risk assessments cannot be auto-decided", async () => {
  const cac = "RC4000005";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: "FIN-TEST-5",
      businessSector: "Retail Trade",
    });
    await assert.rejects(
      () =>
        beginUnderwriting(assessorSession(), Number(created.id), {
          assessment: { ...validAssessment, riskCategory: "High", score: 20 },
          autoDecided: true,
        }),
      (err: unknown) =>
        err instanceof DomainError && err.message === "High-risk assessments cannot be auto-decided; human review required",
    );
  } finally {
    await cleanup(cac);
  }
});

test("beginUnderwriting: full happy path transitions to Underwriting and creates UnderwritingResult", async () => {
  const cac = "RC4000006";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: "FIN-TEST-6",
      businessSector: "Retail Trade",
    });
    const result = await beginUnderwriting(assessorSession(), Number(created.id), {
      assessment: validAssessment,
      autoDecided: false,
    });
    assert.ok(result.underwritingResultId);

    const { rows } = await fixtureClient.query("SELECT status FROM financing_request WHERE id = $1", [created.id]);
    assert.equal(rows[0].status, "Underwriting");
  } finally {
    await cleanup(cac);
  }
});

// ─── flagUnderwritingForManualReview ────────────────────────────────────────

test("flagUnderwritingForManualReview: can only flag from Submitted", async () => {
  const cac = "RC4000007";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: "FIN-TEST-7",
      businessSector: "Retail Trade",
    });
    await beginUnderwriting(assessorSession(), Number(created.id), { assessment: validAssessment, autoDecided: false });
    // Now Underwriting, not Submitted.
    await assert.rejects(
      () =>
        flagUnderwritingForManualReview(vetifySession(), Number(created.id), {
          riskScore: 60,
          riskLevel: "Medium",
          agentVersion: "test-v1",
          note: "test flag",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only flag from Submitted",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── rejectUnderwriting ─────────────────────────────────────────────────────

test("rejectUnderwriting: rejection reason must not be empty", async () => {
  const cac = "RC4000008";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: "FIN-TEST-8",
      businessSector: "Retail Trade",
    });
    await assert.rejects(
      () => rejectUnderwriting(assessorSession(), Number(created.id), { reason: "", autoDecided: false, reviewerParty: "assessor" }),
      (err: unknown) => err instanceof DomainError && err.message === "Rejection reason must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("rejectUnderwriting: full happy path archives the request and creates UnderwritingRejection", async () => {
  const cac = "RC4000009";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: "FIN-TEST-9",
      businessSector: "Retail Trade",
    });
    const rejection = await rejectUnderwriting(assessorSession(), Number(created.id), {
      reason: "Fails sector policy",
      autoDecided: false,
      reviewerParty: "assessor",
    });
    assert.ok(rejection.underwritingRejectionId);

    const { rows } = await fixtureClient.query(
      "SELECT status, archived_at FROM financing_request WHERE id = $1",
      [created.id],
    );
    assert.equal(rows[0].status, "FinancingRejected");
    assert.ok(rows[0].archived_at);
  } finally {
    await cleanup(cac);
  }
});

// ─── approveFunding / rejectFunding ─────────────────────────────────────────

test("approveFunding: can only approve from Underwriting", async () => {
  const cac = "RC4000010";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: "FIN-TEST-10",
      businessSector: "Retail Trade",
    });
    // Still Submitted -- beginUnderwriting was never called. The status
    // guard fires before assetDetails/Stage 0 args are ever examined, so
    // these values are never used -- but the interface still requires them.
    await assert.rejects(
      () =>
        approveFunding(fiSession(), Number(created.id), {
          assetDetails: { description: "Flour", supplier: "Golden Mills", supplierRef: "PO-1", estimatedCost: 500_000 },
          approvedProviderId: 0,
          approvingOfficerId: "unused",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only approve from Underwriting",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approveFunding: rejects a provider not approved for Murabahah", async () => {
  const cac = "RC4000013";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 13 },
      financingRef: "FIN-TEST-13",
      businessSector: "Retail Trade",
    });
    await beginUnderwriting(assessorSession(), Number(created.id), { assessment: validAssessment, autoDecided: false });

    const onboarding = await fixtureClient.query(
      `INSERT INTO financing_provider_onboarding
         (provider_name, address, cac_reg_number, provider_type, governing_doc_ref, declared_instruments, archived_at)
       VALUES ('Ijarah-Only Provider', 'Lagos', 'RC4000013-PROVIDER', 'CooperativeSociety', '{}', '["Ijarah"]', now())
       RETURNING id`,
    );
    const ijarahOnlyProvider = await fixtureClient.query(
      `INSERT INTO approved_provider (financing_provider_onboarding_id, provider_name, provider_type, approved_instruments)
       VALUES ($1, 'Ijarah-Only Provider', 'CooperativeSociety', '["Ijarah"]')
       RETURNING id`,
      [onboarding.rows[0].id],
    );

    await assert.rejects(
      () =>
        approveFunding(fiSession(), Number(created.id), {
          assetDetails: { description: "Flour", supplier: "Golden Mills", supplierRef: "PO-1", estimatedCost: 500_000 },
          approvedProviderId: ijarahOnlyProvider.rows[0].id,
          approvingOfficerId: stage0.approvingOfficerId,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Financial institution is not approved to offer Murabahah financing",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approveFunding: rejects an unregistered/inactive officer", async () => {
  const cac = "RC4000014";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 14 },
      financingRef: "FIN-TEST-14",
      businessSector: "Retail Trade",
    });
    await beginUnderwriting(assessorSession(), Number(created.id), { assessment: validAssessment, autoDecided: false });

    await assert.rejects(
      () =>
        approveFunding(fiSession(), Number(created.id), {
          assetDetails: { description: "Flour", supplier: "Golden Mills", supplierRef: "PO-1", estimatedCost: 500_000 },
          approvedProviderId: stage0.approvedProviderId,
          approvingOfficerId: "NO-SUCH-OFFICER",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Officer NO-SUCH-OFFICER not found",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approveFunding: rejects an amount over the officer's approval limit", async () => {
  const cac = "RC4000015";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 15 },
      financingRef: "FIN-TEST-15",
      businessSector: "Retail Trade",
    });
    await beginUnderwriting(assessorSession(), Number(created.id), { assessment: validAssessment, autoDecided: false });

    await fixtureClient.query(
      `INSERT INTO authorized_officer (officer_id, officer_name, roles, authorized_by, authorized_at, active, approval_limit)
       SELECT 'LOW-LIMIT-OFFICER', 'Low Limit Officer', '["CreditOfficer"]', 'Test Setup', now(), true, 1000
       WHERE NOT EXISTS (SELECT 1 FROM authorized_officer WHERE officer_id = 'LOW-LIMIT-OFFICER')`,
    );

    await assert.rejects(
      () =>
        approveFunding(fiSession(), Number(created.id), {
          assetDetails: { description: "Flour", supplier: "Golden Mills", supplierRef: "PO-1", estimatedCost: 500_000 },
          approvedProviderId: stage0.approvedProviderId,
          approvingOfficerId: "LOW-LIMIT-OFFICER",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Financing amount exceeds officer's approval limit",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approveFunding: full happy path creates a FinancingDecision", async () => {
  const cac = "RC4000011";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: "FIN-TEST-11",
      businessSector: "Retail Trade",
    });
    await beginUnderwriting(assessorSession(), Number(created.id), { assessment: validAssessment, autoDecided: false });
    const decision = await approveFunding(fiSession(), Number(created.id), {
      assetDetails: { description: "50 metric tonnes of white flour", supplier: "Golden Mills Ltd", supplierRef: "PO-2026-1", estimatedCost: 500_000 },
      approvedProviderId: stage0.approvedProviderId,
      approvingOfficerId: stage0.approvingOfficerId,
    });
    assert.ok(decision.financingDecisionId);
    assert.ok(decision.murabahahWadId);

    const { rows } = await fixtureClient.query(
      "SELECT outcome FROM financing_decision WHERE id = $1",
      [decision.financingDecisionId],
    );
    assert.equal(rows[0].outcome, "FinancingApproved");
  } finally {
    await cleanup(cac);
  }
});

test("rejectFunding: rejection reason must not be empty", async () => {
  const cac = "RC4000012";
  try {
    await makeApprovedBusiness(cac);
    const created = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: "FIN-TEST-12",
      businessSector: "Retail Trade",
    });
    await assert.rejects(
      () => rejectFunding(fiSession(), Number(created.id), { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Rejection reason must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("rejectFunding: withAuthorization rejects a non-financialInstitution session", async () => {
  await assert.rejects(
    () => rejectFunding(vetifySession(), 1, { reason: "test" }),
    AuthorizationError,
  );
});
