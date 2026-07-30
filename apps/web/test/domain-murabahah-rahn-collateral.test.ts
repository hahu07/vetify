// Unit/integration tests for lib/domain/murabahah.ts's sixth-slice additions
// (RahnAgreement collateral: PledgeCollateral, ReleaseCollateral,
// EnforceCollateral). Builds the fixture chain through the real domain
// functions to an Active MurabahahContract, the same way
// domain-murabahah-ibra-charity-default.test.ts does, then exercises the
// new choices on top of it.
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
  pledgeCollateral,
  releaseCollateral,
  enforceCollateral,
  revalue,
  recordInspection,
  proposeEnforceCollateral,
  confirmEnforce,
  rejectEnforce,
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
    `DELETE FROM pending_collateral_enforcement WHERE rahn_agreement_id IN (SELECT id FROM rahn_agreement WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM collateral_valuation_record WHERE rahn_agreement_id IN (SELECT id FROM rahn_agreement WHERE cac_reg_number = $1)`,
    [cac],
  );
  await fixtureClient.query(
    `DELETE FROM collateral_inspection_record WHERE rahn_agreement_id IN (SELECT id FROM rahn_agreement WHERE cac_reg_number = $1)`,
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

async function registerOfficer(officerId: string, role: string): Promise<void> {
  await fixtureClient.query(
    `INSERT INTO authorized_officer (officer_id, officer_name, roles, authorized_by, authorized_at, active)
     VALUES ($1, $2, $3, 'Test Setup', now(), true)`,
    [officerId, `Test ${role}`, JSON.stringify([role])],
  );
}

// ─── pledgeCollateral ───────────────────────────────────────────────────────

test("pledgeCollateral: rejects an empty description and a non-positive value", async () => {
  const cac = "RC8000001";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await assert.rejects(
      () => pledgeCollateral(fiSession(), contractId, { collateralDescription: "", collateralValue: 1_000_000 }),
      (err: unknown) => err instanceof DomainError && err.message === "Collateral description must not be empty",
    );
    await assert.rejects(
      () => pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 0 }),
      (err: unknown) => err instanceof DomainError && err.message === "Collateral value must be positive",
    );
  } finally {
    await cleanup(cac);
  }
});

test("pledgeCollateral: happy path creates an Active RahnAgreement", async () => {
  const cac = "RC8000002";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const pledge = await pledgeCollateral(fiSession(), contractId, {
      collateralDescription: "Plot 14, Lekki Phase 1, Lagos",
      collateralValue: 2_000_000,
    });
    const { rows } = await fixtureClient.query("SELECT collateral_status, collateral_value FROM rahn_agreement WHERE id = $1", [
      pledge.rahnAgreementId,
    ]);
    assert.equal(rows[0].collateral_status, "CollateralActive");
    assert.equal(Number(rows[0].collateral_value), 2_000_000);
  } finally {
    await cleanup(cac);
  }
});

// ─── releaseCollateral ──────────────────────────────────────────────────────

