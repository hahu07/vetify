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

// ─── Choice: AttachQuotation (MurabahahWad, financialInstitution) ─────────
// Phase 2, Twenty-Fifth Slice. Nonconsuming in the real Daml -- "the Wa'd
// stays active; the quotation is a side record."

interface AttachQuotationArgs {
  supplierName: string;
  quotationRef: string;
  quotedAmount: number;
  validUntil?: string | null;
}

async function attachQuotationImpl(session: SessionContext, wadId: number, args: AttachQuotationArgs) {
  if (!(args.quotedAmount > 0)) throw new DomainError("Quoted amount must be positive");
  if (!args.quotationRef) throw new DomainError("Quotation reference must not be empty");
  if (!args.supplierName) throw new DomainError("Supplier name must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_wad WHERE id = $1", [wadId]);
    const wad = rows[0];
    if (!wad) throw new DomainError("MurabahahWad not found");

    const { rows: created } = await client.query(
      `INSERT INTO supplier_quotation
         (murabahah_wad_id, cac_reg_number, business_name, supplier_name, quotation_ref, quoted_amount, asset_description, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [wadId, wad.cac_reg_number, wad.business_name, args.supplierName, args.quotationRef, args.quotedAmount, wad.asset_description, args.validUntil ?? null],
    );
    return { supplierQuotationId: created[0].id };
  });
}
export const attachQuotation = withAuthorization(["financialInstitution"], attachQuotationImpl);

export async function listSupplierQuotations(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM supplier_quotation ORDER BY created_at DESC`);
    return rows;
  });
}

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

// ─── Pre-Qabdh rejection/replacement/cancellation (AssetPurchaseRecord) ───
// Phase 2, Twenty-Seventh Slice. Deferred since migration 006's own header
// ("supporting/exception choices" named out of scope at the time). Ports
// RejectDelivery, ProceedWithReplacement, RequestCancellation, and
// ConfirmCancellation/RejectCancellation.

// ─── Choice: RejectDelivery (AssetPurchaseRecord, business) ───────────────
// Nonconsuming -- the AssetPurchaseRecord stays live; the FI must replace
// the asset (ProceedWithReplacement) or the parties agree to cancel
// (RequestCancellation -> ConfirmCancellation).

async function rejectDeliveryImpl(
  session: SessionContext,
  recordId: number,
  args: { reason: string; defectDescription: string },
) {
  if (!args.reason) throw new DomainError("Rejection reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM asset_purchase_record WHERE id = $1", [recordId]);
    const record = rows[0];
    if (!record) throw new DomainError("AssetPurchaseRecord not found");
    if (record.delivery_acknowledged) throw new DomainError("Cannot reject an already-acknowledged delivery");

    const { rows: created } = await client.query(
      `INSERT INTO asset_rejection_record
         (asset_purchase_record_id, cac_reg_number, business_name, reason, defect_description, rejected_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id`,
      [recordId, record.cac_reg_number, record.business_name, args.reason, args.defectDescription ?? ""],
    );
    return { assetRejectionRecordId: created[0].id };
  });
}
export const rejectDelivery = withAuthorization(["business"], rejectDeliveryImpl);

export async function listAssetRejectionRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM asset_rejection_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: ProceedWithReplacement (AssetPurchaseRecord, financialInstitution) ──
// The real Daml body is `create this with <replacement fields>, ancillary
// costs reset to 0.0` -- same keyless field-replace shape as Revalue
// (Twenty-Sixth Slice), collapses to a plain UPDATE rather than an
// archive/recreate pair.

async function proceedWithReplacementImpl(
  session: SessionContext,
  recordId: number,
  args: { newActualCost: number; newPurchaseDate: string; newInvoiceRef: string; replacementNote: string },
) {
  if (!(args.newActualCost > 0)) throw new DomainError("Replacement cost must be positive");
  if (!args.newInvoiceRef) throw new DomainError("Invoice reference must not be empty");
  if (!args.replacementNote) throw new DomainError("Replacement note must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM asset_purchase_record WHERE id = $1 FOR UPDATE", [recordId]);
    const record = rows[0];
    if (!record) throw new DomainError("AssetPurchaseRecord not found");
    if (record.archived_at) throw new DomainError("AssetPurchaseRecord is no longer active");

    const totalAcquisitionCost = args.newActualCost;
    await client.query(
      `UPDATE asset_purchase_record
         SET actual_cost = $2, purchase_date = $3, invoice_ref = $4,
             freight_cost = 0, customs_duty = 0, insurance_premium = 0, other_acquisition_costs = 0,
             total_acquisition_cost = $5, delivery_acknowledged = false, updated_at = now()
         WHERE id = $1`,
      [recordId, args.newActualCost, args.newPurchaseDate, args.newInvoiceRef, totalAcquisitionCost],
    );
    return { assetPurchaseRecordId: recordId };
  });
}
export const proceedWithReplacement = withAuthorization(["financialInstitution"], proceedWithReplacementImpl);

// ─── Choice: RequestCancellation (AssetPurchaseRecord, business) ──────────
// Nonconsuming -- the AssetPurchaseRecord stays live until the FI confirms.

async function requestCancellationImpl(session: SessionContext, recordId: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Cancellation reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM asset_purchase_record WHERE id = $1", [recordId]);
    const record = rows[0];
    if (!record) throw new DomainError("AssetPurchaseRecord not found");
    if (record.archived_at) throw new DomainError("AssetPurchaseRecord is no longer active");

    const { rows: created } = await client.query(
      `INSERT INTO acquisition_cancellation_request (asset_purchase_record_id, cac_reg_number, business_name, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [recordId, record.cac_reg_number, record.business_name, args.reason],
    );
    return { acquisitionCancellationRequestId: created[0].id };
  });
}
export const requestCancellation = withAuthorization(["business"], requestCancellationImpl);

// ─── Choice: ConfirmCancellation (AssetPurchaseRecord, financialInstitution) ──
// Consuming on AssetPurchaseRecord -- the real Daml body exercises
// AcceptCancellation on the request as an atomic sub-step, then archives
// this purchase record too. Returns `()` -- no successor, archives with
// superseded_by_kind left NULL, same shape as ExpireProposal/WithdrawProposal.

async function confirmCancellationImpl(session: SessionContext, recordId: number, args: { requestId: number }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM asset_purchase_record WHERE id = $1 FOR UPDATE", [recordId]);
    const record = rows[0];
    if (!record) throw new DomainError("AssetPurchaseRecord not found");
    if (record.archived_at) throw new DomainError("AssetPurchaseRecord is no longer active");

    const { rows: reqRows } = await client.query(
      "SELECT * FROM acquisition_cancellation_request WHERE id = $1 FOR UPDATE",
      [args.requestId],
    );
    const request = reqRows[0];
    if (!request) throw new DomainError("AcquisitionCancellationRequest not found");
    if (Number(request.asset_purchase_record_id) !== recordId) {
      throw new DomainError("AcquisitionCancellationRequest does not belong to this AssetPurchaseRecord");
    }
    if (request.status !== "Pending") throw new DomainError("AcquisitionCancellationRequest is not pending");

    await client.query(
      `UPDATE acquisition_cancellation_request SET status = 'Confirmed', resolved_at = now(), updated_at = now() WHERE id = $1`,
      [args.requestId],
    );
    await client.query(
      `UPDATE asset_purchase_record SET archived_at = now(), updated_at = now() WHERE id = $1`,
      [recordId],
    );
    return { assetPurchaseRecordId: recordId };
  });
}
export const confirmCancellation = withAuthorization(["financialInstitution"], confirmCancellationImpl);

// ─── Choice: RejectCancellation (AcquisitionCancellationRequest, financialInstitution) ──
// The AssetPurchaseRecord remains live.

async function rejectCancellationImpl(session: SessionContext, requestId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM acquisition_cancellation_request WHERE id = $1 FOR UPDATE",
      [requestId],
    );
    const request = rows[0];
    if (!request) throw new DomainError("AcquisitionCancellationRequest not found");
    if (request.status !== "Pending") throw new DomainError("AcquisitionCancellationRequest is not pending");

    await client.query(
      `UPDATE acquisition_cancellation_request SET status = 'Rejected', resolved_at = now(), updated_at = now() WHERE id = $1`,
      [requestId],
    );
    return { acquisitionCancellationRequestId: requestId };
  });
}
export const rejectCancellation = withAuthorization(["financialInstitution"], rejectCancellationImpl);

export async function listAcquisitionCancellationRequests(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM acquisition_cancellation_request ORDER BY created_at DESC`);
    return rows;
  });
}

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

