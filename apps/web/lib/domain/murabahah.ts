import type { PoolClient } from "pg";
import type { SessionContext } from "@/lib/db";
import { withTransaction } from "@/lib/db";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { DomainError } from "@/lib/errors";
import type { MurabahahTerms, PaymentScheduleEntry } from "@/lib/types-murabahah";

// node-pg parses a DATE column into a local-midnight JS Date object, not a
// string -- comparing it directly against a "YYYY-MM-DD" string (or calling
// toISOString(), which converts to UTC and can shift the date backward by a
// day depending on the server's timezone) both produce wrong results. Reads
// the Date's own local getters instead, matching how pg constructed it.
function dateOnlyString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  const d = value as Date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Phase 2, second slice (Stage 8, the Murabahah acquisition chain) -- see
// migrations/006_murabahah_stage8.sql's header for what's deliberately
// deferred (the Wakala agency detour, supporting/exception choices,
// RevokeCertification, and everything past contract formation --
// Stage 9-10's repayment lifecycle is a separate later pass).

// ─── Choice: ProceedDirectly (MurabahahWad, financialInstitution) ─────────
// Daml's "Path B" -- the FI purchases the asset directly from the supplier.
// (Path A, ProceedWithWakala, is the deferred agency detour.)

interface ProceedDirectlyArgs {
  actualCost: number;
  purchaseDate: string;
  invoiceRef: string;
  freightCost?: number;
  customsDuty?: number;
  insurancePremium?: number;
  otherAcquisitionCosts?: number;
}

async function proceedDirectlyImpl(session: SessionContext, wadId: number, args: ProceedDirectlyArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_wad WHERE id = $1 FOR UPDATE", [wadId]);
    const wad = rows[0];
    if (!wad) throw new DomainError("MurabahahWad not found");
    if (wad.archived_at) throw new DomainError("MurabahahWad is no longer active");
    if (args.actualCost <= 0) throw new DomainError("Actual purchase cost must be positive");

    const freightCost = args.freightCost ?? 0;
    const customsDuty = args.customsDuty ?? 0;
    const insurancePremium = args.insurancePremium ?? 0;
    const otherAcquisitionCosts = args.otherAcquisitionCosts ?? 0;
    const totalAcquisitionCost = args.actualCost + freightCost + customsDuty + insurancePremium + otherAcquisitionCosts;

    const { rows: record } = await client.query(
      `INSERT INTO asset_purchase_record
         (murabahah_wad_id, cac_reg_number, business_name, terms_amount, terms_purpose,
          terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref,
          asset_estimated_cost, actual_cost, purchase_date, invoice_ref, freight_cost,
          customs_duty, insurance_premium, other_acquisition_costs, total_acquisition_cost,
          purchased_via_wakala)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, false)
       RETURNING id`,
      [
        wadId,
        wad.cac_reg_number,
        wad.business_name,
        wad.terms_amount,
        wad.terms_purpose,
        wad.terms_tenure_months,
        wad.asset_description,
        wad.asset_supplier,
        wad.asset_supplier_ref,
        wad.asset_estimated_cost,
        args.actualCost,
        args.purchaseDate,
        args.invoiceRef,
        freightCost,
        customsDuty,
        insurancePremium,
        otherAcquisitionCosts,
        totalAcquisitionCost,
      ],
    );

    await client.query(
      `UPDATE murabahah_wad
         SET archived_at = now(), superseded_by_kind = 'asset_purchase_record', superseded_by_id = $2
         WHERE id = $1`,
      [wadId, record[0].id],
    );

    return { assetPurchaseRecordId: record[0].id };
  });
}
export const proceedDirectly = withAuthorization(["financialInstitution"], proceedDirectlyImpl);

// ─── Choice: ProceedWithWakala (MurabahahWad, financialInstitution) ───────
// Phase 2, Twenty-Fourth Slice. Path A -- the deferred agency detour named
// in this file's very first comment on ProceedDirectly, since the Second
// Slice. Takes no arguments in the real Daml signature at all (agencyFee is
// hardcoded to None there too -- ported exactly, not invented as a caller
// argument).

async function proceedWithWakalaImpl(session: SessionContext, wadId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_wad WHERE id = $1 FOR UPDATE", [wadId]);
    const wad = rows[0];
    if (!wad) throw new DomainError("MurabahahWad not found");
    if (wad.archived_at) throw new DomainError("MurabahahWad is no longer active");

    const { rows: wakala } = await client.query(
      `INSERT INTO murabahah_wakala
         (murabahah_wad_id, cac_reg_number, business_name, terms_amount, terms_purpose,
          terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref, asset_estimated_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        wadId, wad.cac_reg_number, wad.business_name, wad.terms_amount, wad.terms_purpose,
        wad.terms_tenure_months, wad.asset_description, wad.asset_supplier, wad.asset_supplier_ref, wad.asset_estimated_cost,
      ],
    );
    const murabahahWakalaId = wakala[0].id;

    await client.query(
      `UPDATE murabahah_wad SET archived_at = now(), superseded_by_kind = 'murabahah_wakala', superseded_by_id = $2 WHERE id = $1`,
      [wadId, murabahahWakalaId],
    );

    return { murabahahWakalaId };
  });
}
export const proceedWithWakala = withAuthorization(["financialInstitution"], proceedWithWakalaImpl);

// ─── Choice: WithdrawWad (MurabahahWad, business) ──────────────────────────

async function withdrawWadImpl(session: SessionContext, wadId: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_wad WHERE id = $1 FOR UPDATE", [wadId]);
    const wad = rows[0];
    if (!wad) throw new DomainError("MurabahahWad not found");
    if (wad.archived_at) throw new DomainError("MurabahahWad is no longer active");

    const { rows: record } = await client.query(
      `INSERT INTO wad_withdrawal_record (murabahah_wad_id, cac_reg_number, business_name, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [wadId, wad.cac_reg_number, wad.business_name, args.reason],
    );
    const wadWithdrawalRecordId = record[0].id;

    await client.query(
      `UPDATE murabahah_wad SET archived_at = now(), superseded_by_kind = 'wad_withdrawal_record', superseded_by_id = $2 WHERE id = $1`,
      [wadId, wadWithdrawalRecordId],
    );

    return { wadWithdrawalRecordId };
  });
}
export const withdrawWad = withAuthorization(["business"], withdrawWadImpl);

// ─── MurabahahWakala: RecordAssetPurchase + DeclineAgency ─────────────────
// Both consuming on the real Daml MurabahahWakala template, business-
// controlled. asset_purchase_record.murabahah_wad_id is set to the
// *originating* Wad's id (via wakala.murabahah_wad_id), not a new wakala-
// specific FK -- see migrations/025's header for why.

interface RecordAssetPurchaseArgs {
  actualCost: number;
  purchaseDate: string;
  invoiceRef: string;
  freightCost?: number;
  customsDuty?: number;
  insurancePremium?: number;
  otherAcquisitionCosts?: number;
}

async function recordAssetPurchaseImpl(session: SessionContext, wakalaId: number, args: RecordAssetPurchaseArgs) {
  if (!(args.actualCost > 0)) throw new DomainError("Actual purchase cost must be positive");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_wakala WHERE id = $1 FOR UPDATE", [wakalaId]);
    const wakala = rows[0];
    if (!wakala) throw new DomainError("MurabahahWakala not found");
    if (wakala.archived_at) throw new DomainError("MurabahahWakala is no longer active");

    const freightCost = args.freightCost ?? 0;
    const customsDuty = args.customsDuty ?? 0;
    const insurancePremium = args.insurancePremium ?? 0;
    const otherAcquisitionCosts = args.otherAcquisitionCosts ?? 0;
    const totalAcquisitionCost = args.actualCost + freightCost + customsDuty + insurancePremium + otherAcquisitionCosts;

    const { rows: record } = await client.query(
      `INSERT INTO asset_purchase_record
         (murabahah_wad_id, cac_reg_number, business_name, terms_amount, terms_purpose,
          terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref,
          asset_estimated_cost, actual_cost, purchase_date, invoice_ref, freight_cost,
          customs_duty, insurance_premium, other_acquisition_costs, total_acquisition_cost,
          purchased_via_wakala)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, true)
       RETURNING id`,
      [
        wakala.murabahah_wad_id,
        wakala.cac_reg_number,
        wakala.business_name,
        wakala.terms_amount,
        wakala.terms_purpose,
        wakala.terms_tenure_months,
        wakala.asset_description,
        wakala.asset_supplier,
        wakala.asset_supplier_ref,
        wakala.asset_estimated_cost,
        args.actualCost,
        args.purchaseDate,
        args.invoiceRef,
        freightCost,
        customsDuty,
        insurancePremium,
        otherAcquisitionCosts,
        totalAcquisitionCost,
      ],
    );
    const assetPurchaseRecordId = record[0].id;

    await client.query(
      `UPDATE murabahah_wakala SET archived_at = now(), superseded_by_kind = 'asset_purchase_record', superseded_by_id = $2 WHERE id = $1`,
      [wakalaId, assetPurchaseRecordId],
    );

    return { assetPurchaseRecordId };
  });
}
export const recordAssetPurchase = withAuthorization(["business"], recordAssetPurchaseImpl);

