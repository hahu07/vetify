/**
 * Stages 8–10: Murabahah Contract, Repayment, Ibra', Charity, Collateral, Reports
 *
 * GET  → PQS (PostgreSQL via repository.ts)
 * POST → Canton HTTP JSON API (canton.ts)
 */
import { Router } from "express";
import { exerciseChoice, createContract, queryContracts, resolveFinancerParty, partyId } from "../canton.js";
import { requireAuth } from "../auth.js";
import {
  listContracts,
  listContractsByStatus,
  listContractsByFi,
  listContractsPaged,
  listContractsByStatusPaged,
  getContractById,
  listRepayments,
  listRepaymentsByBusiness,
  listRepaymentsPaged,
  listRepaymentsByBusinessPaged,
  listIbraRequests,
  listIbraByBusiness,
  listLatePaymentCharities,
  listUnsettledCharities,
  listCharitiesByBusiness,
  listRahnAgreements,
  listRahnByBusiness,
  listPortfolioReports,
  getPortfolioSummary,
  getPortfolioSummaryByFi,
  getBusinessContracts,
  getBusinessFinancingRequests,
  getBusinessRepayments,
} from "../repository.js";
import { clampPage } from "../pqs.js";

const router = Router();

const T_CONTRACT = "Vetify.Murabahah:MurabahahContract";
const T_IBRA     = "Vetify.Murabahah:IbraRequest";
const T_CHARITY  = "Vetify.Murabahah:LatePaymentCharity";
const T_RAHN     = "Vetify.Murabahah:RahnAgreement";
const T_AUTHORIZED_SENTINEL = "Vetify.Governance:AuthorizedSentinel";
const T_AUTHORIZED_OFFICER  = "Vetify.Governance:AuthorizedOfficer";
const T_PAYMENT_IDEMPOTENCY_GUARD = "Vetify.Murabahah:PaymentIdempotencyGuard";

// SDK 3.4.11 / Daml-LF 2.1/2.2 has no contract keys, so the choices below can
// no longer resolve their active registry/guard contract via lookupByKey —
// these small helpers do the equivalent lookup off-ledger and the routes pass
// the resulting ContractId(s) in explicitly.
async function getAuthorizedSentinelCid(sentinelParty: string): Promise<string | null> {
  const entries = await queryContracts(T_AUTHORIZED_SENTINEL);
  return (entries.find((e: any) => e.payload.sentinel === sentinelParty))?.contractId ?? null;
}

async function getAuthorizedOfficerCid(financialInstitution: string, officerId: string): Promise<string | null> {
  // Queried as "vetify" (the AuthorizedOfficer observer, per Governance.daml).
  const entries = await queryContracts(T_AUTHORIZED_OFFICER, "vetify");
  return (entries.find((e: any) =>
    e.payload.financialInstitution === financialInstitution && e.payload.officerId === officerId))?.contractId ?? null;
}

// Narrows (but does not fully close, per Murabahah.daml's RecordPayment comment) the
// duplicate-directDebitRef race now that PaymentIdempotencyGuard has no contract key.
// `actingFinancerKey` is the FI's own party key (PaymentIdempotencyGuard's sole
// signatory, no observer) — must query as that same party, not a fixed role, so a
// self-serve FI's dynamically-allocated party sees its own guards.
async function getExistingPaymentGuardCid(
  actingFinancerKey: string, financialInstitution: string, directDebitRef: string,
): Promise<string | null> {
  const entries = await queryContracts(T_PAYMENT_IDEMPOTENCY_GUARD, actingFinancerKey);
  return (entries.find((e: any) =>
    e.payload.financialInstitution === financialInstitution && e.payload.directDebitRef === directDebitRef))?.contractId ?? null;
}

// ── FI Portfolio Dashboard ────────────────────────────────────────────────────

router.get("/summary", async (req, res, next) => {
  try {
    const { partyRole, financialInstitutionPartyId } = req.authUser!;
    res.json(
      partyRole === "financer" && financialInstitutionPartyId
        ? await getPortfolioSummaryByFi(financialInstitutionPartyId)
        : await getPortfolioSummary(),
    );
  } catch (e) { next(e); }
});