// ─── Choice: ExpireProposal (MurabahahProposal, vetify) ────────────────────
// Phase 2, Twenty-Fifth Slice. Returns `()` in the real Daml -- no
// successor record, unlike AcceptProposal/DeclineProposal. Archives with
// superseded_by_kind left NULL, same "no successor" shape WithdrawDemand
// (Twenty-Third Slice) already established.

async function expireProposalImpl(session: SessionContext, proposalId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_proposal WHERE id = $1 FOR UPDATE", [proposalId]);
    const proposal = rows[0];
    if (!proposal) throw new DomainError("MurabahahProposal not found");
    if (proposal.archived_at) throw new DomainError("MurabahahProposal is no longer active");
    if (!proposal.acceptance_expires_at) throw new DomainError("No acceptance expiry configured on this proposal");
    if (new Date(proposal.acceptance_expires_at).getTime() >= Date.now()) {
      throw new DomainError("Proposal acceptance window has not yet elapsed");
    }

    await client.query(`UPDATE murabahah_proposal SET archived_at = now() WHERE id = $1`, [proposalId]);
    return { proposalId };
  });
}
export const expireProposal = withAuthorization(["vetify"], expireProposalImpl);

// ─── Choice: WithdrawProposal (MurabahahProposal, financialInstitution) ───
// Also returns `()` in the real Daml -- no successor record.

async function withdrawProposalImpl(session: SessionContext, proposalId: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Withdrawal reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT archived_at FROM murabahah_proposal WHERE id = $1 FOR UPDATE", [proposalId]);
    const proposal = rows[0];
    if (!proposal) throw new DomainError("MurabahahProposal not found");
    if (proposal.archived_at) throw new DomainError("MurabahahProposal is no longer active");

    await client.query(`UPDATE murabahah_proposal SET archived_at = now() WHERE id = $1`, [proposalId]);
    return { proposalId };
  });
}
export const withdrawProposal = withAuthorization(["financialInstitution"], withdrawProposalImpl);

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
  // Phase 2, Thirty-Fourth Slice (Batch E) -- PaymentIdempotencyGuard.
  // Only set for Direct Debit collections; manual/cash payments (undefined)
  // are not deduplicated this way, mirroring the real Daml's `Optional Text`.
  directDebitRef?: string | null;
}

async function recordPaymentImpl(session: SessionContext, contractId: number, args: RecordPaymentArgs) {
  return withTransaction(session, async (client) => {
    // PaymentIdempotencyGuard (Batch E) -- a real Postgres UNIQUE constraint,
    // atomic within this transaction. Only Direct Debit collections carry a
    // ref; manual/cash payments (directDebitRef undefined/null) skip this.
    if (args.directDebitRef) {
      try {
        await client.query(`INSERT INTO payment_idempotency_guard (direct_debit_ref) VALUES ($1)`, [args.directDebitRef]);
      } catch (err) {
        if (err && typeof err === "object" && "code" in err && err.code === "23505") {
          throw new DomainError(`Payment with directDebitRef ${args.directDebitRef} has already been recorded`);
        }
        throw err;
      }
    }

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
          due_date, payment_date, amount_paid, remaining_balance, was_late, direct_debit_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        args.directDebitRef ?? null,
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

// ─── Choice: GrantPartialIbra (IbraRequest, financialInstitution) ─────────
// Phase 2, Thirty-Third Slice (Batch D). Same four-eyes CreditOfficer/
// RiskOfficer shape as the already-ported GrantIbra.

interface GrantPartialIbraArgs {
  rebateAmount: number;
  approvedSettlementAmount: number;
  proposedByOfficerId: string;
  confirmedByOfficerId: string;
}

async function grantPartialIbraImpl(session: SessionContext, ibraRequestId: number, args: GrantPartialIbraArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM ibra_request WHERE id = $1 FOR UPDATE", [ibraRequestId]);
    const request = rows[0];
    if (!request) throw new DomainError("IbraRequest not found");
    if (request.archived_at) throw new DomainError("IbraRequest is no longer active");
    if (request.settlement_type !== "PartialIbra") {
      throw new DomainError("GrantPartialIbra requires PartialIbra settlement type");
    }
    const outstandingBalance = Number(request.outstanding_balance);
    if (!(args.approvedSettlementAmount > 0)) throw new DomainError("Approved settlement amount must be positive");
    if (!(args.approvedSettlementAmount < outstandingBalance)) {
      throw new DomainError("Approved settlement must be less than outstanding balance");
    }
    if (!(args.rebateAmount >= 0)) throw new DomainError("Rebate must be non-negative");
    if (args.proposedByOfficerId === args.confirmedByOfficerId) {
      throw new DomainError("Confirming officer must differ from proposing officer (four-eyes)");
    }

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
      `INSERT INTO partial_ibra_grant
         (ibra_request_id, facility_ref, cac_reg_number, business_name, outstanding_balance,
          rebate_amount, approved_settlement_amount, effective_date, proposed_by_officer_id, confirmed_by_officer_id, granted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       RETURNING id`,
      [
        ibraRequestId, request.facility_ref, request.cac_reg_number, request.business_name, request.outstanding_balance,
        args.rebateAmount, args.approvedSettlementAmount, request.requested_settlement_date, args.proposedByOfficerId, args.confirmedByOfficerId,
      ],
    );

    await client.query(
      `UPDATE ibra_request SET archived_at = now(), superseded_by_kind = 'partial_ibra_grant', superseded_by_id = $2 WHERE id = $1`,
      [ibraRequestId, grant[0].id],
    );

    return { partialIbraGrantId: grant[0].id };
  });
}
export const grantPartialIbra = withAuthorization(["financialInstitution"], grantPartialIbraImpl);

export async function listPartialIbraGrants(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM partial_ibra_grant ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: ProposeRebate (IbraRequest, financialInstitution) ────────────
// Nonconsuming -- an internal advisory calculation tool for the FI's own
// financing team, not vetify. The IbraRequest stays live.

interface ProposeRebateArgs {
  suggestedRebate: number;
  rationale: string;
}

async function proposeRebateImpl(session: SessionContext, ibraRequestId: number, args: ProposeRebateArgs) {
  if (!(args.suggestedRebate >= 0)) throw new DomainError("Suggested rebate must be non-negative");
  if (!args.rationale) throw new DomainError("Rationale must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM ibra_request WHERE id = $1", [ibraRequestId]);
    const request = rows[0];
    if (!request) throw new DomainError("IbraRequest not found");
    if (request.archived_at) throw new DomainError("IbraRequest is no longer active");
    if (!(args.suggestedRebate <= Number(request.outstanding_balance))) {
      throw new DomainError("Suggested rebate cannot exceed outstanding balance");
    }

    const { rows: created } = await client.query(
      `INSERT INTO ibra_rebate_proposal
         (ibra_request_id, facility_ref, cac_reg_number, business_name, outstanding_balance, suggested_rebate, rationale, settlement_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        ibraRequestId, request.facility_ref, request.cac_reg_number, request.business_name, request.outstanding_balance,
        args.suggestedRebate, args.rationale, request.settlement_type,
      ],
    );
    return { ibraRebateProposalId: created[0].id };
  });
}
export const proposeRebate = withAuthorization(["financialInstitution"], proposeRebateImpl);

export async function listIbraRebateProposals(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM ibra_rebate_proposal ORDER BY created_at DESC`);
    return rows;
  });
}

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

// Extracted so ConfirmEnforce (below) can invoke the same core logic inside
// its own transaction/client, atomically with archiving the
// PendingCollateralEnforcement it was exercised on -- mirrors the real
// Daml's `exercise rahnCid EnforceCollateral with ...` nested-exercise
// shape. Guards/checkFourEyes unchanged from the original single-entry form.
async function applyEnforceCollateral(client: PoolClient, rahnAgreementId: number, args: CollateralOfficerArgs & { reason: string }) {
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
}

async function enforceCollateralImpl(session: SessionContext, rahnAgreementId: number, args: CollateralOfficerArgs & { reason: string }) {
  return withTransaction(session, (client) => applyEnforceCollateral(client, rahnAgreementId, args));
}
export const enforceCollateral = withAuthorization(["financialInstitution"], enforceCollateralImpl);

