// Unit/integration tests for lib/domain/financing.ts's Thirty-Fifth Slice
// addition: UnderwritingPolicy (create + UpdatePolicy), and its wiring into
// BeginUnderwriting/FlagUnderwritingForManualReview's gates. A vetify-wide
// singleton (see migrations/036's header) -- every test creates its own
// policy row and deletes it in `finally`, since --test-concurrency=1 means
// other test files run before/after this one, not concurrently with it, but
// an un-cleaned-up policy row would still leak into whichever file runs next.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import {
  requestFinancing,
  beginUnderwriting,
  flagUnderwritingForManualReview,
  createUnderwritingPolicy,
  updateUnderwritingPolicy,
} from "@/lib/domain/financing";
import type { RiskAssessment } from "@/lib/types-financing";

function businessSession(cacRegNumber: string): SessionContext {
  return { userId: 1, username: "test-business", displayName: "Test Business", partyRole: "business", cacRegNumber };
}
function assessorSession(): SessionContext {
  return { userId: 4, username: "test-assessor", displayName: "Test Assessor", partyRole: "assessor", cacRegNumber: null };
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

const validAssessment: RiskAssessment = {
  score: 90,
  riskCategory: "Low",
  recommendedLimit: 1_000_000,
  recommendation: "Approve",
};

const validScoringWeights = { dscrHigh: 40, dscrMedium: 20, dscrLow: 0 };

function validPolicyArgs(overrides: Record<string, unknown> = {}) {
  return {
    policyVersion: "UWP-2026-TEST-1",
    autoApproveMin: 80,
    autoRejectMax: 30,
    requestSlaHours: 48,
    offerValidityDays: 14,
    effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
    scoringWeights: validScoringWeights,
    ...overrides,
  };
}

async function makeApprovedBusiness(cac: string) {
  await fixtureClient.query(
    `INSERT INTO approved_business
       (cac_reg_number, business_name, business_sector, business_activity,
        incorporation_date, verification_ref, compliance_ref, approved_at, status)
     VALUES ($1, 'Test Co', 'Retail Trade', 'Retail sale', '2020-01-01', $2, $3, now(), 'BusinessActive')`,
    [cac, `VER-${cac}`, `COM-${cac}`],
  );
}

async function cleanup(cac: string) {
  await fixtureClient.query(`DELETE FROM underwriting_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_request WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM approved_business WHERE cac_reg_number = $1`, [cac]);
}

async function cleanupPolicy(policyId: number) {
  await fixtureClient.query(`DELETE FROM underwriting_policy WHERE id = $1`, [policyId]);
}

// ─── createUnderwritingPolicy / updateUnderwritingPolicy ───────────────────

test("createUnderwritingPolicy: rejects autoApproveMin <= autoRejectMax, non-positive SLA hours, and inverted loan-amount bounds", async () => {
  await assert.rejects(
    () => createUnderwritingPolicy(vetifySession(), validPolicyArgs({ autoApproveMin: 30, autoRejectMax: 30 })),
    (err: unknown) => err instanceof DomainError && err.message === "autoApproveMin must exceed autoRejectMax",
  );
  await assert.rejects(
    () => createUnderwritingPolicy(vetifySession(), validPolicyArgs({ requestSlaHours: 0 })),
    (err: unknown) => err instanceof DomainError && err.message === "requestSlaHours must be positive",
  );
  await assert.rejects(
    () => createUnderwritingPolicy(vetifySession(), validPolicyArgs({ minLoanAmount: 500_000, maxLoanAmount: 100_000 })),
    (err: unknown) => err instanceof DomainError && err.message === "minLoanAmount must not exceed maxLoanAmount",
  );
});

test("createUnderwritingPolicy + updateUnderwritingPolicy: happy path", async () => {
  const created = await createUnderwritingPolicy(vetifySession(), validPolicyArgs());
  try {
    assert.ok(created.underwritingPolicyId);

    await assert.rejects(
      () => updateUnderwritingPolicy(vetifySession(), 999_999, validPolicyArgs()),
      (err: unknown) => err instanceof DomainError && err.message === "UnderwritingPolicy not found",
    );

    const updated = await updateUnderwritingPolicy(
      vetifySession(),
      Number(created.underwritingPolicyId),
      validPolicyArgs({ policyVersion: "UWP-2026-TEST-2", autoApproveMin: 85 }),
    );
    assert.equal(Number(updated.underwritingPolicyId), Number(created.underwritingPolicyId));

    const { rows } = await fixtureClient.query("SELECT policy_version, auto_approve_min FROM underwriting_policy WHERE id = $1", [
      created.underwritingPolicyId,
    ]);
    assert.equal(rows[0].policy_version, "UWP-2026-TEST-2");
    assert.equal(rows[0].auto_approve_min, 85);
  } finally {
    await cleanupPolicy(Number(created.underwritingPolicyId));
  }
});

// ─── BeginUnderwriting policy gate ──────────────────────────────────────────

test("beginUnderwriting: with no active policy, behaves exactly as before this slice (no snapshot, no expiry)", async () => {
  const cac = "RC4200001";
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    await beginUnderwriting(assessorSession(), Number(request.id), { assessment: validAssessment, autoDecided: false });

    const { rows: reqRow } = await fixtureClient.query("SELECT expires_at FROM financing_request WHERE id = $1", [request.id]);
    assert.equal(reqRow[0].expires_at, null);
  } finally {
    await cleanup(cac);
  }
});