async function declineAgencyImpl(session: SessionContext, wakalaId: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_wakala WHERE id = $1 FOR UPDATE", [wakalaId]);
    const wakala = rows[0];
    if (!wakala) throw new DomainError("MurabahahWakala not found");
    if (wakala.archived_at) throw new DomainError("MurabahahWakala is no longer active");

    const { rows: record } = await client.query(
      `INSERT INTO agency_withdrawal_record (murabahah_wakala_id, cac_reg_number, business_name, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [wakalaId, wakala.cac_reg_number, wakala.business_name, args.reason],
    );
    const agencyWithdrawalRecordId = record[0].id;

    await client.query(
      `UPDATE murabahah_wakala SET archived_at = now(), superseded_by_kind = 'agency_withdrawal_record', superseded_by_id = $2 WHERE id = $1`,
      [wakalaId, agencyWithdrawalRecordId],
    );

    return { agencyWithdrawalRecordId };
  });
}
export const declineAgency = withAuthorization(["business"], declineAgencyImpl);

export async function listMurabahahWakalas(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM murabahah_wakala ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listWadWithdrawalRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM wad_withdrawal_record ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listAgencyWithdrawalRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM agency_withdrawal_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: AcknowledgeDelivery (AssetPurchaseRecord, business) -- Qabdh ──

async function acknowledgeDeliveryImpl(session: SessionContext, recordId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT delivery_acknowledged FROM asset_purchase_record WHERE id = $1 FOR UPDATE",
      [recordId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("AssetPurchaseRecord not found");
    if (row.delivery_acknowledged) throw new DomainError("Delivery already acknowledged");

    const { rows: updated } = await client.query(
      `UPDATE asset_purchase_record SET delivery_acknowledged = true, updated_at = now()
         WHERE id = $1 RETURNING id, delivery_acknowledged`,
      [recordId],
    );
    return updated[0];
  });
}
export const acknowledgeDelivery = withAuthorization(["business"], acknowledgeDeliveryImpl);

// ─── Choice: OfferMurabahah (AssetPurchaseRecord, financialInstitution) ────
// Ijab -- gated by Qabdh (deliveryAcknowledged).

interface OfferMurabahahArgs {
  murabahahTerms: MurabahahTerms;
  paymentSchedule: PaymentScheduleEntry[];
  facilityRef: string;
  startDate: string;
  acceptanceExpiresAt?: string | null;
}

async function offerMurabahahImpl(session: SessionContext, recordId: number, args: OfferMurabahahArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM asset_purchase_record WHERE id = $1 FOR UPDATE", [recordId]);
    const record = rows[0];
    if (!record) throw new DomainError("AssetPurchaseRecord not found");
    if (!record.delivery_acknowledged) {
      throw new DomainError("Delivery must be acknowledged (Qabdh) before making the sale offer");
    }
    if (Number(record.total_acquisition_cost) !== args.murabahahTerms.assetCost) {
      throw new DomainError("Disclosed cost must match total acquisition cost (AAOIFI §3/3)");
    }
    if (args.murabahahTerms.salePrice !== args.murabahahTerms.assetCost + args.murabahahTerms.profitAmount) {
      throw new DomainError("Disclosed profit invariant: salePrice must equal assetCost + profitAmount");
    }
    if (args.murabahahTerms.profitAmount < 0) throw new DomainError("Profit must be non-negative");
    if (args.paymentSchedule.length !== args.murabahahTerms.tenureMonths) {
      throw new DomainError("Payment schedule length must match tenure");
    }
    if (!args.facilityRef) throw new DomainError("Facility reference must not be empty");
    if (args.acceptanceExpiresAt && new Date(args.acceptanceExpiresAt).getTime() <= Date.now()) {
      throw new DomainError("acceptanceExpiresAt must be in the future");
    }

    const { rows: proposal } = await client.query(
      `INSERT INTO murabahah_proposal
         (asset_purchase_record_id, facility_ref, cac_reg_number, business_name, terms_amount,
          terms_purpose, terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref,
          asset_estimated_cost, actual_cost, asset_cost, profit_amount, sale_price, installment_amount,
          murabahah_tenure_months, profit_rate, effective_rate, payment_schedule, start_date,
          acceptance_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING id`,
      [
        recordId,
        args.facilityRef,
        record.cac_reg_number,
        record.business_name,
        record.terms_amount,
        record.terms_purpose,
        record.terms_tenure_months,
        record.asset_description,
        record.asset_supplier,
        record.asset_supplier_ref,
        record.asset_estimated_cost,
        record.total_acquisition_cost,
        args.murabahahTerms.assetCost,
        args.murabahahTerms.profitAmount,
        args.murabahahTerms.salePrice,
        args.murabahahTerms.installmentAmount,
        args.murabahahTerms.tenureMonths,
        args.murabahahTerms.profitRate ?? null,
        args.murabahahTerms.effectiveRate ?? null,
        JSON.stringify(args.paymentSchedule),
        args.startDate,
        args.acceptanceExpiresAt ?? null,
      ],
    );

    // Mirrors proceedDirectlyImpl/acceptProposalImpl's archive-on-supersede
    // pattern -- found missing while building the Stage 8 acquisition-queue
    // UI: without this, an offered AssetPurchaseRecord never left
    // listAssetPurchaseRecords' `WHERE archived_at IS NULL` result set, so
    // it kept reappearing in the FI's "ready to offer" queue after already
    // being offered.
    await client.query(
      `UPDATE asset_purchase_record
         SET archived_at = now(), superseded_by_kind = 'murabahah_proposal', superseded_by_id = $2
         WHERE id = $1`,
      [recordId, proposal[0].id],
    );

    return { murabahahProposalId: proposal[0].id };
  });
}
export const offerMurabahah = withAuthorization(["financialInstitution"], offerMurabahahImpl);

// ─── Choice: CertifyShariahTerms (MurabahahProposal, advisor+vetify dual) ──
// G11 -- the SSB's per-contract sign-off, closing the AAOIFI GSIFI No. 1/2
// governance loop the Stage-3 sector pre-check alone leaves open.

interface CertifyShariahTermsArgs {
  certificationRef: string;
  aaoifiStandards: string[];
  rationale: string;
  certifiedBy: string;
}

async function certifyShariahTermsImpl(session: SessionContext, proposalId: number, args: CertifyShariahTermsArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_proposal WHERE id = $1", [proposalId]);
    const proposal = rows[0];
    if (!proposal) throw new DomainError("MurabahahProposal not found");
    if (!args.certificationRef) throw new DomainError("Certification reference must not be empty");
    if (!args.certifiedBy) throw new DomainError("Certifying scholar/member must be named");

    const { rows: cert } = await client.query(
      `INSERT INTO shariah_contract_certification
         (murabahah_proposal_id, facility_ref, cac_reg_number, business_name, certified_sale_price,
          certified_asset_cost, certified_profit_amount, certified_tenure_months, certification_ref,
          verdict, aaoifi_standards, rationale, certified_by, certified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'COMPLIANT', $10, $11, $12, now())
       RETURNING id`,
      [
        proposalId,
        proposal.facility_ref,
        proposal.cac_reg_number,
        proposal.business_name,
        proposal.sale_price,
        proposal.asset_cost,
        proposal.profit_amount,
        proposal.murabahah_tenure_months,
        args.certificationRef,
        JSON.stringify(args.aaoifiStandards),
        args.rationale,
        args.certifiedBy,
      ],
    );
    return { shariahContractCertificationId: cert[0].id };
  });
}
export const certifyShariahTerms = withAuthorization(["advisor", "vetify"], certifyShariahTermsImpl);

// ─── Choice: AcceptProposal (MurabahahProposal, business) -- Qabul ─────────
// The G11 hard gate: a missing, revoked, or stale-terms certification blocks
// acceptance entirely. Mirrors Daml's AcceptProposal exactly -- facility,
// advisor-issuer, verdict, and all four certified figures must match.

interface AcceptProposalArgs {
  certificationId: number;
}

async function acceptProposalImpl(session: SessionContext, proposalId: number, args: AcceptProposalArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_proposal WHERE id = $1 FOR UPDATE", [proposalId]);
    const proposal = rows[0];
    if (!proposal) throw new DomainError("MurabahahProposal not found");
    if (proposal.archived_at) throw new DomainError("MurabahahProposal is no longer active");

    const { rows: certRows } = await client.query(
      "SELECT * FROM shariah_contract_certification WHERE id = $1",
      [args.certificationId],
    );
    const cert = certRows[0];
    if (!cert) throw new DomainError("Certification not found");
    if (cert.archived_at) throw new DomainError("Certification has been revoked");
    if (cert.facility_ref !== proposal.facility_ref) {
      throw new DomainError("Certification is for a different facility");
    }
    if (cert.verdict !== "COMPLIANT") throw new DomainError("Certification verdict is not COMPLIANT");
    if (Number(cert.certified_sale_price) !== Number(proposal.sale_price)) {
      throw new DomainError("Certified sale price does not match the proposal's terms");
    }
    if (Number(cert.certified_profit_amount) !== Number(proposal.profit_amount)) {
      throw new DomainError("Certified profit amount does not match the proposal's terms");
    }
    if (Number(cert.certified_asset_cost) !== Number(proposal.asset_cost)) {
      throw new DomainError("Certified asset cost does not match the proposal's terms");
    }
    if (cert.certified_tenure_months !== proposal.murabahah_tenure_months) {
      throw new DomainError("Certified tenure does not match the proposal's terms");
    }

    const { rows: contract } = await client.query(
      `INSERT INTO murabahah_contract
         (murabahah_proposal_id, facility_ref, cac_reg_number, business_name, terms_amount,
          terms_purpose, terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref,
          asset_estimated_cost, asset_cost, profit_amount, sale_price, installment_amount,
          murabahah_tenure_months, payment_schedule, start_date, outstanding_balance,
          shariah_certification_ref, shariah_certified_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING id`,
      [
        proposalId,
        proposal.facility_ref,
        proposal.cac_reg_number,
        proposal.business_name,
        proposal.terms_amount,
        proposal.terms_purpose,
        proposal.terms_tenure_months,
        proposal.asset_description,
        proposal.asset_supplier,
        proposal.asset_supplier_ref,
        proposal.asset_estimated_cost,
        proposal.asset_cost,
        proposal.profit_amount,
        proposal.sale_price,
        proposal.installment_amount,
        proposal.murabahah_tenure_months,
        // pg auto-parses jsonb columns into JS values on SELECT, but does
        // NOT auto-serialize them back on the way into another jsonb
        // parameter -- re-stringify explicitly (found live: "invalid input
        // syntax for type json" without this).
        JSON.stringify(proposal.payment_schedule),
        proposal.start_date,
        proposal.sale_price,
        cert.certification_ref,
        cert.certified_by,
      ],
    );

    await client.query(
      `UPDATE murabahah_proposal
         SET archived_at = now(), superseded_by_kind = 'murabahah_contract', superseded_by_id = $2
         WHERE id = $1`,
      [proposalId, contract[0].id],
    );

    return { murabahahContractId: contract[0].id };
  });
}
export const acceptProposal = withAuthorization(["business"], acceptProposalImpl);

// ─── Choice: DeclineProposal (MurabahahProposal, business) ────────────────
// Phase 2, Twenty-Fourth Slice. Consuming in the real Daml (no
// `nonconsuming` keyword) -- archives the proposal, creates
// ProposalDeclineRecord. murabahah_proposal_update already covers
// `business` (no RLS gap here, unlike murabahah_wad's own update policy --
// see migrations/025's header).

async function declineProposalImpl(session: SessionContext, proposalId: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_proposal WHERE id = $1 FOR UPDATE", [proposalId]);
    const proposal = rows[0];
    if (!proposal) throw new DomainError("MurabahahProposal not found");
    if (proposal.archived_at) throw new DomainError("MurabahahProposal is no longer active");

    const { rows: record } = await client.query(
      `INSERT INTO proposal_decline_record (murabahah_proposal_id, facility_ref, cac_reg_number, business_name, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [proposalId, proposal.facility_ref, proposal.cac_reg_number, proposal.business_name, args.reason],
    );
    const proposalDeclineRecordId = record[0].id;

    await client.query(
      `UPDATE murabahah_proposal SET archived_at = now(), superseded_by_kind = 'proposal_decline_record', superseded_by_id = $2 WHERE id = $1`,
      [proposalId, proposalDeclineRecordId],
    );

    return { proposalDeclineRecordId };
  });
}
export const declineProposal = withAuthorization(["business"], declineProposalImpl);

export async function listProposalDeclineRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM proposal_decline_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Reads ──────────────────────────────────────────────────────────────

export async function listMurabahahWads(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM murabahah_wad WHERE archived_at IS NULL ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function listAssetPurchaseRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM asset_purchase_record WHERE archived_at IS NULL ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function listMurabahahProposals(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM murabahah_proposal WHERE archived_at IS NULL ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function listShariahContractCertifications(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM shariah_contract_certification WHERE archived_at IS NULL ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function listMurabahahContracts(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM murabahah_contract ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listRepaymentRecords(session: SessionContext, murabahahContractId?: number) {
  return withTransaction(session, async (client) => {
    const { rows } = murabahahContractId
      ? await client.query(
          `SELECT * FROM repayment_record WHERE murabahah_contract_id = $1 ORDER BY installment_no ASC`,
          [murabahahContractId],
        )
      : await client.query(`SELECT * FROM repayment_record ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listLatePaymentCharities(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM late_payment_charity ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listAuditEvents(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM audit_event ORDER BY occurred_at DESC`);
    return rows;
  });
}

// ─── Phase 2, third slice: Stage 9-10 (repayment lifecycle) ───────────────
// See migrations/008_murabahah_stage9_10.sql's header for exact scope and
// deferrals.

// ─── Choice: RecordPayment (MurabahahContract, financialInstitution) ─────

interface RecordPaymentArgs {
  paymentDate: string;
  amountPaid: number;
  installmentNo: number;
}

async function recordPaymentImpl(session: SessionContext, contractId: number, args: RecordPaymentArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (!(contract.status === "Active" || contract.status === "Delinquent")) {
      throw new DomainError("Can only record payment on an Active or Delinquent contract");
    }
    if (!(args.amountPaid > 0)) throw new DomainError("Payment amount must be positive");
    const outstandingBalance = Number(contract.outstanding_balance);
    if (!(args.amountPaid <= outstandingBalance)) throw new DomainError("Payment exceeds outstanding balance");
    if (args.installmentNo !== contract.installments_paid + 1) {
      throw new DomainError("Installment number out of sequence");
    }

    const schedule = contract.payment_schedule as PaymentScheduleEntry[];
    const entry = schedule.find((e) => e.installmentNo === args.installmentNo);
    if (!entry) throw new DomainError("Installment not found in payment schedule");

    const newBalance = outstandingBalance - args.amountPaid;
    const pendingInstallmentPaid = Number(contract.pending_installment_paid);
    const totalForInstallment = pendingInstallmentPaid + args.amountPaid;
    const installmentComplete = totalForInstallment >= Number(entry.dueAmount);
    // Mirrors Daml's isPaymentLate (Murabahah.daml line ~39): a payment made
    // on or before an active moratorium's end date never counts as late,
    // even if past the installment's own due date. Phase 2, tenth slice --
    // migrations/015_murabahah_moratorium_hamish.sql's header -- closes what
    // was previously a hardcoded always-None simplification here.
    const activeMoratorium = dateOnlyString(contract.active_moratorium);
    const isLate = args.paymentDate > entry.dueDate && !(activeMoratorium != null && args.paymentDate <= activeMoratorium);

    const newInstallmentsPaid = installmentComplete ? contract.installments_paid + 1 : contract.installments_paid;
    const newPendingPaid = installmentComplete ? 0 : totalForInstallment;

    await client.query(
      `UPDATE murabahah_contract
         SET outstanding_balance = $2, installments_paid = $3, pending_installment_paid = $4, updated_at = now()
         WHERE id = $1`,
      [contractId, newBalance, newInstallmentsPaid, newPendingPaid],
    );

    const { rows: recordRows } = await client.query(
      `INSERT INTO repayment_record
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, installment_no,
          due_date, payment_date, amount_paid, remaining_balance, was_late)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        contractId,
        contract.facility_ref,
        contract.cac_reg_number,
        contract.business_name,
        args.installmentNo,
        entry.dueDate,
        args.paymentDate,
        args.amountPaid,
        newBalance,
        isLate,
      ],
    );
    const repaymentRecordId = recordRows[0].id;

    // Sadaqah only on the completing payment of a late installment (AAOIFI
    // Std No. 8, S2/4/20).
    let charityObligationId: number | null = null;
    if (isLate && installmentComplete) {
      const { rows: charityRows } = await client.query(
        `INSERT INTO late_payment_charity
           (murabahah_contract_id, repayment_record_id, cac_reg_number, business_name, installment_no,
            due_date, payment_date, charity_amount, settled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, false)
         RETURNING id`,
        [
          contractId,
          repaymentRecordId,
          contract.cac_reg_number,
          contract.business_name,
          args.installmentNo,
          entry.dueDate,
          args.paymentDate,
        ],
      );
      charityObligationId = charityRows[0].id;
    }

    return { murabahahContractId: contractId, repaymentRecordId, charityObligationId };
  });
}
export const recordPayment = withAuthorization(["financialInstitution"], recordPaymentImpl);

// ─── Choice: FlagDelinquent / ResumeActive (MurabahahContract, sentinel+vetify) ──
// Dual controller in the Daml original; this REST layer follows the same
// simplification as beginUnderwriting -- either role may call the endpoint,
// since a single backend session already acts as one Canton party at a
// time and there is no second-signature step to model here.

const VALID_TRANSITIONS: Record<string, string[]> = {
  Active: ["Delinquent", "Completed", "DelinquencyManualReview"],
  Delinquent: ["Active", "Completed", "Defaulted"],
  Defaulted: ["Completed"],
  DelinquencyManualReview: ["Active", "Delinquent"],
};

function assertValidTransition(from: string, to: string) {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new DomainError("Invalid status transition");
  }
}

async function flagDelinquentImpl(
  session: SessionContext,
  contractId: number,
  args: { reason: string; sentinelId: number },
) {
  return withTransaction(session, async (client) => {
    // Inlined against the same client/transaction rather than calling the
    // standalone requireActiveSentinel export (which opens its own pool
    // connection) -- keeping the registry check and the contract lock
    // atomic mirrors the Daml original's guarantee, where requireActiveX
    // runs in the same ledger transaction as the choice body.
    const { rows: sentinelRows } = await client.query("SELECT active FROM authorized_sentinel WHERE id = $1", [
      args.sentinelId,
    ]);
    if (!sentinelRows[0] || !sentinelRows[0].active) throw new DomainError("Sentinel is not active");

    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    assertValidTransition(contract.status, "Delinquent");

    await client.query(`UPDATE murabahah_contract SET status = 'Delinquent', updated_at = now() WHERE id = $1`, [
      contractId,
    ]);
    const { rows: evtRows } = await client.query(
      `INSERT INTO audit_event (murabahah_contract_id, cac_reg_number, business_name, event_type, description, acted_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        contractId,
        contract.cac_reg_number,
        contract.business_name,
        "DELINQUENCY_FLAGGED",
        `MurabahahContract ${contract.facility_ref} flagged delinquent: ${args.reason}`,
        "sentinel",
      ],
    );
    return { murabahahContractId: contractId, auditEventId: evtRows[0].id };
  });
}
export const flagDelinquent = withAuthorization(["sentinel", "vetify"], flagDelinquentImpl);

async function resumeActiveImpl(session: SessionContext, contractId: number, args: { note: string; sentinelId: number }) {
  return withTransaction(session, async (client) => {
    const { rows: sentinelRows } = await client.query("SELECT active FROM authorized_sentinel WHERE id = $1", [
      args.sentinelId,
    ]);
    if (!sentinelRows[0] || !sentinelRows[0].active) throw new DomainError("Sentinel is not active");

    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    assertValidTransition(contract.status, "Active");

    await client.query(`UPDATE murabahah_contract SET status = 'Active', updated_at = now() WHERE id = $1`, [
      contractId,
    ]);
    const { rows: evtRows } = await client.query(
      `INSERT INTO audit_event (murabahah_contract_id, cac_reg_number, business_name, event_type, description, acted_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        contractId,
        contract.cac_reg_number,
        contract.business_name,
        "CONTRACT_RESUMED",
        `MurabahahContract ${contract.facility_ref} resumed to Active: ${args.note}`,
        "sentinel",
      ],
    );
    return { murabahahContractId: contractId, auditEventId: evtRows[0].id };
  });
}
export const resumeActive = withAuthorization(["sentinel", "vetify"], resumeActiveImpl);

// ─── Choice: CloseContract (MurabahahContract, financialInstitution) ─────

async function closeContractImpl(session: SessionContext, contractId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (!(contract.status === "Active" || contract.status === "Delinquent")) {
      throw new DomainError("Can only close an Active or Delinquent contract");
    }
    assertValidTransition(contract.status, "Completed");
    if (!(Number(contract.outstanding_balance) <= 0)) {
      throw new DomainError("Can only close a fully repaid contract");
    }
    await client.query(`UPDATE murabahah_contract SET status = 'Completed', updated_at = now() WHERE id = $1`, [
      contractId,
    ]);
    return { murabahahContractId: contractId };
  });
}
export const closeContract = withAuthorization(["financialInstitution"], closeContractImpl);

// ─── Phase 2, fifth slice: Ibra, LatePaymentCharity settlement, Default ───
// See migrations/010_murabahah_ibra_charity_default.sql's header for scope.

// ─── Choice: RequestIbra (MurabahahContract, business, nonconsuming) ─────

interface RequestIbraArgs {
  requestedSettlementDate: string;
  settlementType: "FullIbra" | "PartialIbra";
  requestedAmount?: number | null;
}

async function requestIbraImpl(session: SessionContext, contractId: number, args: RequestIbraArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (contract.status !== "Active") throw new DomainError("Ibra' can only be requested on an Active contract");
    if (args.requestedAmount != null) {
      const outstanding = Number(contract.outstanding_balance);
      if (!(args.requestedAmount > 0 && args.requestedAmount < outstanding)) {
        throw new DomainError("Partial settlement amount must be positive and less than outstanding balance");
      }
    }

    const { rows: inserted } = await client.query(
      `INSERT INTO ibra_request
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, outstanding_balance,
          requested_settlement_date, settlement_type, requested_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        contractId,
        contract.facility_ref,
        contract.cac_reg_number,
        contract.business_name,
        contract.outstanding_balance,
        args.requestedSettlementDate,
        args.settlementType,
        args.requestedAmount ?? null,
      ],
    );
    return { ibraRequestId: inserted[0].id };
  });
}
export const requestIbra = withAuthorization(["business"], requestIbraImpl);

// ─── Choice: GrantIbra (IbraRequest, financialInstitution) ────────────────
// Four-eyes: a CreditOfficer proposes, a different RiskOfficer confirms --
// the first choice in this migration to consume the AuthorizedOfficer
// registry built in an earlier, unrelated slice (Governance).

interface GrantIbraArgs {
  rebateAmount: number;
  proposedByOfficerId: string;
  confirmedByOfficerId: string;
}

async function grantIbraImpl(session: SessionContext, ibraRequestId: number, args: GrantIbraArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM ibra_request WHERE id = $1 FOR UPDATE", [ibraRequestId]);
    const request = rows[0];
    if (!request) throw new DomainError("IbraRequest not found");
    if (request.archived_at) throw new DomainError("IbraRequest is no longer active");
    if (request.settlement_type !== "FullIbra") {
      throw new DomainError("GrantIbra is for full settlement; use GrantPartialIbra for partial");
    }
    const outstandingBalance = Number(request.outstanding_balance);
    if (!(args.rebateAmount <= outstandingBalance)) throw new DomainError("Rebate cannot exceed outstanding balance");
    if (!(args.rebateAmount >= 0)) throw new DomainError("Rebate must be non-negative");
    if (args.proposedByOfficerId === args.confirmedByOfficerId) {
      throw new DomainError("Confirming officer must differ from proposing officer (four-eyes)");
    }

    // Inlined against the same client/transaction (mirrors flagDelinquent/
    // resumeActive's precedent in this file) rather than calling a
    // standalone requireActiveOfficerWithRole export, keeping the officer
    // checks and the IbraRequest archive atomic.
    const { rows: proposer } = await client.query("SELECT active, roles FROM authorized_officer WHERE officer_id = $1", [
      args.proposedByOfficerId,
    ]);
    if (!proposer[0] || !proposer[0].active) throw new DomainError(`Officer ${args.proposedByOfficerId} is not active`);
    if (!(proposer[0].roles ?? []).includes("CreditOfficer")) {
      throw new DomainError(`Officer ${args.proposedByOfficerId} does not hold the required role`);
    }
    const { rows: confirmer } = await client.query("SELECT active, roles FROM authorized_officer WHERE officer_id = $1", [
      args.confirmedByOfficerId,
    ]);
    if (!confirmer[0] || !confirmer[0].active) throw new DomainError(`Officer ${args.confirmedByOfficerId} is not active`);
    if (!(confirmer[0].roles ?? []).includes("RiskOfficer")) {
      throw new DomainError(`Officer ${args.confirmedByOfficerId} does not hold the required role`);
    }

    const { rows: grant } = await client.query(
      `INSERT INTO ibra_grant_record
         (ibra_request_id, facility_ref, cac_reg_number, business_name, outstanding_balance,
          rebate_amount, effective_date, proposed_by_officer_id, confirmed_by_officer_id, granted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       RETURNING id`,
      [
        ibraRequestId,
        request.facility_ref,
        request.cac_reg_number,
        request.business_name,
        request.outstanding_balance,
        args.rebateAmount,
        request.requested_settlement_date,
        args.proposedByOfficerId,
        args.confirmedByOfficerId,
      ],
    );

    await client.query(
      `UPDATE ibra_request SET archived_at = now(), superseded_by_kind = 'ibra_grant_record', superseded_by_id = $2 WHERE id = $1`,
      [ibraRequestId, grant[0].id],
    );

    return { ibraGrantRecordId: grant[0].id };
  });
}
export const grantIbra = withAuthorization(["financialInstitution"], grantIbraImpl);