// ─── Choice: Revalue (RahnAgreement, financialInstitution) ────────────────
// Phase 2, Twenty-Sixth Slice. Named as deferred directly in migrations/012's
// own header when that slice built the business-driven valuation *document
// upload* instead -- a deliberately separate, lower-stakes feature. This is
// the real FI-controlled revaluation decision `create this with
// collateralValue = newValue` collapses to a plain UPDATE (no contract key
// on SDK 3.4.11/LF 2.2), same rule as every other keyless field-replace
// choice already ported.

interface RevalueArgs {
  newValue: number;
  valuationDate: string;
  valuatorRef: string;
  notes?: string | null;
}

async function revalueImpl(session: SessionContext, rahnAgreementId: number, args: RevalueArgs) {
  if (!(args.newValue > 0)) throw new DomainError("New collateral value must be positive");
  if (!args.valuatorRef) throw new DomainError("Valuator reference must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM rahn_agreement WHERE id = $1 FOR UPDATE", [rahnAgreementId]);
    const rahn = rows[0];
    if (!rahn) throw new DomainError("RahnAgreement not found");
    if (rahn.collateral_status !== "CollateralActive") throw new DomainError("Collateral must be Active to revalue");

    const previousValue = rahn.collateral_value;
    await client.query(`UPDATE rahn_agreement SET collateral_value = $2, updated_at = now() WHERE id = $1`, [rahnAgreementId, args.newValue]);

    const { rows: record } = await client.query(
      `INSERT INTO collateral_valuation_record
         (rahn_agreement_id, cac_reg_number, business_name, previous_value, valuation_amount, valuation_date, valuator_ref, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [rahnAgreementId, rahn.cac_reg_number, rahn.business_name, previousValue, args.newValue, args.valuationDate, args.valuatorRef, args.notes ?? null],
    );
    return { rahnAgreementId, collateralValuationRecordId: record[0].id };
  });
}
export const revalue = withAuthorization(["financialInstitution"], revalueImpl);

// ─── Choice: RecordInspection (RahnAgreement, financialInstitution) ───────
// Nonconsuming in the real Daml -- a periodic physical inspection doesn't
// change collateral status.

interface RecordInspectionArgs {
  inspectionDate: string;
  inspectedBy: string;
  condition: "Satisfactory" | "RequiresAttention" | "Impaired";
  inspectionNotes?: string | null;
  nextInspectionDate?: string | null;
  mandateStatus?: string | null;
  estimatedGsmRecoverable?: number | null;
}

async function recordInspectionImpl(session: SessionContext, rahnAgreementId: number, args: RecordInspectionArgs) {
  if (!args.inspectedBy) throw new DomainError("Inspected-by must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM rahn_agreement WHERE id = $1", [rahnAgreementId]);
    const rahn = rows[0];
    if (!rahn) throw new DomainError("RahnAgreement not found");
    if (rahn.collateral_status !== "CollateralActive") throw new DomainError("Can only inspect Active collateral");

    const { rows: record } = await client.query(
      `INSERT INTO collateral_inspection_record
         (rahn_agreement_id, cac_reg_number, business_name, inspection_date, inspected_by, condition,
          inspection_notes, next_inspection_date, mandate_status, estimated_gsm_recoverable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        rahnAgreementId, rahn.cac_reg_number, rahn.business_name, args.inspectionDate, args.inspectedBy, args.condition,
        args.inspectionNotes ?? null, args.nextInspectionDate ?? null, args.mandateStatus ?? null, args.estimatedGsmRecoverable ?? null,
      ],
    );
    return { collateralInspectionRecordId: record[0].id };
  });
}
export const recordInspection = withAuthorization(["financialInstitution"], recordInspectionImpl);

export async function listCollateralValuationRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM collateral_valuation_record ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listCollateralInspectionRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM collateral_inspection_record ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listRahnAgreements(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM rahn_agreement ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── ProposeEnforceCollateral / ConfirmEnforce / RejectEnforce ────────────
// Phase 2, Twenty-Eighth Slice -- the maker-checker variant of
// EnforceCollateral: the FI's RecoveryOfficer proposes (ProposeEnforceCollateral,
// nonconsuming on RahnAgreement), and vetify -- not a second FI officer --
// confirms or rejects. ConfirmEnforce's real Daml body is a nested
// `exercise rahnCid EnforceCollateral with ...`, ported by calling
// applyEnforceCollateral inside this choice's own transaction so the
// PendingCollateralEnforcement resolution and the RahnAgreement update stay
// atomic, same technique as ConfirmCancellation (Twenty-Seventh Slice).

async function requireActiveRecoveryOfficer(client: PoolClient, officerId: string) {
  const { rows } = await client.query("SELECT active, roles FROM authorized_officer WHERE officer_id = $1", [officerId]);
  const officer = rows[0];
  if (!officer || !officer.active) throw new DomainError(`Officer ${officerId} is not active`);
  if (!(officer.roles ?? []).includes("RecoveryOfficer")) {
    throw new DomainError(`Officer ${officerId} does not hold the required role`);
  }
}

interface ProposeEnforceCollateralArgs {
  reason: string;
  gsmExhausted: boolean;
  gsmRef?: string | null;
  proposedByOfficerId: string;
}

async function proposeEnforceCollateralImpl(session: SessionContext, rahnAgreementId: number, args: ProposeEnforceCollateralArgs) {
  if (!args.reason) throw new DomainError("Reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM rahn_agreement WHERE id = $1", [rahnAgreementId]);
    const rahn = rows[0];
    if (!rahn) throw new DomainError("RahnAgreement not found");
    if (rahn.collateral_status !== "CollateralActive") throw new DomainError("Can only propose enforcement on Active collateral");

    await requireActiveRecoveryOfficer(client, args.proposedByOfficerId);

    const { rows: created } = await client.query(
      `INSERT INTO pending_collateral_enforcement
         (rahn_agreement_id, cac_reg_number, business_name, reason, gsm_exhausted, gsm_ref, proposed_by_officer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [rahnAgreementId, rahn.cac_reg_number, rahn.business_name, args.reason, args.gsmExhausted, args.gsmRef ?? null, args.proposedByOfficerId],
    );
    return { pendingCollateralEnforcementId: created[0].id };
  });
}
export const proposeEnforceCollateral = withAuthorization(["financialInstitution"], proposeEnforceCollateralImpl);

async function confirmEnforceImpl(session: SessionContext, pendingId: number, args: { confirmedByOfficerId: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM pending_collateral_enforcement WHERE id = $1 FOR UPDATE", [pendingId]);
    const pending = rows[0];
    if (!pending) throw new DomainError("PendingCollateralEnforcement not found");
    if (pending.status !== "Pending") throw new DomainError("PendingCollateralEnforcement is not pending");

    const enforcement = await applyEnforceCollateral(client, Number(pending.rahn_agreement_id), {
      reason: pending.reason,
      proposedByOfficerId: pending.proposed_by_officer_id,
      confirmedByOfficerId: args.confirmedByOfficerId,
    });

    await client.query(
      `UPDATE pending_collateral_enforcement SET status = 'Confirmed', resolved_at = now(), updated_at = now() WHERE id = $1`,
      [pendingId],
    );
    return { rahnAgreementId: enforcement.rahnAgreementId };
  });
}
export const confirmEnforce = withAuthorization(["vetify"], confirmEnforceImpl);

async function rejectEnforceImpl(session: SessionContext, pendingId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT status FROM pending_collateral_enforcement WHERE id = $1 FOR UPDATE", [pendingId]);
    const pending = rows[0];
    if (!pending) throw new DomainError("PendingCollateralEnforcement not found");
    if (pending.status !== "Pending") throw new DomainError("PendingCollateralEnforcement is not pending");

    await client.query(
      `UPDATE pending_collateral_enforcement SET status = 'Rejected', resolved_at = now(), updated_at = now() WHERE id = $1`,
      [pendingId],
    );
    return { pendingCollateralEnforcementId: pendingId };
  });
}
export const rejectEnforce = withAuthorization(["vetify"], rejectEnforceImpl);

export async function listPendingCollateralEnforcements(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM pending_collateral_enforcement ORDER BY created_at DESC`);
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

// ─── Phase 2, Twenty-Ninth Slice: regulatory inspection workflow ──────────
// RegulatoryInspectionRequest is created directly by vetify -- no exercised
// choice creates it in the real Daml (confirmed against MurabahahTests.daml's
// M-RI test, a bare `createCmd` as vetify). No `business` visibility on any
// of the three templates -- this is CBN oversight of the FI, not something
// the underlying business sees.

interface CreateRegulatoryInspectionRequestArgs {
  cacRegNumber: string;
  businessName: string;
  inspectionRef: string;
  inspectionScope: string;
  responseDeadline: string;
}

async function createRegulatoryInspectionRequestImpl(session: SessionContext, args: CreateRegulatoryInspectionRequestArgs) {
  if (!args.inspectionRef) throw new DomainError("Inspection reference must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO regulatory_inspection_request
         (cac_reg_number, business_name, inspection_ref, inspection_scope, response_deadline)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [args.cacRegNumber, args.businessName, args.inspectionRef, args.inspectionScope, args.responseDeadline],
    );
    return { regulatoryInspectionRequestId: rows[0].id };
  });
}
export const createRegulatoryInspectionRequest = withAuthorization(["vetify"], createRegulatoryInspectionRequestImpl);

