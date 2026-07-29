// Unit/integration tests for lib/domain/murabahah.ts's fifth-slice additions
// (Ibra, LatePaymentCharity settlement, Default). Builds the fixture chain
// through the real domain functions to an Active MurabahahContract, the
// same way domain-murabahah-stage9-10.test.ts does, then exercises the new
// choices on top of it.
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
  requestIbra,
  grantIbra,
  declineIbra,
  setCharityAmount,
  confirmCharityPayment,
  defaultContract,
  closeDefaultedContract,
} from "@/lib/domain/murabahah";
import type { RiskAssessment } from "@/lib/types-financing";
import type { MurabahahTerms, PaymentScheduleEntry } from "@/lib/types-murabahah";

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
  await fixtureClient.query(`DELETE FROM charity_payment_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM late_payment_charity WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM repayment_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM default_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM ibra_grant_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM ibra_decline_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM ibra_request WHERE cac_reg_number = $1`, [cac]);
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

async function registerOfficer(officerId: string, role: string): Promise<void> {
  await fixtureClient.query(
    `INSERT INTO authorized_officer (officer_id, officer_name, roles, authorized_by, authorized_at, active)
     VALUES ($1, $2, $3, 'Test Setup', now(), true)`,
    [officerId, `Test ${role}`, JSON.stringify([role])],
  );
}

async function registerActiveSentinel(tag: string): Promise<number> {
  const { rows } = await fixtureClient.query(
    `INSERT INTO authorized_sentinel (sentinel, role, authorized_by, authorized_at, active)
     VALUES ('sentinel', 'Portfolio Analyst', $1, now(), true) RETURNING id`,
    [tag],
  );
  return rows[0].id;
}

// ─── requestIbra ────────────────────────────────────────────────────────────

test("requestIbra: rejects on a non-Active contract", async () => {
  const cac = "RC7000001";
  const tag = "TEST-SENTINEL-IBRA-1";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const sentinelId = await registerActiveSentinel(tag);
    await flagDelinquent(sentinelSession(), contractId, { reason: "Missed installment", sentinelId });
    await assert.rejects(
      () => requestIbra(businessSession(cac), contractId, { requestedSettlementDate: "2026-03-01", settlementType: "FullIbra" }),
      (err: unknown) => err instanceof DomainError && err.message === "Ibra' can only be requested on an Active contract",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_sentinel WHERE authorized_by = $1`, [tag]);
  }
});

test("requestIbra: rejects an out-of-range partial settlement amount", async () => {
  const cac = "RC7000002";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () =>
        requestIbra(businessSession(cac), contractId, {
          requestedSettlementDate: "2026-03-01",
          settlementType: "PartialIbra",
          requestedAmount: 999_999,
        }),
      (err: unknown) =>
        err instanceof DomainError && err.message === "Partial settlement amount must be positive and less than outstanding balance",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── grantIbra / declineIbra ────────────────────────────────────────────────

test("grantIbra: fails closed when the proposing officer is not a registered CreditOfficer", async () => {
  const cac = "RC7000003";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const request = await requestIbra(businessSession(cac), contractId, { requestedSettlementDate: "2026-03-01", settlementType: "FullIbra" });
    await assert.rejects(
      () =>
        grantIbra(fiSession(), Number(request.ibraRequestId), {
          rebateAmount: 10_000,
          proposedByOfficerId: "OFF-NONEXISTENT",
          confirmedByOfficerId: "OFF-ALSO-NONEXISTENT",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Officer OFF-NONEXISTENT is not active",
    );
  } finally {
    await cleanup(cac);
  }
});

test("grantIbra: rejects the same officer proposing and confirming (four-eyes)", async () => {
  const cac = "RC7000004";
  const officerId = "OFF-IBRA-SAME";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const request = await requestIbra(businessSession(cac), contractId, { requestedSettlementDate: "2026-03-01", settlementType: "FullIbra" });
    await assert.rejects(
      () =>
        grantIbra(fiSession(), Number(request.ibraRequestId), {
          rebateAmount: 10_000,
          proposedByOfficerId: officerId,
          confirmedByOfficerId: officerId,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Confirming officer must differ from proposing officer (four-eyes)",
    );
  } finally {
    await cleanup(cac);
  }
});

test("grantIbra: happy path -- four-eyes CreditOfficer/RiskOfficer confirmation creates an IbraGrantRecord", async () => {
  const cac = "RC7000005";
  const creditOfficerId = "OFF-CREDIT-1";
  const riskOfficerId = "OFF-RISK-1";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(creditOfficerId, "CreditOfficer");
    await registerOfficer(riskOfficerId, "RiskOfficer");
    const request = await requestIbra(businessSession(cac), contractId, { requestedSettlementDate: "2026-03-01", settlementType: "FullIbra" });

    const grant = await grantIbra(fiSession(), Number(request.ibraRequestId), {
      rebateAmount: 15_000,
      proposedByOfficerId: creditOfficerId,
      confirmedByOfficerId: riskOfficerId,
    });
    assert.ok(grant.ibraGrantRecordId);

    const { rows } = await fixtureClient.query("SELECT rebate_amount FROM ibra_grant_record WHERE id = $1", [grant.ibraGrantRecordId]);
    assert.equal(Number(rows[0].rebate_amount), 15_000);

    const { rows: reqRows } = await fixtureClient.query("SELECT archived_at FROM ibra_request WHERE id = $1", [request.ibraRequestId]);
    assert.ok(reqRows[0].archived_at, "the IbraRequest must be archived once granted");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id IN ($1, $2)`, [creditOfficerId, riskOfficerId]);
  }
});