// ─── Choice: DeclineIbra (IbraRequest, financialInstitution) ─────────────

async function declineIbraImpl(session: SessionContext, ibraRequestId: number, args: { reason: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM ibra_request WHERE id = $1 FOR UPDATE", [ibraRequestId]);
    const request = rows[0];
    if (!request) throw new DomainError("IbraRequest not found");
    if (request.archived_at) throw new DomainError("IbraRequest is no longer active");
    if (!args.reason) throw new DomainError("Reason must not be empty");

    const { rows: decline } = await client.query(
      `INSERT INTO ibra_decline_record
         (ibra_request_id, facility_ref, cac_reg_number, business_name, outstanding_balance, reason, declined_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING id`,
      [ibraRequestId, request.facility_ref, request.cac_reg_number, request.business_name, request.outstanding_balance, args.reason],
    );

    await client.query(
      `UPDATE ibra_request SET archived_at = now(), superseded_by_kind = 'ibra_decline_record', superseded_by_id = $2 WHERE id = $1`,
      [ibraRequestId, decline[0].id],
    );

    return { ibraDeclineRecordId: decline[0].id };
  });
}
export const declineIbra = withAuthorization(["financialInstitution"], declineIbraImpl);

// ─── Choice: SetCharityAmount (LatePaymentCharity, financialInstitution) ──

