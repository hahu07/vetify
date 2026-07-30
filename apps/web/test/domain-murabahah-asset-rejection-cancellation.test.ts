// Unit/integration tests for lib/domain/murabahah.ts's Twenty-Seventh Slice
// additions: the pre-Qabdh rejection/replacement/cancellation cluster on
// AssetPurchaseRecord (RejectDelivery, ProceedWithReplacement,
// RequestCancellation, ConfirmCancellation, RejectCancellation). Builds the
// fixture chain through the real domain functions to a live, unacknowledged
// AssetPurchaseRecord, the same way domain-murabahah.test.ts does.
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
  rejectDelivery,
  proceedWithReplacement,
  requestCancellation,
  confirmCancellation,
  rejectCancellation,
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
    `DELETE FROM acquisition_cancellation_request WHERE asset_purchase_record_id IN
       (SELECT id FROM asset_purchase_record WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM asset_rejection_record WHERE asset_purchase_record_id IN
       (SELECT id FROM asset_purchase_record WHERE cac_reg_number = $1)`,
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

// ─── rejectDelivery ─────────────────────────────────────────────────────────

test("rejectDelivery: rejects an empty reason, creates an AssetRejectionRecord on success, stays nonconsuming", async () => {
  const cac = "RC5200001";
  try {
    const recordId = await buildPurchaseFixture(cac);
    await assert.rejects(
      () => rejectDelivery(businessSession(cac), recordId, { reason: "", defectDescription: "Torn bags" }),
      (err: unknown) => err instanceof DomainError && err.message === "Rejection reason must not be empty",
    );
    const result = await rejectDelivery(businessSession(cac), recordId, {
      reason: "Defective goods", defectDescription: "20% of bags torn in transit",
    });
    assert.ok(result.assetRejectionRecordId);

    const { rows: rejection } = await fixtureClient.query(
      "SELECT reason, defect_description FROM asset_rejection_record WHERE id = $1",
      [result.assetRejectionRecordId],
    );
    assert.equal(rejection[0].reason, "Defective goods");

    const { rows: record } = await fixtureClient.query(
      "SELECT archived_at, delivery_acknowledged FROM asset_purchase_record WHERE id = $1",
      [recordId],
    );
    assert.equal(record[0].archived_at, null);
    assert.equal(record[0].delivery_acknowledged, false);
  } finally {
    await cleanup(cac);
  }
});

