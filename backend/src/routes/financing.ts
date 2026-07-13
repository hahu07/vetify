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
import { exerciseChoice, createContract, queryContracts, partyId, resolveFinancerParty } from "../canton.js";
import { requireAuth } from "../auth.js";
import { randomUUID } from "node:crypto";
import {
  listFinancingRequests,
  listFinancingByStatus,
  listFinancingRequestsByFi,
  getBusinessFinancingRequests,
  getFinancingRequestById,
  listUnderwritingResults,
  listUnderwritingResultsByCac,
  listUnderwritingRejectionsByCac,
  listUnderwritingPolicies,
  getUnderwritingPolicyByFi,
  listFinancingDecisions,
  listWads,
  listWadsByBusiness,
  listWakalas,
  listPurchaseRecords,
  listPurchaseRecordsByBusiness,
  listProposals,
  listProposalsByBusiness,
  listWadsByFi,
  listWakalasByFi,
  listWakalasByBusiness,
  listPurchaseRecordsByFi,
  listProposalsByFi,
  listShariahCertifications,
  listShariahCertificationsByFacility,
  listShariahCertificationsByBusiness,
  getApprovedBusinessById,
} from "../repository.js";

const router = Router();

const T_APPROVED = "Vetify.Compliance:ApprovedBusiness";
const T_FINANCING = "Vetify.Financing:FinancingRequest";
const T_UNDERWRITING_POLICY = "Vetify.Financing:UnderwritingPolicy";
const T_AUTHORIZED_ASSESSOR = "Vetify.Governance:AuthorizedAssessor";
const T_WAD       = "Vetify.Murabahah:MurabahahWad";
const T_WAKALA    = "Vetify.Murabahah:MurabahahWakala";
const T_PURCHASE  = "Vetify.Murabahah:AssetPurchaseRecord";
const T_PROPOSAL  = "Vetify.Murabahah:MurabahahProposal";
const T_SHARIAH_CERT = "Vetify.Murabahah:ShariahContractCertification"; // G11
const T_AUTHORIZED_OFFICER  = "Vetify.Governance:AuthorizedOfficer";
const T_AUTHORIZED_ADVISOR  = "Vetify.Governance:AuthorizedAdvisor";

// SDK 3.4.11 / Daml-LF 2.1/2.2 has no contract keys, so the choices below can
// no longer resolve their active policy/registry contract via lookupByKey —
// these small helpers do the equivalent lookup off-ledger and the routes pass
// the resulting ContractId(s) in explicitly.
async function getAuthorizedAssessorCid(assessorParty: string): Promise<string | null> {
  const entries = await queryContracts(T_AUTHORIZED_ASSESSOR);
  return (entries.find((e: any) => e.payload.assessor === assessorParty))?.contractId ?? null;
}

async function getAuthorizedOfficerCid(financialInstitution: string, officerId: string): Promise<string | null> {
  // Queried as "vetify" (the AuthorizedOfficer observer, per Governance.daml)
  // rather than the dynamically-allocated financer party, since queryContracts
  // needs a party whose JWT this backend actually holds under a fixed role key.
  const entries = await queryContracts(T_AUTHORIZED_OFFICER, "vetify");
  return (entries.find((e: any) =>
    e.payload.financialInstitution === financialInstitution && e.payload.officerId === officerId))?.contractId ?? null;
}

async function getAuthorizedAdvisorCid(advisorParty: string): Promise<string | null> {
  const entries = await queryContracts(T_AUTHORIZED_ADVISOR);
  return (entries.find((e: any) => e.payload.advisor === advisorParty))?.contractId ?? null;
}

// ── Stage 5–6: Financing Requests & Underwriting ─────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const { partyRole, cacRegNumber, financialInstitutionPartyId } = req.authUser!;
    // Self-serve tenant scoping: a business session only ever sees its own
    // financing requests; a financer session with its own allocated party
    // only ever sees requests directed to it. Every other role (vetify/
    // verifier staff) keeps today's unrestricted/status-filtered view.
    if (partyRole === "business") {
      return res.json(cacRegNumber ? await getBusinessFinancingRequests(cacRegNumber) : []);
    }
    if (partyRole === "financer" && financialInstitutionPartyId) {
      return res.json(await listFinancingRequestsByFi(financialInstitutionPartyId));
    }
    const { status } = req.query;
    const result = status
      ? await listFinancingByStatus(status as string)
      : await listFinancingRequests();
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/underwriting-results", async (req, res, next) => {
  try {
    const { partyRole, cacRegNumber } = req.authUser!;
    if (partyRole === "business") {
      return res.json(cacRegNumber ? await listUnderwritingResultsByCac(cacRegNumber) : []);
    }
    res.json(await listUnderwritingResults());
  } catch (e) { next(e); }
});

