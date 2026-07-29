// Unit/integration tests for lib/domain/compliance.ts's ported assertMsg
// guards (addendum C's point 1). Fixtures (business_onboarding +
// verification_result rows) are inserted directly via a superuser client,
// bypassing RLS -- this file is testing compliance.ts's own guards, not
// RLS (already covered by test/rls.test.ts) or onboarding.ts's guards
// (already covered by test/domain-onboarding.test.ts).
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { AuthorizationError, DomainError } from "@/lib/errors";
import {
  openComplianceReview,
  startReview,
  approveCompliance,
  rejectCompliance,
  flagComplianceForManualReview,
} from "@/lib/domain/compliance";

function verifierSession(): SessionContext {
  return { userId: 2, username: "test-verifier", displayName: "Test Verifier", partyRole: "verifier", cacRegNumber: null };
}
function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
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

const validChecks = { shariahCompliant: true, amlCleared: true, kycValidated: true, cddCompleted: true };

/** Inserts a real Approved VerificationResult (and its parent onboarding row) via the superuser client -- fixture setup only, not the code under test. */
async function makeApprovedVerification(cac: string) {
  const onboarding = await fixtureClient.query(
    `INSERT INTO business_onboarding (cac_reg_number, profile, kyc, documents, onboarding_ref, status)
     VALUES ($1, $2, '{}', '[]', $3, 'Approved') RETURNING id`,
    [cac, JSON.stringify({ name: "Test Co", businessSector: "Retail Trade", businessActivity: "Retail sale", incorporationDate: "2020-01-01" }), `ONB-${cac}`],
  );
  const verification = await fixtureClient.query(
    `INSERT INTO verification_result
       (business_onboarding_id, cac_reg_number, business_name, checks, risk_score,
        risk_level, outcome, auto_decided, verification_ref, decided_at)
     VALUES ($1, $2, 'Test Co', '{}', 90, 'Low', 'Approved', false, $3, now())
     RETURNING id`,
    [onboarding.rows[0].id, cac, `VER-${cac}`],
  );
  return verification.rows[0].id as number;
}

async function cleanup(cac: string) {
  await fixtureClient.query(`DELETE FROM compliance_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM approved_business WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM compliance_review WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM verification_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM business_onboarding WHERE cac_reg_number = $1`, [cac]);
}

test("openComplianceReview: withAuthorization rejects a non-vetify session", async () => {
  await assert.rejects(() => openComplianceReview(verifierSession(), 1), AuthorizationError);
});

test("openComplianceReview: rejects a non-Approved verification result", async () => {
  const cac = "RC3000001";
  try {
    const onboarding = await fixtureClient.query(
      `INSERT INTO business_onboarding (cac_reg_number, profile, kyc, documents, onboarding_ref, status)
       VALUES ($1, '{}', '{}', '[]', $2, 'Rejected') RETURNING id`,
      [cac, `ONB-${cac}`],
    );
    const verification = await fixtureClient.query(
      `INSERT INTO verification_result
         (business_onboarding_id, cac_reg_number, business_name, checks, risk_score,
          risk_level, outcome, auto_decided, verification_ref, decided_at)
       VALUES ($1, $2, 'Test Co', '{}', 20, 'High', 'Rejected', false, $3, now())
       RETURNING id`,
      [onboarding.rows[0].id, cac, `VER-${cac}`],
    );
    await assert.rejects(
      () => openComplianceReview(vetifySession(), verification.rows[0].id),
      (err: unknown) =>
        err instanceof DomainError &&
        err.message === "Can only open a compliance review from an Approved verification result",
    );
  } finally {
    await cleanup(cac);
  }
});

test("openComplianceReview + startReview: full Pending -> UnderReview happy path", async () => {
  const cac = "RC3000002";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    assert.equal(opened.status, "Pending");

    const started = await startReview(vetifySession(), opened.id);
    assert.equal(started.status, "UnderReview");
  } finally {
    await cleanup(cac);
  }
});

