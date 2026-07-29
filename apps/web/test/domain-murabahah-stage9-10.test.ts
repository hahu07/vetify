// Unit/integration tests for lib/domain/murabahah.ts's Stage 9-10 additions
// (Phase 2, third slice -- the repayment lifecycle: RecordPayment,
// FlagDelinquent/ResumeActive, CloseContract). Builds the fixture chain
// through the real domain functions all the way to an Active
// MurabahahContract (Stage 5 -> 8), the same way domain-murabahah.test.ts
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
  recordPayment,
  flagDelinquent,
  resumeActive,
  closeContract,
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
function sentinelSession(): SessionContext {
  return { userId: 7, username: "test-sentinel", displayName: "Test Sentinel", partyRole: "sentinel", cacRegNumber: null };
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

// A round 2-installment schedule (300,000 sale price) so payment-sequencing
// math in these tests stays exact -- Stage 8's 12x45,833.33 schedule from
// domain-murabahah.test.ts leaves a rounding remainder that's irrelevant
// there but would be noise here.
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
  await fixtureClient.query(`DELETE FROM audit_event WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM late_payment_charity WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM repayment_record WHERE cac_reg_number = $1`, [cac]);
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

/** Builds all the way through to a live, Active MurabahahContract id. */
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

async function registerActiveSentinel(tag: string): Promise<number> {
  const { rows } = await fixtureClient.query(
    `INSERT INTO authorized_sentinel (sentinel, role, authorized_by, authorized_at, active)
     VALUES ('sentinel', 'Portfolio Analyst', $1, now(), true) RETURNING id`,
    [tag],
  );
  return rows[0].id;
}

// ─── recordPayment ──────────────────────────────────────────────────────────

test("recordPayment: rejects an out-of-sequence installment number", async () => {
  const cac = "RC6000001";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => recordPayment(fiSession(), contractId, { paymentDate: "2026-03-01", amountPaid: 150_000, installmentNo: 2 }),
      (err: unknown) => err instanceof DomainError && err.message === "Installment number out of sequence",
    );
  } finally {
    await cleanup(cac);
  }
});

test("recordPayment: rejects a payment that exceeds the outstanding balance", async () => {
  const cac = "RC6000002";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => recordPayment(fiSession(), contractId, { paymentDate: "2026-03-01", amountPaid: 999_999, installmentNo: 1 }),
      (err: unknown) => err instanceof DomainError && err.message === "Payment exceeds outstanding balance",
    );
  } finally {
    await cleanup(cac);
  }
});

test("recordPayment: on-time full installment payment advances installmentsPaid and creates a RepaymentRecord", async () => {
  const cac = "RC6000003";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const result = await recordPayment(fiSession(), contractId, {
      paymentDate: "2026-03-01",
      amountPaid: 150_000,
      installmentNo: 1,
    });
    assert.ok(result.repaymentRecordId);
    assert.equal(result.charityObligationId, null);

    const { rows } = await fixtureClient.query(
      "SELECT outstanding_balance, installments_paid, pending_installment_paid, status FROM murabahah_contract WHERE id = $1",
      [contractId],
    );
    assert.equal(Number(rows[0].outstanding_balance), 150_000);
    assert.equal(rows[0].installments_paid, 1);
    assert.equal(Number(rows[0].pending_installment_paid), 0);
    assert.equal(rows[0].status, "Active");

    const { rows: recRows } = await fixtureClient.query(
      "SELECT was_late, amount_paid, remaining_balance FROM repayment_record WHERE id = $1",
      [result.repaymentRecordId],
    );
    assert.equal(recRows[0].was_late, false);
    assert.equal(Number(recRows[0].amount_paid), 150_000);
    assert.equal(Number(recRows[0].remaining_balance), 150_000);
  } finally {
    await cleanup(cac);
  }
});

test("recordPayment: partial payment does not advance installmentsPaid (status preserved)", async () => {
  const cac = "RC6000004";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const result = await recordPayment(fiSession(), contractId, {
      paymentDate: "2026-03-01",
      amountPaid: 50_000,
      installmentNo: 1,
    });
    assert.equal(result.charityObligationId, null);

    const { rows } = await fixtureClient.query(
      "SELECT outstanding_balance, installments_paid, pending_installment_paid FROM murabahah_contract WHERE id = $1",
      [contractId],
    );
    assert.equal(Number(rows[0].outstanding_balance), 250_000);
    assert.equal(rows[0].installments_paid, 0, "installment not yet fully paid");
    assert.equal(Number(rows[0].pending_installment_paid), 50_000);

    // Completing the same installment with a second, later (past-due) partial
    // payment should now advance installmentsPaid and be flagged late+charity.
    const completing = await recordPayment(fiSession(), contractId, {
      paymentDate: "2026-03-15",
      amountPaid: 100_000,
      installmentNo: 1,
    });
    assert.ok(completing.charityObligationId, "the completing payment was late -- Sadaqah obligation must be created");

    const { rows: afterRows } = await fixtureClient.query(
      "SELECT installments_paid, pending_installment_paid FROM murabahah_contract WHERE id = $1",
      [contractId],
    );
    assert.equal(afterRows[0].installments_paid, 1);
    assert.equal(Number(afterRows[0].pending_installment_paid), 0);

    const { rows: charityRows } = await fixtureClient.query(
      "SELECT settled, charity_amount FROM late_payment_charity WHERE id = $1",
      [completing.charityObligationId],
    );
    assert.equal(charityRows[0].settled, false);
    assert.equal(charityRows[0].charity_amount, null);
  } finally {
    await cleanup(cac);
  }
});