// ─── Choice: ExtendDeadline (RegulatoryInspectionRequest, vetify) ─────────
// Keyless field-replace (`create this with responseDeadline = newDeadline`)
// -- collapses to a plain UPDATE, same convention as Revalue/ProceedWithReplacement.

async function extendDeadlineImpl(session: SessionContext, requestId: number, args: { newDeadline: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM regulatory_inspection_request WHERE id = $1 FOR UPDATE", [requestId]);
    const request = rows[0];
    if (!request) throw new DomainError("RegulatoryInspectionRequest not found");
    if (request.archived_at) throw new DomainError("RegulatoryInspectionRequest is no longer active");
    if (!(new Date(args.newDeadline).getTime() > new Date(dateOnlyString(request.response_deadline)!).getTime())) {
      throw new DomainError("New deadline must be later than current");
    }

    await client.query(
      `UPDATE regulatory_inspection_request SET response_deadline = $2, updated_at = now() WHERE id = $1`,
      [requestId, args.newDeadline],
    );
    return { regulatoryInspectionRequestId: requestId };
  });
}
export const extendDeadline = withAuthorization(["vetify"], extendDeadlineImpl);

// ─── Choice: RespondToInspection (RegulatoryInspectionRequest, financialInstitution) ──
// Consuming -- archives the request, creates InspectionResponse.

interface RespondToInspectionArgs {
  responseRef: string;
  documents: string[];
  respondedByName: string;
  responseDate: string;
}

async function respondToInspectionImpl(session: SessionContext, requestId: number, args: RespondToInspectionArgs) {
  if (!args.responseRef) throw new DomainError("Response reference must not be empty");
  if (!args.respondedByName) throw new DomainError("Responded-by name must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM regulatory_inspection_request WHERE id = $1 FOR UPDATE", [requestId]);
    const request = rows[0];
    if (!request) throw new DomainError("RegulatoryInspectionRequest not found");
    if (request.archived_at) throw new DomainError("RegulatoryInspectionRequest is no longer active");

    const { rows: created } = await client.query(
      `INSERT INTO inspection_response
         (regulatory_inspection_request_id, cac_reg_number, business_name, inspection_ref,
          response_ref, documents, responded_by_name, response_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        requestId, request.cac_reg_number, request.business_name, request.inspection_ref,
        args.responseRef, JSON.stringify(args.documents ?? []), args.respondedByName, args.responseDate,
      ],
    );
    const inspectionResponseId = created[0].id;

    await client.query(
      `UPDATE regulatory_inspection_request
         SET archived_at = now(), superseded_by_kind = 'inspection_response', superseded_by_id = $2
         WHERE id = $1`,
      [requestId, inspectionResponseId],
    );
    return { inspectionResponseId };
  });
}
export const respondToInspection = withAuthorization(["financialInstitution"], respondToInspectionImpl);

// ─── Choice: CloseInspection (InspectionResponse, vetify) ─────────────────
// Consuming -- archives the response, creates the immutable InspectionRecord.

interface CloseInspectionArgs {
  findings: string[];
  passed: boolean;
  followUpNeeded: boolean;
  closingNote: string;
}

async function closeInspectionImpl(session: SessionContext, responseId: number, args: CloseInspectionArgs) {
  if (!args.closingNote) throw new DomainError("Closing note must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM inspection_response WHERE id = $1 FOR UPDATE", [responseId]);
    const response = rows[0];
    if (!response) throw new DomainError("InspectionResponse not found");
    if (response.archived_at) throw new DomainError("InspectionResponse is no longer active");

    const { rows: created } = await client.query(
      `INSERT INTO inspection_record
         (inspection_response_id, cac_reg_number, business_name, inspection_ref, findings, passed, follow_up_needed, closing_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        responseId, response.cac_reg_number, response.business_name, response.inspection_ref,
        JSON.stringify(args.findings ?? []), args.passed, args.followUpNeeded, args.closingNote,
      ],
    );
    const inspectionRecordId = created[0].id;

    await client.query(
      `UPDATE inspection_response
         SET archived_at = now(), superseded_by_kind = 'inspection_record', superseded_by_id = $2
         WHERE id = $1`,
      [responseId, inspectionRecordId],
    );
    return { inspectionRecordId };
  });
}
export const closeInspection = withAuthorization(["vetify"], closeInspectionImpl);

export async function listRegulatoryInspectionRequests(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM regulatory_inspection_request ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listInspectionResponses(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM inspection_response ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listInspectionRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM inspection_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Phase 2, Thirtieth Slice: standalone audit/governance records ────────
// Seven templates, none dependent on any existing choice body -- vetify or
// the FI creates each one directly. Grouped into one batch per the "bigger
// batches, same rigor" plan.

// ─── ShariahAuditRecord (vetify creates directly; no further choices) ─────

interface CreateShariahAuditRecordArgs {
  cacRegNumber: string;
  businessName: string;
  facilityRef?: string | null;
  auditDate: string;
  auditPeriod: string;
  auditorRef: string;
  findings: string[];
  overallCompliant: boolean;
  recommendations: string[];
  nextAuditDate?: string | null;
}

async function createShariahAuditRecordImpl(session: SessionContext, args: CreateShariahAuditRecordArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO shariah_audit_record
         (cac_reg_number, business_name, facility_ref, audit_date, audit_period, auditor_ref,
          findings, overall_compliant, recommendations, next_audit_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        args.cacRegNumber, args.businessName, args.facilityRef ?? null, args.auditDate, args.auditPeriod, args.auditorRef,
        JSON.stringify(args.findings ?? []), args.overallCompliant, JSON.stringify(args.recommendations ?? []), args.nextAuditDate ?? null,
      ],
    );
    return { shariahAuditRecordId: rows[0].id };
  });
}
export const createShariahAuditRecord = withAuthorization(["vetify"], createShariahAuditRecordImpl);

export async function listShariahAuditRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM shariah_audit_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── ShariahException (vetify creates + ResolveException) ─────────────────

interface CreateShariahExceptionArgs {
  cacRegNumber: string;
  businessName: string;
  facilityRef?: string | null;
  exceptionType: string;
  description: string;
  severity: "MinorException" | "MajorException" | "CriticalException";
}

