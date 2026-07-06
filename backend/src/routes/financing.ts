/**
 * Stages 5–8a: Financing Request, Underwriting, FI Approval, Wa'd/Wakala/Asset chain
 *
 * GET  → PQS (PostgreSQL via repository.ts)
 * POST → Canton HTTP JSON API (canton.ts)
 *
 * Murabahah acquisition chain after ApproveFunding:
 *   MurabahahWad → (ProceedWithWakala) → MurabahahWakala → (RecordAssetPurchase)
 *               → (ProceedDirectly)   ┘
 *               → AssetPurchaseRecord → (AcknowledgeDelivery) → (OfferMurabahah)
 *               → MurabahahProposal   → (AcceptProposal) → MurabahahContract
 */
import { Router } from "express";
import { exerciseChoice, createContract } from "../canton.js";
import {
  listFinancingRequests,
  listFinancingByStatus,
  listUnderwritingResults,
  listUnderwritingPolicies,
  getUnderwritingPolicyByFi,
  listFinancingDecisions,
  listWads,
  listWadsByBorrower,
  listWakalas,
  listPurchaseRecords,
  listPurchaseRecordsByBorrower,
  listProposals,
  listProposalsByBorrower,
} from "../repository.js";

const router = Router();

const T_APPROVED = "Vetify.Compliance:ApprovedBorrower";
const T_FINANCING = "Vetify.Financing:FinancingRequest";
const T_UNDERWRITING_POLICY = "Vetify.Financing:UnderwritingPolicy";
const T_WAD       = "Vetify.Murabahah:MurabahahWad";
const T_WAKALA    = "Vetify.Murabahah:MurabahahWakala";
const T_PURCHASE  = "Vetify.Murabahah:AssetPurchaseRecord";
const T_PROPOSAL  = "Vetify.Murabahah:MurabahahProposal";

// ── Stage 5–6: Financing Requests & Underwriting ─────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;
    const result = status
      ? await listFinancingByStatus(status as string)
      : await listFinancingRequests();
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/underwriting-results", async (_req, res, next) => {
  try {
    res.json(await listUnderwritingResults());
  } catch (e) { next(e); }
});

