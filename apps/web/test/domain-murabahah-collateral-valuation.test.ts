// Unit/integration tests for lib/domain/murabahah.ts's seventh-slice
// additions (business-submitted collateral valuation document upload). See
// migrations/012_collateral_valuation_document.sql's header for scope.
// Builds the fixture chain the same way
// domain-murabahah-rahn-collateral.test.ts does, then pledges collateral and
// submits a valuation document on top of it.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { DomainError, AuthorizationError } from "@/lib/errors";
import { requestFinancing, beginUnderwriting, approveFunding } from "@/lib/domain/financing";
import {
  proceedDirectly,
  acknowledgeDelivery,
  offerMurabahah,
  certifyShariahTerms,
  acceptProposal,
  pledgeCollateral,
  submitCollateralValuation,
  listCollateralValuationDocuments,
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
    `DELETE FROM collateral_valuation_document WHERE rahn_agreement_id IN (SELECT id FROM rahn_agreement WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(`DELETE FROM rahn_agreement WHERE cac_reg_number = $1`, [cac]);
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

async function buildRahnFixture(cac: string, facilityRef: string): Promise<number> {
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
  const pledge = await pledgeCollateral(fiSession(), Number(contract.murabahahContractId), {
    collateralDescription: "Plot 14, Lekki Phase 1, Lagos",
    collateralValue: 2_000_000,
  });
  return Number(pledge.rahnAgreementId);
}

const validArgs = {
  valuatorRef: "Test Valuers Ltd",
  valuationAmount: 1_800_000,
  valuationDate: "2026-05-01",
  docType: "CollateralValuationReport",
  contentHash: "a".repeat(64),
  storageRef: "local://report.pdf",
  fileSize: 512_000,
};

test("submitCollateralValuation: only a business session may submit", async () => {
  const cac = "RC8100001";
  try {
    const rahnId = await buildRahnFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => submitCollateralValuation(fiSession(), rahnId, validArgs),
      (err: unknown) => err instanceof AuthorizationError,
    );
  } finally {
    await cleanup(cac);
  }
});

test("submitCollateralValuation: rejects an empty valuator reference", async () => {
  const cac = "RC8100002";
  try {
    const rahnId = await buildRahnFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => submitCollateralValuation(businessSession(cac), rahnId, { ...validArgs, valuatorRef: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Valuator reference must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("submitCollateralValuation: rejects a non-positive valuation amount", async () => {
  const cac = "RC8100003";
  try {
    const rahnId = await buildRahnFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => submitCollateralValuation(businessSession(cac), rahnId, { ...validArgs, valuationAmount: 0 }),
      (err: unknown) => err instanceof DomainError && err.message === "Valuation amount must be positive",
    );
  } finally {
    await cleanup(cac);
  }
});

test("submitCollateralValuation: happy path -- does not modify rahn_agreement.collateral_value", async () => {
  const cac = "RC8100004";
  try {
    const rahnId = await buildRahnFixture(cac, `FAC-${cac}`);
    const result = await submitCollateralValuation(businessSession(cac), rahnId, validArgs);
    assert.ok(result.collateralValuationDocumentId);

    const { rows } = await fixtureClient.query(
      "SELECT valuator_ref, valuation_amount, content_hash FROM collateral_valuation_document WHERE id = $1",
      [result.collateralValuationDocumentId],
    );
    assert.equal(rows[0].valuator_ref, validArgs.valuatorRef);
    assert.equal(Number(rows[0].valuation_amount), validArgs.valuationAmount);
    assert.equal(rows[0].content_hash, validArgs.contentHash);

    const { rows: rahnRows } = await fixtureClient.query("SELECT collateral_value FROM rahn_agreement WHERE id = $1", [rahnId]);
    assert.equal(Number(rahnRows[0].collateral_value), 2_000_000, "submitting a valuation must not change the FI's own recorded collateral value");
  } finally {
    await cleanup(cac);
  }
});

test("listCollateralValuationDocuments: vetify can see documents submitted by any business", async () => {
  const cac = "RC8100005";
  try {
    const rahnId = await buildRahnFixture(cac, `FAC-${cac}`);
    await submitCollateralValuation(businessSession(cac), rahnId, validArgs);
    const docs = await listCollateralValuationDocuments(vetifySession());
    assert.ok(docs.some((d) => String(d.rahn_agreement_id) === String(rahnId)));
  } finally {
    await cleanup(cac);
  }
});