async function setCharityAmountImpl(session: SessionContext, charityId: number, args: { amount: number }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM late_payment_charity WHERE id = $1 FOR UPDATE", [charityId]);
    const charity = rows[0];
    if (!charity) throw new DomainError("LatePaymentCharity not found");
    if (!(args.amount > 0)) throw new DomainError("Charity amount must be positive");
    if (charity.settled) throw new DomainError("Amount already settled");

    await client.query(`UPDATE late_payment_charity SET charity_amount = $2 WHERE id = $1`, [charityId, args.amount]);
    return { latePaymentCharityId: charityId };
  });
}
export const setCharityAmount = withAuthorization(["financialInstitution"], setCharityAmountImpl);

// ─── Choice: ConfirmCharityPayment (LatePaymentCharity, business) ─────────

async function confirmCharityPaymentImpl(
  session: SessionContext,
  charityId: number,
  args: { charityRef: string; charityOrganization: string },
) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM late_payment_charity WHERE id = $1 FOR UPDATE", [charityId]);
    const charity = rows[0];
    if (!charity) throw new DomainError("LatePaymentCharity not found");
    if (charity.charity_amount == null) throw new DomainError("Charity amount must be set before settlement");
    if (!args.charityOrganization) throw new DomainError("Charity organization must not be empty");

    const { rows: record } = await client.query(
      `INSERT INTO charity_payment_record
         (late_payment_charity_id, cac_reg_number, business_name, installment_no, charity_amount,
          charity_ref, charity_organization, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       RETURNING id`,
      [
        charityId,
        charity.cac_reg_number,
        charity.business_name,
        charity.installment_no,
        charity.charity_amount,
        args.charityRef,
        args.charityOrganization,
      ],
    );

    await client.query(`UPDATE late_payment_charity SET settled = true WHERE id = $1`, [charityId]);

    return { charityPaymentRecordId: record[0].id };
  });
}
export const confirmCharityPayment = withAuthorization(["business"], confirmCharityPaymentImpl);

// ─── Choice: DefaultContract (MurabahahContract, financialInstitution) ───

async function defaultContractImpl(session: SessionContext, contractId: number, args: { reason: string; defaultedBy: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    assertValidTransition(contract.status, "Defaulted");
    if (!args.reason) throw new DomainError("Reason must not be empty");

    await client.query(`UPDATE murabahah_contract SET status = 'Defaulted', updated_at = now() WHERE id = $1`, [contractId]);

    const { rows: record } = await client.query(
      `INSERT INTO default_record (murabahah_contract_id, facility_ref, cac_reg_number, business_name, reason, defaulted_by, defaulted_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING id`,
      [contractId, contract.facility_ref, contract.cac_reg_number, contract.business_name, args.reason, args.defaultedBy],
    );

    return { murabahahContractId: contractId, defaultRecordId: record[0].id };
  });
}
export const defaultContract = withAuthorization(["financialInstitution"], defaultContractImpl);

// ─── Choice: CloseDefaultedContract (MurabahahContract, financialInstitution) ──

async function closeDefaultedContractImpl(session: SessionContext, contractId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (contract.status !== "Defaulted") throw new DomainError("Only usable on a Defaulted contract");
    assertValidTransition(contract.status, "Completed");
    if (!(Number(contract.outstanding_balance) <= 0)) {
      throw new DomainError("Outstanding balance must be zero before closure");
    }

    await client.query(`UPDATE murabahah_contract SET status = 'Completed', updated_at = now() WHERE id = $1`, [contractId]);
    return { murabahahContractId: contractId };
  });
}
export const closeDefaultedContract = withAuthorization(["financialInstitution"], closeDefaultedContractImpl);