// ── AuthorizedSentinel registry (who may act as sentinel) ───────────────────
// Mirrors AuthorizedAssessor's register/deactivate/reactivate pattern
// (backend/src/routes/financing.ts) exactly. Registered here, before the
// Stage 8 "/:contractId" catch-all below, so "/sentinels" isn't shadowed by it.

router.get("/sentinels", async (_req, res, next) => {
  try {
    res.json(await queryContracts(T_AUTHORIZED_SENTINEL));
  } catch (e) { next(e); }
});

router.post("/sentinels", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { vetify, sentinel, role, authorizedBy } = req.body;
    res.status(201).json(await createContract(T_AUTHORIZED_SENTINEL, {
      vetify,
      sentinel,
      role,
      authorizedBy,
      authorizedAt: new Date().toISOString(),
      active: true,
    }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/sentinels/:contractId/deactivate", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_SENTINEL, req.params.contractId,
      "DeactivateSentinel", { reason, performedBy }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/sentinels/:contractId/reactivate", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_SENTINEL, req.params.contractId,
      "ReactivateSentinel", { reason, performedBy }, "vetify"));
  } catch (e) { next(e); }
});

// ── Stage 8: Murabahah Contracts ─────────────────────────────────────────────

// G12: opt-in pagination. Pass ?limit and/or ?offset to get a
// { rows, limit, offset, hasMore } envelope with LIMIT/OFFSET pushed to Postgres;
// omit both for the legacy unbounded array (kept for backward compatibility).
router.get("/", async (req, res, next) => {
  try {
    const { partyRole, cacRegNumber, financialInstitutionPartyId } = req.authUser!;
    // Self-serve tenant scoping: pagination is skipped for these — a single
    // business's or FI's own contract set is nowhere near platform scale.
    if (partyRole === "business") {
      return res.json(cacRegNumber ? await getBusinessContracts(cacRegNumber) : []);
    }
    if (partyRole === "financer" && financialInstitutionPartyId) {
      return res.json(await listContractsByFi(financialInstitutionPartyId));
    }
    const { status, limit, offset } = req.query;
    if (limit !== undefined || offset !== undefined) {
      const page = clampPage(limit, offset);
      const result = status
        ? await listContractsByStatusPaged(status as string, page)
        : await listContractsPaged(page);
      return res.json(result);
    }
    const result = status
      ? await listContractsByStatus(status as string)
      : await listContracts();
    res.json(result);
  } catch (e) { next(e); }
});

// ── Business Dashboard ────────────────────────────────────────────────────────

router.get("/business/:cacRegNumber", async (req, res, next) => {
  try {
    const { cacRegNumber } = req.params;
    // A "business" session may only ever fetch its own linked CAC's data —
    // previously any authenticated business session could read any other
    // business's contracts/financing/repayments just by supplying their CAC
    // number in the URL.
    if (req.authUser!.partyRole === "business" && req.authUser!.cacRegNumber !== cacRegNumber) {
      return res.status(403).json({ error: "Not authorized to view this business's records" });
    }
    const [contracts, financingRequests, repayments] = await Promise.all([
      getBusinessContracts(cacRegNumber),
      getBusinessFinancingRequests(cacRegNumber),
      getBusinessRepayments(cacRegNumber),
    ]);
    res.json({ contracts, financingRequests, repayments });
  } catch (e) { next(e); }
});

// ── Stage 9: Repayments ───────────────────────────────────────────────────────