test("releaseCollateral: fails closed when the proposing officer is not a registered OperationsOfficer", async () => {
  const cac = "RC8000003";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    await assert.rejects(
      () =>
        releaseCollateral(fiSession(), Number(pledge.rahnAgreementId), {
          note: "Facility closed",
          proposedByOfficerId: "OFF-NONEXISTENT",
          confirmedByOfficerId: "OFF-ALSO-NONEXISTENT",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Officer OFF-NONEXISTENT is not active",
    );
  } finally {
    await cleanup(cac);
  }
});

test("releaseCollateral: rejects the same officer proposing and confirming (four-eyes)", async () => {
  const cac = "RC8000004";
  const officerId = "OFF-RAHN-SAME";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    await assert.rejects(
      () =>
        releaseCollateral(fiSession(), Number(pledge.rahnAgreementId), {
          note: "Facility closed",
          proposedByOfficerId: officerId,
          confirmedByOfficerId: officerId,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Confirming officer must differ from proposing officer (four-eyes)",
    );
  } finally {
    await cleanup(cac);
  }
});

test("releaseCollateral: happy path -- four-eyes OperationsOfficer/RiskOfficer releases the pledge", async () => {
  const cac = "RC8000005";
  const opsOfficerId = "OFF-OPS-1";
  const riskOfficerId = "OFF-RISK-REL-1";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(opsOfficerId, "OperationsOfficer");
    await registerOfficer(riskOfficerId, "RiskOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });

    const released = await releaseCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      note: "Facility fully repaid",
      releaseDocumentRef: "DEED-2026-001",
      proposedByOfficerId: opsOfficerId,
      confirmedByOfficerId: riskOfficerId,
    });
    assert.ok(released.rahnAgreementId);

    const { rows } = await fixtureClient.query("SELECT collateral_status, release_evidence FROM rahn_agreement WHERE id = $1", [
      released.rahnAgreementId,
    ]);
    assert.equal(rows[0].collateral_status, "CollateralReleased");
    assert.equal(rows[0].release_evidence, "DEED-2026-001");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id IN ($1, $2)`, [opsOfficerId, riskOfficerId]);
  }
});

test("releaseCollateral: rejects releasing already-released collateral", async () => {
  const cac = "RC8000006";
  const opsOfficerId = "OFF-OPS-2";
  const riskOfficerId = "OFF-RISK-REL-2";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(opsOfficerId, "OperationsOfficer");
    await registerOfficer(riskOfficerId, "RiskOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    await releaseCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      note: "Facility fully repaid",
      proposedByOfficerId: opsOfficerId,
      confirmedByOfficerId: riskOfficerId,
    });
    await assert.rejects(
      () =>
        releaseCollateral(fiSession(), Number(pledge.rahnAgreementId), {
          note: "Again",
          proposedByOfficerId: opsOfficerId,
          confirmedByOfficerId: riskOfficerId,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only release Active collateral",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id IN ($1, $2)`, [opsOfficerId, riskOfficerId]);
  }
});

// ─── enforceCollateral ──────────────────────────────────────────────────────

test("enforceCollateral: happy path -- four-eyes RecoveryOfficer/RiskOfficer enforces the pledge", async () => {
  const cac = "RC8000007";
  const recoveryOfficerId = "OFF-RECOVERY-1";
  const riskOfficerId = "OFF-RISK-ENF-1";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(recoveryOfficerId, "RecoveryOfficer");
    await registerOfficer(riskOfficerId, "RiskOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });

    const enforced = await enforceCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      reason: "Contract defaulted, recovering via collateral",
      proposedByOfficerId: recoveryOfficerId,
      confirmedByOfficerId: riskOfficerId,
    });
    assert.ok(enforced.rahnAgreementId);

    const { rows } = await fixtureClient.query("SELECT collateral_status FROM rahn_agreement WHERE id = $1", [enforced.rahnAgreementId]);
    assert.equal(rows[0].collateral_status, "CollateralEnforced");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id IN ($1, $2)`, [recoveryOfficerId, riskOfficerId]);
  }
});

test("enforceCollateral: rejects an empty reason", async () => {
  const cac = "RC8000008";
  const recoveryOfficerId = "OFF-RECOVERY-2";
  const riskOfficerId = "OFF-RISK-ENF-2";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(recoveryOfficerId, "RecoveryOfficer");
    await registerOfficer(riskOfficerId, "RiskOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    await assert.rejects(
      () =>
        enforceCollateral(fiSession(), Number(pledge.rahnAgreementId), {
          reason: "",
          proposedByOfficerId: recoveryOfficerId,
          confirmedByOfficerId: riskOfficerId,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id IN ($1, $2)`, [recoveryOfficerId, riskOfficerId]);
  }
});