async function createShariahExceptionImpl(session: SessionContext, args: CreateShariahExceptionArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO shariah_exception
         (cac_reg_number, business_name, facility_ref, exception_type, description, severity, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING id`,
      [args.cacRegNumber, args.businessName, args.facilityRef ?? null, args.exceptionType, args.description, args.severity],
    );
    return { shariahExceptionId: rows[0].id };
  });
}
export const createShariahException = withAuthorization(["vetify"], createShariahExceptionImpl);

async function resolveExceptionImpl(session: SessionContext, exceptionId: number, args: { note: string }) {
  if (!args.note) throw new DomainError("Resolution note must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT resolution_note FROM shariah_exception WHERE id = $1 FOR UPDATE", [exceptionId]);
    const exception = rows[0];
    if (!exception) throw new DomainError("ShariahException not found");
    if (exception.resolution_note !== null) throw new DomainError("Exception is already resolved");

    await client.query(
      `UPDATE shariah_exception SET resolution_note = $2, resolved_at = now(), updated_at = now() WHERE id = $1`,
      [exceptionId, args.note],
    );
    return { shariahExceptionId: exceptionId };
  });
}
export const resolveException = withAuthorization(["vetify"], resolveExceptionImpl);

export async function listShariahExceptions(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM shariah_exception ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── MurabahahStatement (vetify creates directly; no further choices) ─────

interface CreateMurabahahStatementArgs {
  cacRegNumber: string;
  businessName: string;
  statementDate: string;
  statementPeriod: string;
  totalFinanced: number;
  totalRepaid: number;
  outstandingBalance: number;
  installmentsPaid: number;
  totalInstallments: number;
  contractStatus: string;
  shariahAuditRef?: string | null;
}

async function createMurabahahStatementImpl(session: SessionContext, args: CreateMurabahahStatementArgs) {
  if (!(args.totalFinanced > 0)) throw new DomainError("totalFinanced must be positive");
  if (!(args.totalRepaid >= 0)) throw new DomainError("totalRepaid must be non-negative");
  if (!(args.outstandingBalance >= 0)) throw new DomainError("outstandingBalance must be non-negative");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO murabahah_statement
         (cac_reg_number, business_name, statement_date, statement_period, total_financed, total_repaid,
          outstanding_balance, installments_paid, total_installments, contract_status, shariah_audit_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        args.cacRegNumber, args.businessName, args.statementDate, args.statementPeriod, args.totalFinanced, args.totalRepaid,
        args.outstandingBalance, args.installmentsPaid, args.totalInstallments, args.contractStatus, args.shariahAuditRef ?? null,
      ],
    );
    return { murabahahStatementId: rows[0].id };
  });
}
export const createMurabahahStatement = withAuthorization(["vetify"], createMurabahahStatementImpl);

export async function listMurabahahStatements(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM murabahah_statement ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── MonitoringAlert (vetify creates + DismissAlert) ───────────────────────

interface CreateMonitoringAlertArgs {
  cacRegNumber: string;
  businessName: string;
  facilityRef?: string | null;
  alertType: string;
  alertSeverity: string;
  alertDescription: string;
}

async function createMonitoringAlertImpl(session: SessionContext, args: CreateMonitoringAlertArgs) {
  if (!args.alertDescription) throw new DomainError("Alert description must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO monitoring_alert
         (cac_reg_number, business_name, facility_ref, alert_type, alert_severity, alert_description, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING id`,
      [args.cacRegNumber, args.businessName, args.facilityRef ?? null, args.alertType, args.alertSeverity, args.alertDescription],
    );
    return { monitoringAlertId: rows[0].id };
  });
}
export const createMonitoringAlert = withAuthorization(["vetify"], createMonitoringAlertImpl);

async function dismissAlertImpl(session: SessionContext, alertId: number, args: { dismissNote: string }) {
  if (!args.dismissNote) throw new DomainError("Dismissal note must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT dismissed FROM monitoring_alert WHERE id = $1 FOR UPDATE", [alertId]);
    const alert = rows[0];
    if (!alert) throw new DomainError("MonitoringAlert not found");
    if (alert.dismissed) throw new DomainError("Alert is already dismissed");

    await client.query(
      `UPDATE monitoring_alert SET dismissed = true, dismissal_note = $2, updated_at = now() WHERE id = $1`,
      [alertId, args.dismissNote],
    );
    return { monitoringAlertId: alertId };
  });
}
export const dismissAlert = withAuthorization(["vetify"], dismissAlertImpl);

export async function listMonitoringAlerts(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM monitoring_alert ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── PortfolioRiskReport (vetify creates directly; portfolio-wide, no cacRegNumber) ──

interface PortfolioRiskMetricsArgs {
  probabilityOfDefault: number;
  lossGivenDefault: number;
  expectedLoss: number;
  exposureAtDefault: number;
  concentrationRisk: number;
  sectorConcentration: string;
  delinquencyRate: number;
  activeContractCount: number;
}

interface CreatePortfolioRiskReportArgs {
  reportDate: string;
  reportPeriod: string;
  metrics: PortfolioRiskMetricsArgs;
  generatedByAgent: string;
  modelVersion: string;
}

async function createPortfolioRiskReportImpl(session: SessionContext, args: CreatePortfolioRiskReportArgs) {
  if (!(args.metrics.activeContractCount >= 0)) throw new DomainError("activeContractCount must be non-negative");
  if (!(args.metrics.exposureAtDefault >= 0)) throw new DomainError("exposureAtDefault must be non-negative");
  if (!(args.metrics.expectedLoss >= 0)) throw new DomainError("expectedLoss must be non-negative");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO portfolio_risk_report
         (report_date, report_period, probability_of_default, loss_given_default, expected_loss,
          exposure_at_default, concentration_risk, sector_concentration, delinquency_rate,
          active_contract_count, generated_by_agent, model_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        args.reportDate, args.reportPeriod, args.metrics.probabilityOfDefault, args.metrics.lossGivenDefault, args.metrics.expectedLoss,
        args.metrics.exposureAtDefault, args.metrics.concentrationRisk, args.metrics.sectorConcentration, args.metrics.delinquencyRate,
        args.metrics.activeContractCount, args.generatedByAgent, args.modelVersion,
      ],
    );
    return { portfolioRiskReportId: rows[0].id };
  });
}
export const createPortfolioRiskReport = withAuthorization(["vetify"], createPortfolioRiskReportImpl);

export async function listPortfolioRiskReports(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM portfolio_risk_report ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── ForceMajeureDeclaration (vetify creates + LiftDeclaration; portfolio-wide) ──

interface CreateForceMajeureDeclarationArgs {
  declarationRef: string;
  eventDescription: string;
  affectedRegion: string;
  suspensionStart: string;
  suspensionEnd: string;
  regulatoryBasis: string;
}

async function createForceMajeureDeclarationImpl(session: SessionContext, args: CreateForceMajeureDeclarationArgs) {
  if (!args.declarationRef) throw new DomainError("declarationRef must not be empty");
  if (!args.eventDescription) throw new DomainError("eventDescription must not be empty");
  if (!(new Date(args.suspensionEnd).getTime() > new Date(args.suspensionStart).getTime())) {
    throw new DomainError("suspensionEnd must be later than suspensionStart");
  }
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO force_majeure_declaration
         (declaration_ref, event_description, affected_region, suspension_start, suspension_end, regulatory_basis)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [args.declarationRef, args.eventDescription, args.affectedRegion, args.suspensionStart, args.suspensionEnd, args.regulatoryBasis],
    );
    return { forceMajeureDeclarationId: rows[0].id };
  });
}
export const createForceMajeureDeclaration = withAuthorization(["vetify"], createForceMajeureDeclarationImpl);

async function liftDeclarationImpl(session: SessionContext, declarationId: number, args: { note: string }) {
  if (!args.note) throw new DomainError("Lifting note must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT is_active FROM force_majeure_declaration WHERE id = $1 FOR UPDATE", [declarationId]);
    const declaration = rows[0];
    if (!declaration) throw new DomainError("ForceMajeureDeclaration not found");
    if (!declaration.is_active) throw new DomainError("Declaration has already been lifted");

    await client.query(`UPDATE force_majeure_declaration SET is_active = false, updated_at = now() WHERE id = $1`, [declarationId]);
    return { forceMajeureDeclarationId: declarationId };
  });
}
export const liftDeclaration = withAuthorization(["vetify"], liftDeclarationImpl);

export async function listForceMajeureDeclarations(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM force_majeure_declaration ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── CharityOrganizationRegistry (financialInstitution creates + UpdateRegistry; FI-wide) ──

interface CharityOrgArgs {
  approvedOrganizations: [string, string][];
  shariahBoardRef: string;
  effectiveDate: string;
  version: string;
}

async function createCharityOrganizationRegistryImpl(session: SessionContext, args: CharityOrgArgs) {
  if (!args.approvedOrganizations || args.approvedOrganizations.length === 0) {
    throw new DomainError("Updated list must not be empty");
  }
  if (!args.shariahBoardRef) throw new DomainError("shariahBoardRef must not be empty");
  if (!args.version) throw new DomainError("version must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO charity_organization_registry (approved_organizations, shariah_board_ref, effective_date, version)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [JSON.stringify(args.approvedOrganizations), args.shariahBoardRef, args.effectiveDate, args.version],
    );
    return { charityOrganizationRegistryId: rows[0].id };
  });
}
export const createCharityOrganizationRegistry = withAuthorization(["financialInstitution"], createCharityOrganizationRegistryImpl);

interface UpdateRegistryArgs {
  newOrganizations: [string, string][];
  newVersion: string;
  updatedBoardRef: string;
}