test("recordPayment: rejects on an already-Completed contract", async () => {
  const cac = "RC6000005";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await recordPayment(fiSession(), contractId, { paymentDate: "2026-03-01", amountPaid: 150_000, installmentNo: 1 });
    await recordPayment(fiSession(), contractId, { paymentDate: "2026-04-01", amountPaid: 150_000, installmentNo: 2 });
    await closeContract(fiSession(), contractId);
    await assert.rejects(
      () => recordPayment(fiSession(), contractId, { paymentDate: "2026-05-01", amountPaid: 1, installmentNo: 3 }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only record payment on an Active or Delinquent contract",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── flagDelinquent / resumeActive ──────────────────────────────────────────

test("flagDelinquent: fails closed when the sentinel is not registered/active", async () => {
  const cac = "RC6000006";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => flagDelinquent(sentinelSession(), contractId, { reason: "Missed installment", sentinelId: 999999 }),
      (err: unknown) => err instanceof DomainError && err.message === "Sentinel is not active",
    );
  } finally {
    await cleanup(cac);
  }
});

test("flagDelinquent + resumeActive: full Active -> Delinquent -> Active cycle, each creating an AuditEvent", async () => {
  const cac = "RC6000007";
  const tag = "TEST-SENTINEL-STAGE9-1";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const sentinelId = await registerActiveSentinel(tag);

    const flagged = await flagDelinquent(sentinelSession(), contractId, {
      reason: "Two consecutive missed installments",
      sentinelId,
    });
    assert.ok(flagged.auditEventId);
    const { rows: afterFlag } = await fixtureClient.query("SELECT status FROM murabahah_contract WHERE id = $1", [contractId]);
    assert.equal(afterFlag[0].status, "Delinquent");
    const { rows: evtRows } = await fixtureClient.query("SELECT event_type, acted_by FROM audit_event WHERE id = $1", [
      flagged.auditEventId,
    ]);
    assert.equal(evtRows[0].event_type, "DELINQUENCY_FLAGGED");
    assert.equal(evtRows[0].acted_by, "sentinel");

    const resumed = await resumeActive(sentinelSession(), contractId, { note: "Arrears cleared", sentinelId });
    const { rows: afterResume } = await fixtureClient.query("SELECT status FROM murabahah_contract WHERE id = $1", [contractId]);
    assert.equal(afterResume[0].status, "Active");
    const { rows: evt2Rows } = await fixtureClient.query("SELECT event_type FROM audit_event WHERE id = $1", [
      resumed.auditEventId,
    ]);
    assert.equal(evt2Rows[0].event_type, "CONTRACT_RESUMED");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_sentinel WHERE authorized_by = $1`, [tag]);
  }
});

test("flagDelinquent: rejects an invalid status transition (already Delinquent)", async () => {
  const cac = "RC6000008";
  const tag = "TEST-SENTINEL-STAGE9-2";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const sentinelId = await registerActiveSentinel(tag);
    await flagDelinquent(sentinelSession(), contractId, { reason: "Missed installment", sentinelId });
    await assert.rejects(
      () => flagDelinquent(sentinelSession(), contractId, { reason: "Again", sentinelId }),
      (err: unknown) => err instanceof DomainError && err.message === "Invalid status transition",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_sentinel WHERE authorized_by = $1`, [tag]);
  }
});

// ─── closeContract ──────────────────────────────────────────────────────────

test("closeContract: rejects closure while a balance remains outstanding", async () => {
  const cac = "RC6000009";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await recordPayment(fiSession(), contractId, { paymentDate: "2026-03-01", amountPaid: 150_000, installmentNo: 1 });
    await assert.rejects(
      () => closeContract(fiSession(), contractId),
      (err: unknown) => err instanceof DomainError && err.message === "Can only close a fully repaid contract",
    );
  } finally {
    await cleanup(cac);
  }
});

test("closeContract: happy path -- fully repaid contract transitions to Completed", async () => {
  const cac = "RC6000010";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await recordPayment(fiSession(), contractId, { paymentDate: "2026-03-01", amountPaid: 150_000, installmentNo: 1 });
    await recordPayment(fiSession(), contractId, { paymentDate: "2026-04-01", amountPaid: 150_000, installmentNo: 2 });
    await closeContract(fiSession(), contractId);
    const { rows } = await fixtureClient.query("SELECT status, outstanding_balance FROM murabahah_contract WHERE id = $1", [
      contractId,
    ]);
    assert.equal(rows[0].status, "Completed");
    assert.equal(Number(rows[0].outstanding_balance), 0);
  } finally {
    await cleanup(cac);
  }
});
