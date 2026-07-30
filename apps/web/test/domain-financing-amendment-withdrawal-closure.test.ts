// Unit/integration tests for lib/domain/financing.ts's Thirty-Second Slice
// (Batch C) additions: WithdrawRequest, ExpireRequest, CancelRequest,
// ProposeAmendment + AcceptAmendment/DeclineAmendment, and
// RecordGovernanceAssessment on FinancingDecision.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import {
  requestFinancing,
  beginUnderwriting,
  approveFunding,
  rejectFunding,
  withdrawRequest,
  expireRequest,
  cancelRequest,
  proposeAmendment,
  acceptAmendment,
  declineAmendment,
  recordGovernanceAssessment,
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

const validAssessment: RiskAssessment = {
  score: 90,
  riskCategory: "Low",
  recommendedLimit: 1_000_000,
  recommendation: "Approve",
};

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
  await fixtureClient.query(
    `DELETE FROM funding_governance_record WHERE financing_decision_id IN (SELECT id FROM financing_decision WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM financing_amendment WHERE financing_request_id IN (SELECT id FROM financing_request WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM withdrawal_record WHERE financing_request_id IN (SELECT id FROM financing_request WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM request_closure_record WHERE financing_request_id IN (SELECT id FROM financing_request WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(`DELETE FROM murabahah_wad WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_decision WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM underwriting_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_request WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM approved_business WHERE cac_reg_number = $1`, [cac]);
}

// ─── withdrawRequest ────────────────────────────────────────────────────────

test("withdrawRequest: rejects an empty reason, happy path archives with a WithdrawalRecord successor", async () => {
  const cac = "RC4100001";
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 6 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });

    await assert.rejects(
      () => withdrawRequest(businessSession(cac), Number(request.id), { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Withdrawal reason must not be empty",
    );

    const result = await withdrawRequest(businessSession(cac), Number(request.id), { reason: "Found a better rate elsewhere" });
    assert.ok(result.withdrawalRecordId);

    const { rows: reqRow } = await fixtureClient.query(
      "SELECT archived_at, superseded_by_kind, superseded_by_id FROM financing_request WHERE id = $1",
      [request.id],
    );
    assert.ok(reqRow[0].archived_at);
    assert.equal(reqRow[0].superseded_by_kind, "withdrawal_record");
    assert.equal(Number(reqRow[0].superseded_by_id), Number(result.withdrawalRecordId));
  } finally {
    await cleanup(cac);
  }
});

test("withdrawRequest: can only withdraw a Submitted or Underwriting request", async () => {
  const cac = "RC4100002";
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 6 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    await beginUnderwriting(assessorSession(), Number(request.id), { assessment: validAssessment, autoDecided: false });
    await rejectFunding(fiSession(), Number(request.id), { reason: "Insufficient collateral" });

    await assert.rejects(
      () => withdrawRequest(businessSession(cac), Number(request.id), { reason: "Too late now" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only withdraw a Submitted or Underwriting request",
    );
  } finally {
    await cleanup(cac);
  }
});

test("withdrawRequest: cannot re-exercise on an already-withdrawn request (archived_at set, status column unchanged)", async () => {
  const cac = "RC4100009";
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 6 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    await withdrawRequest(businessSession(cac), Number(request.id), { reason: "First withdrawal" });

    // WithdrawRequest never changes financing_request.status (only archived_at) --
    // a bare status check alone would incorrectly let this succeed twice.
    await assert.rejects(
      () => withdrawRequest(businessSession(cac), Number(request.id), { reason: "Second attempt" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only withdraw a Submitted or Underwriting request",
    );
    await assert.rejects(
      () => cancelRequest(vetifySession(), Number(request.id), { reason: "Should also be blocked" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only cancel a Submitted or Underwriting request",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── expireRequest ──────────────────────────────────────────────────────────

test("expireRequest: rejects when the SLA has not yet elapsed, happy path after backdating expiresAt", async () => {
  const cac = "RC4100003";
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 6 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });

    await assert.rejects(
      () => expireRequest(vetifySession(), Number(request.id), { reason: "SLA elapsed" }),
      (err: unknown) => err instanceof DomainError && err.message === "No SLA expiry configured on this request",
    );

    await fixtureClient.query(`UPDATE financing_request SET expires_at = now() + interval '1 day' WHERE id = $1`, [request.id]);
    await assert.rejects(
      () => expireRequest(vetifySession(), Number(request.id), { reason: "SLA elapsed" }),
      (err: unknown) => err instanceof DomainError && err.message === "Request SLA has not yet elapsed",
    );

    await fixtureClient.query(`UPDATE financing_request SET expires_at = now() - interval '1 day' WHERE id = $1`, [request.id]);
    const result = await expireRequest(vetifySession(), Number(request.id), { reason: "SLA elapsed with no FI decision" });
    assert.ok(result.requestClosureRecordId);

    const { rows } = await fixtureClient.query("SELECT outcome FROM request_closure_record WHERE id = $1", [result.requestClosureRecordId]);
    assert.equal(rows[0].outcome, "Expired");
  } finally {
    await cleanup(cac);
  }
});

// ─── cancelRequest ──────────────────────────────────────────────────────────

test("cancelRequest: rejects an empty reason, happy path creates a Cancelled RequestClosureRecord", async () => {
  const cac = "RC4100004";
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 6 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });

    await assert.rejects(
      () => cancelRequest(vetifySession(), Number(request.id), { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Cancellation reason must not be empty",
    );

    const result = await cancelRequest(vetifySession(), Number(request.id), { reason: "Business insolvency event" });
    const { rows } = await fixtureClient.query("SELECT outcome, reason FROM request_closure_record WHERE id = $1", [result.requestClosureRecordId]);
    assert.equal(rows[0].outcome, "Cancelled");
    assert.equal(rows[0].reason, "Business insolvency event");
  } finally {
    await cleanup(cac);
  }
});

// ─── proposeAmendment / acceptAmendment / declineAmendment ─────────────────

test("proposeAmendment: rejects a non-positive amount and tenure", async () => {
  const cac = "RC4100005";
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 6 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });

    await assert.rejects(
      () =>
        proposeAmendment(fiSession(), Number(request.id), {
          proposedTerms: { amount: 0, purpose: "Inventory", tenureMonths: 6 },
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Proposed amount must be positive",
    );
    await assert.rejects(
      () =>
        proposeAmendment(fiSession(), Number(request.id), {
          proposedTerms: { amount: 600_000, purpose: "Inventory", tenureMonths: 0 },
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Proposed tenure must be positive",
    );
  } finally {
    await cleanup(cac);
  }
});

test("acceptAmendment: happy path updates the FinancingRequest's terms in place and increments amendmentCount", async () => {
  const cac = "RC4100006";
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory purchase", tenureMonths: 6 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    const amendment = await proposeAmendment(fiSession(), Number(request.id), {
      proposedTerms: { amount: 600_000, purpose: "Expanded inventory purchase", tenureMonths: 9 },
      proposalNote: "FI can offer more given strong repayment history",
    });

    const result = await acceptAmendment(businessSession(cac), Number(amendment.financingAmendmentId));
    assert.equal(Number(result.financingRequestId), Number(request.id));

    const { rows: reqRow } = await fixtureClient.query(
      "SELECT terms_amount, terms_purpose, terms_tenure_months, amendment_count, term_history, status, expires_at FROM financing_request WHERE id = $1",
      [request.id],
    );
    assert.equal(Number(reqRow[0].terms_amount), 600_000);
    assert.equal(reqRow[0].terms_purpose, "Expanded inventory purchase");
    assert.equal(reqRow[0].terms_tenure_months, 9);
    assert.equal(reqRow[0].amendment_count, 1);
    assert.equal(reqRow[0].term_history.length, 1);
    assert.equal(reqRow[0].term_history[0].amount, 500_000);
    assert.equal(reqRow[0].status, "Submitted");
    assert.equal(reqRow[0].expires_at, null);

    const { rows: amendRow } = await fixtureClient.query("SELECT status FROM financing_amendment WHERE id = $1", [amendment.financingAmendmentId]);
    assert.equal(amendRow[0].status, "Accepted");

    await assert.rejects(
      () => acceptAmendment(businessSession(cac), Number(amendment.financingAmendmentId)),
      (err: unknown) => err instanceof DomainError && err.message === "FinancingAmendment is not pending",
    );
  } finally {
    await cleanup(cac);
  }
});

test("declineAmendment: rejects an empty reason, happy path leaves the FinancingRequest untouched", async () => {
  const cac = "RC4100007";
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 6 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    const amendment = await proposeAmendment(fiSession(), Number(request.id), {
      proposedTerms: { amount: 600_000, purpose: "Inventory", tenureMonths: 9 },
    });

    await assert.rejects(
      () => declineAmendment(businessSession(cac), Number(amendment.financingAmendmentId), { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );

    const result = await declineAmendment(businessSession(cac), Number(amendment.financingAmendmentId), { reason: "Prefer original terms" });
    assert.equal(Number(result.financingAmendmentId), Number(amendment.financingAmendmentId));

    const { rows: amendRow } = await fixtureClient.query("SELECT status, decline_reason FROM financing_amendment WHERE id = $1", [
      amendment.financingAmendmentId,
    ]);
    assert.equal(amendRow[0].status, "Declined");
    assert.equal(amendRow[0].decline_reason, "Prefer original terms");

    const { rows: reqRow } = await fixtureClient.query("SELECT terms_amount, amendment_count FROM financing_request WHERE id = $1", [request.id]);
    assert.equal(Number(reqRow[0].terms_amount), 500_000);
    assert.equal(reqRow[0].amendment_count, 0);
  } finally {
    await cleanup(cac);
  }
});

// ─── recordGovernanceAssessment ─────────────────────────────────────────────

test("recordGovernanceAssessment: rejects an empty assessor name, happy path creates a FundingGovernanceRecord", async () => {
  const cac = "RC4100008";
  try {
    await makeApprovedBusiness(cac);
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 6 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    await beginUnderwriting(assessorSession(), Number(request.id), { assessment: validAssessment, autoDecided: false });
    const decision = await rejectFunding(fiSession(), Number(request.id), { reason: "DSCR below threshold" });

    await assert.rejects(
      () =>
        recordGovernanceAssessment(fiSession(), Number(decision.financingDecisionId), {
          aiRecommendationFollowed: false, assessedBy: "",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Governance assessor name required",
    );

    const result = await recordGovernanceAssessment(fiSession(), Number(decision.financingDecisionId), {
      aiRecommendationFollowed: false, governanceNote: "AI recommended approval; FI overrode on DSCR", assessedBy: "Credit Committee Chair",
    });
    assert.ok(result.fundingGovernanceRecordId);

    const { rows } = await fixtureClient.query(
      "SELECT decision_outcome, ai_recommendation_followed, assessed_by FROM funding_governance_record WHERE id = $1",
      [result.fundingGovernanceRecordId],
    );
    assert.equal(rows[0].decision_outcome, "FinancingRejected");
    assert.equal(rows[0].ai_recommendation_followed, false);
    assert.equal(rows[0].assessed_by, "Credit Committee Chair");
  } finally {
    await cleanup(cac);
  }
});