test("declineIbra: happy path archives the request and records a reason", async () => {
  const cac = "RC7000006";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const request = await requestIbra(businessSession(cac), contractId, { requestedSettlementDate: "2026-03-01", settlementType: "FullIbra" });
    const decline = await declineIbra(fiSession(), Number(request.ibraRequestId), { reason: "Business has sufficient recovery capacity" });
    assert.ok(decline.ibraDeclineRecordId);
    const { rows } = await fixtureClient.query("SELECT archived_at FROM ibra_request WHERE id = $1", [request.ibraRequestId]);
    assert.ok(rows[0].archived_at);
  } finally {
    await cleanup(cac);
  }
});

// ─── setCharityAmount / confirmCharityPayment ──────────────────────────────

test("setCharityAmount + confirmCharityPayment: full happy path settles a late payment charity", async () => {
  const cac = "RC7000007";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    // Late completing payment creates a LatePaymentCharity (mirrors
    // domain-murabahah-stage9-10.test.ts's precedent for this pattern).
    await recordPayment(fiSession(), contractId, { paymentDate: "2026-03-01", amountPaid: 50_000, installmentNo: 1 });
    const completing = await recordPayment(fiSession(), contractId, { paymentDate: "2026-03-15", amountPaid: 100_000, installmentNo: 1 });
    assert.ok(completing.charityObligationId, "the completing payment was late -- a charity obligation must exist");

    await setCharityAmount(fiSession(), Number(completing.charityObligationId), { amount: 2_500 });
    const { rows: afterSet } = await fixtureClient.query("SELECT charity_amount FROM late_payment_charity WHERE id = $1", [
      completing.charityObligationId,
    ]);
    assert.equal(Number(afterSet[0].charity_amount), 2_500);

    const confirmation = await confirmCharityPayment(businessSession(cac), Number(completing.charityObligationId), {
      charityRef: "CHR-2026-001",
      charityOrganization: "Al-Amanah Relief Foundation",
    });
    assert.ok(confirmation.charityPaymentRecordId);

    const { rows: afterConfirm } = await fixtureClient.query("SELECT settled FROM late_payment_charity WHERE id = $1", [
      completing.charityObligationId,
    ]);
    assert.equal(afterConfirm[0].settled, true);
  } finally {
    await cleanup(cac);
  }
});