// G12: same opt-in ?limit/?offset pagination as the contracts list above.
router.get("/repayments", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "business") {
      const cac = req.authUser!.cacRegNumber;
      return res.json(cac ? await listRepaymentsByBusiness(cac) : []);
    }
    const { cacRegNumber, limit, offset } = req.query;
    if (limit !== undefined || offset !== undefined) {
      const page = clampPage(limit, offset);
      const result = cacRegNumber
        ? await listRepaymentsByBusinessPaged(cacRegNumber as string, page)
        : await listRepaymentsPaged(page);
      return res.json(result);
    }
    const result = cacRegNumber
      ? await listRepaymentsByBusiness(cacRegNumber as string)
      : await listRepayments();
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/:contractId/record-payment", requireAuth("financer"), async (req, res, next) => {
  try {
    const { paymentDate, amountPaid, installmentNo, allocation, settlementAccount, directDebitRef } = req.body;
    const financerKey = resolveFinancerParty(req.authUser!);
    const existingGuardCid = directDebitRef
      ? await getExistingPaymentGuardCid(financerKey, partyId(financerKey), directDebitRef)
      : null;
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "RecordPayment",
      {
        paymentDate, amountPaid, installmentNo,
        allocation: allocation ?? null,
        settlementAccount: settlementAccount ?? null,
        directDebitRef: directDebitRef ?? null,
        existingGuardCid,
      }, financerKey));
  } catch (e) { next(e); }
});

// sentinel (vetify's own portfolio-monitoring team) makes the real delinquency
// call — dual controller ["sentinel", "vetify"], gated by the AuthorizedSentinel
// registry (fails closed if unregistered/deactivated).
router.post("/:contractId/flag-delinquent", requireAuth("vetify"), async (req, res, next) => {
  try {
    const sentinelCid = await getAuthorizedSentinelCid(partyId("sentinel"));
    if (!sentinelCid) {
      return res.status(409).json({ error: "sentinel is not a registered AuthorizedSentinel" });
    }
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "FlagDelinquent",
      { reason: req.body.reason, sentinelCid }, ["sentinel", "vetify"]));
  } catch (e) { next(e); }
});

router.post("/:contractId/resume-active", requireAuth("vetify"), async (req, res, next) => {
  try {
    const sentinelCid = await getAuthorizedSentinelCid(partyId("sentinel"));
    if (!sentinelCid) {
      return res.status(409).json({ error: "sentinel is not a registered AuthorizedSentinel" });
    }
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "ResumeActive",
      { note: req.body.note, sentinelCid }, ["sentinel", "vetify"]));
  } catch (e) { next(e); }
});