// ─── Reads ──────────────────────────────────────────────────────────────

export async function listIbraRequests(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM ibra_request WHERE archived_at IS NULL ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listDefaultRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM default_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Phase 2, sixth slice: RahnAgreement collateral ───────────────────────
// See migrations/011_rahn_agreement_collateral.sql's header for scope.

interface PledgeCollateralArgs {
  collateralDescription: string;
  collateralValue: number;
}

async function pledgeCollateralImpl(session: SessionContext, contractId: number, args: PledgeCollateralArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (!args.collateralDescription) throw new DomainError("Collateral description must not be empty");
    if (!(args.collateralValue > 0)) throw new DomainError("Collateral value must be positive");

    const { rows: inserted } = await client.query(
      `INSERT INTO rahn_agreement (murabahah_contract_id, facility_ref, cac_reg_number, business_name, collateral_description, collateral_value)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [contractId, contract.facility_ref, contract.cac_reg_number, contract.business_name, args.collateralDescription, args.collateralValue],
    );
    return { rahnAgreementId: inserted[0].id };
  });
}
export const pledgeCollateral = withAuthorization(["financialInstitution"], pledgeCollateralImpl);

interface CollateralOfficerArgs {
  proposedByOfficerId: string;
  confirmedByOfficerId: string;
}

async function checkFourEyes(
  client: PoolClient,
  proposedByOfficerId: string,
  proposedRole: string,
  confirmedByOfficerId: string,
  confirmedRole: string,
) {
  if (proposedByOfficerId === confirmedByOfficerId) {
    throw new DomainError("Confirming officer must differ from proposing officer (four-eyes)");
  }
  const { rows: proposer } = await client.query("SELECT active, roles FROM authorized_officer WHERE officer_id = $1", [proposedByOfficerId]);
  if (!proposer[0] || !proposer[0].active) throw new DomainError(`Officer ${proposedByOfficerId} is not active`);
  if (!(proposer[0].roles ?? []).includes(proposedRole)) {
    throw new DomainError(`Officer ${proposedByOfficerId} does not hold the required role`);
  }
  const { rows: confirmer } = await client.query("SELECT active, roles FROM authorized_officer WHERE officer_id = $1", [confirmedByOfficerId]);
  if (!confirmer[0] || !confirmer[0].active) throw new DomainError(`Officer ${confirmedByOfficerId} is not active`);
  if (!(confirmer[0].roles ?? []).includes(confirmedRole)) {
    throw new DomainError(`Officer ${confirmedByOfficerId} does not hold the required role`);
  }
}

async function releaseCollateralImpl(
  session: SessionContext,
  rahnAgreementId: number,
  args: CollateralOfficerArgs & { note: string; releaseDocumentRef?: string | null },
) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM rahn_agreement WHERE id = $1 FOR UPDATE", [rahnAgreementId]);
    const rahn = rows[0];
    if (!rahn) throw new DomainError("RahnAgreement not found");
    if (rahn.collateral_status !== "CollateralActive") throw new DomainError("Can only release Active collateral");

    // Inlined against the same client/transaction (mirrors grantIbra's
    // precedent above) rather than a separate withTransaction-wrapped call.
    await checkFourEyes(client, args.proposedByOfficerId, "OperationsOfficer", args.confirmedByOfficerId, "RiskOfficer");

    await client.query(
      `UPDATE rahn_agreement
         SET collateral_status = 'CollateralReleased', release_evidence = $2,
             proposed_by_officer_id = $3, confirmed_by_officer_id = $4, updated_at = now()
         WHERE id = $1`,
      [rahnAgreementId, args.releaseDocumentRef ?? args.note, args.proposedByOfficerId, args.confirmedByOfficerId],
    );
    return { rahnAgreementId };
  });
}
export const releaseCollateral = withAuthorization(["financialInstitution"], releaseCollateralImpl);

async function enforceCollateralImpl(session: SessionContext, rahnAgreementId: number, args: CollateralOfficerArgs & { reason: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM rahn_agreement WHERE id = $1 FOR UPDATE", [rahnAgreementId]);
    const rahn = rows[0];
    if (!rahn) throw new DomainError("RahnAgreement not found");
    if (rahn.collateral_status !== "CollateralActive") throw new DomainError("Can only enforce Active collateral");
    if (!args.reason) throw new DomainError("Reason must not be empty");

    await checkFourEyes(client, args.proposedByOfficerId, "RecoveryOfficer", args.confirmedByOfficerId, "RiskOfficer");

    await client.query(
      `UPDATE rahn_agreement
         SET collateral_status = 'CollateralEnforced', proposed_by_officer_id = $2, confirmed_by_officer_id = $3, updated_at = now()
         WHERE id = $1`,
      [rahnAgreementId, args.proposedByOfficerId, args.confirmedByOfficerId],
    );
    return { rahnAgreementId };
  });
}
export const enforceCollateral = withAuthorization(["financialInstitution"], enforceCollateralImpl);

export async function listRahnAgreements(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM rahn_agreement ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Phase 2, seventh slice: collateral valuation document upload ─────────
// See migrations/012_collateral_valuation_document.sql's header for scope
// and why this deliberately does NOT update rahn_agreement.collateral_value
// (that stays the FI-only, still-deferred Revalue choice's job).

interface SubmitCollateralValuationArgs {
  valuatorRef: string;
  valuationAmount: number;
  valuationDate: string;
  notes?: string | null;
  docType: string;
  contentHash: string;
  storageRef: string;
  fileSize?: number | null;
}

async function submitCollateralValuationImpl(session: SessionContext, rahnAgreementId: number, args: SubmitCollateralValuationArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM rahn_agreement WHERE id = $1", [rahnAgreementId]);
    const rahn = rows[0];
    if (!rahn) throw new DomainError("RahnAgreement not found");
    if (!args.valuatorRef) throw new DomainError("Valuator reference must not be empty");
    if (!(args.valuationAmount > 0)) throw new DomainError("Valuation amount must be positive");

    const { rows: inserted } = await client.query(
      `INSERT INTO collateral_valuation_document
         (rahn_agreement_id, cac_reg_number, business_name, valuator_ref, valuation_amount, valuation_date,
          notes, doc_type, content_hash, storage_ref, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        rahnAgreementId,
        rahn.cac_reg_number,
        rahn.business_name,
        args.valuatorRef,
        args.valuationAmount,
        args.valuationDate,
        args.notes ?? null,
        args.docType,
        args.contentHash,
        args.storageRef,
        args.fileSize ?? null,
      ],
    );
    return { collateralValuationDocumentId: inserted[0].id };
  });
}
export const submitCollateralValuation = withAuthorization(["business"], submitCollateralValuationImpl);

export async function listCollateralValuationDocuments(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM collateral_valuation_document ORDER BY uploaded_at DESC`);
    return rows;
  });
}

// ─── Phase 2, eighth slice: restructuring + disputes/arbitration ──────────
// See migrations/013_murabahah_restructuring_disputes.sql's header for scope
// and the reasoning behind each choice's shape (UPDATE-in-place vs.
// archive-and-supersede).

// ─── Choice: RequestRestructuring (MurabahahContract, business) ───────────

interface RequestRestructuringArgs {
  proposedSchedule: PaymentScheduleEntry[];
  reason: string;
  requestDate: string;
}

async function requestRestructuringImpl(session: SessionContext, contractId: number, args: RequestRestructuringArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (!(contract.status === "Active" || contract.status === "Delinquent")) {
      throw new DomainError("Can only restructure an Active or Delinquent contract");
    }
    if (!args.reason) throw new DomainError("Restructuring reason must not be empty");
    if (!args.proposedSchedule || args.proposedSchedule.length === 0) {
      throw new DomainError("Proposed schedule must not be empty");
    }
    const totalProposed = args.proposedSchedule.reduce((acc, e) => acc + Number(e.dueAmount), 0);
    const outstandingBalance = Number(contract.outstanding_balance);
    if (!(totalProposed <= outstandingBalance)) {
      throw new DomainError("New schedule total cannot exceed outstanding balance (no debt increase)");
    }

    const { rows: inserted } = await client.query(
      `INSERT INTO restructuring_request
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, outstanding_balance,
          proposed_schedule, reason, request_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        contractId,
        contract.facility_ref,
        contract.cac_reg_number,
        contract.business_name,
        outstandingBalance,
        JSON.stringify(args.proposedSchedule),
        args.reason,
        args.requestDate,
      ],
    );
    return { restructuringRequestId: inserted[0].id };
  });
}
export const requestRestructuring = withAuthorization(["business"], requestRestructuringImpl);

// ─── Choice: ApproveRestructuring (RestructuringRequest, financialInstitution) ──

interface ApproveRestructuringArgs {
  approvedSchedule: PaymentScheduleEntry[];
  maxRestructurings?: number | null;
}

async function approveRestructuringImpl(session: SessionContext, restructuringRequestId: number, args: ApproveRestructuringArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM restructuring_request WHERE id = $1 FOR UPDATE", [restructuringRequestId]);
    const request = rows[0];
    if (!request) throw new DomainError("RestructuringRequest not found");
    if (request.archived_at) throw new DomainError("RestructuringRequest is no longer active");
    if (!args.approvedSchedule || args.approvedSchedule.length === 0) {
      throw new DomainError("Approved schedule must not be empty");
    }

    const { rows: contractRows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [
      request.murabahah_contract_id,
    ]);
    const contract = contractRows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (!(contract.status === "Active" || contract.status === "Delinquent")) {
      throw new DomainError("Can only restructure an Active or Delinquent contract");
    }
    const totalApproved = args.approvedSchedule.reduce((acc, e) => acc + Number(e.dueAmount), 0);
    if (!(totalApproved <= Number(contract.outstanding_balance))) {
      throw new DomainError("Approved schedule total cannot exceed outstanding balance");
    }
    if (args.maxRestructurings != null && !(contract.restructuring_count < args.maxRestructurings)) {
      throw new DomainError("Restructuring frequency limit exceeded");
    }

    await client.query(
      `UPDATE murabahah_contract
         SET payment_schedule = $2, pending_installment_paid = 0, schedule_version = schedule_version + 1,
             restructuring_count = restructuring_count + 1, updated_at = now()
         WHERE id = $1`,
      [request.murabahah_contract_id, JSON.stringify(args.approvedSchedule)],
    );
    await client.query(
      `UPDATE restructuring_request SET archived_at = now(), superseded_by_kind = 'approved' WHERE id = $1`,
      [restructuringRequestId],
    );

    return { murabahahContractId: request.murabahah_contract_id };
  });
}
export const approveRestructuring = withAuthorization(["financialInstitution"], approveRestructuringImpl);

