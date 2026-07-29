// Unit/integration tests for lib/domain/murabahah.ts's eighth-slice
// additions (RequestRestructuring/ApproveRestructuring/RejectRestructuring,
// RaiseDispute/EscalateToArbitration/RecordArbitrationOutcome). See
// migrations/013_murabahah_restructuring_disputes.sql's header for scope.
// Builds the fixture chain through the real domain functions to an Active
// MurabahahContract, the same way domain-murabahah-rahn-collateral.test.ts
// does, then exercises the new choices on top of it.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { requestFinancing, beginUnderwriting, approveFunding } from "@/lib/domain/financing";
import {
  proceedDirectly,
  acknowledgeDelivery,
  offerMurabahah,
  certifyShariahTerms,
  acceptProposal,
  requestRestructuring,
  approveRestructuring,
  rejectRestructuring,
  raiseDispute,
  escalateToArbitration,
  recordArbitrationOutcome,
} from "@/lib/domain/murabahah";
import type { RiskAssessment } from "@/lib/types-financing";
import type { MurabahahTerms, PaymentScheduleEntry } from "@/lib/types-murabahah";
import { ensureStage0ApprovalFixtures } from "./stage0-fixtures";

function businessSession(cacRegNumber: string): SessionContext {
  return { userId: 1, username: "test-business", displayName: "Test Business", partyRole: "business", cacRegNumber };
}
function assessorSession(): SessionContext {
  return { userId: 4, username: "test-assessor", displayName: "Test Assessor", partyRole: "assessor", cacRegNumber: null };
}
function fiSession(): SessionContext {
  return { userId: 5, username: "test-fi", displayName: "Test FI", partyRole: "financialInstitution", cacRegNumber: null };
}
function advisorSession(): SessionContext {
  return { userId: 6, username: "test-advisor", displayName: "Test Advisor", partyRole: "advisor", cacRegNumber: null };
}
function vetifySession(): SessionContext {
  return { userId: 2, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
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

const validMurabahahTerms: MurabahahTerms = {
  assetCost: 270_000,
  profitAmount: 30_000,
  salePrice: 300_000,
  installmentAmount: 150_000,
  tenureMonths: 2,
};

function twoInstallmentSchedule(): PaymentScheduleEntry[] {
  return [
    { installmentNo: 1, dueDate: "2026-03-01", dueAmount: 150_000 },
    { installmentNo: 2, dueDate: "2026-04-01", dueAmount: 150_000 },
  ];
}

async function cleanup(cac: string) {
  await fixtureClient.query(
    `DELETE FROM arbitration_request WHERE dispute_record_id IN (SELECT id FROM dispute_record WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(`DELETE FROM dispute_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(
    `DELETE FROM restructuring_rejection_record WHERE restructuring_request_id IN (SELECT id FROM restructuring_request WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(`DELETE FROM restructuring_request WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM murabahah_contract WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM shariah_contract_certification WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM murabahah_proposal WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM asset_purchase_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM murabahah_wad WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_decision WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM underwriting_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_request WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM approved_business WHERE cac_reg_number = $1`, [cac]);
}

async function buildContractFixture(cac: string, facilityRef: string): Promise<number> {
  await fixtureClient.query(
    `INSERT INTO approved_business
       (cac_reg_number, business_name, business_sector, business_activity,
        incorporation_date, verification_ref, compliance_ref, approved_at, status)
     VALUES ($1, 'Test Co', 'Retail Trade', 'Retail sale', '2020-01-01', $2, $3, now(), 'BusinessActive')
     ON CONFLICT (cac_reg_number) WHERE archived_at IS NULL DO NOTHING`,
    [cac, `VER-${cac}`, `COM-${cac}`],
  );
  const request = await requestFinancing(businessSession(cac), {
    terms: { amount: 270_000, purpose: "Purchase of flour", tenureMonths: 2 },
    financingRef: `FIN-${cac}`,
    businessSector: "Retail Trade",
  });
  await beginUnderwriting(assessorSession(), Number(request.id), { assessment: validAssessment, autoDecided: false });
  const approval = await approveFunding(fiSession(), Number(request.id), {
    assetDetails: { description: "Flour", supplier: "Golden Mills", supplierRef: "PO-1", estimatedCost: 270_000 },
    approvedProviderId: stage0.approvedProviderId,
    approvingOfficerId: stage0.approvingOfficerId,
  });
  const purchase = await proceedDirectly(fiSession(), Number(approval.murabahahWadId), {
    actualCost: 270_000,
    purchaseDate: "2026-01-01",
    invoiceRef: "INV-1",
  });
  await acknowledgeDelivery(businessSession(cac), Number(purchase.assetPurchaseRecordId));
  const proposal = await offerMurabahah(fiSession(), Number(purchase.assetPurchaseRecordId), {
    murabahahTerms: validMurabahahTerms,
    paymentSchedule: twoInstallmentSchedule(),
    facilityRef,
    startDate: "2026-02-01",
  });
  const cert = await certifyShariahTerms(advisorSession(), Number(proposal.murabahahProposalId), {
    certificationRef: `CERT-${cac}`,
    aaoifiStandards: ["Std No. 8"],
    rationale: "Compliant",
    certifiedBy: "Sheikh Test",
  });
  const contract = await acceptProposal(businessSession(cac), Number(proposal.murabahahProposalId), {
    certificationId: Number(cert.shariahContractCertificationId),
  });
  return Number(contract.murabahahContractId);
}

function newSchedule(): PaymentScheduleEntry[] {
  return [
    { installmentNo: 1, dueDate: "2026-05-01", dueAmount: 100_000 },
    { installmentNo: 2, dueDate: "2026-06-01", dueAmount: 100_000 },
    { installmentNo: 3, dueDate: "2026-07-01", dueAmount: 100_000 },
  ];
}

// ─── requestRestructuring ───────────────────────────────────────────────────

test("requestRestructuring: rejects an empty reason and a schedule exceeding the outstanding balance", async () => {
  const cac = "RC8200001";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => requestRestructuring(businessSession(cac), contractId, { proposedSchedule: newSchedule(), reason: "", requestDate: "2026-03-01" }),
      (err: unknown) => err instanceof DomainError && err.message === "Restructuring reason must not be empty",
    );
    await assert.rejects(
      () =>
        requestRestructuring(businessSession(cac), contractId, {
          proposedSchedule: [{ installmentNo: 1, dueDate: "2026-05-01", dueAmount: 999_999_999 }],
          reason: "Cash flow difficulty",
          requestDate: "2026-03-01",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "New schedule total cannot exceed outstanding balance (no debt increase)",
    );
  } finally {
    await cleanup(cac);
  }
});

test("requestRestructuring: happy path creates a restructuring_request row", async () => {
  const cac = "RC8200002";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const result = await requestRestructuring(businessSession(cac), contractId, {
      proposedSchedule: newSchedule(),
      reason: "Cash flow difficulty",
      requestDate: "2026-03-01",
    });
    assert.ok(result.restructuringRequestId);
    const { rows } = await fixtureClient.query("SELECT reason, archived_at FROM restructuring_request WHERE id = $1", [
      result.restructuringRequestId,
    ]);
    assert.equal(rows[0].reason, "Cash flow difficulty");
    assert.equal(rows[0].archived_at, null);
  } finally {
    await cleanup(cac);
  }
});

// ─── approveRestructuring ───────────────────────────────────────────────────

test("approveRestructuring: happy path updates murabahah_contract's schedule and counters", async () => {
  const cac = "RC8200003";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const request = await requestRestructuring(businessSession(cac), contractId, {
      proposedSchedule: newSchedule(),
      reason: "Cash flow difficulty",
      requestDate: "2026-03-01",
    });
    const result = await approveRestructuring(fiSession(), Number(request.restructuringRequestId), { approvedSchedule: newSchedule() });
    assert.equal(Number(result.murabahahContractId), contractId);

    const { rows } = await fixtureClient.query(
      "SELECT payment_schedule, pending_installment_paid, schedule_version, restructuring_count FROM murabahah_contract WHERE id = $1",
      [contractId],
    );
    assert.equal(rows[0].payment_schedule.length, 3);
    assert.equal(Number(rows[0].pending_installment_paid), 0);
    assert.equal(rows[0].schedule_version, 2);
    assert.equal(rows[0].restructuring_count, 1);

    const { rows: reqRows } = await fixtureClient.query("SELECT archived_at FROM restructuring_request WHERE id = $1", [
      request.restructuringRequestId,
    ]);
    assert.ok(reqRows[0].archived_at);
  } finally {
    await cleanup(cac);
  }
});

test("approveRestructuring: rejects an already-archived request", async () => {
  const cac = "RC8200004";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const request = await requestRestructuring(businessSession(cac), contractId, {
      proposedSchedule: newSchedule(),
      reason: "Cash flow difficulty",
      requestDate: "2026-03-01",
    });
    await approveRestructuring(fiSession(), Number(request.restructuringRequestId), { approvedSchedule: newSchedule() });
    await assert.rejects(
      () => approveRestructuring(fiSession(), Number(request.restructuringRequestId), { approvedSchedule: newSchedule() }),
      (err: unknown) => err instanceof DomainError && err.message === "RestructuringRequest is no longer active",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── rejectRestructuring ────────────────────────────────────────────────────

test("rejectRestructuring: rejects an empty reason", async () => {
  const cac = "RC8200005";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const request = await requestRestructuring(businessSession(cac), contractId, {
      proposedSchedule: newSchedule(),
      reason: "Cash flow difficulty",
      requestDate: "2026-03-01",
    });
    await assert.rejects(
      () => rejectRestructuring(fiSession(), Number(request.restructuringRequestId), { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Rejection reason must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("rejectRestructuring: happy path creates a rejection record and archives the request", async () => {
  const cac = "RC8200006";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const request = await requestRestructuring(businessSession(cac), contractId, {
      proposedSchedule: newSchedule(),
      reason: "Cash flow difficulty",
      requestDate: "2026-03-01",
    });
    const result = await rejectRestructuring(fiSession(), Number(request.restructuringRequestId), { reason: "Insufficient justification" });
    assert.ok(result.restructuringRejectionRecordId);

    const { rows } = await fixtureClient.query("SELECT archived_at, superseded_by_kind FROM restructuring_request WHERE id = $1", [
      request.restructuringRequestId,
    ]);
    assert.ok(rows[0].archived_at);
    assert.equal(rows[0].superseded_by_kind, "restructuring_rejection_record");
  } finally {
    await cleanup(cac);
  }
});

// ─── raiseDispute / escalateToArbitration / recordArbitrationOutcome ───────

test("raiseDispute: rejects an empty description", async () => {
  const cac = "RC8200007";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => raiseDispute(businessSession(cac), contractId, { disputeType: "PaymentDispute", disputeDesc: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Dispute description must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("escalateToArbitration: rejects an arbitrator matching the business's own name", async () => {
  const cac = "RC8200008";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const dispute = await raiseDispute(businessSession(cac), contractId, {
      disputeType: "PaymentDispute",
      disputeDesc: "Disagreement over a recorded payment amount",
    });
    await assert.rejects(
      () => escalateToArbitration(vetifySession(), Number(dispute.disputeRecordId), { arbitrator: "Test Co" }),
      (err: unknown) => err instanceof DomainError && err.message === "Arbitrator must differ from the parties",
    );
  } finally {
    await cleanup(cac);
  }
});

test("escalateToArbitration + recordArbitrationOutcome: full happy path", async () => {
  const cac = "RC8200009";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const dispute = await raiseDispute(businessSession(cac), contractId, {
      disputeType: "ContractTermsDispute",
      disputeDesc: "Disagreement over the profit rate applied",
    });
    const arbitration = await escalateToArbitration(vetifySession(), Number(dispute.disputeRecordId), { arbitrator: "Lagos Chamber of Commerce Arbitration Centre" });
    assert.ok(arbitration.arbitrationRequestId);

    const { rows: disputeRows } = await fixtureClient.query("SELECT archived_at, superseded_by_kind FROM dispute_record WHERE id = $1", [
      dispute.disputeRecordId,
    ]);
    assert.ok(disputeRows[0].archived_at);
    assert.equal(disputeRows[0].superseded_by_kind, "arbitration_request");

    const result = await recordArbitrationOutcome(vetifySession(), Number(arbitration.arbitrationRequestId), {
      arbOutcome: "SettlementAgreed",
      arbResolution: "Parties agreed to a reduced profit rate going forward",
    });
    assert.equal(Number(result.arbitrationRequestId), Number(arbitration.arbitrationRequestId));

    const { rows: arbRows } = await fixtureClient.query("SELECT outcome, resolution FROM arbitration_request WHERE id = $1", [
      arbitration.arbitrationRequestId,
    ]);
    assert.equal(arbRows[0].outcome, "SettlementAgreed");

    await assert.rejects(
      () =>
        recordArbitrationOutcome(vetifySession(), Number(arbitration.arbitrationRequestId), {
          arbOutcome: "FIPrevails",
          arbResolution: "Second attempt",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Arbitration is already concluded",
    );
  } finally {
    await cleanup(cac);
  }
});
