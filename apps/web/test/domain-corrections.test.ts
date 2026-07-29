// Unit/integration tests for the Twenty-First Slice's three post-hoc
// correction choices (supersedeVerificationResult, supersedeComplianceResult,
// issueUnderwritingCorrection). Each section inserts the minimal parent +
// result-row fixture directly via the superuser fixtureClient (bypassing
// RLS -- this file tests the domain guards, not RLS, already covered by
// test/rls.test.ts) rather than driving the full multi-stage chain, since
// nothing here depends on how the result row came to exist.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { AuthorizationError, DomainError } from "@/lib/errors";
import { supersedeVerificationResult } from "@/lib/domain/onboarding";
import { supersedeComplianceResult } from "@/lib/domain/compliance";
import { issueUnderwritingCorrection } from "@/lib/domain/financing";
import type { RiskAssessment } from "@/lib/types-financing";

function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
}
function verifierSession(): SessionContext {
  return { userId: 2, username: "test-verifier", displayName: "Test Verifier", partyRole: "verifier", cacRegNumber: null };
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

// ─── supersedeVerificationResult ────────────────────────────────────────────

async function makeVerificationResult(cac: string): Promise<number> {
  const onboarding = await fixtureClient.query(
    `INSERT INTO business_onboarding (cac_reg_number, profile, kyc, documents, onboarding_ref, status)
     VALUES ($1, '{}', '{}', '[]', $2, 'Approved') RETURNING id`,
    [cac, `ONB-${cac}`],
  );
  const vr = await fixtureClient.query(
    `INSERT INTO verification_result
       (business_onboarding_id, cac_reg_number, business_name, checks, risk_score,
        risk_level, outcome, auto_decided, verification_ref, decided_at)
     VALUES ($1, $2, 'Test Co', '{}', 90, 'Low', 'Approved', false, $3, now())
     RETURNING id`,
    [onboarding.rows[0].id, cac, `VER-${cac}`],
  );
  return vr.rows[0].id;
}

async function cleanupVerification(cac: string) {
  await fixtureClient.query(`DELETE FROM verification_correction WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM verification_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM business_onboarding WHERE cac_reg_number = $1`, [cac]);
}

test("supersedeVerificationResult: withAuthorization rejects a non-vetify session", async () => {
  await assert.rejects(
    () => supersedeVerificationResult(verifierSession(), 1, { correctionRef: "COR-1", correctedOutcome: "Rejected", reason: "test", correctedBy: "Ops" }),
    AuthorizationError,
  );
});

test("supersedeVerificationResult: correction reason must not be empty", async () => {
  await assert.rejects(
    () => supersedeVerificationResult(vetifySession(), 1, { correctionRef: "COR-1", correctedOutcome: "Rejected", reason: "", correctedBy: "Ops" }),
    (err: unknown) => err instanceof DomainError && err.message === "Correction reason must not be empty",
  );
});

test("supersedeVerificationResult: full happy path archives the result and creates VerificationCorrection", async () => {
  const cac = "RC8000001";
  try {
    const verificationResultId = await makeVerificationResult(cac);
    const correction = await supersedeVerificationResult(vetifySession(), verificationResultId, {
      correctionRef: "COR-2026-001",
      correctedOutcome: "Rejected",
      reason: "Original approval missed a disqualifying AML hit",
      correctedBy: "Amina Compliance Lead",
    });
    assert.ok(correction.verificationCorrectionId);

    const { rows: vr } = await fixtureClient.query("SELECT archived_at FROM verification_result WHERE id = $1", [verificationResultId]);
    assert.ok(vr[0].archived_at);

    const { rows: vc } = await fixtureClient.query(
      "SELECT original_outcome, corrected_outcome, correction_ref FROM verification_correction WHERE id = $1",
      [correction.verificationCorrectionId],
    );
    assert.equal(vc[0].original_outcome, "Approved");
    assert.equal(vc[0].corrected_outcome, "Rejected");
    assert.equal(vc[0].correction_ref, "COR-2026-001");
  } finally {
    await cleanupVerification(cac);
  }
});

// ─── supersedeComplianceResult ──────────────────────────────────────────────

async function makeComplianceResult(cac: string, reviewedBy: string | null): Promise<number> {
  const onboarding = await fixtureClient.query(
    `INSERT INTO business_onboarding (cac_reg_number, profile, kyc, documents, onboarding_ref, status)
     VALUES ($1, '{}', '{}', '[]', $2, 'Approved') RETURNING id`,
    [cac, `ONB-${cac}`],
  );
  const verification = await fixtureClient.query(
    `INSERT INTO verification_result
       (business_onboarding_id, cac_reg_number, business_name, checks, risk_score,
        risk_level, outcome, auto_decided, verification_ref, decided_at)
     VALUES ($1, $2, 'Test Co', '{}', 90, 'Low', 'Approved', false, $3, now())
     RETURNING id`,
    [onboarding.rows[0].id, cac, `VER-${cac}`],
  );
  const review = await fixtureClient.query(
    `INSERT INTO compliance_review
       (verification_result_id, cac_reg_number, business_name, business_sector, business_activity,
        incorporation_date, verification_ref, compliance_ref, status)
     VALUES ($1, $2, 'Test Co', 'Retail Trade', 'Retail sale', '2020-01-01', $3, $4, 'Approved')
     RETURNING id`,
    [verification.rows[0].id, cac, `VER-${cac}`, `COM-${cac}`],
  );
  const cr = await fixtureClient.query(
    `INSERT INTO compliance_result
       (compliance_review_id, cac_reg_number, business_name, verification_ref, compliance_ref,
        outcome, checks, risk_score, risk_level, auto_decided, reviewed_by, decided_at)
     VALUES ($1, $2, 'Test Co', $3, $4, 'Approved', '{}', 90, 'Low', false, $5, now())
     RETURNING id`,
    [review.rows[0].id, cac, `VER-${cac}`, `COM-${cac}`, reviewedBy],
  );
  return cr.rows[0].id;
}

async function cleanupCompliance(cac: string) {
  await fixtureClient.query(`DELETE FROM compliance_correction WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM compliance_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM compliance_review WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM verification_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM business_onboarding WHERE cac_reg_number = $1`, [cac]);
}

test("supersedeComplianceResult: withAuthorization rejects a non-vetify session", async () => {
  await assert.rejects(
    () => supersedeComplianceResult(verifierSession(), 1, { correctionRef: "COR-1", correctedOutcome: "Rejected", reason: "test", correctedBy: "Ops" }),
    AuthorizationError,
  );
});

test("supersedeComplianceResult: corrector cannot be the same as the original human reviewer", async () => {
  const cac = "RC8000002";
  try {
    const complianceResultId = await makeComplianceResult(cac, "Chidinma Okeke");
    await assert.rejects(
      () => supersedeComplianceResult(vetifySession(), complianceResultId, {
        correctionRef: "COR-1", correctedOutcome: "Rejected", reason: "test", correctedBy: "Chidinma Okeke",
      }),
      (err: unknown) => err instanceof DomainError && err.message === "Corrector cannot be the same as the original human reviewer",
    );
  } finally {
    await cleanupCompliance(cac);
  }
});

test("supersedeComplianceResult: full happy path does not archive the original (nonconsuming)", async () => {
  const cac = "RC8000003";
  try {
    const complianceResultId = await makeComplianceResult(cac, "Chidinma Okeke");
    const correction = await supersedeComplianceResult(vetifySession(), complianceResultId, {
      correctionRef: "COR-2026-002",
      correctedOutcome: "Rejected",
      reason: "AML hit confirmed after the fact",
      correctedBy: "Amina Compliance Lead",
    });
    assert.ok(correction.complianceCorrectionId);

    // Nonconsuming -- unlike VerificationResult.Supersede, the original row
    // is neither archived nor otherwise mutated.
    const { rows: cr } = await fixtureClient.query("SELECT outcome FROM compliance_result WHERE id = $1", [complianceResultId]);
    assert.equal(cr[0].outcome, "Approved");

    const { rows: cc } = await fixtureClient.query(
      "SELECT original_outcome, corrected_outcome FROM compliance_correction WHERE id = $1",
      [correction.complianceCorrectionId],
    );
    assert.equal(cc[0].original_outcome, "Approved");
    assert.equal(cc[0].corrected_outcome, "Rejected");
  } finally {
    await cleanupCompliance(cac);
  }
});

// ─── issueUnderwritingCorrection ────────────────────────────────────────────

const validAssessment: RiskAssessment = {
  score: 90,
  riskCategory: "Low",
  recommendedLimit: 1_000_000,
  recommendation: "Approve",
};

async function makeUnderwritingResult(cac: string): Promise<number> {
  const request = await fixtureClient.query(
    `INSERT INTO financing_request
       (cac_reg_number, business_name, terms_amount, terms_purpose, terms_tenure_months,
        financing_ref, business_sector, incorporation_date, status)
     VALUES ($1, 'Test Co', 500000, 'Inventory', 12, $2, 'Retail Trade', '2020-01-01', 'Underwriting')
     RETURNING id`,
    [cac, `FIN-${cac}`],
  );
  const ur = await fixtureClient.query(
    `INSERT INTO underwriting_result
       (financing_request_id, cac_reg_number, business_name, financing_ref,
        assessment_score, assessment_risk_category, assessment_recommended_limit, assessment_recommendation, auto_decided)
     VALUES ($1, $2, 'Test Co', $3, $4, $5, $6, $7, false)
     RETURNING id`,
    [request.rows[0].id, cac, `FIN-${cac}`, validAssessment.score, validAssessment.riskCategory, validAssessment.recommendedLimit, validAssessment.recommendation],
  );
  return ur.rows[0].id;
}

async function cleanupUnderwriting(cac: string) {
  await fixtureClient.query(`DELETE FROM underwriting_correction WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM underwriting_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_request WHERE cac_reg_number = $1`, [cac]);
}

test("issueUnderwritingCorrection: withAuthorization rejects a non-vetify session", async () => {
  await assert.rejects(
    () => issueUnderwritingCorrection(verifierSession(), 1, {
      correctedAssessment: validAssessment, correctionRef: "COR-1", correctedOutcome: "Reject", reason: "test", correctedBy: "Ops",
    }),
    AuthorizationError,
  );
});

test("issueUnderwritingCorrection: correction reference must not be empty", async () => {
  await assert.rejects(
    () => issueUnderwritingCorrection(vetifySession(), 1, {
      correctedAssessment: validAssessment, correctionRef: "", correctedOutcome: "Reject", reason: "test", correctedBy: "Ops",
    }),
    (err: unknown) => err instanceof DomainError && err.message === "Correction reference must not be empty",
  );
});

test("issueUnderwritingCorrection: full happy path preserves the original assessment alongside the corrected one", async () => {
  const cac = "RC8000004";
  try {
    const underwritingResultId = await makeUnderwritingResult(cac);
    const correctedAssessment: RiskAssessment = { ...validAssessment, score: 40, riskCategory: "High", recommendation: "Reject" };
    const correction = await issueUnderwritingCorrection(vetifySession(), underwritingResultId, {
      correctedAssessment,
      correctionRef: "COR-2026-003",
      correctedOutcome: "Reject",
      reason: "Fraud pattern found on re-review, missed by the original scoring pass",
      correctedBy: "Tunde Bakare",
    });
    assert.ok(correction.underwritingCorrectionId);

    const { rows: ur } = await fixtureClient.query("SELECT assessment_score FROM underwriting_result WHERE id = $1", [underwritingResultId]);
    assert.equal(ur[0].assessment_score, 90);

    const { rows: uc } = await fixtureClient.query(
      "SELECT original_assessment, corrected_assessment FROM underwriting_correction WHERE id = $1",
      [correction.underwritingCorrectionId],
    );
    assert.equal(uc[0].original_assessment.score, 90);
    assert.equal(uc[0].corrected_assessment.score, 40);
    assert.equal(uc[0].corrected_assessment.riskCategory, "High");
  } finally {
    await cleanupUnderwriting(cac);
  }
});