// RejectUnderwriting archives FinancingRequest without recreating it (see
// listUnderwritingRejectionsByCac's own comment) — this is business-scoped-only
// since it exists purely so a rejected business's dashboard can read the outcome;
// staff already see rejections via the Underwriting Queue / audit views.
router.get("/underwriting-rejections", requireAuth("business"), async (req, res, next) => {
  try {
    const { cacRegNumber } = req.authUser!;
    res.json(cacRegNumber ? await listUnderwritingRejectionsByCac(cacRegNumber) : []);
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

router.post("/underwriting-policy", requireAuth("vetify"), async (req, res, next) => {
  try {
    const {
      vetify, financialInstitution, policyVersion, autoApproveMin, autoRejectMax,
      minDscrRatio, minLoanAmount, maxLoanAmount, indicativeProfitMarginPct,
      requestSlaHours, offerValidityDays, effectiveFrom,
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
      minLoanAmount:     minLoanAmount     ?? null,
      maxLoanAmount:     maxLoanAmount     ?? null,
      indicativeProfitMarginPct: indicativeProfitMarginPct ?? null,
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

router.post("/underwriting-policy/:contractId/update", requireAuth("vetify"), async (req, res, next) => {
  try {
    const {
      newPolicyVersion, newAutoApproveMin, newAutoRejectMax, newMinDscrRatio,
      newMinLoanAmount, newMaxLoanAmount, newIndicativeProfitMarginPct,
      newRequestSlaHours, newOfferValidityDays, newEffectiveFrom,
      newScoringWeights,
    } = req.body;
    res.json(await exerciseChoice(T_UNDERWRITING_POLICY, req.params.contractId, "UpdatePolicy", {
      newPolicyVersion,
      newAutoApproveMin,
      newAutoRejectMax,
      newMinDscrRatio:   newMinDscrRatio   ?? null,
      newMinLoanAmount:  newMinLoanAmount  ?? null,
      newMaxLoanAmount:  newMaxLoanAmount  ?? null,
      newIndicativeProfitMarginPct: newIndicativeProfitMarginPct ?? null,
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

// Active Wa'd contracts (business promise to purchase). A "business" session
// previously could pass ANY ?cacRegNumber= and read another business's Wa'd
// records — the query param is now ignored for that role in favor of the
// session's own linked CAC number (closing a real cross-tenant read gap).
router.get("/wads", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "business") {
      const cac = req.authUser!.cacRegNumber;
      return res.json(cac ? await listWadsByBusiness(cac) : []);
    }
    // financer sessions with their own dynamically-allocated party (self-serve
    // signup) are scoped to their own institution — a Wa'd naming a different FI
    // isn't this session's to act on, same cross-tenant fix as contracts.ts's
    // GET / (listContractsByFi). A session on the static shared "financialInstitution"
    // demo party (financialInstitutionPartyId unset) falls through to the unscoped
    // list below — same precedent as contracts.ts, since there's only ever one such
    // static FI in this deployment, not something to scope away from itself.
    if (req.authUser!.partyRole === "financer" && req.authUser!.financialInstitutionPartyId) {
      return res.json(await listWadsByFi(req.authUser!.financialInstitutionPartyId));
    }
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listWadsByBusiness(cacRegNumber as string)
      : await listWads();
    res.json(result);
  } catch (e) { next(e); }
});

// Active Wakala appointments (FI → business as purchasing agent) — same
// cross-tenant fix as /wads for both business and financer sessions.
router.get("/wakalas", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "business") {
      const cac = req.authUser!.cacRegNumber;
      return res.json(cac ? await listWakalasByBusiness(cac) : []);
    }
    if (req.authUser!.partyRole === "financer" && req.authUser!.financialInstitutionPartyId) {
      return res.json(await listWakalasByFi(req.authUser!.financialInstitutionPartyId));
    }
    res.json(await listWakalas());
  } catch (e) { next(e); }
});

// Asset purchase records (FI ownership evidence) — same cross-tenant fix as /wads.
router.get("/purchase-records", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "business") {
      const cac = req.authUser!.cacRegNumber;
      return res.json(cac ? await listPurchaseRecordsByBusiness(cac) : []);
    }
    if (req.authUser!.partyRole === "financer" && req.authUser!.financialInstitutionPartyId) {
      return res.json(await listPurchaseRecordsByFi(req.authUser!.financialInstitutionPartyId));
    }
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listPurchaseRecordsByBusiness(cacRegNumber as string)
      : await listPurchaseRecords();
    res.json(result);
  } catch (e) { next(e); }
});

// Pending Murabahah proposals awaiting business acceptance — same cross-tenant fix as /wads.
router.get("/proposals", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "business") {
      const cac = req.authUser!.cacRegNumber;
      return res.json(cac ? await listProposalsByBusiness(cac) : []);
    }
    if (req.authUser!.partyRole === "financer" && req.authUser!.financialInstitutionPartyId) {
      return res.json(await listProposalsByFi(req.authUser!.financialInstitutionPartyId));
    }
    const { cacRegNumber } = req.query;
    const result = cacRegNumber
      ? await listProposalsByBusiness(cacRegNumber as string)
      : await listProposals();
    res.json(result);
  } catch (e) { next(e); }
});

// G11: Shari'a certifications — the business UI needs a proposal's certificationCid
// to call AcceptProposal, and the vetify UI needs to list/revoke outstanding ones.
// Optional ?facilityRef= scopes to a single proposal (same pattern as ?cacRegNumber=
// on /wads etc.) — no tenant-scoping concerns since certifications carry no secrets
// beyond what business/FI/vetify already see via the proposal itself.
router.get("/certifications", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "business") {
      const cac = req.authUser!.cacRegNumber;
      return res.json(cac ? await listShariahCertificationsByBusiness(cac) : []);
    }
    const { facilityRef } = req.query;
    res.json(facilityRef
      ? await listShariahCertificationsByFacility(facilityRef as string)
      : await listShariahCertifications());
  } catch (e) { next(e); }
});