test("enforceCollateral: an OperationsOfficer cannot substitute for a RecoveryOfficer", async () => {
  const cac = "RC8000009";
  const opsOfficerId = "OFF-OPS-3";
  const riskOfficerId = "OFF-RISK-ENF-3";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(opsOfficerId, "OperationsOfficer");
    await registerOfficer(riskOfficerId, "RiskOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    await assert.rejects(
      () =>
        enforceCollateral(fiSession(), Number(pledge.rahnAgreementId), {
          reason: "Contract defaulted",
          proposedByOfficerId: opsOfficerId,
          confirmedByOfficerId: riskOfficerId,
        }),
      (err: unknown) => err instanceof DomainError && err.message === `Officer ${opsOfficerId} does not hold the required role`,
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id IN ($1, $2)`, [opsOfficerId, riskOfficerId]);
  }
});

// ─── revalue ────────────────────────────────────────────────────────────────

test("revalue: rejects a non-positive new value, updates collateral_value and creates a CollateralValuationRecord on success", async () => {
  const cac = "RC8000010";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    await assert.rejects(
      () => revalue(fiSession(), Number(pledge.rahnAgreementId), { newValue: 0, valuationDate: "2026-06-01", valuatorRef: "APP-1" }),
      (err: unknown) => err instanceof DomainError && err.message === "New collateral value must be positive",
    );
    const result = await revalue(fiSession(), Number(pledge.rahnAgreementId), { newValue: 1_200_000, valuationDate: "2026-06-01", valuatorRef: "APP-2026-001" });
    assert.ok(result.collateralValuationRecordId);

    const { rows: rahn } = await fixtureClient.query("SELECT collateral_value FROM rahn_agreement WHERE id = $1", [pledge.rahnAgreementId]);
    assert.equal(Number(rahn[0].collateral_value), 1_200_000);

    const { rows: record } = await fixtureClient.query(
      "SELECT previous_value, valuation_amount, valuator_ref FROM collateral_valuation_record WHERE id = $1",
      [result.collateralValuationRecordId],
    );
    assert.equal(Number(record[0].previous_value), 1_000_000);
    assert.equal(Number(record[0].valuation_amount), 1_200_000);
    assert.equal(record[0].valuator_ref, "APP-2026-001");
  } finally {
    await cleanup(cac);
  }
});

test("revalue: can only revalue Active collateral", async () => {
  const cac = "RC8000011";
  const opsOfficerId = "OFF-OPS-REV-1";
  const riskOfficerId = "OFF-RISK-REV-1";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(opsOfficerId, "OperationsOfficer");
    await registerOfficer(riskOfficerId, "RiskOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    await releaseCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      note: "Facility closed",
      proposedByOfficerId: opsOfficerId,
      confirmedByOfficerId: riskOfficerId,
    });
    await assert.rejects(
      () => revalue(fiSession(), Number(pledge.rahnAgreementId), { newValue: 900_000, valuationDate: "2026-06-01", valuatorRef: "APP-1" }),
      (err: unknown) => err instanceof DomainError && err.message === "Collateral must be Active to revalue",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id IN ($1, $2)`, [opsOfficerId, riskOfficerId]);
  }
});

// ─── recordInspection ───────────────────────────────────────────────────────