async function updateRegistryImpl(session: SessionContext, registryId: number, args: UpdateRegistryArgs) {
  if (!args.newOrganizations || args.newOrganizations.length === 0) throw new DomainError("Updated list must not be empty");
  if (!args.newVersion) throw new DomainError("New version must not be empty");
  if (!args.updatedBoardRef) throw new DomainError("Updated board reference must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT id FROM charity_organization_registry WHERE id = $1 FOR UPDATE", [registryId]);
    if (!rows[0]) throw new DomainError("CharityOrganizationRegistry not found");

    await client.query(
      `UPDATE charity_organization_registry
         SET approved_organizations = $2, version = $3, shariah_board_ref = $4, updated_at = now()
         WHERE id = $1`,
      [registryId, JSON.stringify(args.newOrganizations), args.newVersion, args.updatedBoardRef],
    );
    return { charityOrganizationRegistryId: registryId };
  });
}
export const updateRegistry = withAuthorization(["financialInstitution"], updateRegistryImpl);

export async function listCharityOrganizationRegistries(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM charity_organization_registry ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Phase 2, Thirty-First Slice: AssetPurchaseRecord supporting records (Batch B) ──
// Four are choices on the already-ported AssetPurchaseRecord
// (RecordDeliveryMilestone, RecordSupplierFailure, RecordSupplierPayment,
// RegisterDocument); PurchaseOrder/CapitalCallRecord are created directly
// by financialInstitution, no dependency on an AssetPurchaseRecord fixture.

// ─── Choice: RecordDeliveryMilestone (AssetPurchaseRecord, business) ──────
// Nonconsuming -- the purchase record stays live.

interface RecordDeliveryMilestoneArgs {
  milestoneDescription: string;
  quantityDelivered: number;
  milestoneDate: string;
  evidenceRef?: string | null;
}

async function recordDeliveryMilestoneImpl(session: SessionContext, recordId: number, args: RecordDeliveryMilestoneArgs) {
  if (!args.milestoneDescription) throw new DomainError("Milestone description must not be empty");
  if (!(args.quantityDelivered > 0)) throw new DomainError("Quantity delivered must be positive");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM asset_purchase_record WHERE id = $1", [recordId]);
    const record = rows[0];
    if (!record) throw new DomainError("AssetPurchaseRecord not found");
    if (record.delivery_acknowledged) throw new DomainError("Cannot record milestone after delivery is fully acknowledged");

    const { rows: created } = await client.query(
      `INSERT INTO delivery_milestone
         (asset_purchase_record_id, cac_reg_number, business_name, milestone_description, quantity_delivered, milestone_date, evidence_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [recordId, record.cac_reg_number, record.business_name, args.milestoneDescription, args.quantityDelivered, args.milestoneDate, args.evidenceRef ?? null],
    );
    return { deliveryMilestoneId: created[0].id };
  });
}
export const recordDeliveryMilestone = withAuthorization(["business"], recordDeliveryMilestoneImpl);

export async function listDeliveryMilestones(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM delivery_milestone ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: RecordSupplierFailure (AssetPurchaseRecord, financialInstitution) ──
// Consuming -- archives the AssetPurchaseRecord; the Wakala sub-flow must restart.

interface RecordSupplierFailureArgs {
  failureType: "SupplierCancelled" | "SupplierBankrupt" | "RefundIssued";
  failureDescription: string;
  refundAmount?: number | null;
}

async function recordSupplierFailureImpl(session: SessionContext, recordId: number, args: RecordSupplierFailureArgs) {
  if (!args.failureDescription) throw new DomainError("Failure description must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM asset_purchase_record WHERE id = $1 FOR UPDATE", [recordId]);
    const record = rows[0];
    if (!record) throw new DomainError("AssetPurchaseRecord not found");
    if (record.archived_at) throw new DomainError("AssetPurchaseRecord is no longer active");

    const { rows: created } = await client.query(
      `INSERT INTO supplier_failure_record
         (asset_purchase_record_id, cac_reg_number, business_name, failure_type, failure_description, refund_amount, failed_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING id`,
      [recordId, record.cac_reg_number, record.business_name, args.failureType, args.failureDescription, args.refundAmount ?? null],
    );
    const supplierFailureRecordId = created[0].id;

    await client.query(
      `UPDATE asset_purchase_record
         SET archived_at = now(), superseded_by_kind = 'supplier_failure_record', superseded_by_id = $2
         WHERE id = $1`,
      [recordId, supplierFailureRecordId],
    );
    return { supplierFailureRecordId };
  });
}
export const recordSupplierFailure = withAuthorization(["financialInstitution"], recordSupplierFailureImpl);

export async function listSupplierFailureRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM supplier_failure_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: RecordSupplierPayment (AssetPurchaseRecord, financialInstitution) ──
// Nonconsuming -- the purchase record stays active.

interface RecordSupplierPaymentArgs {
  supplierDetails?: Record<string, unknown> | null;
  amountPaid: number;
  paymentDate: string;
  paymentRef: string;
  bankConfirmationRef?: string | null;
}

async function recordSupplierPaymentImpl(session: SessionContext, recordId: number, args: RecordSupplierPaymentArgs) {
  if (!(args.amountPaid > 0)) throw new DomainError("Payment amount must be positive");
  if (!args.paymentRef) throw new DomainError("Payment reference must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM asset_purchase_record WHERE id = $1", [recordId]);
    const record = rows[0];
    if (!record) throw new DomainError("AssetPurchaseRecord not found");

    const { rows: created } = await client.query(
      `INSERT INTO supplier_payment_record
         (asset_purchase_record_id, cac_reg_number, business_name, supplier_details, amount_paid, payment_date,
          payment_ref, bank_confirmation_ref, purchased_via_wakala)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        recordId, record.cac_reg_number, record.business_name, args.supplierDetails ? JSON.stringify(args.supplierDetails) : null,
        args.amountPaid, args.paymentDate, args.paymentRef, args.bankConfirmationRef ?? null, record.purchased_via_wakala,
      ],
    );
    return { supplierPaymentRecordId: created[0].id };
  });
}
export const recordSupplierPayment = withAuthorization(["financialInstitution"], recordSupplierPaymentImpl);

export async function listSupplierPaymentRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM supplier_payment_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: RegisterDocument (AssetPurchaseRecord, financialInstitution) ─
// Nonconsuming, creates a managed-lifecycle DocumentEntry.

interface DocumentRefArgs {
  docType: string;
  contentHash: string;
  storageRef: string;
}

async function registerDocumentImpl(session: SessionContext, recordId: number, args: { documentRef: DocumentRefArgs; registeredBy: string }) {
  if (!args.registeredBy) throw new DomainError("Registered-by name must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM asset_purchase_record WHERE id = $1", [recordId]);
    const record = rows[0];
    if (!record) throw new DomainError("AssetPurchaseRecord not found");

    const { rows: created } = await client.query(
      `INSERT INTO document_entry (asset_purchase_record_id, cac_reg_number, business_name, document_ref, registered_by, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id`,
      [recordId, record.cac_reg_number, record.business_name, JSON.stringify(args.documentRef), args.registeredBy],
    );
    return { documentEntryId: created[0].id };
  });
}
export const registerDocument = withAuthorization(["financialInstitution"], registerDocumentImpl);

// ─── Choice: VerifyDocument (DocumentEntry, vetify) ───────────────────────

async function verifyDocumentImpl(session: SessionContext, documentEntryId: number, args: { verifyNote?: string | null }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT verified_at, superseded FROM document_entry WHERE id = $1 FOR UPDATE", [documentEntryId]);
    const entry = rows[0];
    if (!entry) throw new DomainError("DocumentEntry not found");
    if (entry.verified_at !== null) throw new DomainError("Document already verified");
    if (entry.superseded) throw new DomainError("Document is superseded");

    await client.query(`UPDATE document_entry SET verified_at = now(), updated_at = now() WHERE id = $1`, [documentEntryId]);
    return { documentEntryId };
  });
}
export const verifyDocument = withAuthorization(["vetify"], verifyDocumentImpl);

// ─── Choice: SupersedeDocument (DocumentEntry, financialInstitution) ──────

async function supersedeDocumentImpl(
  session: SessionContext,
  documentEntryId: number,
  args: { newDocumentRef: DocumentRefArgs; reason: string },
) {
  if (!args.reason) throw new DomainError("Reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT superseded FROM document_entry WHERE id = $1 FOR UPDATE", [documentEntryId]);
    const entry = rows[0];
    if (!entry) throw new DomainError("DocumentEntry not found");
    if (entry.superseded) throw new DomainError("Document is already superseded");

    await client.query(
      `UPDATE document_entry SET document_ref = $2, verified_at = NULL, superseded = false, updated_at = now() WHERE id = $1`,
      [documentEntryId, JSON.stringify(args.newDocumentRef)],
    );
    return { documentEntryId };
  });
}
export const supersedeDocument = withAuthorization(["financialInstitution"], supersedeDocumentImpl);