test("startReview: can only start a Pending review", async () => {
  const cac = "RC3000003";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await startReview(vetifySession(), opened.id);
    await assert.rejects(
      () => startReview(vetifySession(), opened.id),
      (err: unknown) => err instanceof DomainError && err.message === "Can only start a Pending review",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approveCompliance: withAuthorization rejects a non-verifier session", async () => {
  await assert.rejects(
    () =>
      approveCompliance(vetifySession(), 1, {
        completedChecks: validChecks,
        riskScore: 90,
        riskLevel: "Low",
        autoDecided: false,
        reviewerParty: "verifier",
      }),
    AuthorizationError,
  );
});

test("approveCompliance: risk score must be consistent with risk level", async () => {
  const cac = "RC3000004";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await startReview(vetifySession(), opened.id);
    await assert.rejects(
      () =>
        approveCompliance(verifierSession(), opened.id, {
          completedChecks: validChecks,
          riskScore: 30, // High-band score
          riskLevel: "Low", // but claims Low
          autoDecided: false,
          reviewerParty: "verifier",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Risk score is inconsistent with risk level",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approveCompliance: requires all four compliance checks to pass", async () => {
  const cac = "RC3000005";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await startReview(vetifySession(), opened.id);
    await assert.rejects(
      () =>
        approveCompliance(verifierSession(), opened.id, {
          completedChecks: { ...validChecks, shariahCompliant: false },
          riskScore: 90,
          riskLevel: "Low",
          autoDecided: false,
          reviewerParty: "verifier",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Cannot approve: Shariah compliance check failed",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approveCompliance: full happy path creates ApprovedBusiness + ComplianceResult and archives the review", async () => {
  const cac = "RC3000006";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await startReview(vetifySession(), opened.id);
    const result = await approveCompliance(verifierSession(), opened.id, {
      completedChecks: validChecks,
      riskScore: 90,
      riskLevel: "Low",
      autoDecided: false,
      reviewerParty: "verifier",
    });
    assert.ok(result.approvedBusinessId);
    assert.ok(result.complianceResultId);

    const { rows: reviewRows } = await fixtureClient.query(
      "SELECT status, archived_at FROM compliance_review WHERE id = $1",
      [opened.id],
    );
    assert.equal(reviewRows[0].status, "Approved");
    assert.ok(reviewRows[0].archived_at);

    const { rows: businessRows } = await fixtureClient.query(
      "SELECT status FROM approved_business WHERE id = $1",
      [result.approvedBusinessId],
    );
    assert.equal(businessRows[0].status, "BusinessActive");
  } finally {
    await cleanup(cac);
  }
});

test("rejectCompliance: rejection reason must not be empty", async () => {
  const cac = "RC3000007";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await startReview(vetifySession(), opened.id);
    await assert.rejects(
      () =>
        rejectCompliance(verifierSession(), opened.id, {
          completedChecks: { shariahCompliant: false, amlCleared: true, kycValidated: true, cddCompleted: true },
          riskScore: 20,
          riskLevel: "High",
          autoDecided: false,
          reviewerParty: "verifier",
          reason: "",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Rejection reason must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("flagComplianceForManualReview: can only flag from UnderReview", async () => {
  const cac = "RC3000008";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    // Still Pending -- startReview was never called.
    await assert.rejects(
      () =>
        flagComplianceForManualReview(vetifySession(), opened.id, {
          riskScore: 60,
          riskLevel: "Medium",
          agentVersion: "test-v1",
          note: "test flag",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only flag from UnderReview",
    );
  } finally {
    await cleanup(cac);
  }
});

test("flagComplianceForManualReview: withAuthorization rejects a non-vetify session", async () => {
  await assert.rejects(
    () =>
      flagComplianceForManualReview(verifierSession(), 1, {
        riskScore: 60,
        riskLevel: "Medium",
        agentVersion: "test-v1",
        note: "test",
      }),
    AuthorizationError,
  );
});