// ── Stage 5: Business submits a financing request ────────────────────────────

router.post("/", requireAuth("business"), async (req, res, next) => {
  try {
    const { approvedBusinessContractId, financialInstitution, terms, supportingDocuments } = req.body;
    // businessSector/verificationRef/complianceRef are read from the ApprovedBusiness itself
    // rather than trusted from the client — it's the authoritative source (carried over from
    // ComplianceReview, see the template comment) and RequestFinancing's businessSector feeds
    // straight into BeginUnderwriting's permittedSectors policy check, so a client-supplied
    // value could let a business misrepresent their screened sector.
    const approved = await getApprovedBusinessById(approvedBusinessContractId);
    if (!approved) return res.status(404).json({ error: "Approved business record not found" });
    const payload = approved.payload as unknown as { businessSector: string; verificationRef: string; complianceRef: string };
    const financingRef = `FIN-${new Date().getUTCFullYear()}-${randomUUID().split("-")[0].toUpperCase()}`;
    res.status(201).json(
      await exerciseChoice(T_APPROVED, approvedBusinessContractId, "RequestFinancing",
        {
          financialInstitution,
          assessor: partyId("assessor"),
          terms,
          financingRef,
          verificationRef: payload.verificationRef ?? null,
          complianceRef: payload.complianceRef ?? null,
          supportingDocuments: supportingDocuments ?? [],
          businessSector: payload.businessSector,
        }, "business")
    );
  } catch (e) { next(e); }
});

// ── Stage 6: Assessor qualifies/rejects/flags the request ────────────────
// BeginUnderwriting/RejectUnderwriting are dual-controller (assessor, vetify)
// — vetify's signature authorizes the UnderwritingPolicy lookupByKey inside
// both choices (see Financing.daml). FlagUnderwritingForManualReview is vetify
// alone (pure escalation, no assessor decision made yet).

