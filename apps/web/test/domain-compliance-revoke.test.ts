// Unit/integration tests for lib/domain/compliance.ts's Thirty-Fourth Slice
// (Batch E) addition: Revoke on ApprovedBusiness. Builds the fixture chain
// through the real domain functions to a live ApprovedBusiness, the same
// way domain-compliance.test.ts does.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { openComplianceReview, startReview, approveCompliance, revokeBusiness } from "@/lib/domain/compliance";
import { registerReviewer } from "@/lib/domain/governance";

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

async function makeApprovedBusiness(cac: string, reviewerTag: string): Promise<number> {
  const reviewer = await registerReviewer(vetifySession(), { role: "Senior Compliance Officer", authorizedBy: reviewerTag });
  const verificationId = await makeApprovedVerification(cac);
  const opened = await openComplianceReview(vetifySession(), verificationId);
  await startReview(vetifySession(), opened.id);
  const result = await approveCompliance(verifierSession(), opened.id, {
    completedChecks: validChecks,
    riskScore: 90,
    riskLevel: "Low",
    autoDecided: false,
    reviewerParty: "verifier",
    reviewerAuthId: reviewer.id,
  });
  return Number(result.approvedBusinessId);
}

async function cleanup(cac: string) {
  await fixtureClient.query(
    `DELETE FROM revocation_record WHERE approved_business_id IN (SELECT id FROM approved_business WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(`DELETE FROM compliance_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM approved_business WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM compliance_review WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM verification_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM business_onboarding WHERE cac_reg_number = $1`, [cac]);
}

test("revokeBusiness: rejects an empty reason and revokedBy, happy path archives with a RevocationRecord successor", async () => {
  const cac = "RC3100001";
  const tag = "TEST-REVIEWER-REVOKE-1";
  try {
    const approvedBusinessId = await makeApprovedBusiness(cac, tag);

    await assert.rejects(
      () => revokeBusiness(vetifySession(), approvedBusinessId, { reason: "", revokedBy: "Compliance Head" }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );
    await assert.rejects(
      () => revokeBusiness(vetifySession(), approvedBusinessId, { reason: "AML hit confirmed", revokedBy: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "revokedBy must not be empty",
    );

    const result = await revokeBusiness(vetifySession(), approvedBusinessId, {
      reason: "Confirmed sanctions list match post-approval", revokedBy: "Compliance Head",
    });
    assert.ok(result.revocationRecordId);

    const { rows } = await fixtureClient.query(
      "SELECT archived_at, superseded_by_kind, superseded_by_id FROM approved_business WHERE id = $1",
      [approvedBusinessId],
    );
    assert.ok(rows[0].archived_at);
    assert.equal(rows[0].superseded_by_kind, "revocation_record");
    assert.equal(Number(rows[0].superseded_by_id), Number(result.revocationRecordId));

    const { rows: revRow } = await fixtureClient.query("SELECT reason, revoked_by FROM revocation_record WHERE id = $1", [
      result.revocationRecordId,
    ]);
    assert.equal(revRow[0].reason, "Confirmed sanctions list match post-approval");
    assert.equal(revRow[0].revoked_by, "Compliance Head");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_reviewer WHERE authorized_by = $1`, [tag]);
  }
});

test("revokeBusiness: cannot re-exercise on an already-revoked business", async () => {
  const cac = "RC3100002";
  const tag = "TEST-REVIEWER-REVOKE-2";
  try {
    const approvedBusinessId = await makeApprovedBusiness(cac, tag);
    await revokeBusiness(vetifySession(), approvedBusinessId, { reason: "First revocation", revokedBy: "Compliance Head" });

    await assert.rejects(
      () => revokeBusiness(vetifySession(), approvedBusinessId, { reason: "Second attempt", revokedBy: "Compliance Head" }),
      (err: unknown) => err instanceof DomainError && err.message === "ApprovedBusiness is no longer active",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_reviewer WHERE authorized_by = $1`, [tag]);
  }
});