// Per-institution scoring policy for the Underwriting Agent (agents/src/scoring/
// underwriting.ts fetches these weights) — keyed (vetify, financialInstitution),
// unlike VerificationPolicy/CompliancePolicy's vetify-wide singleton, so this
// supports filtering to one FI's active policy.
router.get("/underwriting-policy", async (req, res, next) => {
  try {
    const { financialInstitution } = req.query;
    const result = financialInstitution
      ? await getUnderwritingPolicyByFi(financialInstitution as string)
      : await listUnderwritingPolicies();
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/underwriting-policy", async (req, res, next) => {
  try {
    const {
      vetify, financialInstitution, policyVersion, autoApproveMin, autoRejectMax,
      minDscrRatio, maxLoanAmount, requestSlaHours, offerValidityDays, effectiveFrom,
      writeOffThresholdAmount, maxRestructuringsPerFacility, permittedSectors,
      requiredCollateralTypes, maxSectorConcentrationPct, scoringWeights,
    } = req.body;
    res.status(201).json(await createContract(T_UNDERWRITING_POLICY, {
      vetify,
      financialInstitution,
      policyVersion,
      autoApproveMin,
      autoRejectMax,
      minDscrRatio:      minDscrRatio      ?? null,
      maxLoanAmount:     maxLoanAmount     ?? null,
      requestSlaHours,
      offerValidityDays,
      effectiveFrom,
      effectiveTo: null,
      writeOffThresholdAmount:      writeOffThresholdAmount      ?? null,
      maxRestructuringsPerFacility: maxRestructuringsPerFacility ?? null,
      permittedSectors:             permittedSectors             ?? null,
      requiredCollateralTypes:      requiredCollateralTypes      ?? [],
      maxSectorConcentrationPct:    maxSectorConcentrationPct    ?? null,
      scoringWeights,
    }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/underwriting-policy/:contractId/update", async (req, res, next) => {
  try {
    const {
      newPolicyVersion, newAutoApproveMin, newAutoRejectMax, newMinDscrRatio,
      newMaxLoanAmount, newRequestSlaHours, newOfferValidityDays, newEffectiveFrom,
      newScoringWeights,
    } = req.body;
    res.json(await exerciseChoice(T_UNDERWRITING_POLICY, req.params.contractId, "UpdatePolicy", {
      newPolicyVersion,
      newAutoApproveMin,
      newAutoRejectMax,
      newMinDscrRatio:   newMinDscrRatio   ?? null,
      newMaxLoanAmount:  newMaxLoanAmount  ?? null,
      newRequestSlaHours,
      newOfferValidityDays,
      newEffectiveFrom,
      newScoringWeights,
    }, "vetify"));
  } catch (e) { next(e); }
});

// Stage 7 audit: recorded FI rejection decisions
router.get("/decisions", async (_req, res, next) => {
  try {
    res.json(await listFinancingDecisions());
  } catch (e) { next(e); }
});

// ── Stage 7→8: Wa'd pipeline ──────────────────────────────────────────────────

// Active Wa'd contracts (borrower promise to purchase)
router.get("/wads", async (req, res, next) => {
  try {
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listWadsByBorrower(cacRegNumber as string)
      : await listWads();
    res.json(result);
  } catch (e) { next(e); }
});

// Active Wakala appointments (FI → borrower as purchasing agent)
router.get("/wakalas", async (_req, res, next) => {
  try {
    res.json(await listWakalas());
  } catch (e) { next(e); }
});

// Asset purchase records (FI ownership evidence)
router.get("/purchase-records", async (req, res, next) => {
  try {
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listPurchaseRecordsByBorrower(cacRegNumber as string)
      : await listPurchaseRecords();
    res.json(result);
  } catch (e) { next(e); }
});

// Pending Murabahah proposals awaiting borrower acceptance
router.get("/proposals", async (req, res, next) => {
  try {
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listProposalsByBorrower(cacRegNumber as string)
      : await listProposals();
    res.json(result);
  } catch (e) { next(e); }
});

// ── Stage 5: Borrower submits a financing request ────────────────────────────

router.post("/", async (req, res, next) => {
  try {
    const { approvedBorrowerContractId, financialInstitution, terms } = req.body;
    res.status(201).json(
      await exerciseChoice(T_APPROVED, approvedBorrowerContractId, "RequestFinancing",
        { financialInstitution, terms }, "borrower")
    );
  } catch (e) { next(e); }
});

// ── Stage 6: Vetify triggers underwriting ────────────────────────────────────

router.post("/:contractId/begin-underwriting", async (req, res, next) => {
  try {
    const {
      assessment, autoDecided, aiMetadata, agentVersion,
      underwriterName, underwritingRef, decisionDocuments,
    } = req.body;
    res.json(await exerciseChoice(T_FINANCING, req.params.contractId, "BeginUnderwriting",
      {
        assessment,
        autoDecided:       autoDecided       ?? false,
        aiMetadata:        aiMetadata        ?? null,
        agentVersion:      agentVersion      ?? null,
        underwriterName:   underwriterName   ?? null,
        underwritingRef:   underwritingRef   ?? null,
        decisionDocuments: decisionDocuments ?? [],
      }, "vetify"));
  } catch (e) { next(e); }
});

// ── Stage 7: FI funding decision ─────────────────────────────────────────────

// FI approves: records the borrower's Wa'd (promise to purchase the identified asset).
// Next step: FI exercises ProceedWithWakala or ProceedDirectly on the returned Wa'd.
router.post("/:contractId/approve", async (req, res, next) => {
  try {
    const {
      assetDetails, approvedProviderCid, approvingOfficerId,
      approvedByName, underwriterName, reasonCode, decisionFactors,
      approvalSignature, decisionDocuments, offerExpiresAt,
    } = req.body;
    res.json(await exerciseChoice(T_FINANCING, req.params.contractId, "ApproveFunding",
      {
        assetDetails,
        approvedProviderCid,   // required — see GET /api/providers/approved
        approvingOfficerId,    // required — see GET /api/providers/officers
        approvedByName:      approvedByName      ?? null,
        underwriterName:     underwriterName     ?? null,
        reasonCode:          reasonCode          ?? null,
        decisionFactors:     decisionFactors     ?? [],
        approvalSignature:   approvalSignature   ?? null,
        decisionDocuments:   decisionDocuments   ?? [],
        offerExpiresAt:      offerExpiresAt      ?? null,
      }, "financialInstitution"));
  } catch (e) { next(e); }
});

// FI rejects: reason recorded on-ledger as a FinancingDecision
router.post("/:contractId/reject", async (req, res, next) => {
  try {
    const { reason, rejectedByName, reasonCode, decisionFactors, decisionDocuments } = req.body;
    res.json(await exerciseChoice(T_FINANCING, req.params.contractId, "RejectFunding",
      {
        reason,
        rejectedByName:    rejectedByName    ?? null,
        reasonCode:        reasonCode        ?? null,
        decisionFactors:   decisionFactors   ?? [],
        decisionDocuments: decisionDocuments ?? [],
      }, "financialInstitution"));
  } catch (e) { next(e); }
});

// ── Wa'd choices (FI exercises on MurabahahWad) ───────────────────────────────

// Path A: FI appoints borrower as purchasing agent (Wakala)
router.post("/wads/:contractId/proceed-with-wakala", async (req, res, next) => {
  try {
    res.status(201).json(await exerciseChoice(T_WAD, req.params.contractId, "ProceedWithWakala",
      {}, "financialInstitution"));
  } catch (e) { next(e); }
});

// Path B: FI purchases the asset directly from the supplier
router.post("/wads/:contractId/proceed-directly", async (req, res, next) => {
  try {
    const { actualCost, purchaseDate, invoiceRef } = req.body;
    res.status(201).json(await exerciseChoice(T_WAD, req.params.contractId, "ProceedDirectly",
      { actualCost, purchaseDate, invoiceRef }, "financialInstitution"));
  } catch (e) { next(e); }
});

// Borrower withdraws the promise (supplier unavailable, circumstances changed)
router.post("/wads/:contractId/withdraw", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_WAD, req.params.contractId, "WithdrawWad",
      { reason: req.body.reason }, "borrower"));
  } catch (e) { next(e); }
});