// ─── Choice: RejectRestructuring (RestructuringRequest, financialInstitution) ──

async function rejectRestructuringImpl(session: SessionContext, restructuringRequestId: number, args: { reason: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM restructuring_request WHERE id = $1 FOR UPDATE", [restructuringRequestId]);
    const request = rows[0];
    if (!request) throw new DomainError("RestructuringRequest not found");
    if (request.archived_at) throw new DomainError("RestructuringRequest is no longer active");
    if (!args.reason) throw new DomainError("Rejection reason must not be empty");

    const { rows: rejection } = await client.query(
      `INSERT INTO restructuring_rejection_record
         (restructuring_request_id, facility_ref, cac_reg_number, business_name, reason, rejected_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id`,
      [restructuringRequestId, request.facility_ref, request.cac_reg_number, request.business_name, args.reason],
    );
    await client.query(
      `UPDATE restructuring_request SET archived_at = now(), superseded_by_kind = 'restructuring_rejection_record', superseded_by_id = $2 WHERE id = $1`,
      [restructuringRequestId, rejection[0].id],
    );

    return { restructuringRejectionRecordId: rejection[0].id };
  });
}
export const rejectRestructuring = withAuthorization(["financialInstitution"], rejectRestructuringImpl);

export async function listRestructuringRequests(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM restructuring_request WHERE archived_at IS NULL ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listRestructuringRejectionRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM restructuring_rejection_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: RaiseDispute (MurabahahContract, business) ───────────────────

interface RaiseDisputeArgs {
  disputeType: string;
  disputeDesc: string;
  evidenceRef?: string | null;
}

async function raiseDisputeImpl(session: SessionContext, contractId: number, args: RaiseDisputeArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (!args.disputeDesc) throw new DomainError("Dispute description must not be empty");

    const { rows: inserted } = await client.query(
      `INSERT INTO dispute_record
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, dispute_type, description, evidence_ref, raised_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       RETURNING id`,
      [contractId, contract.facility_ref, contract.cac_reg_number, contract.business_name, args.disputeType, args.disputeDesc, args.evidenceRef ?? null],
    );
    return { disputeRecordId: inserted[0].id };
  });
}
export const raiseDispute = withAuthorization(["business"], raiseDisputeImpl);

// ─── Choice: EscalateToArbitration (DisputeRecord, vetify) ────────────────

async function escalateToArbitrationImpl(session: SessionContext, disputeRecordId: number, args: { arbitrator: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM dispute_record WHERE id = $1 FOR UPDATE", [disputeRecordId]);
    const dispute = rows[0];
    if (!dispute) throw new DomainError("DisputeRecord not found");
    if (dispute.archived_at) throw new DomainError("DisputeRecord is no longer active");
    if (!args.arbitrator) throw new DomainError("Arbitrator must not be empty");
    if (args.arbitrator === dispute.business_name) {
      throw new DomainError("Arbitrator must differ from the parties");
    }

    const { rows: arbitration } = await client.query(
      `INSERT INTO arbitration_request
         (dispute_record_id, cac_reg_number, business_name, arbitrator, dispute_description, escalated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id`,
      [disputeRecordId, dispute.cac_reg_number, dispute.business_name, args.arbitrator, dispute.description],
    );
    await client.query(
      `UPDATE dispute_record SET archived_at = now(), superseded_by_kind = 'arbitration_request', superseded_by_id = $2 WHERE id = $1`,
      [disputeRecordId, arbitration[0].id],
    );

    return { arbitrationRequestId: arbitration[0].id };
  });
}
export const escalateToArbitration = withAuthorization(["vetify"], escalateToArbitrationImpl);

// ─── Choice: RecordArbitrationOutcome (ArbitrationRequest, vetify) ────────

interface RecordArbitrationOutcomeArgs {
  arbOutcome: string;
  arbResolution: string;
}

async function recordArbitrationOutcomeImpl(session: SessionContext, arbitrationRequestId: number, args: RecordArbitrationOutcomeArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM arbitration_request WHERE id = $1 FOR UPDATE", [arbitrationRequestId]);
    const arbitration = rows[0];
    if (!arbitration) throw new DomainError("ArbitrationRequest not found");
    if (arbitration.outcome != null) throw new DomainError("Arbitration is already concluded");
    if (!args.arbResolution) throw new DomainError("Resolution must not be empty");

    await client.query(`UPDATE arbitration_request SET outcome = $2, resolution = $3 WHERE id = $1`, [
      arbitrationRequestId,
      args.arbOutcome,
      args.arbResolution,
    ]);
    return { arbitrationRequestId };
  });
}
export const recordArbitrationOutcome = withAuthorization(["vetify"], recordArbitrationOutcomeImpl);

export async function listDisputeRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM dispute_record ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listArbitrationRequests(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM arbitration_request ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Phase 2, ninth slice: Collections (Direct Debit + GSM) ───────────────
// See migrations/014_murabahah_collections.sql's header for scope. Procedural
// FI-driven workflow (the Collections Agent), distinct from the sentinel's
// real FlagDelinquent/ResumeActive decision (migration 008) -- no scored
// judgment in any of these choices.

// ─── DirectDebitMandate: create + SuspendMandate/ReinstateMandate/CancelMandate ──

interface CreateDirectDebitMandateArgs {
  monoMandateRef: string;
  accountRef: string;
  bankName: string;
  maxCollectionAmount: number;
  frequency?: string;
  mandateStartDate: string;
  mandateEndDate?: string | null;
  gsmConsentGiven: boolean;
  gsmConsentDate?: string | null;
}

async function createDirectDebitMandateImpl(session: SessionContext, contractId: number, args: CreateDirectDebitMandateArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (!args.monoMandateRef) throw new DomainError("Mandate reference must not be empty");
    if (!args.accountRef) throw new DomainError("Account reference must not be empty");
    if (!(args.maxCollectionAmount > 0)) throw new DomainError("Max collection amount must be positive");

    const { rows: inserted } = await client.query(
      `INSERT INTO direct_debit_mandate
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, mono_mandate_ref, account_ref,
          bank_name, max_collection_amount, frequency, mandate_start_date, mandate_end_date,
          gsm_consent_given, gsm_consent_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        contractId,
        contract.facility_ref,
        contract.cac_reg_number,
        contract.business_name,
        args.monoMandateRef,
        args.accountRef,
        args.bankName,
        args.maxCollectionAmount,
        args.frequency ?? "MONTHLY",
        args.mandateStartDate,
        args.mandateEndDate ?? null,
        args.gsmConsentGiven,
        args.gsmConsentDate ?? null,
      ],
    );
    return { directDebitMandateId: inserted[0].id };
  });
}
export const createDirectDebitMandate = withAuthorization(["financialInstitution"], createDirectDebitMandateImpl);

async function suspendMandateImpl(session: SessionContext, mandateId: number, args: { reason: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM direct_debit_mandate WHERE id = $1 FOR UPDATE", [mandateId]);
    const mandate = rows[0];
    if (!mandate) throw new DomainError("DirectDebitMandate not found");
    if (mandate.status !== "MandateActive") throw new DomainError("Can only suspend an Active mandate");
    if (!args.reason) throw new DomainError("Reason must not be empty");
    await client.query(`UPDATE direct_debit_mandate SET status = 'MandateSuspended' WHERE id = $1`, [mandateId]);
    return { directDebitMandateId: mandateId };
  });
}
export const suspendMandate = withAuthorization(["financialInstitution"], suspendMandateImpl);

async function reinstateMandateImpl(session: SessionContext, mandateId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM direct_debit_mandate WHERE id = $1 FOR UPDATE", [mandateId]);
    const mandate = rows[0];
    if (!mandate) throw new DomainError("DirectDebitMandate not found");
    if (mandate.status !== "MandateSuspended") throw new DomainError("Can only reinstate a Suspended mandate");
    await client.query(`UPDATE direct_debit_mandate SET status = 'MandateActive' WHERE id = $1`, [mandateId]);
    return { directDebitMandateId: mandateId };
  });
}
export const reinstateMandate = withAuthorization(["financialInstitution"], reinstateMandateImpl);

async function cancelMandateImpl(session: SessionContext, mandateId: number, args: { reason: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM direct_debit_mandate WHERE id = $1 FOR UPDATE", [mandateId]);
    const mandate = rows[0];
    if (!mandate) throw new DomainError("DirectDebitMandate not found");
    if (!args.reason) throw new DomainError("Reason must not be empty");
    await client.query(`UPDATE direct_debit_mandate SET status = 'MandateCancelled' WHERE id = $1`, [mandateId]);
    return { directDebitMandateId: mandateId };
  });
}
export const cancelMandate = withAuthorization(["financialInstitution"], cancelMandateImpl);

export async function listDirectDebitMandates(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM direct_debit_mandate ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── DirectDebitCollectionAttempt (immutable, no choices in Daml) ─────────

interface RecordCollectionAttemptArgs {
  monoCollectionRef: string;
  installmentNo: number;
  attemptedAmount: number;
  attemptDate: string;
  succeeded: boolean;
  failureReason?: string | null;
  retryCount?: number;
}

async function recordCollectionAttemptImpl(session: SessionContext, contractId: number, args: RecordCollectionAttemptArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (!args.monoCollectionRef) throw new DomainError("mono.co collection reference must not be empty");
    if (!(args.attemptedAmount > 0)) throw new DomainError("Attempted amount must be positive");

    const { rows: inserted } = await client.query(
      `INSERT INTO direct_debit_collection_attempt
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, mono_collection_ref,
          installment_no, attempted_amount, attempt_date, succeeded, failure_reason, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        contractId,
        contract.facility_ref,
        contract.cac_reg_number,
        contract.business_name,
        args.monoCollectionRef,
        args.installmentNo,
        args.attemptedAmount,
        args.attemptDate,
        args.succeeded,
        args.failureReason ?? null,
        args.retryCount ?? 0,
      ],
    );
    return { directDebitCollectionAttemptId: inserted[0].id };
  });
}
export const recordCollectionAttempt = withAuthorization(["financialInstitution"], recordCollectionAttemptImpl);

