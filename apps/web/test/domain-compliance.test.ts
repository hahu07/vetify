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
  recordShariahPreCheck,
  supersedeShariahVerdict,
  openEddCase,
  updateEddChecklist,
  closeEddCase,
} from "@/lib/domain/compliance";
import { registerAdvisor, registerReviewer, deauthorizeReviewer } from "@/lib/domain/governance";

function verifierSession(): SessionContext {
  return { userId: 2, username: "test-verifier", displayName: "Test Verifier", partyRole: "verifier", cacRegNumber: null };
}
function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
}
function advisorSession(): SessionContext {
  return { userId: 6, username: "test-advisor", displayName: "Test Advisor", partyRole: "advisor", cacRegNumber: null };
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
        reviewerAuthId: 0,
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
          reviewerAuthId: 0,
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
          reviewerAuthId: 0,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Cannot approve: Shariah compliance check failed",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approveCompliance: fails closed when reviewerAuthId is not a registered active reviewer", async () => {
  const cac = "RC3000006A";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await startReview(vetifySession(), opened.id);
    await assert.rejects(
      () => approveCompliance(verifierSession(), opened.id, {
        completedChecks: validChecks,
        riskScore: 90,
        riskLevel: "Low",
        autoDecided: false,
        reviewerParty: "verifier",
        reviewerAuthId: 999999,
      }),
      (err: unknown) => err instanceof DomainError && err.message === "AuthorizedReviewer not found",
    );
  } finally {
    await cleanup(cac);
  }
});