router.post("/:contractId/begin-underwriting", requireAuth("vetify"), async (req, res, next) => {
  try {
    const {
      assessment, autoDecided, aiMetadata, agentVersion,
      assessorName, underwritingRef, decisionDocuments,
    } = req.body;
    const assessorCid = await getAuthorizedAssessorCid(partyId("assessor"));
    if (!assessorCid) {
      return res.status(409).json({ error: "assessor is not a registered AuthorizedAssessor" });
    }
    // financialInstitution is read from the FinancingRequest itself (authoritative), not
    // trusted from the request body — same rationale as POST / reading businessSector
    // from ApprovedBusiness above.
    const request = await getFinancingRequestById(req.params.contractId);
    const fi = (request?.payload as { financialInstitution?: string } | undefined)?.financialInstitution;
    const policyRows = fi ? await getUnderwritingPolicyByFi(fi) : [];
    const policyCid = (policyRows[0] as { contractId?: string } | undefined)?.contractId ?? null;
    res.json(await exerciseChoice(T_FINANCING, req.params.contractId, "BeginUnderwriting",
      {
        assessment,
        autoDecided:       autoDecided       ?? false,
        aiMetadata:        aiMetadata        ?? null,
        agentVersion:      agentVersion      ?? null,
        assessorName:   assessorName   ?? null,
        underwritingRef:   underwritingRef   ?? null,
        decisionDocuments: decisionDocuments ?? [],
        assessorCid,
        policyCid,
      }, ["assessor", "vetify"]));
  } catch (e) { next(e); }
});

router.post("/:contractId/reject-underwriting", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason, autoDecided, reviewerParty, reviewedBy, assessment } = req.body;
    // Human portal decisions (this route, session-gated) identify the reviewer from the
    // authenticated session — same Layer 3 pattern as onboarding.ts's Approve/Reject.
    // RejectUnderwriting asserts a non-None reviewerParty whenever autoDecided is false.
    // assessment is optional here: a human rejecting via the portal isn't
    // required to attach a machine RiskAssessment (the Daml-side guard only
    // fires when one is present and autoDecided is true).
    const assessorCid = await getAuthorizedAssessorCid(partyId("assessor"));
    if (!assessorCid) {
      return res.status(409).json({ error: "assessor is not a registered AuthorizedAssessor" });
    }
    res.json(await exerciseChoice(T_FINANCING, req.params.contractId, "RejectUnderwriting",
      {
        reason,
        autoDecided:   autoDecided   ?? false,
        reviewerParty: reviewerParty ?? (autoDecided ? null : partyId("assessor")),
        reviewedBy:    reviewedBy    ?? (autoDecided ? null : req.authUser!.displayName),
        assessment:    assessment    ?? null,
        assessorCid,
      }, ["assessor", "vetify"]));
  } catch (e) { next(e); }
});

router.post("/:contractId/flag-underwriting", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { riskScore, riskLevel, agentVersion, note } = req.body;
    const request = await getFinancingRequestById(req.params.contractId);
    const fi = (request?.payload as { financialInstitution?: string } | undefined)?.financialInstitution;
    const policyRows = fi ? await getUnderwritingPolicyByFi(fi) : [];
    const policyCid = (policyRows[0] as { contractId?: string } | undefined)?.contractId ?? null;
    res.json(await exerciseChoice(T_FINANCING, req.params.contractId, "FlagUnderwritingForManualReview",
      { riskScore, riskLevel, agentVersion, note, policyCid }, "vetify"));
  } catch (e) { next(e); }
});

// ── AuthorizedAssessor registry (who may act as assessor) ─────────────
// Mirrors PolicyApprover's register/deactivate/reactivate pattern (backend/src/
// routes/policy.ts) rather than AuthorizedReviewer's deactivate-only shape —
// reactivation shouldn't require re-registering from scratch.

router.get("/assessors", async (_req, res, next) => {
  try {
    res.json(await queryContracts(T_AUTHORIZED_ASSESSOR));
  } catch (e) { next(e); }
});

router.post("/assessors", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { vetify, assessor, role, authorizedBy } = req.body;
    res.status(201).json(await createContract(T_AUTHORIZED_ASSESSOR, {
      vetify,
      assessor,
      role,
      authorizedBy,
      authorizedAt: new Date().toISOString(),
      active: true,
    }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/assessors/:contractId/deactivate", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_ASSESSOR, req.params.contractId,
      "DeactivateAssessor", { reason, performedBy }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/assessors/:contractId/reactivate", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_ASSESSOR, req.params.contractId,
      "ReactivateAssessor", { reason, performedBy }, "vetify"));
  } catch (e) { next(e); }
});

// ── Stage 7: FI funding decision ─────────────────────────────────────────────