test("beginUnderwriting: auto-decided score below the policy's autoApproveMin floor is rejected", async () => {
  const cac = "RC4200002";
  const policy = await createUnderwritingPolicy(vetifySession(), validPolicyArgs());
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    await assert.rejects(
      () =>
        beginUnderwriting(assessorSession(), Number(request.id), {
          assessment: { ...validAssessment, score: 75 }, autoDecided: true,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Agent auto-decision requires score >= 80",
    );
  } finally {
    await cleanup(cac);
    await cleanupPolicy(Number(policy.underwritingPolicyId));
  }
});

test("beginUnderwriting: requested amount exceeding the policy's maxLoanAmount is rejected", async () => {
  const cac = "RC4200003";
  const policy = await createUnderwritingPolicy(vetifySession(), validPolicyArgs({ maxLoanAmount: 300_000 }));
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    await assert.rejects(
      () => beginUnderwriting(assessorSession(), Number(request.id), { assessment: validAssessment, autoDecided: false }),
      (err: unknown) => err instanceof DomainError && err.message === "Requested amount exceeds policy maximum loan amount",
    );
  } finally {
    await cleanup(cac);
    await cleanupPolicy(Number(policy.underwritingPolicyId));
  }
});

test("beginUnderwriting: requested amount below the policy's minLoanAmount is rejected", async () => {
  const cac = "RC4200004";
  const policy = await createUnderwritingPolicy(vetifySession(), validPolicyArgs({ minLoanAmount: 600_000 }));
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    await assert.rejects(
      () => beginUnderwriting(assessorSession(), Number(request.id), { assessment: validAssessment, autoDecided: false }),
      (err: unknown) => err instanceof DomainError && err.message === "Requested amount is below policy minimum loan amount",
    );
  } finally {
    await cleanup(cac);
    await cleanupPolicy(Number(policy.underwritingPolicyId));
  }
});

test("beginUnderwriting: a business sector outside permittedSectors is rejected", async () => {
  const cac = "RC4200005";
  const policy = await createUnderwritingPolicy(vetifySession(), validPolicyArgs({ permittedSectors: ["Manufacturing"] }));
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    await assert.rejects(
      () => beginUnderwriting(assessorSession(), Number(request.id), { assessment: validAssessment, autoDecided: false }),
      (err: unknown) => err instanceof DomainError && err.message === "Business sector is not permitted under this institution's lending policy",
    );
  } finally {
    await cleanup(cac);
    await cleanupPolicy(Number(policy.underwritingPolicyId));
  }
});

test("beginUnderwriting: happy path with an active policy captures a snapshot and computes the SLA expiry", async () => {
  const cac = "RC4200006";
  const policy = await createUnderwritingPolicy(vetifySession(), validPolicyArgs({ requestSlaHours: 24 }));
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    const result = await beginUnderwriting(assessorSession(), Number(request.id), { assessment: validAssessment, autoDecided: false });

    const { rows: resultRow } = await fixtureClient.query(
      "SELECT policy_snapshot, valid_until FROM underwriting_result WHERE id = $1",
      [result.underwritingResultId],
    );
    assert.ok(resultRow[0].policy_snapshot);
    assert.equal(resultRow[0].policy_snapshot.policyVersion, "UWP-2026-TEST-1");
    assert.ok(resultRow[0].valid_until);

    const { rows: reqRow } = await fixtureClient.query("SELECT expires_at FROM financing_request WHERE id = $1", [request.id]);
    const expiresAt = new Date(reqRow[0].expires_at).getTime();
    const expectedApprox = Date.now() + 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(expiresAt - expectedApprox) < 60_000, "expiresAt should be ~24h from now");
  } finally {
    await cleanup(cac);
    await cleanupPolicy(Number(policy.underwritingPolicyId));
  }
});

// ─── FlagUnderwritingForManualReview policy gate ───────────────────────────

test("flagUnderwritingForManualReview: a risk score outside the policy's Medium band is rejected", async () => {
  const cac = "RC4200007";
  const policy = await createUnderwritingPolicy(vetifySession(), validPolicyArgs({ autoApproveMin: 80, autoRejectMax: 40 }));
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    await assert.rejects(
      () =>
        flagUnderwritingForManualReview(vetifySession(), Number(request.id), {
          riskScore: 85, riskLevel: "Low", agentVersion: "v1", note: "Should be rejected -- above autoApproveMin",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Risk score is outside the Medium band for this institution's policy",
    );

    const flagged = await flagUnderwritingForManualReview(vetifySession(), Number(request.id), {
      riskScore: 60, riskLevel: "Medium", agentVersion: "v1", note: "Within the Medium band",
    });
    assert.equal(flagged.status, "UnderwritingManualReview");
  } finally {
    await cleanup(cac);
    await cleanupPolicy(Number(policy.underwritingPolicyId));
  }
});