// ── Wakala choices (borrower exercises as purchasing agent) ───────────────────

// Borrower records the completed asset purchase on behalf of the FI
router.post("/wakalas/:contractId/record-purchase", async (req, res, next) => {
  try {
    const { actualCost, purchaseDate, invoiceRef } = req.body;
    res.status(201).json(await exerciseChoice(T_WAKALA, req.params.contractId, "RecordAssetPurchase",
      { actualCost, purchaseDate, invoiceRef }, "borrower"));
  } catch (e) { next(e); }
});

// Borrower declines the agency appointment; FI must buy directly
router.post("/wakalas/:contractId/decline-agency", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_WAKALA, req.params.contractId, "DeclineAgency",
      { reason: req.body.reason }, "borrower"));
  } catch (e) { next(e); }
});

// ── Asset Purchase Record choices ─────────────────────────────────────────────

// Borrower acknowledges receipt/constructive possession (Qabdh) — required before OfferMurabahah
router.post("/purchase-records/:contractId/acknowledge-delivery", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_PURCHASE, req.params.contractId, "AcknowledgeDelivery",
      {}, "borrower"));
  } catch (e) { next(e); }
});

// FI formally offers the asset at cost + disclosed profit (Ijab) — gated by Qabdh
router.post("/purchase-records/:contractId/offer-murabahah", async (req, res, next) => {
  try {
    const { murabahahTerms, paymentSchedule, regulator, startDate } = req.body;
    res.status(201).json(await exerciseChoice(T_PURCHASE, req.params.contractId, "OfferMurabahah",
      { murabahahTerms, paymentSchedule, regulator, startDate }, "financialInstitution"));
  } catch (e) { next(e); }
});

// ── Murabahah Proposal choices (borrower Qabul) ───────────────────────────────

// Borrower accepts the proposed Murabahah terms → binding bilateral contract
router.post("/proposals/:contractId/accept", async (req, res, next) => {
  try {
    res.status(201).json(await exerciseChoice(T_PROPOSAL, req.params.contractId, "AcceptProposal",
      {}, "borrower"));
  } catch (e) { next(e); }
});

// Borrower declines the offered terms
router.post("/proposals/:contractId/decline", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_PROPOSAL, req.params.contractId, "DeclineProposal",
      { reason: req.body.reason }, "borrower"));
  } catch (e) { next(e); }
});

export default router;