// FI approves: records the business's Wa'd (promise to purchase the identified asset).
// Next step: FI exercises ProceedWithWakala or ProceedDirectly on the returned Wa'd.
router.post("/:contractId/approve", requireAuth("financer"), async (req, res, next) => {
  try {
    const {
      assetDetails, approvedProviderCid, approvingOfficerId,
      approvedByName, assessorName, reasonCode, decisionFactors,
      approvalSignature, decisionDocuments, offerExpiresAt,
    } = req.body;
    const financerParty = resolveFinancerParty(req.authUser!);
    const approvingOfficerCid = await getAuthorizedOfficerCid(partyId(financerParty), approvingOfficerId);
    if (!approvingOfficerCid) {
      return res.status(409).json({ error: `Officer ${approvingOfficerId} is not registered for this financial institution` });
    }
    res.json(await exerciseChoice(T_FINANCING, req.params.contractId, "ApproveFunding",
      {
        assetDetails,
        approvedProviderCid,   // required — see GET /api/providers/approved
        approvingOfficerId,    // required — see GET /api/providers/officers
        approvedByName:      approvedByName      ?? null,
        assessorName:     assessorName     ?? null,
        reasonCode:          reasonCode          ?? null,
        decisionFactors:     decisionFactors     ?? [],
        approvalSignature:   approvalSignature   ?? null,
        decisionDocuments:   decisionDocuments   ?? [],
        offerExpiresAt:      offerExpiresAt      ?? null,
        approvingOfficerCid,
      }, financerParty));
  } catch (e) { next(e); }
});