export async function listDirectDebitCollectionAttempts(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM direct_debit_collection_attempt ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── RecordRecoveryPayment (MurabahahContract, financialInstitution) ─────

interface RecordRecoveryPaymentArgs {
  amountRecovered: number;
  recoveryDate: string;
  recoverySource: string;
}

// Inlined against a caller-supplied client/transaction (mirrors
// checkFourEyes's precedent above) rather than always opening its own
// withTransaction -- recordGsmSweepImpl below needs this atomic with its own
// gsm_invocation update, the same "Daml's exercise contractCid RecordRecoveryPayment
// must be part of one transaction, not two" reasoning that choice's own Daml
// source states directly ("does not hold an independent balance").
async function recordRecoveryPayment_onClient(client: PoolClient, contractId: number, args: RecordRecoveryPaymentArgs) {
  const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [contractId]);
  const contract = rows[0];
  if (!contract) throw new DomainError("MurabahahContract not found");
  if (contract.status !== "Defaulted") throw new DomainError("Can only record recovery on a Defaulted contract");
  if (!(args.amountRecovered > 0)) throw new DomainError("Recovery amount must be positive");
  const outstandingBalance = Number(contract.outstanding_balance);
  if (!(args.amountRecovered <= outstandingBalance)) throw new DomainError("Recovery amount must not exceed outstanding balance");
  if (!args.recoverySource) throw new DomainError("Recovery source must not be empty");

  const newBalance = outstandingBalance - args.amountRecovered;
  await client.query(`UPDATE murabahah_contract SET outstanding_balance = $2, updated_at = now() WHERE id = $1`, [contractId, newBalance]);

  const { rows: record } = await client.query(
    `INSERT INTO recovery_payment_record
       (murabahah_contract_id, facility_ref, cac_reg_number, business_name, amount_recovered, recovery_date, recovery_source, remaining_balance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [contractId, contract.facility_ref, contract.cac_reg_number, contract.business_name, args.amountRecovered, args.recoveryDate, args.recoverySource, newBalance],
  );
  return { murabahahContractId: contractId, recoveryPaymentRecordId: record[0].id, remainingBalance: newBalance };
}

async function recordRecoveryPaymentImpl(session: SessionContext, contractId: number, args: RecordRecoveryPaymentArgs) {
  return withTransaction(session, (client) => recordRecoveryPayment_onClient(client, contractId, args));
}
export const recordRecoveryPayment = withAuthorization(["financialInstitution"], recordRecoveryPaymentImpl);

export async function listRecoveryPaymentRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM recovery_payment_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: WriteOffContract (MurabahahContract, financialInstitution) ───
// Phase 2, Twenty-Second Slice. Closes out the Default -> RecordRecoveryPayment
// -> WriteOffContract lifecycle -- the missing terminal step. Four-eyes via
// the shared checkFourEyes() helper (RecoveryOfficer proposes, RiskOfficer
// confirms), plus one more check the helper alone doesn't cover: the
// confirming officer's own registered name must match writeOffApprovedBy,
// same pattern as ApproveFunding's approvedByName check (Thirteenth Slice).

interface WriteOffContractArgs {
  writeOffDate: string;
  writeOffRef: string;
  totalRecovered: number;
  writeOffApprovedBy: string;
  proposedByOfficerId: string;
  confirmedByOfficerId: string;
}

async function writeOffContractImpl(session: SessionContext, contractId: number, args: WriteOffContractArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (contract.status !== "Defaulted") throw new DomainError("Can only write off a Defaulted contract");
    if (!args.writeOffRef) throw new DomainError("Write-off reference must not be empty");
    if (!args.writeOffApprovedBy) throw new DomainError("Write-off approver must be named");
    if (!(args.totalRecovered >= 0)) throw new DomainError("Total recovered must be non-negative");

    await checkFourEyes(client, args.proposedByOfficerId, "RecoveryOfficer", args.confirmedByOfficerId, "RiskOfficer");
    const { rows: confirmer } = await client.query("SELECT officer_name FROM authorized_officer WHERE officer_id = $1", [args.confirmedByOfficerId]);
    if (args.writeOffApprovedBy !== confirmer[0].officer_name) {
      throw new DomainError("writeOffApprovedBy must match the confirming officer's registered name");
    }

    const amountWrittenOff = Number(contract.outstanding_balance);
    await client.query(
      `UPDATE murabahah_contract SET status = 'Completed', outstanding_balance = 0, updated_at = now() WHERE id = $1`,
      [contractId],
    );

    const { rows: record } = await client.query(
      `INSERT INTO write_off_record
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, total_financed, total_recovered,
          amount_written_off, write_off_date, write_off_ref, write_off_approved_by, proposed_by_officer_id, confirmed_by_officer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        contractId, contract.facility_ref, contract.cac_reg_number, contract.business_name, contract.sale_price,
        args.totalRecovered, amountWrittenOff, args.writeOffDate, args.writeOffRef, args.writeOffApprovedBy,
        args.proposedByOfficerId, args.confirmedByOfficerId,
      ],
    );
    return { murabahahContractId: contractId, writeOffRecordId: record[0].id };
  });
}
export const writeOffContract = withAuthorization(["financialInstitution"], writeOffContractImpl);

export async function listWriteOffRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM write_off_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── DemandNotice: IssueDemandNotice + EscalateToLegal/WithdrawDemand ─────
// Phase 2, Twenty-Third Slice. IssueDemandNotice is nonconsuming on
// MurabahahContract ("the Defaulted contract stays alive for recovery
// tracking"); EscalateToLegal/WithdrawDemand are both consuming on
// DemandNotice itself -- a demand notice is either escalated (terminal,
// replaced by a LegalEscalation) or withdrawn (terminal, no successor).

interface IssueDemandNoticeArgs {
  demandDate: string;
  demandRef: string;
  responseDeadline: string;
  gsmEligible: boolean;
}

async function issueDemandNoticeImpl(session: SessionContext, contractId: number, args: IssueDemandNoticeArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (contract.status !== "Defaulted") throw new DomainError("Can only issue demand notice on a Defaulted contract");
    if (!args.demandRef) throw new DomainError("Demand reference must not be empty");
    if (new Date(args.responseDeadline).getTime() <= new Date(args.demandDate).getTime()) {
      throw new DomainError("Response deadline must be after demand date");
    }

    const { rows: created } = await client.query(
      `INSERT INTO demand_notice
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, demand_date,
          outstanding_amount, demand_ref, response_deadline, gsm_eligible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        contractId, contract.facility_ref, contract.cac_reg_number, contract.business_name,
        args.demandDate, contract.outstanding_balance, args.demandRef, args.responseDeadline, args.gsmEligible,
      ],
    );
    return { demandNoticeId: created[0].id };
  });
}
export const issueDemandNotice = withAuthorization(["financialInstitution"], issueDemandNoticeImpl);

interface EscalateToLegalArgs {
  escalationDate: string;
  solicitorRef: string;
  legalAction: string;
}

async function escalateToLegalImpl(session: SessionContext, demandNoticeId: number, args: EscalateToLegalArgs) {
  if (!args.solicitorRef) throw new DomainError("Solicitor reference must not be empty");
  if (!args.legalAction) throw new DomainError("Legal action description must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM demand_notice WHERE id = $1 FOR UPDATE", [demandNoticeId]);
    const notice = rows[0];
    if (!notice) throw new DomainError("DemandNotice not found");
    if (notice.archived_at) throw new DomainError("DemandNotice is no longer active");

    const { rows: created } = await client.query(
      `INSERT INTO legal_escalation
         (demand_notice_id, business_name, cac_reg_number, escalation_date, solicitor_ref, legal_action, outstanding_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [demandNoticeId, notice.business_name, notice.cac_reg_number, args.escalationDate, args.solicitorRef, args.legalAction, notice.outstanding_amount],
    );
    const legalEscalationId = created[0].id;

    await client.query(
      `UPDATE demand_notice SET archived_at = now(), superseded_by_kind = 'legal_escalation', superseded_by_id = $2 WHERE id = $1`,
      [demandNoticeId, legalEscalationId],
    );

    return { legalEscalationId };
  });
}
export const escalateToLegal = withAuthorization(["financialInstitution"], escalateToLegalImpl);

async function withdrawDemandImpl(session: SessionContext, demandNoticeId: number, args: { note: string }) {
  if (!args.note) throw new DomainError("Note must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT archived_at FROM demand_notice WHERE id = $1 FOR UPDATE", [demandNoticeId]);
    const notice = rows[0];
    if (!notice) throw new DomainError("DemandNotice not found");
    if (notice.archived_at) throw new DomainError("DemandNotice is no longer active");

    await client.query(
      `UPDATE demand_notice SET archived_at = now(), withdrawal_note = $2 WHERE id = $1`,
      [demandNoticeId, args.note],
    );
    return { demandNoticeId };
  });
}
export const withdrawDemand = withAuthorization(["financialInstitution"], withdrawDemandImpl);

export async function listDemandNotices(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM demand_notice ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── LegalEscalation: RecordCourtOrder + ResolveLegal ─────────────────────
// Both `create this with` field-replacements on the real Daml template (no
// contract key on SDK 3.4.11/LF 2.2) -- collapsed to plain UPDATEs, same
// rule as every other keyless field-replace choice in this migration.

async function recordCourtOrderImpl(session: SessionContext, legalEscalationId: number, args: { courtOrderRef: string }) {
  if (!args.courtOrderRef) throw new DomainError("Court order reference must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT id FROM legal_escalation WHERE id = $1 FOR UPDATE", [legalEscalationId]);
    if (!rows[0]) throw new DomainError("LegalEscalation not found");
    await client.query(
      `UPDATE legal_escalation SET court_ref = $2, updated_at = now() WHERE id = $1`,
      [legalEscalationId, args.courtOrderRef],
    );
    return { legalEscalationId };
  });
}
export const recordCourtOrder = withAuthorization(["financialInstitution"], recordCourtOrderImpl);