// Pure escalation, no sentinel decision made yet — mirrors FlagUnderwritingForManualReview.
router.post("/:contractId/flag-for-review", requireAuth("vetify"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "FlagForDelinquencyReview",
      { note: req.body.note }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/:contractId/default", requireAuth("financer"), async (req, res, next) => {
  try {
    const { reason, defaultedBy } = req.body;
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "DefaultContract",
      { reason, defaultedBy }, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

// ── Stage 10: Contract Closure ───────────────────────────────────────────────

router.post("/:contractId/close", requireAuth("financer"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_CONTRACT, req.params.contractId, "CloseContract",
      { closingDate: req.body.closingDate }, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

// ── Ibra' (Early Settlement Rebate) ─────────────────────────────────────────

router.get("/ibra", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "business") {
      const cac = req.authUser!.cacRegNumber;
      return res.json(cac ? await listIbraByBusiness(cac) : []);
    }
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listIbraByBusiness(cacRegNumber as string)
      : await listIbraRequests();
    res.json(result);
  } catch (e) { next(e); }
});

// Business requests early full or partial settlement (nonconsuming on MurabahahContract)
router.post("/:contractId/request-ibra", requireAuth("business"), async (req, res, next) => {
  try {
    const existing = await getContractById(req.params.contractId);
    const payload = (existing as { payload?: { cacRegNumber?: string } } | null)?.payload;
    if (!existing || req.authUser!.cacRegNumber !== payload?.cacRegNumber) {
      return res.status(403).json({ error: "Not authorized to act on this contract" });
    }
    const { requestedSettlementDate, settlementType, requestedAmount } = req.body;
    res.status(201).json(await exerciseChoice(T_CONTRACT, req.params.contractId, "RequestIbra",
      { requestedSettlementDate, settlementType, requestedAmount: requestedAmount ?? null }, "business"));
  } catch (e) { next(e); }
});

// FI grants a voluntary rebate on the remaining profit — four-eyes: a CreditOfficer
// proposes, a RiskOfficer confirms (P&L impact), both identified by AuthorizedOfficer id
// (see GET /api/providers/officers), same pattern as ApproveFunding's approvingOfficerId.
router.post("/ibra/:contractId/grant", requireAuth("financer"), async (req, res, next) => {
  try {
    const { rebateAmount, proposedByOfficerId, confirmedByOfficerId } = req.body;
    const financerKey = resolveFinancerParty(req.authUser!);
    const fi = partyId(financerKey);
    const [proposedByOfficerCid, confirmedByOfficerCid] = await Promise.all([
      getAuthorizedOfficerCid(fi, proposedByOfficerId),
      getAuthorizedOfficerCid(fi, confirmedByOfficerId),
    ]);
    if (!proposedByOfficerCid || !confirmedByOfficerCid) {
      return res.status(409).json({ error: "Proposing/confirming officer is not registered for this financial institution" });
    }
    res.json(await exerciseChoice(T_IBRA, req.params.contractId, "GrantIbra",
      { rebateAmount, proposedByOfficerId, confirmedByOfficerId, proposedByOfficerCid, confirmedByOfficerCid },
      financerKey));
  } catch (e) { next(e); }
});

// FI declines; business must pay the full outstanding balance
router.post("/ibra/:contractId/decline", requireAuth("financer"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_IBRA, req.params.contractId, "DeclineIbra",
      { reason: req.body.reason }, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

// ── Late Payment Charity (Sadaqah obligations) ────────────────────────────────

router.get("/charity", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "business") {
      const cac = req.authUser!.cacRegNumber;
      return res.json(cac ? await listCharitiesByBusiness(cac) : []);
    }
    const { cacRegNumber, unsettled } = req.query;
    let result;
    if (unsettled === "true") result = await listUnsettledCharities();
    else if (cacRegNumber) result = await listCharitiesByBusiness(cacRegNumber as string);
    else result = await listLatePaymentCharities();
    res.json(result);
  } catch (e) { next(e); }
});

// FI applies the Shariah committee's formula to set the charity amount
router.post("/charity/:contractId/set-amount", requireAuth("financer"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_CHARITY, req.params.contractId, "SetCharityAmount",
      { amount: req.body.amount }, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

// Business confirms the donation was made and provides the receipt reference + beneficiary
router.post("/charity/:contractId/confirm-payment", requireAuth("business"), async (req, res, next) => {
  try {
    const cac = req.authUser!.cacRegNumber;
    const own = cac ? await listCharitiesByBusiness(cac) : [];
    if (!own.some((c: { contractId: string }) => c.contractId === req.params.contractId)) {
      return res.status(403).json({ error: "Not authorized to act on this charity record" });
    }
    const { charityRef, charityOrganization } = req.body;
    res.json(await exerciseChoice(T_CHARITY, req.params.contractId, "ConfirmCharityPayment",
      { charityRef, charityOrganization }, "business"));
  } catch (e) { next(e); }
});

// ── Rahn (Collateral) ────────────────────────────────────────────────────────

router.get("/rahn", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "business") {
      const cac = req.authUser!.cacRegNumber;
      return res.json(cac ? await listRahnByBusiness(cac) : []);
    }
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listRahnByBusiness(cacRegNumber as string)
      : await listRahnAgreements();
    res.json(result);
  } catch (e) { next(e); }
});

// Create a collateral agreement (FI + business co-sign). The payload's own
// financialInstitution field is derived server-side from the session, not
// trusted from the request body — otherwise a self-serve FI's dynamically-
// allocated party (the actor) and the contract's own financialInstitution
// field (a client-suppliable value) could disagree, which the ledger would
// reject as a signatory-authorization mismatch.
router.post("/rahn", requireAuth("financer"), async (req, res, next) => {
  try {
    const actingParty = resolveFinancerParty(req.authUser!);
    // RahnAgreement's signatory is `business, financialInstitution` — Canton rejects a create
    // unless every signatory is in actAs, so this needs both parties, not just the acting FI.
    // `vetify` is a required observer field the frontend never collected — server-derived here,
    // same trust pattern as `financialInstitution` on this same line (found live-testing: this
    // route hard-failed on every real call before this fix, since the field was simply absent).
    res.status(201).json(await createContract(T_RAHN,
      { ...req.body, financialInstitution: partyId(actingParty), vetify: partyId("vetify") },
      [actingParty, "business"]));
  } catch (e) { next(e); }
});