test("recordInspection: rejects an empty inspected-by, nonconsuming (does not change collateral_status)", async () => {
  const cac = "RC8000012";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    await assert.rejects(
      () =>
        recordInspection(fiSession(), Number(pledge.rahnAgreementId), {
          inspectionDate: "2026-06-01", inspectedBy: "", condition: "Satisfactory",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Inspected-by must not be empty",
    );
    const result = await recordInspection(fiSession(), Number(pledge.rahnAgreementId), {
      inspectionDate: "2026-06-01", inspectedBy: "Field Officer Bello", condition: "RequiresAttention",
      inspectionNotes: "Fence needs repair", nextInspectionDate: "2026-09-01",
    });
    assert.ok(result.collateralInspectionRecordId);

    const { rows: rahn } = await fixtureClient.query("SELECT collateral_status FROM rahn_agreement WHERE id = $1", [pledge.rahnAgreementId]);
    assert.equal(rahn[0].collateral_status, "CollateralActive");

    const { rows: record } = await fixtureClient.query(
      "SELECT condition, inspected_by, next_inspection_date FROM collateral_inspection_record WHERE id = $1",
      [result.collateralInspectionRecordId],
    );
    assert.equal(record[0].condition, "RequiresAttention");
    assert.equal(record[0].inspected_by, "Field Officer Bello");
  } finally {
    await cleanup(cac);
  }
});

test("recordInspection: can only inspect Active collateral", async () => {
  const cac = "RC8000013";
  const opsOfficerId = "OFF-OPS-INSP-1";
  const riskOfficerId = "OFF-RISK-INSP-1";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(opsOfficerId, "OperationsOfficer");
    await registerOfficer(riskOfficerId, "RiskOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    await releaseCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      note: "Facility closed",
      proposedByOfficerId: opsOfficerId,
      confirmedByOfficerId: riskOfficerId,
    });
    await assert.rejects(
      () =>
        recordInspection(fiSession(), Number(pledge.rahnAgreementId), {
          inspectionDate: "2026-06-01", inspectedBy: "Field Officer Bello", condition: "Satisfactory",
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only inspect Active collateral",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id IN ($1, $2)`, [opsOfficerId, riskOfficerId]);
  }
});

// ─── proposeEnforceCollateral / confirmEnforce / rejectEnforce ─────────────

test("proposeEnforceCollateral: rejects an empty reason, creates a Pending PendingCollateralEnforcement, RahnAgreement stays Active", async () => {
  const cac = "RC8000014";
  const recoveryOfficerId = "OFF-RECOVERY-PROP-1";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(recoveryOfficerId, "RecoveryOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });

    await assert.rejects(
      () =>
        proposeEnforceCollateral(fiSession(), Number(pledge.rahnAgreementId), {
          reason: "", gsmExhausted: true, proposedByOfficerId: recoveryOfficerId,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Reason must not be empty",
    );

    const result = await proposeEnforceCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      reason: "Three consecutive missed installments", gsmExhausted: true, gsmRef: "GSM-REF-1",
      proposedByOfficerId: recoveryOfficerId,
    });
    assert.ok(result.pendingCollateralEnforcementId);

    const { rows } = await fixtureClient.query(
      "SELECT status, reason, gsm_exhausted FROM pending_collateral_enforcement WHERE id = $1",
      [result.pendingCollateralEnforcementId],
    );
    assert.equal(rows[0].status, "Pending");
    assert.equal(rows[0].gsm_exhausted, true);

    const { rows: rahn } = await fixtureClient.query("SELECT collateral_status FROM rahn_agreement WHERE id = $1", [pledge.rahnAgreementId]);
    assert.equal(rahn[0].collateral_status, "CollateralActive");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id = $1`, [recoveryOfficerId]);
  }
});

test("proposeEnforceCollateral: can only propose on Active collateral", async () => {
  const cac = "RC8000015";
  const opsOfficerId = "OFF-OPS-PROP-1";
  const riskOfficerId = "OFF-RISK-PROP-1";
  const recoveryOfficerId = "OFF-RECOVERY-PROP-2";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(opsOfficerId, "OperationsOfficer");
    await registerOfficer(riskOfficerId, "RiskOfficer");
    await registerOfficer(recoveryOfficerId, "RecoveryOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    await releaseCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      note: "Facility closed", proposedByOfficerId: opsOfficerId, confirmedByOfficerId: riskOfficerId,
    });

    await assert.rejects(
      () =>
        proposeEnforceCollateral(fiSession(), Number(pledge.rahnAgreementId), {
          reason: "Too late", gsmExhausted: false, proposedByOfficerId: recoveryOfficerId,
        }),
      (err: unknown) => err instanceof DomainError && err.message === "Can only propose enforcement on Active collateral",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id IN ($1, $2, $3)`, [opsOfficerId, riskOfficerId, recoveryOfficerId]);
  }
});

test("confirmEnforce: happy path enforces the RahnAgreement and marks the pending request Confirmed", async () => {
  const cac = "RC8000016";
  const recoveryOfficerId = "OFF-RECOVERY-CONF-1";
  const riskOfficerId = "OFF-RISK-CONF-1";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(recoveryOfficerId, "RecoveryOfficer");
    await registerOfficer(riskOfficerId, "RiskOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    const proposed = await proposeEnforceCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      reason: "Three consecutive missed installments", gsmExhausted: true, proposedByOfficerId: recoveryOfficerId,
    });

    const result = await confirmEnforce(vetifySession(), Number(proposed.pendingCollateralEnforcementId), {
      confirmedByOfficerId: riskOfficerId,
    });
    assert.equal(Number(result.rahnAgreementId), Number(pledge.rahnAgreementId));

    const { rows: rahn } = await fixtureClient.query(
      "SELECT collateral_status, proposed_by_officer_id, confirmed_by_officer_id FROM rahn_agreement WHERE id = $1",
      [pledge.rahnAgreementId],
    );
    assert.equal(rahn[0].collateral_status, "CollateralEnforced");
    assert.equal(rahn[0].proposed_by_officer_id, recoveryOfficerId);
    assert.equal(rahn[0].confirmed_by_officer_id, riskOfficerId);

    const { rows: pending } = await fixtureClient.query(
      "SELECT status FROM pending_collateral_enforcement WHERE id = $1",
      [proposed.pendingCollateralEnforcementId],
    );
    assert.equal(pending[0].status, "Confirmed");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id IN ($1, $2)`, [recoveryOfficerId, riskOfficerId]);
  }
});

test("confirmEnforce: rejects the same officer proposing and confirming (four-eyes), pending request stays Pending", async () => {
  const cac = "RC8000017";
  const recoveryOfficerId = "OFF-RECOVERY-CONF-2";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(recoveryOfficerId, "RecoveryOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    const proposed = await proposeEnforceCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      reason: "Missed installments", gsmExhausted: false, proposedByOfficerId: recoveryOfficerId,
    });

    await assert.rejects(
      () => confirmEnforce(vetifySession(), Number(proposed.pendingCollateralEnforcementId), { confirmedByOfficerId: recoveryOfficerId }),
      (err: unknown) => err instanceof DomainError && err.message === "Confirming officer must differ from proposing officer (four-eyes)",
    );

    const { rows: pending } = await fixtureClient.query(
      "SELECT status FROM pending_collateral_enforcement WHERE id = $1",
      [proposed.pendingCollateralEnforcementId],
    );
    assert.equal(pending[0].status, "Pending");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id = $1`, [recoveryOfficerId]);
  }
});

