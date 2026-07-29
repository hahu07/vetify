// Unit/integration tests for lib/domain/murabahah.ts's ninth-slice
// additions (Collections: DirectDebitMandate lifecycle,
// DirectDebitCollectionAttempt logging, RecordRecoveryPayment, and
// GSMInvocation/RecordGSMSweep/CancelGSM). See
// migrations/014_murabahah_collections.sql's header for scope. Builds the
// fixture chain through the real domain functions to an Active
// MurabahahContract (the same way domain-murabahah-rahn-collateral.test.ts
// does), and for the GSM/recovery tests, on through Delinquent to Defaulted
// via flagDelinquent/defaultContract (mirrors
// domain-murabahah-ibra-charity-default.test.ts's registerActiveSentinel
// pattern).
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
  flagDelinquent,
  defaultContract,
  createDirectDebitMandate,
  suspendMandate,
  reinstateMandate,
  cancelMandate,
  recordCollectionAttempt,
  recordRecoveryPayment,
  createGsmInvocation,
  recordGsmSweep,
  cancelGsm,
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
  return { userId: 8, username: "test-sentinel", displayName: "Test Sentinel", partyRole: "sentinel", cacRegNumber: null };
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
  await fixtureClient.query(
    `DELETE FROM gsm_invocation WHERE murabahah_contract_id IN (SELECT id FROM murabahah_contract WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM recovery_payment_record WHERE murabahah_contract_id IN (SELECT id FROM murabahah_contract WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM direct_debit_collection_attempt WHERE murabahah_contract_id IN (SELECT id FROM murabahah_contract WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM direct_debit_mandate WHERE murabahah_contract_id IN (SELECT id FROM murabahah_contract WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(`DELETE FROM default_record WHERE cac_reg_number = $1`, [cac]);
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

async function buildDefaultedContractFixture(cac: string, facilityRef: string, tag: string): Promise<number> {
  const contractId = await buildContractFixture(cac, facilityRef);
  const sentinelId = await registerActiveSentinel(tag);
  await flagDelinquent(sentinelSession(), contractId, { reason: "Missed installments", sentinelId });
  await defaultContract(fiSession(), contractId, { reason: "No response to demand notice", defaultedBy: "Recovery Officer Test" });
  return contractId;
}

const validMandateArgs = {
  monoMandateRef: "MONO-DDM-001",
  accountRef: "0123456789",
  bankName: "First Halal Bank",
  maxCollectionAmount: 150_000,
  mandateStartDate: "2026-02-01",
  gsmConsentGiven: true,
};

// ─── DirectDebitMandate: create + Suspend/Reinstate/Cancel ────────────────

test("createDirectDebitMandate: rejects an empty mandate reference and a non-positive max collection amount", async () => {
  const cac = "RC8300001";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => createDirectDebitMandate(fiSession(), contractId, { ...validMandateArgs, monoMandateRef: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Mandate reference must not be empty",
    );
    await assert.rejects(
      () => createDirectDebitMandate(fiSession(), contractId, { ...validMandateArgs, maxCollectionAmount: 0 }),
      (err: unknown) => err instanceof DomainError && err.message === "Max collection amount must be positive",
    );
  } finally {
    await cleanup(cac);
  }
});

test("createDirectDebitMandate: happy path creates an Active mandate", async () => {
  const cac = "RC8300002";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const result = await createDirectDebitMandate(fiSession(), contractId, validMandateArgs);
    assert.ok(result.directDebitMandateId);
    const { rows } = await fixtureClient.query("SELECT status, gsm_consent_given FROM direct_debit_mandate WHERE id = $1", [
      result.directDebitMandateId,
    ]);
    assert.equal(rows[0].status, "MandateActive");
    assert.equal(rows[0].gsm_consent_given, true);
  } finally {
    await cleanup(cac);
  }
});

test("suspendMandate/reinstateMandate: happy path round-trip", async () => {
  const cac = "RC8300003";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const mandate = await createDirectDebitMandate(fiSession(), contractId, validMandateArgs);
    await suspendMandate(fiSession(), Number(mandate.directDebitMandateId), { reason: "Business requested pause" });
    const { rows: suspended } = await fixtureClient.query("SELECT status FROM direct_debit_mandate WHERE id = $1", [
      mandate.directDebitMandateId,
    ]);
    assert.equal(suspended[0].status, "MandateSuspended");

    await assert.rejects(
      () => suspendMandate(fiSession(), Number(mandate.directDebitMandateId), { reason: "Again" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only suspend an Active mandate",
    );

    await reinstateMandate(fiSession(), Number(mandate.directDebitMandateId));
    const { rows: reinstated } = await fixtureClient.query("SELECT status FROM direct_debit_mandate WHERE id = $1", [
      mandate.directDebitMandateId,
    ]);
    assert.equal(reinstated[0].status, "MandateActive");
  } finally {
    await cleanup(cac);
  }
});

test("cancelMandate: rejects an empty reason and otherwise cancels regardless of prior status", async () => {
  const cac = "RC8300004";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const mandate = await createDirectDebitMandate(fiSession(), contractId, validMandateArgs);
    await assert.rejects(
      () => cancelMandate(fiSession(), Number(mandate.directDebitMandateId), { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );
    await cancelMandate(fiSession(), Number(mandate.directDebitMandateId), { reason: "Facility closed" });
    const { rows } = await fixtureClient.query("SELECT status FROM direct_debit_mandate WHERE id = $1", [mandate.directDebitMandateId]);
    assert.equal(rows[0].status, "MandateCancelled");
  } finally {
    await cleanup(cac);
  }
});

// ─── recordCollectionAttempt (immutable) ──────────────────────────────────

test("recordCollectionAttempt: rejects an empty mono.co reference and a non-positive amount", async () => {
  const cac = "RC8300005";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () =>
        recordCollectionAttempt(fiSession(), contractId, {
          monoCollectionRef: "",
          installmentNo: 1,
          attemptedAmount: 150_000,
          attemptDate: "2026-03-01",
          succeeded: true,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "mono.co collection reference must not be empty",
    );
    await assert.rejects(
      () =>
        recordCollectionAttempt(fiSession(), contractId, {
          monoCollectionRef: "MONO-COL-1",
          installmentNo: 1,
          attemptedAmount: 0,
          attemptDate: "2026-03-01",
          succeeded: true,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Attempted amount must be positive",
    );
  } finally {
    await cleanup(cac);
  }
});

test("recordCollectionAttempt: happy path records a failed attempt with a failure reason", async () => {
  const cac = "RC8300006";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const result = await recordCollectionAttempt(fiSession(), contractId, {
      monoCollectionRef: "MONO-COL-2",
      installmentNo: 1,
      attemptedAmount: 150_000,
      attemptDate: "2026-03-01",
      succeeded: false,
      failureReason: "INSUFFICIENT_FUNDS",
    });
    const { rows } = await fixtureClient.query("SELECT succeeded, failure_reason FROM direct_debit_collection_attempt WHERE id = $1", [
      result.directDebitCollectionAttemptId,
    ]);
    assert.equal(rows[0].succeeded, false);
    assert.equal(rows[0].failure_reason, "INSUFFICIENT_FUNDS");
  } finally {
    await cleanup(cac);
  }
});

// ─── recordRecoveryPayment ─────────────────────────────────────────────────

test("recordRecoveryPayment: rejects on a non-Defaulted contract", async () => {
  const cac = "RC8300007";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => recordRecoveryPayment(fiSession(), contractId, { amountRecovered: 50_000, recoveryDate: "2026-03-01", recoverySource: "VOLUNTARY" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only record recovery on a Defaulted contract",
    );
  } finally {
    await cleanup(cac);
  }
});

test("recordRecoveryPayment: happy path reduces outstanding balance", async () => {
  const cac = "RC8300008";
  const tag = "TEST-SENTINEL-COLLECTIONS-1";
  try {
    const contractId = await buildDefaultedContractFixture(cac, `FAC-${cac}`, tag);
    const { rows: before } = await fixtureClient.query("SELECT outstanding_balance FROM murabahah_contract WHERE id = $1", [contractId]);
    const outstandingBefore = Number(before[0].outstanding_balance);

    const result = await recordRecoveryPayment(fiSession(), contractId, {
      amountRecovered: 100_000,
      recoveryDate: "2026-05-01",
      recoverySource: "GUARANTOR",
    });
    assert.equal(result.remainingBalance, outstandingBefore - 100_000);

    const { rows: after } = await fixtureClient.query("SELECT outstanding_balance FROM murabahah_contract WHERE id = $1", [contractId]);
    assert.equal(Number(after[0].outstanding_balance), outstandingBefore - 100_000);
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_sentinel WHERE authorized_by = $1`, [tag]);
  }
});