test("confirmCharityPayment: rejects settlement before the amount is set", async () => {
  const cac = "RC7000008";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await recordPayment(fiSession(), contractId, { paymentDate: "2026-03-01", amountPaid: 50_000, installmentNo: 1 });
    const completing = await recordPayment(fiSession(), contractId, { paymentDate: "2026-03-15", amountPaid: 100_000, installmentNo: 1 });
    await assert.rejects(
      () =>
        confirmCharityPayment(businessSession(cac), Number(completing.charityObligationId), {
          charityRef: "CHR-2026-002",
          charityOrganization: "Test Foundation",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Charity amount must be set before settlement",
    );
  } finally {
    await cleanup(cac);
  }
});

test("setCharityAmount: rejects re-setting an already-settled charity", async () => {
  const cac = "RC7000009";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await recordPayment(fiSession(), contractId, { paymentDate: "2026-03-01", amountPaid: 50_000, installmentNo: 1 });
    const completing = await recordPayment(fiSession(), contractId, { paymentDate: "2026-03-15", amountPaid: 100_000, installmentNo: 1 });
    await setCharityAmount(fiSession(), Number(completing.charityObligationId), { amount: 1_000 });
    await confirmCharityPayment(businessSession(cac), Number(completing.charityObligationId), {
      charityRef: "CHR-2026-003",
      charityOrganization: "Test Foundation",
    });
    await assert.rejects(
      () => setCharityAmount(fiSession(), Number(completing.charityObligationId), { amount: 2_000 }),
      (err: unknown) => err instanceof DomainError && err.message === "Amount already settled",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── defaultContract / closeDefaultedContract ──────────────────────────────

test("defaultContract: rejects an invalid transition (Active contract, not Delinquent)", async () => {
  const cac = "RC7000010";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => defaultContract(fiSession(), contractId, { reason: "Unrecoverable", defaultedBy: "Test Officer" }),
      (err: unknown) => err instanceof DomainError && err.message === "Invalid status transition",
    );
  } finally {
    await cleanup(cac);
  }
});

test("defaultContract + closeDefaultedContract: full write-off and recovery cycle", async () => {
  const cac = "RC7000011";
  const tag = "TEST-SENTINEL-IBRA-2";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const sentinelId = await registerActiveSentinel(tag);
    await flagDelinquent(sentinelSession(), contractId, { reason: "Missed installments", sentinelId });

    const result = await defaultContract(fiSession(), contractId, { reason: "Unrecoverable after collections", defaultedBy: "Test Officer" });
    assert.ok(result.defaultRecordId);
    const { rows: afterDefault } = await fixtureClient.query("SELECT status FROM murabahah_contract WHERE id = $1", [contractId]);
    assert.equal(afterDefault[0].status, "Defaulted");

    // Recovery once Defaulted has no in-scope choice of its own (RecordPayment
    // only accepts Active/Delinquent -- RecoveryPaymentRecord is out of scope
    // for this pass, see the migration header). Directly setting the balance
    // to zero here isolates CloseDefaultedContract's own guard, the same
    // "mutate the fixture to prove the check fires" precedent
    // domain-murabahah.test.ts already uses for its stale-certification test.
    await fixtureClient.query("UPDATE murabahah_contract SET outstanding_balance = 0 WHERE id = $1", [contractId]);

    const closed = await closeDefaultedContract(fiSession(), contractId);
    assert.equal(closed.murabahahContractId, contractId);
    const { rows: afterClose } = await fixtureClient.query("SELECT status FROM murabahah_contract WHERE id = $1", [contractId]);
    assert.equal(afterClose[0].status, "Completed");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_sentinel WHERE authorized_by = $1`, [tag]);
  }
});

test("closeDefaultedContract: rejects a non-zero outstanding balance", async () => {
  const cac = "RC7000012";
  const tag = "TEST-SENTINEL-IBRA-3";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const sentinelId = await registerActiveSentinel(tag);
    await flagDelinquent(sentinelSession(), contractId, { reason: "Missed installments", sentinelId });
    await defaultContract(fiSession(), contractId, { reason: "Unrecoverable", defaultedBy: "Test Officer" });
    await assert.rejects(
      () => closeDefaultedContract(fiSession(), contractId),
      (err: unknown) => err instanceof DomainError && err.message === "Outstanding balance must be zero before closure",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_sentinel WHERE authorized_by = $1`, [tag]);
  }
});
