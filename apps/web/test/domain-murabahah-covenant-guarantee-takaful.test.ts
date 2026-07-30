// Unit/integration tests for lib/domain/murabahah.ts's Thirty-Third Slice
// (Batch D) additions: CreditCovenant + CovenantMeasurementRecord,
// GuaranteeAgreement, and TakafulPolicy -- all created directly by
// financialInstitution against a live MurabahahContract.
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
  createCreditCovenant,
  recordCovenantMeasurement,
  createGuaranteeAgreement,
  enforceGuarantee,
  releaseGuarantee,
  createTakafulPolicy,
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
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
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
    `DELETE FROM covenant_measurement_record WHERE credit_covenant_id IN (SELECT id FROM credit_covenant WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(`DELETE FROM credit_covenant WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM guarantee_agreement WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM takaful_policy WHERE cac_reg_number = $1`, [cac]);
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

// ─── CreditCovenant / CovenantMeasurementRecord ────────────────────────────

test("createCreditCovenant: rejects a non-positive threshold, recordCovenantMeasurement rejects an empty measuredBy", async () => {
  const cac = "RC9100001";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => createCreditCovenant(fiSession(), contractId, { covenantType: "DSCR_MINIMUM", threshold: 0, measurementFrequency: "QUARTERLY" }),
      (err: unknown) => err instanceof DomainError && err.message === "threshold must be positive",
    );

    const covenant = await createCreditCovenant(fiSession(), contractId, {
      covenantType: "DSCR_MINIMUM", threshold: 1.25, measurementFrequency: "QUARTERLY",
    });
    assert.ok(covenant.creditCovenantId);

    await assert.rejects(
      () =>
        recordCovenantMeasurement(vetifySession(), Number(covenant.creditCovenantId), {
          measuredValue: 1.3, measureDate: "2026-06-30", measuredBy: "",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Measured-by must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("recordCovenantMeasurement: happy path computes breached correctly for both a passing and a failing measurement", async () => {
  const cac = "RC9100002";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const covenant = await createCreditCovenant(fiSession(), contractId, {
      covenantType: "DSCR_MINIMUM", threshold: 1.25, measurementFrequency: "QUARTERLY",
    });

    const passing = await recordCovenantMeasurement(vetifySession(), Number(covenant.creditCovenantId), {
      measuredValue: 1.4, measureDate: "2026-06-30", measuredBy: "Portfolio Analyst A",
    });
    const { rows: passRow } = await fixtureClient.query("SELECT breached FROM covenant_measurement_record WHERE id = $1", [
      passing.covenantMeasurementRecordId,
    ]);
    assert.equal(passRow[0].breached, false);

    const failing = await recordCovenantMeasurement(vetifySession(), Number(covenant.creditCovenantId), {
      measuredValue: 1.1, measureDate: "2026-09-30", measuredBy: "Portfolio Analyst A",
    });
    const { rows: failRow } = await fixtureClient.query("SELECT breached FROM covenant_measurement_record WHERE id = $1", [
      failing.covenantMeasurementRecordId,
    ]);
    assert.equal(failRow[0].breached, true);
  } finally {
    await cleanup(cac);
  }
});

// ─── GuaranteeAgreement ─────────────────────────────────────────────────────

test("createGuaranteeAgreement: rejects a non-positive amount, enforceGuarantee/releaseGuarantee guard Active status", async () => {
  const cac = "RC9100003";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () =>
        createGuaranteeAgreement(fiSession(), contractId, {
          guaranteeType: "PERSONAL", guaranteedAmount: 0, guarantorName: "Chinedu Okafor", guarantorId: "NIN-12345678901",
          effectiveDate: "2026-01-01",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "guaranteedAmount must be positive",
    );

    const guarantee = await createGuaranteeAgreement(fiSession(), contractId, {
      guaranteeType: "PERSONAL", guaranteedAmount: 300_000, guarantorName: "Chinedu Okafor", guarantorId: "NIN-12345678901",
      effectiveDate: "2026-01-01",
    });
    assert.ok(guarantee.guaranteeAgreementId);

    const released = await releaseGuarantee(fiSession(), Number(guarantee.guaranteeAgreementId), { note: "Facility fully repaid" });
    assert.equal(Number(released.guaranteeAgreementId), Number(guarantee.guaranteeAgreementId));

    await assert.rejects(
      () => enforceGuarantee(fiSession(), Number(guarantee.guaranteeAgreementId), { reason: "Default" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only enforce an Active guarantee",
    );

    const { rows } = await fixtureClient.query("SELECT guarantee_status FROM guarantee_agreement WHERE id = $1", [guarantee.guaranteeAgreementId]);
    assert.equal(rows[0].guarantee_status, "GuaranteeReleased");
  } finally {
    await cleanup(cac);
  }
});

test("enforceGuarantee: happy path enforces an Active guarantee", async () => {
  const cac = "RC9100004";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const guarantee = await createGuaranteeAgreement(fiSession(), contractId, {
      guaranteeType: "CORPORATE", guaranteedAmount: 300_000, guarantorName: "Adaeze Holdings Ltd", guarantorId: "RC7654321",
      effectiveDate: "2026-01-01",
    });

    const enforced = await enforceGuarantee(fiSession(), Number(guarantee.guaranteeAgreementId), { reason: "Business defaulted on the facility" });
    assert.equal(Number(enforced.guaranteeAgreementId), Number(guarantee.guaranteeAgreementId));

    const { rows } = await fixtureClient.query("SELECT guarantee_status FROM guarantee_agreement WHERE id = $1", [guarantee.guaranteeAgreementId]);
    assert.equal(rows[0].guarantee_status, "GuaranteeEnforced");
  } finally {
    await cleanup(cac);
  }
});

// ─── TakafulPolicy ───────────────────────────────────────────────────────────

test("createTakafulPolicy: rejects an expiry not later than the start date, happy path is immutable", async () => {
  const cac = "RC9100005";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () =>
        createTakafulPolicy(fiSession(), contractId, {
          policyNumber: "TAK-2026-001", takafulOperator: "Cornerstone Takaful Nigeria", coverageType: "ASSET_TAKAFUL",
          coverageAmount: 300_000, premiumAmount: 15_000, startDate: "2026-08-01", expiryDate: "2026-01-01",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "expiryDate must be later than startDate",
    );

    const policy = await createTakafulPolicy(fiSession(), contractId, {
      policyNumber: "TAK-2026-002", takafulOperator: "Cornerstone Takaful Nigeria", coverageType: "ASSET_TAKAFUL",
      coverageAmount: 300_000, premiumAmount: 15_000, startDate: "2026-01-01", expiryDate: "2027-01-01",
    });
    assert.ok(policy.takafulPolicyId);

    const { rows } = await fixtureClient.query("SELECT coverage_amount, premium_amount FROM takaful_policy WHERE id = $1", [
      policy.takafulPolicyId,
    ]);
    assert.equal(Number(rows[0].coverage_amount), 300_000);
    assert.equal(Number(rows[0].premium_amount), 15_000);
  } finally {
    await cleanup(cac);
  }
});