test("recordRecoveryPayment: rejects an amount exceeding the outstanding balance", async () => {
  const cac = "RC8300009";
  const tag = "TEST-SENTINEL-COLLECTIONS-2";
  try {
    const contractId = await buildDefaultedContractFixture(cac, `FAC-${cac}`, tag);
    await assert.rejects(
      () => recordRecoveryPayment(fiSession(), contractId, { amountRecovered: 999_999_999, recoveryDate: "2026-05-01", recoverySource: "VOLUNTARY" }),
      (err: unknown) => err instanceof DomainError && err.message === "Recovery amount must not exceed outstanding balance",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_sentinel WHERE authorized_by = $1`, [tag]);
  }
});

// ─── GSMInvocation: create + RecordGSMSweep/CancelGSM ──────────────────────

test("createGsmInvocation: rejects on a non-Defaulted contract", async () => {
  const cac = "RC8300010";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => createGsmInvocation(fiSession(), contractId, { businessBvn: "12345678901", invokedAmount: 300_000, monoGsmRef: "GSM-1" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only invoke GSM on a Defaulted contract",
    );
  } finally {
    await cleanup(cac);
  }
});

test("recordGsmSweep: happy path atomically updates both gsm_invocation and murabahah_contract via one transaction", async () => {
  const cac = "RC8300011";
  const tag = "TEST-SENTINEL-COLLECTIONS-3";
  try {
    const contractId = await buildDefaultedContractFixture(cac, `FAC-${cac}`, tag);
    const { rows: before } = await fixtureClient.query("SELECT outstanding_balance FROM murabahah_contract WHERE id = $1", [contractId]);
    const outstandingBefore = Number(before[0].outstanding_balance);

    const invocation = await createGsmInvocation(fiSession(), contractId, {
      businessBvn: "12345678901",
      invokedAmount: outstandingBefore,
      monoGsmRef: "GSM-REF-1",
    });

    const sweep = await recordGsmSweep(fiSession(), Number(invocation.gsmInvocationId), {
      sweepAmount: 80_000,
      sweepDate: "2026-05-01",
      nibssSweepRef: "NIBSS-SWEEP-1",
    });
    assert.ok(sweep.recoveryPaymentRecordId);

    const { rows: gsmRows } = await fixtureClient.query("SELECT last_sweep_ref, status FROM gsm_invocation WHERE id = $1", [
      invocation.gsmInvocationId,
    ]);
    assert.equal(gsmRows[0].last_sweep_ref, "NIBSS-SWEEP-1");
    assert.equal(gsmRows[0].status, "GSMActive");

    const { rows: contractRows } = await fixtureClient.query("SELECT outstanding_balance FROM murabahah_contract WHERE id = $1", [contractId]);
    assert.equal(Number(contractRows[0].outstanding_balance), outstandingBefore - 80_000);

    const { rows: recoveryRows } = await fixtureClient.query("SELECT recovery_source FROM recovery_payment_record WHERE id = $1", [
      sweep.recoveryPaymentRecordId,
    ]);
    assert.equal(recoveryRows[0].recovery_source, "GSM_NIBSS");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_sentinel WHERE authorized_by = $1`, [tag]);
  }
});

