// Unit/integration tests for lib/domain/murabahah.ts's ported assertMsg
// guards (Phase 2, Stage 8 -- the Murabahah acquisition chain). Builds the
// fixture chain through the REAL domain functions from earlier modules
// (requestFinancing -> beginUnderwriting -> approveFunding), not raw SQL --
// this doubles as an integration test that Stage 5-7 and Stage 8 compose
// correctly end-to-end, not just each module in isolation.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { requestFinancing, beginUnderwriting, approveFunding } from "@/lib/domain/financing";
import {
  proceedDirectly,
  proceedWithWakala,
  withdrawWad,
  recordAssetPurchase,
  declineAgency,
  acknowledgeDelivery,
  offerMurabahah,
  certifyShariahTerms,
  acceptProposal,
  declineProposal,
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
  assetCost: 500_000,
  profitAmount: 50_000,
  salePrice: 550_000,
  installmentAmount: 45_833.33,
  tenureMonths: 12,
};

function makeSchedule(months: number, dueAmount: number): PaymentScheduleEntry[] {
  return Array.from({ length: months }, (_, i) => ({
    installmentNo: i + 1,
    dueDate: `2026-${String((i % 12) + 1).padStart(2, "0")}-01`,
    dueAmount,
  }));
}

async function cleanup(cac: string) {
  await fixtureClient.query(`DELETE FROM murabahah_contract WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM shariah_contract_certification WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM proposal_decline_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM murabahah_proposal WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM asset_purchase_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM agency_withdrawal_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM murabahah_wakala WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM wad_withdrawal_record WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM murabahah_wad WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_decision WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM underwriting_result WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM financing_request WHERE cac_reg_number = $1`, [cac]);
  await fixtureClient.query(`DELETE FROM approved_business WHERE cac_reg_number = $1`, [cac]);
}

/** Builds through ApproveFunding only, returning the live murabahahWadId -- for tests of the Path A (Wakala) and WithdrawWad alternatives to ProceedDirectly. */
async function buildWadFixture(cac: string): Promise<number> {
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
    assetDetails: { description: "50 tonnes of flour", supplier: "Golden Mills", supplierRef: "PO-1", estimatedCost: 500_000 },
    approvedProviderId: stage0.approvedProviderId,
    approvingOfficerId: stage0.approvingOfficerId,
  });
  return Number(approval.murabahahWadId);
}

/**
 * Builds through OfferMurabahah, returning the live murabahahProposalId.
 * Idempotent on the approved_business insert -- a real business can request
 * more than one facility over time (see the "same business, two facilities"
 * test below), and one_active_approved_business_per_cac only allows one
 * *active* row per CAC, not one ever.
 */
async function buildProposalFixture(cac: string, facilityRef: string) {
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
    assetDetails: { description: "50 tonnes of flour", supplier: "Golden Mills", supplierRef: "PO-1", estimatedCost: 500_000 },
    approvedProviderId: stage0.approvedProviderId,
    approvingOfficerId: stage0.approvingOfficerId,
  });
  const purchase = await proceedDirectly(fiSession(), Number(approval.murabahahWadId), {
    actualCost: 500_000,
    purchaseDate: "2026-01-01",
    invoiceRef: "INV-1",
  });
  await acknowledgeDelivery(businessSession(cac), Number(purchase.assetPurchaseRecordId));
  const proposal = await offerMurabahah(fiSession(), Number(purchase.assetPurchaseRecordId), {
    murabahahTerms: validMurabahahTerms,
    paymentSchedule: makeSchedule(12, 45_833.33),
    facilityRef,
    startDate: "2026-02-01",
  });
  return proposal.murabahahProposalId;
}

// ─── proceedDirectly ────────────────────────────────────────────────────────