test("approveCompliance: full happy path creates ApprovedBusiness + ComplianceResult and archives the review", async () => {
  const cac = "RC3000006";
  const tag = "TEST-REVIEWER-3000006";
  try {
    const reviewer = await registerReviewer(vetifySession(), { role: "Senior Compliance Officer", authorizedBy: tag });
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
    await fixtureClient.query(`DELETE FROM authorized_reviewer WHERE authorized_by = $1`, [tag]);
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
          reviewerAuthId: 0,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Rejection reason must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("rejectCompliance: fails closed when reviewerAuthId is not a registered active reviewer", async () => {
  const cac = "RC3000007A";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await startReview(vetifySession(), opened.id);
    await assert.rejects(
      () => rejectCompliance(verifierSession(), opened.id, {
        completedChecks: { shariahCompliant: false, amlCleared: true, kycValidated: true, cddCompleted: true },
        riskScore: 20,
        riskLevel: "High",
        autoDecided: false,
        reviewerParty: "verifier",
        reason: "AML hit confirmed",
        reviewerAuthId: 999999,
      }),
      (err: unknown) => err instanceof DomainError && err.message === "AuthorizedReviewer not found",
    );
  } finally {
    await cleanup(cac);
  }
});

test("rejectCompliance: fails closed when the reviewer has been deauthorized", async () => {
  const cac = "RC3000007B";
  const tag = "TEST-REVIEWER-3000007B";
  try {
    const reviewer = await registerReviewer(vetifySession(), { role: "Compliance Officer", authorizedBy: tag });
    await deauthorizeReviewer(vetifySession(), reviewer.id, { reason: "Left the company" });

    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await startReview(vetifySession(), opened.id);
    await assert.rejects(
      () => rejectCompliance(verifierSession(), opened.id, {
        completedChecks: { shariahCompliant: false, amlCleared: true, kycValidated: true, cddCompleted: true },
        riskScore: 20,
        riskLevel: "High",
        autoDecided: false,
        reviewerParty: "verifier",
        reason: "AML hit confirmed",
        reviewerAuthId: reviewer.id,
      }),
      (err: unknown) => err instanceof DomainError && err.message === "Reviewer is not active",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_reviewer WHERE authorized_by = $1`, [tag]);
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
// ─── RecordShariahPreCheck / SupersedeShariahVerdict (Phase 2, Fifteenth Slice) ──

async function cleanupAdvisor(tag: string) {
  await fixtureClient.query(`DELETE FROM authorized_advisor WHERE authorized_by = $1`, [tag]);
}

const validShariahVerdict = {
  verdict: "COMPLIANT" as const,
  activitiesScreened: ["Retail sale of textiles"],
  aaoifiStandards: ["Std No. 8"],
  rationale: "Retail trade is a permissible-sector activity per the keyword table.",
};

test("recordShariahPreCheck: fails closed when the advisor is not a registered active advisor", async () => {
  const cac = "RC6000001";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await assert.rejects(
      () => recordShariahPreCheck(advisorSession(), opened.id, { verdict: validShariahVerdict, advisorId: 999999 }),
      (err: unknown) => err instanceof DomainError && err.message === "Advisor 999999 not found",
    );
  } finally {
    await cleanup(cac);
  }
});

test("recordShariahPreCheck: only advisor or vetify sessions may call", async () => {
  await assert.rejects(
    () => recordShariahPreCheck(verifierSession(), 1, { verdict: validShariahVerdict, advisorId: 1 }),
    AuthorizationError,
  );
});

test("recordShariahPreCheck: can only record on a Pending review, and only once", async () => {
  const cac = "RC6000002";
  const tag = "TEST-ADVISOR-6000002";
  try {
    const advisor = await registerAdvisor(vetifySession(), { advisor: "Sheikh Test", role: "SSB Member", authorizedBy: tag });
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);

    const recorded = await recordShariahPreCheck(advisorSession(), opened.id, { verdict: validShariahVerdict, advisorId: advisor.id });
    assert.equal(recorded.shariah_verdict, "COMPLIANT");

    await assert.rejects(
      () => recordShariahPreCheck(advisorSession(), opened.id, { verdict: validShariahVerdict, advisorId: advisor.id }),
      (err: unknown) => err instanceof DomainError && err.message === "Shariah pre-check already recorded for this review",
    );

    // Moving off Pending (via startReview) should also block a fresh attempt.
    const cac2 = "RC6000002B";
    const verificationId2 = await makeApprovedVerification(cac2);
    const opened2 = await openComplianceReview(vetifySession(), verificationId2);
    await startReview(vetifySession(), opened2.id);
    await assert.rejects(
      () => recordShariahPreCheck(advisorSession(), opened2.id, { verdict: validShariahVerdict, advisorId: advisor.id }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only record a Shariah pre-check on a Pending review",
    );
    await cleanup(cac2);
  } finally {
    await cleanup(cac);
    await cleanupAdvisor(tag);
  }
});

test("supersedeShariahVerdict: cannot supersede a verdict that was never recorded", async () => {
  const cac = "RC6000003";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await assert.rejects(
      () => supersedeShariahVerdict(vetifySession(), opened.id, {
        correctionRef: "COR-1", newVerdict: validShariahVerdict, reason: "typo fix", correctedBy: "Ops",
      }),
      (err: unknown) => err instanceof DomainError && err.message === "Cannot supersede a Shariah verdict that was never recorded",
    );
  } finally {
    await cleanup(cac);
  }
});

test("supersedeShariahVerdict: only a vetify session may call (advisor cannot correct its own verdict)", async () => {
  await assert.rejects(
    () => supersedeShariahVerdict(advisorSession(), 1, {
      correctionRef: "COR-1", newVerdict: validShariahVerdict, reason: "test", correctedBy: "Ops",
    }),
    AuthorizationError,
  );
});

test("full lifecycle: recordShariahPreCheck -> supersedeShariahVerdict creates a correction record and updates the live verdict", async () => {
  const cac = "RC6000004";
  const tag = "TEST-ADVISOR-6000004";
  try {
    const advisor = await registerAdvisor(vetifySession(), { advisor: "Sheikh Test 2", role: "SSB Member", authorizedBy: tag });
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await recordShariahPreCheck(advisorSession(), opened.id, { verdict: validShariahVerdict, advisorId: advisor.id });

    const correctedVerdict = {
      verdict: "REQUIRES_REVIEW" as const,
      activitiesScreened: ["Retail sale of textiles", "Ancillary consulting services"],
      aaoifiStandards: ["Std No. 8", "Std No. 28"],
      rationale: "Reassessed: ancillary consulting revenue share was not screened in the original pass.",
    };
    const correction = await supersedeShariahVerdict(vetifySession(), opened.id, {
      correctionRef: "COR-2026-001",
      newVerdict: correctedVerdict,
      reason: "Original screening missed a secondary business line",
      correctedBy: "Amina Compliance Lead",
    });
    assert.ok(correction.shariahVerdictCorrectionId);

    const { rows: reviewRows } = await fixtureClient.query(
      "SELECT shariah_verdict, shariah_rationale FROM compliance_review WHERE id = $1",
      [opened.id],
    );
    assert.equal(reviewRows[0].shariah_verdict, "REQUIRES_REVIEW");
    assert.equal(reviewRows[0].shariah_rationale, correctedVerdict.rationale);

    const { rows: correctionRows } = await fixtureClient.query(
      "SELECT original_verdict, corrected_verdict, correction_ref FROM shariah_verdict_correction WHERE id = $1",
      [correction.shariahVerdictCorrectionId],
    );
    assert.equal(correctionRows[0].original_verdict.verdict, "COMPLIANT");
    assert.equal(correctionRows[0].corrected_verdict.verdict, "REQUIRES_REVIEW");
    assert.equal(correctionRows[0].correction_ref, "COR-2026-001");
  } finally {
    // Must run before cleanup(cac) -- shariah_verdict_correction has a FK
    // into compliance_review, which cleanup(cac) deletes.
    await fixtureClient.query(
      `DELETE FROM shariah_verdict_correction WHERE compliance_review_id IN
         (SELECT id FROM compliance_review WHERE cac_reg_number = $1)`,
      [cac],
    );
    await cleanup(cac);
    await cleanupAdvisor(tag);
  }
});

// ─── EDDCase / G14 hard gate (Phase 2, Seventeenth Slice) ──────────────────

async function cleanupEddCase(cac: string) {
  await fixtureClient.query(
    `DELETE FROM edd_case WHERE compliance_review_id IN
       (SELECT id FROM compliance_review WHERE cac_reg_number = $1)`,
    [cac],
  );
}

test("openEddCase: only a vetify session may call", async () => {
  await assert.rejects(
    () => openEddCase(verifierSession(), 1, { triggerReason: "PEP hit" }),
    AuthorizationError,
  );
});

test("openEddCase: trigger reason must not be empty", async () => {
  await assert.rejects(
    () => openEddCase(vetifySession(), 1, { triggerReason: "" }),
    (err: unknown) => err instanceof DomainError && err.message === "Trigger reason must not be empty",
  );
});

test("updateEddChecklist / closeEddCase: cannot close until every checklist item is complete", async () => {
  const cac = "RC7000001";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    const eddCase = await openEddCase(vetifySession(), opened.id, { triggerReason: "PEP hit on director" });
    assert.equal(eddCase.status, "EddOpen");

    await assert.rejects(
      () => closeEddCase(verifierSession(), eddCase.id, { closedBy: "Chidinma Okeke" }),
      (err: unknown) => err instanceof DomainError && err.message === "Source of wealth must be verified before closing",
    );

    await updateEddChecklist(verifierSession(), eddCase.id, { sourceOfWealthVerified: true });
    await assert.rejects(
      () => closeEddCase(verifierSession(), eddCase.id, { closedBy: "Chidinma Okeke" }),
      (err: unknown) => err instanceof DomainError && err.message === "Enhanced media search must be done before closing",
    );

    await updateEddChecklist(verifierSession(), eddCase.id, { enhancedMediaSearchDone: true });
    await assert.rejects(
      () => closeEddCase(verifierSession(), eddCase.id, { closedBy: "Chidinma Okeke" }),
      (err: unknown) => err instanceof DomainError && err.message === "Senior management sign-off is required before closing",
    );

    await updateEddChecklist(verifierSession(), eddCase.id, { seniorManagementSignoff: "Tunde Bakare, Head of Compliance" });
    await assert.rejects(
      () => closeEddCase(verifierSession(), eddCase.id, { closedBy: "Chidinma Okeke" }),
      (err: unknown) => err instanceof DomainError && err.message === "Ongoing monitoring frequency must be set before closing",
    );

    await updateEddChecklist(verifierSession(), eddCase.id, { monitoringFrequency: "quarterly" });
    const closed = await closeEddCase(verifierSession(), eddCase.id, { closedBy: "Chidinma Okeke" });
    assert.equal(closed.status, "EddClosed");

    await assert.rejects(
      () => closeEddCase(verifierSession(), eddCase.id, { closedBy: "Chidinma Okeke" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only close an Open EDD case",
    );
  } finally {
    await cleanupEddCase(cac);
    await cleanup(cac);
  }
});

test("updateEddChecklist: partial updates preserve previously-set fields (None keeps existing value)", async () => {
  const cac = "RC7000002";
  try {
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    const eddCase = await openEddCase(vetifySession(), opened.id, { triggerReason: "PEP hit" });

    await updateEddChecklist(verifierSession(), eddCase.id, { sourceOfWealthVerified: true, sourceOfWealthNote: "Confirmed via bank statements" });
    const afterFirst = await updateEddChecklist(verifierSession(), eddCase.id, { enhancedMediaSearchDone: true });
    // The first update's sourceOfWealthVerified must survive an update that
    // doesn't mention it at all.
    assert.equal(afterFirst.source_of_wealth_verified, true);
    assert.equal(afterFirst.enhanced_media_search_done, true);
  } finally {
    await cleanupEddCase(cac);
    await cleanup(cac);
  }
});

test("approveCompliance: G14 hard gate blocks approval when eddCaseId is Open, allows it when Closed", async () => {
  const cac = "RC7000003";
  const tag = "TEST-REVIEWER-7000003";
  try {
    const reviewer = await registerReviewer(vetifySession(), { role: "Senior Compliance Officer", authorizedBy: tag });
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await startReview(vetifySession(), opened.id);
    const eddCase = await openEddCase(vetifySession(), opened.id, { triggerReason: "PEP hit on director" });

    await assert.rejects(
      () => approveCompliance(verifierSession(), opened.id, {
        completedChecks: validChecks, riskScore: 90, riskLevel: "Low", autoDecided: false,
        reviewerParty: "verifier", reviewerAuthId: reviewer.id, eddCaseId: eddCase.id,
      }),
      (err: unknown) => err instanceof DomainError && err.message === "EDD case must be Closed before approval",
    );

    await updateEddChecklist(verifierSession(), eddCase.id, {
      sourceOfWealthVerified: true, enhancedMediaSearchDone: true,
      seniorManagementSignoff: "Tunde Bakare", monitoringFrequency: "quarterly",
    });
    await closeEddCase(verifierSession(), eddCase.id, { closedBy: "Chidinma Okeke" });

    const result = await approveCompliance(verifierSession(), opened.id, {
      completedChecks: validChecks, riskScore: 90, riskLevel: "Low", autoDecided: false,
      reviewerParty: "verifier", reviewerAuthId: reviewer.id, eddCaseId: eddCase.id,
    });
    assert.ok(result.approvedBusinessId);
  } finally {
    await cleanupEddCase(cac);
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_reviewer WHERE authorized_by = $1`, [tag]);
  }
});

test("approveCompliance: G14 gate rejects an EDD case belonging to a different compliance review", async () => {
  const cac = "RC7000004";
  const cacOther = "RC7000004B";
  const tag = "TEST-REVIEWER-7000004";
  try {
    const reviewer = await registerReviewer(vetifySession(), { role: "Senior Compliance Officer", authorizedBy: tag });
    const verificationId = await makeApprovedVerification(cac);
    const opened = await openComplianceReview(vetifySession(), verificationId);
    await startReview(vetifySession(), opened.id);

    const otherVerificationId = await makeApprovedVerification(cacOther);
    const otherOpened = await openComplianceReview(vetifySession(), otherVerificationId);
    const otherEddCase = await openEddCase(vetifySession(), otherOpened.id, { triggerReason: "PEP hit" });
    await updateEddChecklist(verifierSession(), otherEddCase.id, {
      sourceOfWealthVerified: true, enhancedMediaSearchDone: true,
      seniorManagementSignoff: "Tunde Bakare", monitoringFrequency: "quarterly",
    });
    await closeEddCase(verifierSession(), otherEddCase.id, { closedBy: "Chidinma Okeke" });

    await assert.rejects(
      () => approveCompliance(verifierSession(), opened.id, {
        completedChecks: validChecks, riskScore: 90, riskLevel: "Low", autoDecided: false,
        reviewerParty: "verifier", reviewerAuthId: reviewer.id, eddCaseId: otherEddCase.id,
      }),
      (err: unknown) => err instanceof DomainError && err.message === "EDD case is for a different compliance review",
    );
  } finally {
    await cleanupEddCase(cac);
    await cleanupEddCase(cacOther);
    await cleanup(cac);
    await cleanup(cacOther);
    await fixtureClient.query(`DELETE FROM authorized_reviewer WHERE authorized_by = $1`, [tag]);
  }
});