test("recordGsmSweep: rejects sweeping a Cancelled GSM invocation", async () => {
  const cac = "RC8300012";
  const tag = "TEST-SENTINEL-COLLECTIONS-4";
  try {
    const contractId = await buildDefaultedContractFixture(cac, `FAC-${cac}`, tag);
    const invocation = await createGsmInvocation(fiSession(), contractId, {
      businessBvn: "12345678901",
      invokedAmount: 100_000,
      monoGsmRef: "GSM-REF-2",
    });
    await cancelGsm(fiSession(), Number(invocation.gsmInvocationId), { reason: "Business settled directly" });
    await assert.rejects(
      () => recordGsmSweep(fiSession(), Number(invocation.gsmInvocationId), { sweepAmount: 10_000, sweepDate: "2026-05-01", nibssSweepRef: "NIBSS-2" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only sweep an Active GSM invocation",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_sentinel WHERE authorized_by = $1`, [tag]);
  }
});

test("cancelGsm: rejects an empty reason", async () => {
  const cac = "RC8300013";
  const tag = "TEST-SENTINEL-COLLECTIONS-5";
  try {
    const contractId = await buildDefaultedContractFixture(cac, `FAC-${cac}`, tag);
    const invocation = await createGsmInvocation(fiSession(), contractId, {
      businessBvn: "12345678901",
      invokedAmount: 100_000,
      monoGsmRef: "GSM-REF-3",
    });
    await assert.rejects(
      () => cancelGsm(fiSession(), Number(invocation.gsmInvocationId), { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_sentinel WHERE authorized_by = $1`, [tag]);
  }
});
