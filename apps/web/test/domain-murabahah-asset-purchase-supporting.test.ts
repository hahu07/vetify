// Unit/integration tests for lib/domain/murabahah.ts's Thirty-First Slice
// (Batch B) additions: AssetPurchaseRecord's supporting-record cluster
// (RecordDeliveryMilestone, RecordSupplierFailure, RecordSupplierPayment,
// RegisterDocument + VerifyDocument/SupersedeDocument) plus the two
// standalone templates (PurchaseOrder, CapitalCallRecord) that need no
// AssetPurchaseRecord fixture at all.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { requestFinancing, beginUnderwriting, approveFunding } from "@/lib/domain/financing";
import {
  proceedDirectly,
  recordDeliveryMilestone,
  recordSupplierFailure,
  recordSupplierPayment,
  registerDocument,
  verifyDocument,
  supersedeDocument,
  createPurchaseOrder,
  confirmPO,
  markPartiallyFulfilled,
  markFulfilled,
  cancelPO,
  createCapitalCallRecord,
} from "@/lib/domain/murabahah";
import type { RiskAssessment } from "@/lib/types-financing";
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
  recommendedLimit: 500_000,
  recommendation: "Approve",
};

async function cleanup(cac: string) {
  await fixtureClient.query(
    `DELETE FROM document_entry WHERE asset_purchase_record_id IN (SELECT id FROM asset_purchase_record WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM supplier_payment_record WHERE asset_purchase_record_id IN (SELECT id FROM asset_purchase_record WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM supplier_failure_record WHERE asset_purchase_record_id IN (SELECT id FROM asset_purchase_record WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM delivery_milestone WHERE asset_purchase_record_id IN (SELECT id FROM asset_purchase_record WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(`DELETE FROM asset_purchase_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM murabahah_wad WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_decision WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM underwriting_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_request WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM approved_business WHERE cac_reg_number = $1`, [cac]);
}

/** Builds through ProceedDirectly, returning the live, unacknowledged assetPurchaseRecordId. */
async function buildPurchaseFixture(cac: string): Promise<number> {
  await fixtureClient.query(
    `INSERT INTO approved_business
       (cac_reg_number, business_name, business_sector, business_activity,
        incorporation_date, verification_ref, compliance_ref, approved_at, status)
     VALUES ($1, 'Test Co', 'Retail Trade', 'Retail sale', '2020-01-01', $2, $3, now(), 'BusinessActive')
     ON CONFLICT (cac_reg_number) WHERE archived_at IS NULL DO NOTHING`,
    [cac, `VER-${cac}`, `COM-${cac}`],
  );
  const request = await requestFinancing(businessSession(cac), {
    terms: { amount: 500_000, purpose: "Purchase of flour", tenureMonths: 12 },
    financingRef: `FIN-${cac}`,
    businessSector: "Retail Trade",
  });
  await beginUnderwriting(assessorSession(), Number(request.id), { assessment: validAssessment, autoDecided: false });
  const approval = await approveFunding(fiSession(), Number(request.id), {
    assetDetails: { description: "Flour", supplier: "Golden Mills", supplierRef: "PO-1", estimatedCost: 500_000 },
    approvedProviderId: stage0.approvedProviderId,
    approvingOfficerId: stage0.approvingOfficerId,
  });
  const purchase = await proceedDirectly(fiSession(), Number(approval.murabahahWadId), {
    actualCost: 500_000,
    purchaseDate: "2026-01-01",
    invoiceRef: "INV-1",
  });
  return Number(purchase.assetPurchaseRecordId);
}

// ─── recordDeliveryMilestone ────────────────────────────────────────────────

test("recordDeliveryMilestone: rejects an empty description and non-positive quantity, happy path is nonconsuming", async () => {
  const cac = "RC5300001";
  try {
    const recordId = await buildPurchaseFixture(cac);
    await assert.rejects(
      () => recordDeliveryMilestone(businessSession(cac), recordId, { milestoneDescription: "", quantityDelivered: 5, milestoneDate: "2026-01-05" }),
      (err: unknown) => err instanceof DomainError && err.message === "Milestone description must not be empty",
    );
    await assert.rejects(
      () => recordDeliveryMilestone(businessSession(cac), recordId, { milestoneDescription: "First batch", quantityDelivered: 0, milestoneDate: "2026-01-05" }),
      (err: unknown) => err instanceof DomainError && err.message === "Quantity delivered must be positive",
    );

    const result = await recordDeliveryMilestone(businessSession(cac), recordId, {
      milestoneDescription: "First 10 tonnes delivered", quantityDelivered: 10, milestoneDate: "2026-01-05", evidenceRef: "BOL-001",
    });
    assert.ok(result.deliveryMilestoneId);

    const { rows } = await fixtureClient.query("SELECT archived_at FROM asset_purchase_record WHERE id = $1", [recordId]);
    assert.equal(rows[0].archived_at, null);
  } finally {
    await cleanup(cac);
  }
});

// ─── recordSupplierFailure ──────────────────────────────────────────────────

test("recordSupplierFailure: rejects an empty description, happy path archives the purchase record", async () => {
  const cac = "RC5300002";
  try {
    const recordId = await buildPurchaseFixture(cac);
    await assert.rejects(
      () => recordSupplierFailure(fiSession(), recordId, { failureType: "SupplierBankrupt", failureDescription: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Failure description must not be empty",
    );

    const result = await recordSupplierFailure(fiSession(), recordId, {
      failureType: "SupplierBankrupt", failureDescription: "Golden Mills filed for insolvency", refundAmount: 500_000,
    });
    assert.ok(result.supplierFailureRecordId);

    const { rows } = await fixtureClient.query(
      "SELECT archived_at, superseded_by_kind, superseded_by_id FROM asset_purchase_record WHERE id = $1",
      [recordId],
    );
    assert.ok(rows[0].archived_at);
    assert.equal(rows[0].superseded_by_kind, "supplier_failure_record");
    assert.equal(Number(rows[0].superseded_by_id), Number(result.supplierFailureRecordId));
  } finally {
    await cleanup(cac);
  }
});

// ─── recordSupplierPayment ──────────────────────────────────────────────────

test("recordSupplierPayment: rejects a non-positive amount and empty ref, happy path is nonconsuming", async () => {
  const cac = "RC5300003";
  try {
    const recordId = await buildPurchaseFixture(cac);
    await assert.rejects(
      () => recordSupplierPayment(fiSession(), recordId, { amountPaid: 0, paymentDate: "2026-01-02", paymentRef: "PAY-1" }),
      (err: unknown) => err instanceof DomainError && err.message === "Payment amount must be positive",
    );
    await assert.rejects(
      () => recordSupplierPayment(fiSession(), recordId, { amountPaid: 500_000, paymentDate: "2026-01-02", paymentRef: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Payment reference must not be empty",
    );

    const result = await recordSupplierPayment(fiSession(), recordId, {
      amountPaid: 500_000, paymentDate: "2026-01-02", paymentRef: "PAY-2026-001", bankConfirmationRef: "BANK-CONF-1",
    });
    assert.ok(result.supplierPaymentRecordId);

    const { rows } = await fixtureClient.query("SELECT archived_at FROM asset_purchase_record WHERE id = $1", [recordId]);
    assert.equal(rows[0].archived_at, null);
  } finally {
    await cleanup(cac);
  }
});

// ─── registerDocument / verifyDocument / supersedeDocument ────────────────

test("registerDocument + verifyDocument + supersedeDocument: full managed lifecycle", async () => {
  const cac = "RC5300004";
  try {
    const recordId = await buildPurchaseFixture(cac);
    await assert.rejects(
      () => registerDocument(fiSession(), recordId, { documentRef: { docType: "INVOICE", contentHash: "abc", storageRef: "s3://x" }, registeredBy: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Registered-by name must not be empty",
    );

    const doc = await registerDocument(fiSession(), recordId, {
      documentRef: { docType: "INVOICE", contentHash: "abc123", storageRef: "s3://vetify-docs/inv.pdf" },
      registeredBy: "Ops Officer A",
    });
    assert.ok(doc.documentEntryId);

    const verified = await verifyDocument(vetifySession(), Number(doc.documentEntryId), {});
    assert.equal(Number(verified.documentEntryId), Number(doc.documentEntryId));

    await assert.rejects(
      () => verifyDocument(vetifySession(), Number(doc.documentEntryId), {}),
      (err: unknown) => err instanceof DomainError && err.message === "Document already verified",
    );

    await assert.rejects(
      () => supersedeDocument(fiSession(), Number(doc.documentEntryId), { newDocumentRef: { docType: "INVOICE", contentHash: "def", storageRef: "s3://y" }, reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );

    const superseded = await supersedeDocument(fiSession(), Number(doc.documentEntryId), {
      newDocumentRef: { docType: "INVOICE", contentHash: "def456", storageRef: "s3://vetify-docs/inv-v2.pdf" },
      reason: "Corrected invoice amount",
    });
    assert.equal(Number(superseded.documentEntryId), Number(doc.documentEntryId));

    const { rows } = await fixtureClient.query("SELECT verified_at, superseded, document_ref FROM document_entry WHERE id = $1", [doc.documentEntryId]);
    assert.equal(rows[0].verified_at, null);
    assert.equal(rows[0].superseded, false);
    assert.equal(rows[0].document_ref.contentHash, "def456");
  } finally {
    await cleanup(cac);
  }
});

// ─── PurchaseOrder ───────────────────────────────────────────────────────────

test("createPurchaseOrder + full lifecycle: Issued -> Confirmed -> PartiallyFulfilled -> Fulfilled", async () => {
  const created = await createPurchaseOrder(fiSession(), {
    cacRegNumber: "RC5300005", businessName: "Test Co", facilityRef: "FAC-RC5300005",
    supplierName: "Flour Mills of Nigeria PLC",
    supplierDetails: { supplierName: "Flour Mills of Nigeria PLC", supplierAddress: "Lagos" },
    orderedItems: [{ description: "Flour", supplierName: "Flour Mills", supplierRef: "PO-1", estimatedCost: 500_000 }],
    totalOrderValue: 500_000, deliveryDeadline: "2026-08-15", poRef: "PO-TEST-001",
  });
  try {
    assert.ok(created.purchaseOrderId);

    const confirmed = await confirmPO(fiSession(), Number(created.purchaseOrderId), { confirmationRef: "CONF-001" });
    assert.equal(Number(confirmed.purchaseOrderId), Number(created.purchaseOrderId));

    await markPartiallyFulfilled(fiSession(), Number(created.purchaseOrderId), { deliveryRef: "DEL-001" });
    await markFulfilled(fiSession(), Number(created.purchaseOrderId), { deliveryRef: "DEL-002" });

    const { rows } = await fixtureClient.query("SELECT status FROM purchase_order WHERE id = $1", [created.purchaseOrderId]);
    assert.equal(rows[0].status, "POFulfilled");

    await assert.rejects(
      () => cancelPO(fiSession(), Number(created.purchaseOrderId), { reason: "Cannot cancel after fulfillment" }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only cancel an Issued or Confirmed PO",
    );
  } finally {
    await fixtureClient.query("DELETE FROM purchase_order WHERE id = $1", [created.purchaseOrderId]);
  }
});

test("cancelPO: happy path cancels an Issued PO", async () => {
  const created = await createPurchaseOrder(fiSession(), {
    cacRegNumber: "RC5300006", businessName: "Test Co", facilityRef: "FAC-RC5300006",
    supplierName: "Flour Mills of Nigeria PLC",
    supplierDetails: { supplierName: "Flour Mills of Nigeria PLC", supplierAddress: "Lagos" },
    orderedItems: [{ description: "Flour", supplierName: "Flour Mills", supplierRef: "PO-1", estimatedCost: 500_000 }],
    totalOrderValue: 500_000, deliveryDeadline: "2026-08-15", poRef: "PO-TEST-002",
  });
  try {
    const cancelled = await cancelPO(fiSession(), Number(created.purchaseOrderId), { reason: "Business withdrew Wa'd before supplier confirmation" });
    assert.equal(Number(cancelled.purchaseOrderId), Number(created.purchaseOrderId));

    const { rows } = await fixtureClient.query("SELECT status FROM purchase_order WHERE id = $1", [created.purchaseOrderId]);
    assert.equal(rows[0].status, "POCancelled");
  } finally {
    await fixtureClient.query("DELETE FROM purchase_order WHERE id = $1", [created.purchaseOrderId]);
  }
});

// ─── CapitalCallRecord ───────────────────────────────────────────────────────

test("createCapitalCallRecord: rejects an inconsistent cumulative amount, happy path is immutable", async () => {
  await assert.rejects(
    () =>
      createCapitalCallRecord(fiSession(), {
        cacRegNumber: "RC5300007", businessName: "Test Co", facilityRef: "FAC-RC5300007", trancheNumber: 1,
        trancheAmount: 1_000_000, disbursementDate: "2026-07-15", purposeOfTranche: "Initial inventory purchase",
        disbursementRef: "DISB-001", cumulativeDisbursed: 500_000, remainingFacility: 1_300_000,
      }),
    (err: unknown) => err instanceof DomainError && err.message === "cumulativeDisbursed must be at least trancheAmount",
  );

  const tranche1 = await createCapitalCallRecord(fiSession(), {
    cacRegNumber: "RC5300007", businessName: "Test Co", facilityRef: "FAC-RC5300007", trancheNumber: 1,
    trancheAmount: 1_000_000, disbursementDate: "2026-07-15", purposeOfTranche: "Initial inventory purchase — 25 MT flour",
    disbursementRef: "DISB-2026-001", cumulativeDisbursed: 1_000_000, remainingFacility: 1_300_000,
  });
  try {
    assert.ok(tranche1.capitalCallRecordId);

    const tranche2 = await createCapitalCallRecord(fiSession(), {
      cacRegNumber: "RC5300007", businessName: "Test Co", facilityRef: "FAC-RC5300007", trancheNumber: 2,
      trancheAmount: 1_300_000, disbursementDate: "2026-08-15", purposeOfTranche: "Second inventory tranche — 25 MT flour",
      disbursementRef: "DISB-2026-002", cumulativeDisbursed: 2_300_000, remainingFacility: 0,
    });
    try {
      const { rows } = await fixtureClient.query(
        "SELECT tranche_number, cumulative_disbursed, remaining_facility FROM capital_call_record WHERE id = $1",
        [tranche2.capitalCallRecordId],
      );
      assert.equal(rows[0].tranche_number, 2);
      assert.equal(Number(rows[0].cumulative_disbursed), 2_300_000);
      assert.equal(Number(rows[0].remaining_facility), 0);
    } finally {
      await fixtureClient.query("DELETE FROM capital_call_record WHERE id = $1", [tranche2.capitalCallRecordId]);
    }
  } finally {
    await fixtureClient.query("DELETE FROM capital_call_record WHERE id = $1", [tranche1.capitalCallRecordId]);
  }
});