export async function listDocumentEntries(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM document_entry ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── PurchaseOrder (financialInstitution creates directly + lifecycle choices) ──

interface CreatePurchaseOrderArgs {
  cacRegNumber: string;
  businessName: string;
  facilityRef: string;
  supplierName: string;
  supplierDetails: Record<string, unknown>;
  orderedItems: Record<string, unknown>[];
  totalOrderValue: number;
  deliveryDeadline: string;
  poRef: string;
}

async function createPurchaseOrderImpl(session: SessionContext, args: CreatePurchaseOrderArgs) {
  if (!(args.totalOrderValue > 0)) throw new DomainError("totalOrderValue must be positive");
  if (!args.poRef) throw new DomainError("poRef must not be empty");
  if (!args.orderedItems || args.orderedItems.length === 0) throw new DomainError("orderedItems must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO purchase_order
         (cac_reg_number, business_name, facility_ref, supplier_name, supplier_details, ordered_items,
          total_order_value, delivery_deadline, po_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        args.cacRegNumber, args.businessName, args.facilityRef, args.supplierName, JSON.stringify(args.supplierDetails),
        JSON.stringify(args.orderedItems), args.totalOrderValue, args.deliveryDeadline, args.poRef,
      ],
    );
    return { purchaseOrderId: rows[0].id };
  });
}
export const createPurchaseOrder = withAuthorization(["financialInstitution"], createPurchaseOrderImpl);

async function confirmPOImpl(session: SessionContext, poId: number, args: { confirmationRef: string }) {
  if (!args.confirmationRef) throw new DomainError("Confirmation reference must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT status FROM purchase_order WHERE id = $1 FOR UPDATE", [poId]);
    if (!rows[0]) throw new DomainError("PurchaseOrder not found");
    await client.query(`UPDATE purchase_order SET status = 'POConfirmed', updated_at = now() WHERE id = $1`, [poId]);
    return { purchaseOrderId: poId };
  });
}
export const confirmPO = withAuthorization(["financialInstitution"], confirmPOImpl);

async function markPartiallyFulfilledImpl(session: SessionContext, poId: number, args: { deliveryRef: string }) {
  if (!args.deliveryRef) throw new DomainError("Delivery reference must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT status FROM purchase_order WHERE id = $1 FOR UPDATE", [poId]);
    const po = rows[0];
    if (!po) throw new DomainError("PurchaseOrder not found");
    if (!(po.status === "POConfirmed" || po.status === "POIssued")) {
      throw new DomainError("Can only mark Confirmed or Issued PO as partially fulfilled");
    }
    await client.query(`UPDATE purchase_order SET status = 'POPartiallyFulfilled', updated_at = now() WHERE id = $1`, [poId]);
    return { purchaseOrderId: poId };
  });
}
export const markPartiallyFulfilled = withAuthorization(["financialInstitution"], markPartiallyFulfilledImpl);

async function markFulfilledImpl(session: SessionContext, poId: number, args: { deliveryRef: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT status FROM purchase_order WHERE id = $1 FOR UPDATE", [poId]);
    const po = rows[0];
    if (!po) throw new DomainError("PurchaseOrder not found");
    if (!(po.status === "POConfirmed" || po.status === "POPartiallyFulfilled")) {
      throw new DomainError("PO must be Confirmed or PartiallyFulfilled to mark as Fulfilled");
    }
    await client.query(`UPDATE purchase_order SET status = 'POFulfilled', updated_at = now() WHERE id = $1`, [poId]);
    return { purchaseOrderId: poId };
  });
}
export const markFulfilled = withAuthorization(["financialInstitution"], markFulfilledImpl);

async function cancelPOImpl(session: SessionContext, poId: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT status FROM purchase_order WHERE id = $1 FOR UPDATE", [poId]);
    const po = rows[0];
    if (!po) throw new DomainError("PurchaseOrder not found");
    if (!(po.status === "POIssued" || po.status === "POConfirmed")) {
      throw new DomainError("Can only cancel an Issued or Confirmed PO");
    }
    await client.query(`UPDATE purchase_order SET status = 'POCancelled', updated_at = now() WHERE id = $1`, [poId]);
    return { purchaseOrderId: poId };
  });
}
export const cancelPO = withAuthorization(["financialInstitution"], cancelPOImpl);

export async function listPurchaseOrders(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM purchase_order ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── CapitalCallRecord (financialInstitution creates directly; immutable) ──

interface CreateCapitalCallRecordArgs {
  cacRegNumber: string;
  businessName: string;
  facilityRef: string;
  trancheNumber: number;
  trancheAmount: number;
  disbursementDate: string;
  purposeOfTranche: string;
  disbursementRef: string;
  cumulativeDisbursed: number;
  remainingFacility: number;
}

async function createCapitalCallRecordImpl(session: SessionContext, args: CreateCapitalCallRecordArgs) {
  if (!(args.trancheAmount > 0)) throw new DomainError("trancheAmount must be positive");
  if (!args.disbursementRef) throw new DomainError("disbursementRef must not be empty");
  if (!args.purposeOfTranche) throw new DomainError("purposeOfTranche must not be empty");
  if (!(args.cumulativeDisbursed >= args.trancheAmount)) throw new DomainError("cumulativeDisbursed must be at least trancheAmount");
  if (!(args.remainingFacility >= 0)) throw new DomainError("remainingFacility must be non-negative");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO capital_call_record
         (cac_reg_number, business_name, facility_ref, tranche_number, tranche_amount, disbursement_date,
          purpose_of_tranche, disbursement_ref, cumulative_disbursed, remaining_facility)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        args.cacRegNumber, args.businessName, args.facilityRef, args.trancheNumber, args.trancheAmount, args.disbursementDate,
        args.purposeOfTranche, args.disbursementRef, args.cumulativeDisbursed, args.remainingFacility,
      ],
    );
    return { capitalCallRecordId: rows[0].id };
  });
}
export const createCapitalCallRecord = withAuthorization(["financialInstitution"], createCapitalCallRecordImpl);

export async function listCapitalCallRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM capital_call_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Phase 2, Thirty-Third Slice: MurabahahContract instruments (Batch D) ──
// CreditCovenant, GuaranteeAgreement, TakafulPolicy are all created
// directly by financialInstitution against a live MurabahahContract -- no
// exercised choice creates any of them in the real Daml.

// ─── CreditCovenant (financialInstitution creates directly + RecordCovenantMeasurement, vetify) ──

interface CreateCreditCovenantArgs {
  covenantType: string;
  threshold: number;
  measurementFrequency: string;
}

async function createCreditCovenantImpl(session: SessionContext, contractId: number, args: CreateCreditCovenantArgs) {
  if (!(args.threshold > 0)) throw new DomainError("threshold must be positive");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");

    const { rows: created } = await client.query(
      `INSERT INTO credit_covenant (murabahah_contract_id, cac_reg_number, business_name, covenant_type, threshold, measurement_frequency)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [contractId, contract.cac_reg_number, contract.business_name, args.covenantType, args.threshold, args.measurementFrequency],
    );
    return { creditCovenantId: created[0].id };
  });
}
export const createCreditCovenant = withAuthorization(["financialInstitution"], createCreditCovenantImpl);

interface RecordCovenantMeasurementArgs {
  measuredValue: number;
  measureDate: string;
  measuredBy: string;
}

async function recordCovenantMeasurementImpl(session: SessionContext, covenantId: number, args: RecordCovenantMeasurementArgs) {
  if (!args.measuredBy) throw new DomainError("Measured-by must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM credit_covenant WHERE id = $1", [covenantId]);
    const covenant = rows[0];
    if (!covenant) throw new DomainError("CreditCovenant not found");

    const threshold = Number(covenant.threshold);
    const { rows: created } = await client.query(
      `INSERT INTO covenant_measurement_record
         (credit_covenant_id, cac_reg_number, business_name, covenant_type, threshold, measured_value, measure_date, measured_by, breached)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        covenantId, covenant.cac_reg_number, covenant.business_name, covenant.covenant_type, threshold,
        args.measuredValue, args.measureDate, args.measuredBy, args.measuredValue < threshold,
      ],
    );
    return { covenantMeasurementRecordId: created[0].id };
  });
}
export const recordCovenantMeasurement = withAuthorization(["vetify"], recordCovenantMeasurementImpl);