async function resolveLegalImpl(session: SessionContext, legalEscalationId: number, args: { note: string }) {
  if (!args.note) throw new DomainError("Resolution note must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT resolved_at FROM legal_escalation WHERE id = $1 FOR UPDATE", [legalEscalationId]);
    const escalation = rows[0];
    if (!escalation) throw new DomainError("LegalEscalation not found");
    if (escalation.resolved_at) throw new DomainError("Already resolved");
    await client.query(
      `UPDATE legal_escalation SET resolved_at = now(), updated_at = now() WHERE id = $1`,
      [legalEscalationId],
    );
    return { legalEscalationId };
  });
}
export const resolveLegal = withAuthorization(["financialInstitution"], resolveLegalImpl);

export async function listLegalEscalations(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM legal_escalation ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── GSMInvocation: create + RecordGSMSweep/CancelGSM ─────────────────────

interface CreateGsmInvocationArgs {
  businessBvn: string;
  invokedAmount: number;
  monoGsmRef: string;
}

async function createGsmInvocationImpl(session: SessionContext, contractId: number, args: CreateGsmInvocationArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (contract.status !== "Defaulted") throw new DomainError("Can only invoke GSM on a Defaulted contract");
    if (!args.monoGsmRef) throw new DomainError("mono.co/NIBSS GSM reference must not be empty");
    if (!(args.invokedAmount > 0)) throw new DomainError("Invoked amount must be positive");
    if (!args.businessBvn) throw new DomainError("Business BVN must not be empty");

    const { rows: inserted } = await client.query(
      `INSERT INTO gsm_invocation
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, business_bvn, invoked_amount, mono_gsm_ref, invoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       RETURNING id`,
      [contractId, contract.facility_ref, contract.cac_reg_number, contract.business_name, args.businessBvn, args.invokedAmount, args.monoGsmRef],
    );
    return { gsmInvocationId: inserted[0].id };
  });
}
export const createGsmInvocation = withAuthorization(["financialInstitution"], createGsmInvocationImpl);

interface RecordGsmSweepArgs {
  sweepAmount: number;
  sweepDate: string;
  nibssSweepRef: string;
}

async function recordGsmSweepImpl(session: SessionContext, gsmInvocationId: number, args: RecordGsmSweepArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM gsm_invocation WHERE id = $1 FOR UPDATE", [gsmInvocationId]);
    const invocation = rows[0];
    if (!invocation) throw new DomainError("GSMInvocation not found");
    if (invocation.status !== "GSMActive") throw new DomainError("Can only sweep an Active GSM invocation");
    if (!args.nibssSweepRef) throw new DomainError("NIBSS reference must not be empty");
    if (!(args.sweepAmount > 0)) throw new DomainError("Sweep amount must be positive");

    // Mirrors RecordGSMSweep's own `exercise contractCid RecordRecoveryPayment`
    // in Daml -- every balance change routes through the same choice, called
    // here against this same client/transaction (recordRecoveryPayment_onClient,
    // not recordRecoveryPaymentImpl) since Daml's atomic composed-choice
    // semantics need to be preserved: a partial sweep that recovered money
    // but never recorded it (or vice versa) would be worse than either
    // succeeding or failing outright. Calling recordRecoveryPaymentImpl here
    // instead would open a second, independent withTransaction/pool
    // connection -- silently breaking exactly the atomicity this comment
    // describes, caught before it ever shipped.
    const recovery = await recordRecoveryPayment_onClient(client, Number(invocation.murabahah_contract_id), {
      amountRecovered: args.sweepAmount,
      recoveryDate: args.sweepDate,
      recoverySource: "GSM_NIBSS",
    });

    await client.query(`UPDATE gsm_invocation SET last_sweep_ref = $2, status = 'GSMActive' WHERE id = $1`, [gsmInvocationId, args.nibssSweepRef]);

    return {
      gsmInvocationId,
      murabahahContractId: recovery.murabahahContractId,
      recoveryPaymentRecordId: recovery.recoveryPaymentRecordId,
    };
  });
}
export const recordGsmSweep = withAuthorization(["financialInstitution"], recordGsmSweepImpl);

async function cancelGsmImpl(session: SessionContext, gsmInvocationId: number, args: { reason: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM gsm_invocation WHERE id = $1 FOR UPDATE", [gsmInvocationId]);
    const invocation = rows[0];
    if (!invocation) throw new DomainError("GSMInvocation not found");
    if (!args.reason) throw new DomainError("Reason must not be empty");
    await client.query(`UPDATE gsm_invocation SET status = 'GSMCancelled' WHERE id = $1`, [gsmInvocationId]);
    return { gsmInvocationId };
  });
}
export const cancelGsm = withAuthorization(["financialInstitution"], cancelGsmImpl);

export async function listGsmInvocations(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM gsm_invocation ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Phase 2, tenth slice: Moratorium + HamishJiddiyyah ───────────────────
// See migrations/015_murabahah_moratorium_hamish.sql's header for scope.

// ─── GrantMoratorium / EndMoratorium (MurabahahContract) ──────────────────

interface GrantMoratoriumArgs {
  moratoriumEnd: string;
  reason: string;
}

async function grantMoratoriumImpl(session: SessionContext, contractId: number, args: GrantMoratoriumArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (!(contract.status === "Active" || contract.status === "Delinquent")) {
      throw new DomainError("Can only grant moratorium on Active or Delinquent contract");
    }
    if (contract.active_moratorium != null) throw new DomainError("A moratorium is already active");
    if (!args.reason) throw new DomainError("Reason must not be empty");

    await client.query(`UPDATE murabahah_contract SET active_moratorium = $2, updated_at = now() WHERE id = $1`, [
      contractId,
      args.moratoriumEnd,
    ]);
    const { rows: record } = await client.query(
      `INSERT INTO moratorium_record (murabahah_contract_id, facility_ref, cac_reg_number, business_name, moratorium_end, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [contractId, contract.facility_ref, contract.cac_reg_number, contract.business_name, args.moratoriumEnd, args.reason],
    );
    return { murabahahContractId: contractId, moratoriumRecordId: record[0].id };
  });
}
export const grantMoratorium = withAuthorization(["financialInstitution"], grantMoratoriumImpl);

async function endMoratoriumImpl(session: SessionContext, contractId: number, args: { note: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1 FOR UPDATE", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (contract.active_moratorium == null) throw new DomainError("No active moratorium to end");
    if (!args.note) throw new DomainError("Note must not be empty");

    await client.query(`UPDATE murabahah_contract SET active_moratorium = NULL, updated_at = now() WHERE id = $1`, [contractId]);
    return { murabahahContractId: contractId };
  });
}
export const endMoratorium = withAuthorization(["vetify"], endMoratoriumImpl);

export async function listMoratoriumRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM moratorium_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── HamishJiddiyyah: create + ReturnDeposit/ForfeitDeposit ───────────────

interface CreateHamishJiddiyyahArgs {
  depositAmount: number;
  depositRef: string;
  depositDate: string;
  returnDeadline: string;
}

async function createHamishJiddiyyahImpl(session: SessionContext, contractId: number, args: CreateHamishJiddiyyahArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");
    if (!(args.depositAmount > 0)) throw new DomainError("Deposit amount must be positive");
    if (!args.depositRef) throw new DomainError("Deposit reference must not be empty");

    const { rows: inserted } = await client.query(
      `INSERT INTO hamish_jiddiyyah
         (murabahah_contract_id, facility_ref, cac_reg_number, business_name, deposit_amount, deposit_ref, deposit_date, return_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [contractId, contract.facility_ref, contract.cac_reg_number, contract.business_name, args.depositAmount, args.depositRef, args.depositDate, args.returnDeadline],
    );
    return { hamishJiddiyyahId: inserted[0].id };
  });
}
export const createHamishJiddiyyah = withAuthorization(["financialInstitution"], createHamishJiddiyyahImpl);

async function returnDepositImpl(session: SessionContext, hamishId: number, args: { transferRef: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM hamish_jiddiyyah WHERE id = $1 FOR UPDATE", [hamishId]);
    const hamish = rows[0];
    if (!hamish) throw new DomainError("HamishJiddiyyah not found");
    if (hamish.status !== "HamishHeld") throw new DomainError("Can only return a Held deposit");
    if (!args.transferRef) throw new DomainError("Transfer reference must not be empty");
    await client.query(`UPDATE hamish_jiddiyyah SET status = 'HamishReturned' WHERE id = $1`, [hamishId]);
    return { hamishJiddiyyahId: hamishId };
  });
}
export const returnDeposit = withAuthorization(["financialInstitution"], returnDepositImpl);

interface ForfeitDepositArgs {
  actualLoss: number;
  reason: string;
}

async function forfeitDepositImpl(session: SessionContext, hamishId: number, args: ForfeitDepositArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM hamish_jiddiyyah WHERE id = $1 FOR UPDATE", [hamishId]);
    const hamish = rows[0];
    if (!hamish) throw new DomainError("HamishJiddiyyah not found");
    if (hamish.status !== "HamishHeld") throw new DomainError("Can only forfeit a Held deposit");
    if (!(args.actualLoss <= Number(hamish.deposit_amount))) throw new DomainError("Forfeited amount cannot exceed deposit");
    if (!(args.actualLoss >= 0)) throw new DomainError("Forfeited amount must be non-negative");
    if (!args.reason) throw new DomainError("Reason must not be empty");

    await client.query(`UPDATE hamish_jiddiyyah SET status = 'HamishForfeited', actual_loss_deducted = $2 WHERE id = $1`, [
      hamishId,
      args.actualLoss,
    ]);
    return { hamishJiddiyyahId: hamishId };
  });
}
export const forfeitDeposit = withAuthorization(["financialInstitution"], forfeitDepositImpl);

export async function listHamishJiddiyyah(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM hamish_jiddiyyah ORDER BY created_at DESC`);
    return rows;
  });
}