test("proceedDirectly: actual purchase cost must be positive", async () => {
  const cac = "RC5000001";
  try {
    await fixtureClient.query(
      `INSERT INTO approved_business
         (cac_reg_number, business_name, business_sector, business_activity,
          incorporation_date, verification_ref, compliance_ref, approved_at, status)
       VALUES ($1, 'Test Co', 'Retail Trade', 'Retail sale', '2020-01-01', $2, $3, now(), 'BusinessActive')`,
      [cac, `VER-${cac}`, `COM-${cac}`],
    );
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
      financingRef: `FIN-${cac}`,
      businessSector: "Retail Trade",
    });
    await beginUnderwriting(assessorSession(), Number(request.id), { assessment: validAssessment, autoDecided: false });
    const approval = await approveFunding(fiSession(), Number(request.id), {
      assetDetails: { description: "Flour", supplier: "Golden Mills", supplierRef: "PO-1", estimatedCost: 500_000 },
      approvedProviderId: stage0.approvedProviderId,
      approvingOfficerId: stage0.approvingOfficerId,
    });
    await assert.rejects(
      () =>
        proceedDirectly(fiSession(), Number(approval.murabahahWadId), {
          actualCost: 0,
          purchaseDate: "2026-01-01",
          invoiceRef: "INV-1",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Actual purchase cost must be positive",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── proceedWithWakala / withdrawWad -- Path A, the deferred agency detour ──

test("proceedWithWakala: happy path creates a MurabahahWakala and archives the Wad", async () => {
  const cac = "RC5100001";
  try {
    const wadId = await buildWadFixture(cac);
    const result = await proceedWithWakala(fiSession(), wadId);
    assert.ok(result.murabahahWakalaId);

    const { rows: wad } = await fixtureClient.query("SELECT archived_at, superseded_by_kind, superseded_by_id FROM murabahah_wad WHERE id = $1", [wadId]);
    assert.ok(wad[0].archived_at);
    assert.equal(wad[0].superseded_by_kind, "murabahah_wakala");
    assert.equal(Number(wad[0].superseded_by_id), Number(result.murabahahWakalaId));

    await assert.rejects(
      () => proceedWithWakala(fiSession(), wadId),
      (err: unknown) => err instanceof DomainError && err.message === "MurabahahWad is no longer active",
    );
  } finally {
    await cleanup(cac);
  }
});

test("recordAssetPurchase: happy path creates an AssetPurchaseRecord with purchasedViaWakala = true, linked to the originating Wad", async () => {
  const cac = "RC5100002";
  try {
    const wadId = await buildWadFixture(cac);
    const wakala = await proceedWithWakala(fiSession(), wadId);
    const purchase = await recordAssetPurchase(businessSession(cac), Number(wakala.murabahahWakalaId), {
      actualCost: 500_000, purchaseDate: "2026-01-01", invoiceRef: "INV-WAK-1",
    });
    assert.ok(purchase.assetPurchaseRecordId);

    const { rows: record } = await fixtureClient.query(
      "SELECT murabahah_wad_id, purchased_via_wakala FROM asset_purchase_record WHERE id = $1",
      [purchase.assetPurchaseRecordId],
    );
    assert.equal(Number(record[0].murabahah_wad_id), wadId);
    assert.equal(record[0].purchased_via_wakala, true);

    const { rows: wakalaRow } = await fixtureClient.query("SELECT archived_at, superseded_by_kind FROM murabahah_wakala WHERE id = $1", [wakala.murabahahWakalaId]);
    assert.ok(wakalaRow[0].archived_at);
    assert.equal(wakalaRow[0].superseded_by_kind, "asset_purchase_record");
  } finally {
    await cleanup(cac);
  }
});

test("declineAgency: rejects an empty reason, archives the Wakala with an AgencyWithdrawalRecord on success", async () => {
  const cac = "RC5100003";
  try {
    const wadId = await buildWadFixture(cac);
    const wakala = await proceedWithWakala(fiSession(), wadId);
    await assert.rejects(
      () => declineAgency(businessSession(cac), Number(wakala.murabahahWakalaId), { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );
    const result = await declineAgency(businessSession(cac), Number(wakala.murabahahWakalaId), { reason: "Supplier terms changed" });
    assert.ok(result.agencyWithdrawalRecordId);

    const { rows } = await fixtureClient.query("SELECT reason FROM agency_withdrawal_record WHERE id = $1", [result.agencyWithdrawalRecordId]);
    assert.equal(rows[0].reason, "Supplier terms changed");
  } finally {
    await cleanup(cac);
  }
});

test("withdrawWad: rejects an empty reason, archives the Wad with a WadWithdrawalRecord successor on success", async () => {
  const cac = "RC5100004";
  try {
    const wadId = await buildWadFixture(cac);
    await assert.rejects(
      () => withdrawWad(businessSession(cac), wadId, { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );
    const result = await withdrawWad(businessSession(cac), wadId, { reason: "Supplier unavailable" });
    assert.ok(result.wadWithdrawalRecordId);

    const { rows: wad } = await fixtureClient.query("SELECT archived_at, superseded_by_kind, superseded_by_id FROM murabahah_wad WHERE id = $1", [wadId]);
    assert.ok(wad[0].archived_at);
    assert.equal(wad[0].superseded_by_kind, "wad_withdrawal_record");
    assert.equal(Number(wad[0].superseded_by_id), Number(result.wadWithdrawalRecordId));

    await assert.rejects(
      () => withdrawWad(businessSession(cac), wadId, { reason: "test" }),
      (err: unknown) => err instanceof DomainError && err.message === "MurabahahWad is no longer active",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── acknowledgeDelivery ────────────────────────────────────────────────────

test("acknowledgeDelivery: cannot acknowledge twice", async () => {
  const cac = "RC5000002";
  try {
    await fixtureClient.query(
      `INSERT INTO approved_business
         (cac_reg_number, business_name, business_sector, business_activity,
          incorporation_date, verification_ref, compliance_ref, approved_at, status)
       VALUES ($1, 'Test Co', 'Retail Trade', 'Retail sale', '2020-01-01', $2, $3, now(), 'BusinessActive')`,
      [cac, `VER-${cac}`, `COM-${cac}`],
    );
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
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
    await acknowledgeDelivery(businessSession(cac), Number(purchase.assetPurchaseRecordId));
    await assert.rejects(
      () => acknowledgeDelivery(businessSession(cac), Number(purchase.assetPurchaseRecordId)),
      (err: unknown) => err instanceof DomainError && err.message === "Delivery already acknowledged",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── offerMurabahah ─────────────────────────────────────────────────────────

test("offerMurabahah: gated by Qabdh (delivery must be acknowledged first)", async () => {
  const cac = "RC5000003";
  try {
    await fixtureClient.query(
      `INSERT INTO approved_business
         (cac_reg_number, business_name, business_sector, business_activity,
          incorporation_date, verification_ref, compliance_ref, approved_at, status)
       VALUES ($1, 'Test Co', 'Retail Trade', 'Retail sale', '2020-01-01', $2, $3, now(), 'BusinessActive')`,
      [cac, `VER-${cac}`, `COM-${cac}`],
    );
    const request = await requestFinancing(businessSession(cac), {
      terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
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
    // Delivery not acknowledged yet.
    await assert.rejects(
      () =>
        offerMurabahah(fiSession(), Number(purchase.assetPurchaseRecordId), {
          murabahahTerms: validMurabahahTerms,
          paymentSchedule: makeSchedule(12, 45_833.33),
          facilityRef: `FAC-${cac}`,
          startDate: "2026-02-01",
        }),
      (err: unknown) =>
        err instanceof DomainError && err.message === "Delivery must be acknowledged (Qabdh) before making the sale offer",
    );
  } finally {
    await cleanup(cac);
  }
});

test("offerMurabahah: disclosed profit invariant (salePrice = assetCost + profitAmount)", async () => {
  const cac = "RC5000004";
  try {
    const proposalPromise = (async () => {
      await fixtureClient.query(
        `INSERT INTO approved_business
           (cac_reg_number, business_name, business_sector, business_activity,
            incorporation_date, verification_ref, compliance_ref, approved_at, status)
         VALUES ($1, 'Test Co', 'Retail Trade', 'Retail sale', '2020-01-01', $2, $3, now(), 'BusinessActive')`,
        [cac, `VER-${cac}`, `COM-${cac}`],
      );
      const request = await requestFinancing(businessSession(cac), {
        terms: { amount: 500_000, purpose: "Inventory", tenureMonths: 12 },
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
      await acknowledgeDelivery(businessSession(cac), Number(purchase.assetPurchaseRecordId));
      return purchase.assetPurchaseRecordId;
    })();
    const recordId = await proposalPromise;
    await assert.rejects(
      () =>
        offerMurabahah(fiSession(), Number(recordId), {
          murabahahTerms: { ...validMurabahahTerms, salePrice: 999_999 },
          paymentSchedule: makeSchedule(12, 45_833.33),
          facilityRef: `FAC-${cac}`,
          startDate: "2026-02-01",
        }),
      (err: unknown) =>
        err instanceof DomainError && err.message === "Disclosed profit invariant: salePrice must equal assetCost + profitAmount",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── certifyShariahTerms ────────────────────────────────────────────────────

test("certifyShariahTerms: certifying scholar/member must be named", async () => {
  const cac = "RC5000005";
  try {
    const proposalId = await buildProposalFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () =>
        certifyShariahTerms(advisorSession(), Number(proposalId), {
          certificationRef: `CERT-${cac}`,
          aaoifiStandards: ["Std No. 8"],
          rationale: "Sale price correctly discloses cost and profit",
          certifiedBy: "",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Certifying scholar/member must be named",
    );
  } finally {
    await cleanup(cac);
  }
});

// ─── acceptProposal -- the G11 hard gate ────────────────────────────────────

test("acceptProposal: rejects a certification for a different facility (same business, two facilities)", async () => {
  // Deliberately the SAME cac for both proposals -- a cross-tenant version
  // of this scenario hits RLS's tenant-scoping on shariah_contract_
  // certification before acceptProposal's own facility-match check ever
  // runs (confirmed live: businessA reading businessB's certification row
  // fails RLS's SELECT policy with "not found", not this DomainError) --
  // which is arguably the more correct outcome (visibility denied before
  // business rules even evaluate), but it isn't what this test is for. Two
  // facilities under one business isolates the facility-mismatch check
  // itself, which is exactly what a real business with more than one
  // financing facility over time would encounter.
  const cac = "RC5000006";
  try {
    const proposalIdA = await buildProposalFixture(cac, `FAC-${cac}-A`);
    const proposalIdB = await buildProposalFixture(cac, `FAC-${cac}-B`);
    const certB = await certifyShariahTerms(advisorSession(), Number(proposalIdB), {
      certificationRef: `CERT-${cac}-B`,
      aaoifiStandards: ["Std No. 8"],
      rationale: "Compliant",
      certifiedBy: "Sheikh Test",
    });
    // Certification B is for facility B; trying to accept proposal A with it must fail.
    await assert.rejects(
      () =>
        acceptProposal(businessSession(cac), Number(proposalIdA), {
          certificationId: Number(certB.shariahContractCertificationId),
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Certification is for a different facility",
    );
  } finally {
    await cleanup(cac);
  }
});

test("acceptProposal: RLS blocks reading a different tenant's certification before the facility check even runs", async () => {
  const cacA = "RC5000010";
  const cacB = "RC5000011";
  try {
    const proposalIdA = await buildProposalFixture(cacA, `FAC-${cacA}`);
    const proposalIdB = await buildProposalFixture(cacB, `FAC-${cacB}`);
    const certB = await certifyShariahTerms(advisorSession(), Number(proposalIdB), {
      certificationRef: `CERT-${cacB}`,
      aaoifiStandards: ["Std No. 8"],
      rationale: "Compliant",
      certifiedBy: "Sheikh Test",
    });
    await assert.rejects(
      () =>
        acceptProposal(businessSession(cacA), Number(proposalIdA), {
          certificationId: Number(certB.shariahContractCertificationId),
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Certification not found",
    );
  } finally {
    await cleanup(cacA);
    await cleanup(cacB);
  }
});

test("acceptProposal: rejects a certification whose figures no longer match the proposal (stale terms)", async () => {
  const cac = "RC5000008";
  try {
    const proposalId = await buildProposalFixture(cac, `FAC-${cac}`);
    const cert = await certifyShariahTerms(advisorSession(), Number(proposalId), {
      certificationRef: `CERT-${cac}`,
      aaoifiStandards: ["Std No. 8"],
      rationale: "Compliant",
      certifiedBy: "Sheikh Test",
    });
    // Simulate the proposal's terms changing after certification (a real
    // Daml scenario would need a fresh OfferMurabahah; here we directly
    // mutate the fixture to prove the equality check actually fires).
    // sale_price changes too, not just profit_amount, to satisfy the
    // schema's own sale_price = asset_cost + profit_amount CHECK constraint
    // -- and acceptProposalImpl checks sale_price before profit_amount, so
    // that's the message that actually fires here (matches the code's real
    // check order, not an arbitrarily-chosen one).
    await fixtureClient.query(`UPDATE murabahah_proposal SET profit_amount = 60000, sale_price = 560000 WHERE id = $1`, [
      proposalId,
    ]);
    await assert.rejects(
      () =>
        acceptProposal(businessSession(cac), Number(proposalId), {
          certificationId: Number(cert.shariahContractCertificationId),
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Certified sale price does not match the proposal's terms",
    );
  } finally {
    await cleanup(cac);
  }
});

test("acceptProposal: full happy path creates an Active MurabahahContract with the certification's audit fields", async () => {
  const cac = "RC5000009";
  try {
    const proposalId = await buildProposalFixture(cac, `FAC-${cac}`);
    const cert = await certifyShariahTerms(advisorSession(), Number(proposalId), {
      certificationRef: `CERT-${cac}`,
      aaoifiStandards: ["Std No. 8", "Std No. 40"],
      rationale: "Sale price correctly discloses cost and profit; tenure matches disbursement plan",
      certifiedBy: "Sheikh Test",
    });
    const contract = await acceptProposal(businessSession(cac), Number(proposalId), {
      certificationId: Number(cert.shariahContractCertificationId),
    });
    assert.ok(contract.murabahahContractId);

    const { rows } = await fixtureClient.query(
      "SELECT status, shariah_certification_ref, shariah_certified_by, outstanding_balance FROM murabahah_contract WHERE id = $1",
      [contract.murabahahContractId],
    );
    assert.equal(rows[0].status, "Active");
    assert.equal(rows[0].shariah_certification_ref, `CERT-${cac}`);
    assert.equal(rows[0].shariah_certified_by, "Sheikh Test");
    assert.equal(Number(rows[0].outstanding_balance), 550_000);

    const { rows: proposalRows } = await fixtureClient.query(
      "SELECT archived_at FROM murabahah_proposal WHERE id = $1",
      [proposalId],
    );
    assert.ok(proposalRows[0].archived_at, "the proposal must be archived once accepted");
  } finally {
    await cleanup(cac);
  }
});

// ─── declineProposal ────────────────────────────────────────────────────────

test("declineProposal: rejects an empty reason, archives the proposal with a ProposalDeclineRecord successor on success", async () => {
  const cac = "RC5100005";
  try {
    const proposalId = await buildProposalFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => declineProposal(businessSession(cac), Number(proposalId), { reason: "" }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );
    const result = await declineProposal(businessSession(cac), Number(proposalId), { reason: "Terms no longer acceptable" });
    assert.ok(result.proposalDeclineRecordId);

    const { rows: proposal } = await fixtureClient.query("SELECT archived_at, superseded_by_kind, superseded_by_id FROM murabahah_proposal WHERE id = $1", [proposalId]);
    assert.ok(proposal[0].archived_at);
    assert.equal(proposal[0].superseded_by_kind, "proposal_decline_record");
    assert.equal(Number(proposal[0].superseded_by_id), Number(result.proposalDeclineRecordId));

    const { rows: record } = await fixtureClient.query("SELECT reason FROM proposal_decline_record WHERE id = $1", [result.proposalDeclineRecordId]);
    assert.equal(record[0].reason, "Terms no longer acceptable");

    await assert.rejects(
      () => declineProposal(businessSession(cac), Number(proposalId), { reason: "test" }),
      (err: unknown) => err instanceof DomainError && err.message === "MurabahahProposal is no longer active",
    );
  } finally {
    await cleanup(cac);
  }
});