// FI rejects: reason recorded on-ledger as a FinancingDecision
router.post("/:contractId/reject", requireAuth("financer"), async (req, res, next) => {
  try {
    const { reason, rejectedByName, reasonCode, decisionFactors, decisionDocuments } = req.body;
    res.json(await exerciseChoice(T_FINANCING, req.params.contractId, "RejectFunding",
      {
        reason,
        rejectedByName:    rejectedByName    ?? null,
        reasonCode:        reasonCode        ?? null,
        decisionFactors:   decisionFactors   ?? [],
        decisionDocuments: decisionDocuments ?? [],
      }, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

// ── Wa'd choices (FI exercises on MurabahahWad) ───────────────────────────────

// Path A: FI appoints business as purchasing agent (Wakala)
router.post("/wads/:contractId/proceed-with-wakala", requireAuth("financer"), async (req, res, next) => {
  try {
    res.status(201).json(await exerciseChoice(T_WAD, req.params.contractId, "ProceedWithWakala",
      {}, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

// Path B: FI purchases the asset directly from the supplier — C-2's four acquisition-cost
// components are required Decimals on the Daml side (0.0 default when not applicable, not
// Optional), so they must always be forwarded, not silently dropped when the caller omits them.
router.post("/wads/:contractId/proceed-directly", requireAuth("financer"), async (req, res, next) => {
  try {
    const { actualCost, purchaseDate, invoiceRef, freightCost, customsDuty, insurancePremium, otherAcquisitionCosts } = req.body;
    res.status(201).json(await exerciseChoice(T_WAD, req.params.contractId, "ProceedDirectly",
      {
        actualCost, purchaseDate, invoiceRef,
        freightCost:           freightCost           ?? 0,
        customsDuty:           customsDuty           ?? 0,
        insurancePremium:      insurancePremium       ?? 0,
        otherAcquisitionCosts: otherAcquisitionCosts ?? 0,
      }, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

// Business withdraws the promise (supplier unavailable, circumstances changed)
router.post("/wads/:contractId/withdraw", requireAuth("business"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_WAD, req.params.contractId, "WithdrawWad",
      { reason: req.body.reason }, "business"));
  } catch (e) { next(e); }
});

// ── Wakala choices (business exercises as purchasing agent) ───────────────────

// Business records the completed asset purchase on behalf of the FI — same required
// acquisition-cost Decimals as ProceedDirectly above.
router.post("/wakalas/:contractId/record-purchase", requireAuth("business"), async (req, res, next) => {
  try {
    const { actualCost, purchaseDate, invoiceRef, freightCost, customsDuty, insurancePremium, otherAcquisitionCosts } = req.body;
    res.status(201).json(await exerciseChoice(T_WAKALA, req.params.contractId, "RecordAssetPurchase",
      {
        actualCost, purchaseDate, invoiceRef,
        freightCost:           freightCost           ?? 0,
        customsDuty:           customsDuty           ?? 0,
        insurancePremium:      insurancePremium       ?? 0,
        otherAcquisitionCosts: otherAcquisitionCosts ?? 0,
      }, "business"));
  } catch (e) { next(e); }
});

// Business declines the agency appointment; FI must buy directly
router.post("/wakalas/:contractId/decline-agency", requireAuth("business"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_WAKALA, req.params.contractId, "DeclineAgency",
      { reason: req.body.reason }, "business"));
  } catch (e) { next(e); }
});

// ── Asset Purchase Record choices ─────────────────────────────────────────────

// Business acknowledges receipt/constructive possession (Qabdh) — required before OfferMurabahah
router.post("/purchase-records/:contractId/acknowledge-delivery", requireAuth("business"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_PURCHASE, req.params.contractId, "AcknowledgeDelivery",
      {}, "business"));
  } catch (e) { next(e); }
});

// FI formally offers the asset at cost + disclosed profit (Ijab) — gated by Qabdh.
// advisor (the Shari'a Supervisory Board party) is supplied here from server config,
// same as sentinel below — an internal party the FI's own session need not know (G11).
router.post("/purchase-records/:contractId/offer-murabahah", requireAuth("financer"), async (req, res, next) => {
  try {
    const { murabahahTerms, paymentSchedule, startDate, acceptanceExpiresAt } = req.body;
    // facilityRef (C-1) is the unique identifier that becomes MurabahahContract's contract
    // key — generated here rather than trusted from the client, same rationale as
    // onboarding.ts's onboardingRef and financing.ts's own financingRef above.
    const facilityRef = `FAC-${new Date().getUTCFullYear()}-${randomUUID().split("-")[0].toUpperCase()}`;
    // regulator, like advisor, is a single platform-wide party the FI's own session
    // has no reason to know the raw Canton party ID for — derived server-side from
    // config rather than collected as free text in the UI.
    res.status(201).json(await exerciseChoice(T_PURCHASE, req.params.contractId, "OfferMurabahah",
      {
        murabahahTerms, paymentSchedule, regulator: partyId("regulator"), advisor: partyId("advisor"), facilityRef, startDate,
        acceptanceExpiresAt: acceptanceExpiresAt ?? null,
      },
      resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

// ── Murabahah Proposal choices (business Qabul) ───────────────────────────────

// G11: the advisor (Shari'a Supervisory Board) certifies THESE proposed terms —
// disclosed cost, profit, sale price, tenure — before the business can execute.
// Dual-controller [advisor, vetify] (vetify co-signs the requireActiveAdvisor lookup);
// gated to the vetify session role like every other Shariah-governance route.
router.post("/proposals/:contractId/certify-shariah", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { certificationRef, aaoifiStandards, rationale, certifiedBy } = req.body;
    const advisorCid = await getAuthorizedAdvisorCid(partyId("advisor"));
    if (!advisorCid) {
      return res.status(409).json({ error: "advisor is not a registered AuthorizedAdvisor" });
    }
    res.status(201).json(await exerciseChoice(T_PROPOSAL, req.params.contractId, "CertifyShariahTerms",
      { certificationRef, aaoifiStandards: aaoifiStandards ?? [], rationale, certifiedBy, advisorCid },
      ["advisor", "vetify"]));
  } catch (e) { next(e); }
});

// G11: the advisor withdraws a certification (terms changed / error found before
// acceptance). Archiving it blocks AcceptProposal until a fresh cert is issued.
router.post("/certifications/:contractId/revoke", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { revocationRef, reason, revokedBy } = req.body;
    res.status(201).json(await exerciseChoice(T_SHARIAH_CERT, req.params.contractId, "RevokeCertification",
      { revocationRef, reason, revokedBy }, "advisor"));
  } catch (e) { next(e); }
});

// Business accepts the proposed Murabahah terms → binding bilateral contract.
// sentinel is a choice argument (not a MurabahahProposal field) — supplied here
// from server-side config, same as every other party JWT/ID, not something the
// business's own session should need to know (see Murabahah.daml's AcceptProposal
// doc comment for why this wasn't threaded through the whole acquisition chain).
// G11: certificationCid comes from the request body — it's the ContractId of the
// advisor's ShariahContractCertification for this proposal, a hard gate on execution.
router.post("/proposals/:contractId/accept", requireAuth("business"), async (req, res, next) => {
  try {
    res.status(201).json(await exerciseChoice(T_PROPOSAL, req.params.contractId, "AcceptProposal",
      { sentinel: partyId("sentinel"), certificationCid: req.body.certificationCid }, "business"));
  } catch (e) { next(e); }
});

// Business declines the offered terms
router.post("/proposals/:contractId/decline", requireAuth("business"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_PROPOSAL, req.params.contractId, "DeclineProposal",
      { reason: req.body.reason }, "business"));
  } catch (e) { next(e); }
});

export default router;
