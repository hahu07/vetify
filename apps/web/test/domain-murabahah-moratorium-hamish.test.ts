// Unit/integration tests for lib/domain/murabahah.ts's tenth-slice
// additions (GrantMoratorium/EndMoratorium, HamishJiddiyyah's
// create/ReturnDeposit/ForfeitDeposit). See
// migrations/015_murabahah_moratorium_hamish.sql's header for scope. Builds
// the fixture chain through the real domain functions to an Active
// MurabahahContract, the same way domain-murabahah-rahn-collateral.test.ts
// does, then exercises the new choices on top of it. Also covers the
// isPaymentLate fix in recordPaymentImpl (a payment made on or before an
// active moratorium's end date must not be flagged late, even past the
// installment's own due date).
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
  grantMoratorium,
  endMoratorium,
  createHamishJiddiyyah,
  returnDeposit,
  forfeitDeposit,
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
    `DELETE FROM hamish_jiddiyyah WHERE murabahah_contract_id IN (SELECT id FROM murabahah_contract WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM moratorium_record WHERE murabahah_contract_id IN (SELECT id FROM murabahah_contract WHERE cac_reg_number = $1)`,
    [cac],
  );
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

// ─── GrantMoratorium / EndMoratorium ────────────────────────────────────────

test("grantMoratorium: rejects an empty reason", async () => {
  const cac = "RC8400001";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => grantMoratorium(fiSession(), contractId, { moratoriumEnd: "2026-05-01", reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("grantMoratorium: rejects granting a second moratorium while one is already active", async () => {
  const cac = "RC8400002";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await grantMoratorium(fiSession(), contractId, { moratoriumEnd: "2026-05-01", reason: "Business cash flow shortfall" });
    await assert.rejects(
      () => grantMoratorium(fiSession(), contractId, { moratoriumEnd: "2026-06-01", reason: "Again" }),
      (err: unknown) => err instanceof DomainError && err.message === "A moratorium is already active",
    );
  } finally {
    await cleanup(cac);
  }
});

test("grantMoratorium: happy path sets active_moratorium and creates a moratorium_record", async () => {
  const cac = "RC8400003";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const result = await grantMoratorium(fiSession(), contractId, { moratoriumEnd: "2026-05-01", reason: "Business cash flow shortfall" });
    assert.ok(result.moratoriumRecordId);
    // Cast to text in SQL rather than reading the driver's JS Date and
    // calling toISOString() -- pg returns DATE columns as local-midnight JS
    // Date objects, and toISOString() converts to UTC, which can shift the
    // date backward by a day depending on the test runner's timezone.
    const { rows } = await fixtureClient.query("SELECT active_moratorium::text AS active_moratorium FROM murabahah_contract WHERE id = $1", [
      contractId,
    ]);
    assert.equal(rows[0].active_moratorium, "2026-05-01");
  } finally {
    await cleanup(cac);
  }
});

test("endMoratorium: rejects when no moratorium is active, and requires vetify", async () => {
  const cac = "RC8400004";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => endMoratorium(vetifySession(), contractId, { note: "Test" }),
      (err: unknown) => err instanceof DomainError && err.message === "No active moratorium to end",
    );
    await grantMoratorium(fiSession(), contractId, { moratoriumEnd: "2026-05-01", reason: "Cash flow shortfall" });
    await assert.rejects(() => endMoratorium(fiSession(), contractId, { note: "Test" }));
  } finally {
    await cleanup(cac);
  }
});

test("endMoratorium: happy path clears active_moratorium", async () => {
  const cac = "RC8400005";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await grantMoratorium(fiSession(), contractId, { moratoriumEnd: "2026-05-01", reason: "Cash flow shortfall" });
    await endMoratorium(vetifySession(), contractId, { note: "Arrears cleared, ending early" });
    const { rows } = await fixtureClient.query("SELECT active_moratorium FROM murabahah_contract WHERE id = $1", [contractId]);
    assert.equal(rows[0].active_moratorium, null);
  } finally {
    await cleanup(cac);
  }
});

// ─── recordPayment: isPaymentLate honors an active moratorium ─────────────