test("rejectEnforce: happy path marks the pending request Rejected, RahnAgreement stays Active", async () => {
  const cac = "RC8000018";
  const recoveryOfficerId = "OFF-RECOVERY-REJ-1";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(recoveryOfficerId, "RecoveryOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    const proposed = await proposeEnforceCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      reason: "Suspected but unconfirmed default", gsmExhausted: false, proposedByOfficerId: recoveryOfficerId,
    });

    const result = await rejectEnforce(vetifySession(), Number(proposed.pendingCollateralEnforcementId));
    assert.equal(Number(result.pendingCollateralEnforcementId), Number(proposed.pendingCollateralEnforcementId));

    const { rows: pending } = await fixtureClient.query(
      "SELECT status FROM pending_collateral_enforcement WHERE id = $1",
      [proposed.pendingCollateralEnforcementId],
    );
    assert.equal(pending[0].status, "Rejected");

    const { rows: rahn } = await fixtureClient.query("SELECT collateral_status FROM rahn_agreement WHERE id = $1", [pledge.rahnAgreementId]);
    assert.equal(rahn[0].collateral_status, "CollateralActive");
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id = $1`, [recoveryOfficerId]);
  }
});

test("rejectEnforce: rejects a pending request that is not pending", async () => {
  const cac = "RC8000019";
  const recoveryOfficerId = "OFF-RECOVERY-REJ-2";
  try {
    const contractId = await buildContractFixture(cac, `FAC-${cac}`);
    await registerOfficer(recoveryOfficerId, "RecoveryOfficer");
    const pledge = await pledgeCollateral(fiSession(), contractId, { collateralDescription: "Plot 14", collateralValue: 1_000_000 });
    const proposed = await proposeEnforceCollateral(fiSession(), Number(pledge.rahnAgreementId), {
      reason: "First attempt", gsmExhausted: false, proposedByOfficerId: recoveryOfficerId,
    });
    await rejectEnforce(vetifySession(), Number(proposed.pendingCollateralEnforcementId));

    await assert.rejects(
      () => rejectEnforce(vetifySession(), Number(proposed.pendingCollateralEnforcementId)),
      (err: unknown) => err instanceof DomainError && err.message === "PendingCollateralEnforcement is not pending",
    );
  } finally {
    await cleanup(cac);
    await fixtureClient.query(`DELETE FROM authorized_officer WHERE officer_id = $1`, [recoveryOfficerId]);
  }
});