export async function listCreditCovenants(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM credit_covenant ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listCovenantMeasurementRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM covenant_measurement_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── GuaranteeAgreement (financialInstitution creates directly + EnforceGuarantee/ReleaseGuarantee) ──
// "guarantor" collapses to the guarantorName/guarantorId text fields --
// no natural session party role exists for a one-off individual guarantor.

interface CreateGuaranteeAgreementArgs {
  guaranteeType: string;
  guaranteedAmount: number;
  guarantorName: string;
  guarantorId: string;
  effectiveDate: string;
  expiryDate?: string | null;
}

async function createGuaranteeAgreementImpl(session: SessionContext, contractId: number, args: CreateGuaranteeAgreementArgs) {
  if (!args.guaranteeType) throw new DomainError("guaranteeType must not be empty");
  if (!(args.guaranteedAmount > 0)) throw new DomainError("guaranteedAmount must be positive");
  if (!args.guarantorName) throw new DomainError("guarantorName must not be empty");
  if (!args.guarantorId) throw new DomainError("guarantorId must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");

    const { rows: created } = await client.query(
      `INSERT INTO guarantee_agreement
         (murabahah_contract_id, cac_reg_number, business_name, facility_ref, guarantee_type, guaranteed_amount,
          guarantor_name, guarantor_id, effective_date, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        contractId, contract.cac_reg_number, contract.business_name, contract.facility_ref, args.guaranteeType, args.guaranteedAmount,
        args.guarantorName, args.guarantorId, args.effectiveDate, args.expiryDate ?? null,
      ],
    );
    return { guaranteeAgreementId: created[0].id };
  });
}
export const createGuaranteeAgreement = withAuthorization(["financialInstitution"], createGuaranteeAgreementImpl);

async function enforceGuaranteeImpl(session: SessionContext, guaranteeId: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT guarantee_status FROM guarantee_agreement WHERE id = $1 FOR UPDATE", [guaranteeId]);
    const guarantee = rows[0];
    if (!guarantee) throw new DomainError("GuaranteeAgreement not found");
    if (guarantee.guarantee_status !== "GuaranteeActive") throw new DomainError("Can only enforce an Active guarantee");

    await client.query(`UPDATE guarantee_agreement SET guarantee_status = 'GuaranteeEnforced', updated_at = now() WHERE id = $1`, [guaranteeId]);
    return { guaranteeAgreementId: guaranteeId };
  });
}
export const enforceGuarantee = withAuthorization(["financialInstitution"], enforceGuaranteeImpl);

async function releaseGuaranteeImpl(session: SessionContext, guaranteeId: number, args: { note: string }) {
  if (!args.note) throw new DomainError("Release note must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT guarantee_status FROM guarantee_agreement WHERE id = $1 FOR UPDATE", [guaranteeId]);
    const guarantee = rows[0];
    if (!guarantee) throw new DomainError("GuaranteeAgreement not found");
    if (guarantee.guarantee_status !== "GuaranteeActive") throw new DomainError("Can only release an Active guarantee");

    await client.query(`UPDATE guarantee_agreement SET guarantee_status = 'GuaranteeReleased', updated_at = now() WHERE id = $1`, [guaranteeId]);
    return { guaranteeAgreementId: guaranteeId };
  });
}
export const releaseGuarantee = withAuthorization(["financialInstitution"], releaseGuaranteeImpl);

export async function listGuaranteeAgreements(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM guarantee_agreement ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── TakafulPolicy (financialInstitution creates directly; immutable) ─────

interface CreateTakafulPolicyArgs {
  policyNumber: string;
  takafulOperator: string;
  coverageType: string;
  coverageAmount: number;
  premiumAmount: number;
  startDate: string;
  expiryDate: string;
  assetRef?: string | null;
}

async function createTakafulPolicyImpl(session: SessionContext, contractId: number, args: CreateTakafulPolicyArgs) {
  if (!(args.premiumAmount > 0)) throw new DomainError("premiumAmount must be positive");
  if (!(args.coverageAmount > 0)) throw new DomainError("coverageAmount must be positive");
  if (!(new Date(args.expiryDate).getTime() > new Date(args.startDate).getTime())) {
    throw new DomainError("expiryDate must be later than startDate");
  }
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM murabahah_contract WHERE id = $1", [contractId]);
    const contract = rows[0];
    if (!contract) throw new DomainError("MurabahahContract not found");

    const { rows: created } = await client.query(
      `INSERT INTO takaful_policy
         (murabahah_contract_id, cac_reg_number, business_name, policy_number, takaful_operator, coverage_type,
          coverage_amount, premium_amount, start_date, expiry_date, asset_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        contractId, contract.cac_reg_number, contract.business_name, args.policyNumber, args.takafulOperator, args.coverageType,
        args.coverageAmount, args.premiumAmount, args.startDate, args.expiryDate, args.assetRef ?? null,
      ],
    );
    return { takafulPolicyId: created[0].id };
  });
}
export const createTakafulPolicy = withAuthorization(["financialInstitution"], createTakafulPolicyImpl);

export async function listTakafulPolicies(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM takaful_policy ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Phase 2, Thirty-Fourth Slice: SARReport + RevokeCertification (Batch E) ──

// ─── SARReport (vetify creates directly; no business observer; immutable) ──

interface CreateSarReportArgs {
  cacRegNumber: string;
  businessName: string;
  sarRef: string;
  suspiciousActivity: string;
  reportDate: string;
  reportedByParty: string;
  confidential?: boolean;
}

async function createSarReportImpl(session: SessionContext, args: CreateSarReportArgs) {
  if (!args.sarRef) throw new DomainError("sarRef must not be empty");
  if (!args.suspiciousActivity) throw new DomainError("suspiciousActivity must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO sar_report (cac_reg_number, business_name, sar_ref, suspicious_activity, report_date, reported_by_party, confidential)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [args.cacRegNumber, args.businessName, args.sarRef, args.suspiciousActivity, args.reportDate, args.reportedByParty, args.confidential ?? true],
    );
    return { sarReportId: rows[0].id };
  });
}
export const createSarReport = withAuthorization(["vetify"], createSarReportImpl);

export async function listSarReports(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM sar_report ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: RevokeCertification (ShariahContractCertification, advisor) ──
// Named as deferred since this migration's very first Murabahah slice --
// consuming, archives the certification (so AcceptProposal's fetch fails,
// blocking execution until a fresh certification is issued), creates an
// immutable ShariahCertificationRevocation audit record.

interface RevokeCertificationArgs {
  revocationRef: string;
  reason: string;
  revokedBy: string;
}

async function revokeCertificationImpl(session: SessionContext, certificationId: number, args: RevokeCertificationArgs) {
  if (!args.revocationRef) throw new DomainError("Revocation reference must not be empty");
  if (!args.reason) throw new DomainError("Revocation reason must not be empty");
  if (!args.revokedBy) throw new DomainError("Revoking member must be named");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM shariah_contract_certification WHERE id = $1 FOR UPDATE",
      [certificationId],
    );
    const cert = rows[0];
    if (!cert) throw new DomainError("ShariahContractCertification not found");
    if (cert.archived_at) throw new DomainError("ShariahContractCertification is no longer active");

    const { rows: created } = await client.query(
      `INSERT INTO shariah_certification_revocation
         (shariah_contract_certification_id, facility_ref, cac_reg_number, business_name,
          original_certification_ref, revocation_ref, reason, revoked_by, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       RETURNING id`,
      [
        certificationId, cert.facility_ref, cert.cac_reg_number, cert.business_name,
        cert.certification_ref, args.revocationRef, args.reason, args.revokedBy,
      ],
    );
    const shariahCertificationRevocationId = created[0].id;

    await client.query(
      `UPDATE shariah_contract_certification
         SET archived_at = now(), superseded_by_kind = 'shariah_certification_revocation', superseded_by_id = $2
         WHERE id = $1`,
      [certificationId, shariahCertificationRevocationId],
    );
    return { shariahCertificationRevocationId };
  });
}
export const revokeCertification = withAuthorization(["advisor"], revokeCertificationImpl);

export async function listShariahCertificationRevocations(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM shariah_certification_revocation ORDER BY created_at DESC`);
    return rows;
  });
}