test("rejectDelivery: cannot reject an already-acknowledged delivery", async () => {
  const cac = "RC5200002";
  try {
    const recordId = await buildPurchaseFixture(cac);
    await acknowledgeDelivery(businessSession(cac), recordId);
    await assert.rejects(
      () => rejectDelivery(businessSession(cac), recordId, { reason: "Too late", defectDescription: "N/A" }),
      (err: unknown) => err instanceof DomainError && err.message === "Cannot reject an already-acknowledged delivery",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── proceedWithReplacement ─────────────────────────────────────────────────

test("proceedWithReplacement: rejects a non-positive cost, empty invoice ref, and empty note", async () => {
  const cac = "RC5200003";
  try {
    const recordId = await buildPurchaseFixture(cac);
    await assert.rejects(
      () =>
        proceedWithReplacement(fiSession(), recordId, {
          newActualCost: 0, newPurchaseDate: "2026-01-15", newInvoiceRef: "INV-2", replacementNote: "Replaced",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Replacement cost must be positive",
    );
    await assert.rejects(
      () =>
        proceedWithReplacement(fiSession(), recordId, {
          newActualCost: 500_000, newPurchaseDate: "2026-01-15", newInvoiceRef: "", replacementNote: "Replaced",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Invoice reference must not be empty",
    );
    await assert.rejects(
      () =>
        proceedWithReplacement(fiSession(), recordId, {
          newActualCost: 500_000, newPurchaseDate: "2026-01-15", newInvoiceRef: "INV-2", replacementNote: "",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Replacement note must not be empty",
    );
  } finally {
    await cleanup(cac);
  }
});

test("proceedWithReplacement: happy path replaces the asset, resets ancillary costs and delivery_acknowledged", async () => {
  const cac = "RC5200004";
  try {
    const recordId = await buildPurchaseFixture(cac);
    await rejectDelivery(businessSession(cac), recordId, { reason: "Defective", defectDescription: "Torn bags" });

    const result = await proceedWithReplacement(fiSession(), recordId, {
      newActualCost: 520_000, newPurchaseDate: "2026-01-20", newInvoiceRef: "INV-REPLACEMENT-1",
      replacementNote: "Fresh batch from a different warehouse",
    });
    assert.equal(Number(result.assetPurchaseRecordId), recordId);

    const { rows } = await fixtureClient.query(
      `SELECT actual_cost, invoice_ref, total_acquisition_cost, freight_cost, delivery_acknowledged
         FROM asset_purchase_record WHERE id = $1`,
      [recordId],
    );
    assert.equal(Number(rows[0].actual_cost), 520_000);
    assert.equal(rows[0].invoice_ref, "INV-REPLACEMENT-1");
    assert.equal(Number(rows[0].total_acquisition_cost), 520_000);
    assert.equal(Number(rows[0].freight_cost), 0);
    assert.equal(rows[0].delivery_acknowledged, false);
  } finally {
    await cleanup(cac);
  }
});

// ─── requestCancellation / confirmCancellation / rejectCancellation ────────

test("requestCancellation: rejects an empty reason, creates a Pending AcquisitionCancellationRequest on success", async () => {
  const cac = "RC5200005";
  try {
    const recordId = await buildPurchaseFixture(cac);
    await assert.rejects(
      () => requestCancellation(businessSession(cac), recordId, { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Cancellation reason must not be empty",
    );
    const result = await requestCancellation(businessSession(cac), recordId, {
      reason: "FI could not source a suitable replacement",
    });
    assert.ok(result.acquisitionCancellationRequestId);

    const { rows } = await fixtureClient.query(
      "SELECT status, reason FROM acquisition_cancellation_request WHERE id = $1",
      [result.acquisitionCancellationRequestId],
    );
    assert.equal(rows[0].status, "Pending");
  } finally {
    await cleanup(cac);
  }
});

test("confirmCancellation: happy path archives the AssetPurchaseRecord and marks the request Confirmed", async () => {
  const cac = "RC5200006";
  try {
    const recordId = await buildPurchaseFixture(cac);
    const req = await requestCancellation(businessSession(cac), recordId, { reason: "No replacement available" });

    const result = await confirmCancellation(fiSession(), recordId, {
      requestId: Number(req.acquisitionCancellationRequestId),
    });
    assert.equal(Number(result.assetPurchaseRecordId), recordId);

    const { rows: record } = await fixtureClient.query(
      "SELECT archived_at FROM asset_purchase_record WHERE id = $1",
      [recordId],
    );
    assert.ok(record[0].archived_at);

    const { rows: request } = await fixtureClient.query(
      "SELECT status FROM acquisition_cancellation_request WHERE id = $1",
      [req.acquisitionCancellationRequestId],
    );
    assert.equal(request[0].status, "Confirmed");
  } finally {
    await cleanup(cac);
  }
});

test("confirmCancellation: rejects a request that does not belong to this AssetPurchaseRecord", async () => {
  const cacA = "RC5200007";
  const cacB = "RC5200008";
  try {
    const recordA = await buildPurchaseFixture(cacA);
    const recordB = await buildPurchaseFixture(cacB);
    const reqOnB = await requestCancellation(businessSession(cacB), recordB, { reason: "Wrong record test" });

    await assert.rejects(
      () => confirmCancellation(fiSession(), recordA, { requestId: Number(reqOnB.acquisitionCancellationRequestId) }),
      (err: unknown) =>
        err instanceof DomainError &&
        err.message === "AcquisitionCancellationRequest does not belong to this AssetPurchaseRecord",
    );
  } finally {
    await cleanup(cacA);
    await cleanup(cacB);
  }
});

test("rejectCancellation: happy path marks the request Rejected, AssetPurchaseRecord stays live", async () => {
  const cac = "RC5200009";
  try {
    const recordId = await buildPurchaseFixture(cac);
    const req = await requestCancellation(businessSession(cac), recordId, { reason: "Trying again with a new supplier" });

    const result = await rejectCancellation(fiSession(), Number(req.acquisitionCancellationRequestId));
    assert.equal(Number(result.acquisitionCancellationRequestId), Number(req.acquisitionCancellationRequestId));

    const { rows: request } = await fixtureClient.query(
      "SELECT status FROM acquisition_cancellation_request WHERE id = $1",
      [req.acquisitionCancellationRequestId],
    );
    assert.equal(request[0].status, "Rejected");

    const { rows: record } = await fixtureClient.query(
      "SELECT archived_at FROM asset_purchase_record WHERE id = $1",
      [recordId],
    );
    assert.equal(record[0].archived_at, null);
  } finally {
    await cleanup(cac);
  }
});

test("rejectCancellation: rejects a request that is not pending", async () => {
  const cac = "RC5200010";
  try {
    const recordId = await buildPurchaseFixture(cac);
    const req = await requestCancellation(businessSession(cac), recordId, { reason: "First attempt" });
    await rejectCancellation(fiSession(), Number(req.acquisitionCancellationRequestId));

    await assert.rejects(
      () => rejectCancellation(fiSession(), Number(req.acquisitionCancellationRequestId)),
      (err: unknown) => err instanceof DomainError && err.message === "AcquisitionCancellationRequest is not pending",
    );
  } finally {
    await cleanup(cac);
  }
});
