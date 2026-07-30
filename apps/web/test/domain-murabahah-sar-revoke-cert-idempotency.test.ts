// Unit/integration tests for lib/domain/murabahah.ts's Thirty-Fourth Slice
// (Batch E) remainder: SARReport (standalone), RevokeCertification (on
// ShariahContractCertification), and the PaymentIdempotencyGuard wired into
// RecordPayment.
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
  createSarReport,
  revokeCertification,
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
  await fixtureClient.query(`DELETE FROM repayment_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(
    `DELETE FROM shariah_certification_revocation WHERE cac_reg_number = $1`,
    [cac],
  );
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

/** Builds through OfferMurabahah, returning the live murabahahProposalId + certification. */
async function buildProposalWithCertFixture(cac: string, facilityRef: string) {
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
  return { proposalId: Number(proposal.murabahahProposalId), certificationId: Number(cert.shariahContractCertificationId) };
}

async function buildContractFixture(cac: string, facilityRef: string): Promise<number> {
  const { proposalId, certificationId } = await buildProposalWithCertFixture(cac, facilityRef);
  const contract = await acceptProposal(businessSession(cac), proposalId, { certificationId });
  return Number(contract.murabahahContractId);
}

// ─── SARReport ───────────────────────────────────────────────────────────────

test("createSarReport: business cannot create it, rejects an empty sarRef", async () => {
  await assert.rejects(
    () =>
      createSarReport(businessSession("RC9200001"), {
        cacRegNumber: "RC9200001", businessName: "Test Co", sarRef: "SAR-1", suspiciousActivity: "Structuring pattern",
        reportDate: "2026-06-01", reportedByParty: "Compliance Officer",
      }),
    (err: unknown) => err instanceof Error && err.message.includes("not authorized"),
  );
  await assert.rejects(
    () =>
      createSarReport(vetifySession(), {
        cacRegNumber: "RC9200001", businessName: "Test Co", sarRef: "", suspiciousActivity: "Structuring pattern",
        reportDate: "2026-06-01", reportedByParty: "Compliance Officer",
      }),
    (err: unknown) => err instanceof DomainError && err.message === "sarRef must not be empty",
  );
});

test("createSarReport: happy path defaults confidential to true", async () => {
  const result = await createSarReport(vetifySession(), {
    cacRegNumber: "RC9200002", businessName: "Test Co", sarRef: "SAR-2026-001",
    suspiciousActivity: "Repeated structuring below reporting threshold", reportDate: "2026-06-01",
    reportedByParty: "AML Compliance Officer",
  });
  try {
    assert.ok(result.sarReportId);
    const { rows } = await fixtureClient.query("SELECT confidential, sar_ref FROM sar_report WHERE id = $1", [result.sarReportId]);
    assert.equal(rows[0].confidential, true);
    assert.equal(rows[0].sar_ref, "SAR-2026-001");
  } finally {
    await fixtureClient.query("DELETE FROM sar_report WHERE id = $1", [result.sarReportId]);
  }
});

// ─── RevokeCertification ─────────────────────────────────────────────────────

test("revokeCertification: rejects empty fields, happy path archives the certification and blocks AcceptProposal", async () => {
  const cac = "RC9200003";
  try {
    const { proposalId, certificationId } = await buildProposalWithCertFixture(cac, `FAC-${cac}`);

    await assert.rejects(
      () => revokeCertification(advisorSession(), certificationId, { revocationRef: "", reason: "Terms changed", revokedBy: "Sheikh Test" }),
      (err: unknown) => err instanceof DomainError && err.message === "Revocation reference must not be empty",
    );

    const result = await revokeCertification(advisorSession(), certificationId, {
      revocationRef: "REV-2026-001", reason: "Sale price recalculated after a data-entry error", revokedBy: "Sheikh Test",
    });
    assert.ok(result.shariahCertificationRevocationId);

    const { rows: certRow } = await fixtureClient.query(
      "SELECT archived_at, superseded_by_kind FROM shariah_contract_certification WHERE id = $1",
      [certificationId],
    );
    assert.ok(certRow[0].archived_at);
    assert.equal(certRow[0].superseded_by_kind, "shariah_certification_revocation");

    // AcceptProposal fetches the certification -- a revoked one is archived, so
    // the ledger-equivalent guard here is that acceptProposal must fail once
    // the row it depends on is gone. This mirrors the real Daml's "archiving
    // it makes AcceptProposal's fetch fail" comment.
    await assert.rejects(
      () => acceptProposal(businessSession(cac), proposalId, { certificationId }),
      (err: unknown) => err instanceof DomainError,
    );
  } finally {
    await cleanup(cac);
  }
});

test("revokeCertification: cannot re-exercise on an already-revoked certification", async () => {
  const cac = "RC9200004";
  try {
    const { certificationId } = await buildProposalWithCertFixture(cac, `FAC-${cac}`);
    await revokeCertification(advisorSession(), certificationId, {
      revocationRef: "REV-1", reason: "First revocation", revokedBy: "Sheikh Test",
    });

    await assert.rejects(
      () =>
        revokeCertification(advisorSession(), certificationId, {
          revocationRef: "REV-2", reason: "Second attempt", revokedBy: "Sheikh Test",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "ShariahContractCertification is no longer active",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── PaymentIdempotencyGuard ─────────────────────────────────────────────────

test("recordPayment: a replayed directDebitRef is rejected; manual payments (no ref) are never deduplicated", async () => {
  const cac = "RC9200005";
  const ref = "DD-LIVE-TEST-9200005";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);

    const first = await recordPayment(fiSession(), contractId, {
      paymentDate: "2026-03-01", amountPaid: 150_000, installmentNo: 1, directDebitRef: ref,
    });
    assert.ok(first.repaymentRecordId);

    await assert.rejects(
      () =>
        recordPayment(fiSession(), contractId, {
          paymentDate: "2026-03-01", amountPaid: 150_000, installmentNo: 2, directDebitRef: ref,
        }),
      (err: unknown) => err instanceof DomainError && err.message === `Payment with directDebitRef ${ref} has already been recorded`,
    );

    // Confirms the guard's rollback didn't corrupt the contract's own state --
    // installment 2 is still unpaid after the rejected replay.
    const { rows } = await fixtureClient.query("SELECT installments_paid FROM murabahah_contract WHERE id = $1", [contractId]);
    assert.equal(rows[0].installments_paid, 1);

    // A manual/cash completion of installment 2 (no directDebitRef) must
    // still succeed -- manual payments are never deduplicated.
    const second = await recordPayment(fiSession(), contractId, {
      paymentDate: "2026-04-01", amountPaid: 150_000, installmentNo: 2,
    });
    assert.ok(second.repaymentRecordId);
  } finally {
    await cleanup(cac);
    await fixtureClient.query("DELETE FROM payment_idempotency_guard WHERE direct_debit_ref = $1", [ref]);
  }
});