// FI releases the pledge on full repayment / contract closure — four-eyes, same
// proposedBy/confirmedBy officer-id pattern as GrantIbra.
router.post("/rahn/:contractId/release", requireAuth("financer"), async (req, res, next) => {
  try {
    const { note, releaseDocumentRef, proposedByOfficerId, confirmedByOfficerId } = req.body;
    const financerKey = resolveFinancerParty(req.authUser!);
    const fi = partyId(financerKey);
    const [proposedByOfficerCid, confirmedByOfficerCid] = await Promise.all([
      getAuthorizedOfficerCid(fi, proposedByOfficerId),
      getAuthorizedOfficerCid(fi, confirmedByOfficerId),
    ]);
    if (!proposedByOfficerCid || !confirmedByOfficerCid) {
      return res.status(409).json({ error: "Proposing/confirming officer is not registered for this financial institution" });
    }
    res.json(await exerciseChoice(T_RAHN, req.params.contractId, "ReleaseCollateral",
      { note, releaseDocumentRef: releaseDocumentRef ?? null, proposedByOfficerId, confirmedByOfficerId,
        proposedByOfficerCid, confirmedByOfficerCid },
      financerKey));
  } catch (e) { next(e); }
});

// FI enforces the pledge on default — four-eyes, same officer-id pattern.
router.post("/rahn/:contractId/enforce", requireAuth("financer"), async (req, res, next) => {
  try {
    const { reason, proposedByOfficerId, confirmedByOfficerId } = req.body;
    const financerKey = resolveFinancerParty(req.authUser!);
    const fi = partyId(financerKey);
    const [proposedByOfficerCid, confirmedByOfficerCid] = await Promise.all([
      getAuthorizedOfficerCid(fi, proposedByOfficerId),
      getAuthorizedOfficerCid(fi, confirmedByOfficerId),
    ]);
    if (!proposedByOfficerCid || !confirmedByOfficerCid) {
      return res.status(409).json({ error: "Proposing/confirming officer is not registered for this financial institution" });
    }
    res.json(await exerciseChoice(T_RAHN, req.params.contractId, "EnforceCollateral",
      { reason, proposedByOfficerId, confirmedByOfficerId, proposedByOfficerCid, confirmedByOfficerCid },
      financerKey));
  } catch (e) { next(e); }
});

// ── Portfolio Reports ────────────────────────────────────────────────────────

router.get("/reports", async (_req, res, next) => {
  try {
    res.json(await listPortfolioReports());
  } catch (e) { next(e); }
});

// Registered last: a catch-all responding 404 directly (no next() fallthrough) for any
// single-segment GET, so every literal-path GET route above must come before this one or
// it becomes unreachable — this shadowed /repayments, /reports, /ibra, /charity, /rahn
// until fixed (same bug class as onboarding.ts's /:contractId, see its comment there).
router.get("/:contractId", async (req, res, next) => {
  try {
    const result = await getContractById(req.params.contractId);
    if (!result) return res.status(404).json({ error: "Not found" });
    // Same tenant-scoping gap already closed on GET /business/:cacRegNumber (see its
    // comment): PQS ingests every party's contracts regardless of Canton-level observer
    // visibility, so a business session fetching by raw contractId must be checked here —
    // otherwise any authenticated business could read any other business's facility.
    const payload = (result as { payload?: { cacRegNumber?: string } }).payload;
    if (req.authUser!.partyRole === "business" && req.authUser!.cacRegNumber !== payload?.cacRegNumber) {
      return res.status(403).json({ error: "Not authorized to view this contract" });
    }
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