test("recordPayment: a payment past its due date but on/before the moratorium end date is NOT flagged late", async () => {
  const cac = "RC8400006";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await grantMoratorium(fiSession(), contractId, { moratoriumEnd: "2026-03-15", reason: "Cash flow shortfall" });
    // Installment 1 is due 2026-03-01; paying on 2026-03-10 is past due but
    // still on/before the moratorium's 2026-03-15 end date.
    await recordPayment(fiSession(), contractId, {
      paymentDate: "2026-03-10",
      amountPaid: 150_000,
      installmentNo: 1,
    });
    const { rows } = await fixtureClient.query(
      "SELECT was_late FROM repayment_record WHERE murabahah_contract_id = $1 AND installment_no = 1",
      [contractId],
    );
    assert.equal(rows[0].was_late, false);
  } finally {
    await cleanup(cac);
  }
});

test("recordPayment: a payment past both the due date and the moratorium end date IS flagged late", async () => {
  const cac = "RC8400007";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await grantMoratorium(fiSession(), contractId, { moratoriumEnd: "2026-03-05", reason: "Cash flow shortfall" });
    await recordPayment(fiSession(), contractId, {
      paymentDate: "2026-03-10",
      amountPaid: 150_000,
      installmentNo: 1,
    });
    const { rows } = await fixtureClient.query(
      "SELECT was_late FROM repayment_record WHERE murabahah_contract_id = $1 AND installment_no = 1",
      [contractId],
    );
    assert.equal(rows[0].was_late, true);
  } finally {
    await cleanup(cac);
  }
});

// ─── HamishJiddiyyah: create + ReturnDeposit/ForfeitDeposit ────────────────

const validHamishArgs = {
  depositAmount: 50_000,
  depositRef: "BANKXFER-001",
  depositDate: "2026-01-15",
  returnDeadline: "2026-04-01",
};

test("createHamishJiddiyyah: rejects a non-positive amount and an empty deposit reference", async () => {
  const cac = "RC8400008";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => createHamishJiddiyyah(fiSession(), contractId, { ...validHamishArgs, depositAmount: 0 }),
      (err: unknown) => err instanceof DomainError && err.message === "Deposit amount must be positive",
    );
    await assert.rejects(
      () => createHamishJiddiyyah(fiSession(), contractId, { ...validHamishArgs, depositRef: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Deposit reference must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("createHamishJiddiyyah: happy path creates a Held deposit", async () => {
  const cac = "RC8400009";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const result = await createHamishJiddiyyah(fiSession(), contractId, validHamishArgs);
    const { rows } = await fixtureClient.query("SELECT status FROM hamish_jiddiyyah WHERE id = $1", [result.hamishJiddiyyahId]);
    assert.equal(rows[0].status, "HamishHeld");
  } finally {
    await cleanup(cac);
  }
});

test("returnDeposit: rejects returning a deposit that is not Held", async () => {
  const cac = "RC8400010";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const hamish = await createHamishJiddiyyah(fiSession(), contractId, validHamishArgs);
    await returnDeposit(fiSession(), Number(hamish.hamishJiddiyyahId), { transferRef: "XFER-1" });
    await assert.rejects(
      () => returnDeposit(fiSession(), Number(hamish.hamishJiddiyyahId), { transferRef: "XFER-2" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only return a Held deposit",
    );
  } finally {
    await cleanup(cac);
  }
});

test("forfeitDeposit: rejects an amount exceeding the deposit and a negative amount", async () => {
  const cac = "RC8400011";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const hamish = await createHamishJiddiyyah(fiSession(), contractId, validHamishArgs);
    await assert.rejects(
      () => forfeitDeposit(fiSession(), Number(hamish.hamishJiddiyyahId), { actualLoss: 999_999, reason: "Withdrawal" }),
      (err: unknown) => err instanceof DomainError && err.message === "Forfeited amount cannot exceed deposit",
    );
  } finally {
    await cleanup(cac);
  }
});

test("forfeitDeposit: happy path records the actual loss deducted", async () => {
  const cac = "RC8400012";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const hamish = await createHamishJiddiyyah(fiSession(), contractId, validHamishArgs);
    await forfeitDeposit(fiSession(), Number(hamish.hamishJiddiyyahId), { actualLoss: 20_000, reason: "Business withdrew Wa'd after supplier committed" });
    const { rows } = await fixtureClient.query("SELECT status, actual_loss_deducted FROM hamish_jiddiyyah WHERE id = $1", [
      hamish.hamishJiddiyyahId,
    ]);
    assert.equal(rows[0].status, "HamishForfeited");
    assert.equal(Number(rows[0].actual_loss_deducted), 20_000);
  } finally {
    await cleanup(cac);
  }
});
