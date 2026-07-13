/**
 * Stage 0: Financing Provider onboarding (Vetify.FinancingProvider) and the
 * AuthorizedOfficer RBAC registry (Vetify.Governance) that gates ApproveFunding.
 *
 * Every FI must complete provider onboarding and get at least one CreditOfficer
 * registered before it can exercise ApproveFunding on a FinancingRequest — see
 * ApproveFunding's `approvedProviderCid`/`approvingOfficerId` requirements in
 * Vetify.Financing. Previously neither had any backend route at all (confirmed
 * via grep before this file existed) — ApproveFunding's route in financing.ts
 * could never actually succeed against a real ledger.
 *
 * GET  → PQS (PostgreSQL via repository.ts)
 * POST → Canton HTTP JSON API (canton.ts)
 */
import { Router } from "express";
import { exerciseChoice, createContract, queryContracts, resolveFinancerParty, partyId } from "../canton.js";
import { requireAuth } from "../auth.js";
import {
  listProviderOnboardings,
  listProviderOnboardingsByFi,
  getProviderOnboardingById,
  listApprovedProviders,
  listApprovedProvidersByFi,
  listAuthorizedOfficers,
  listAuthorizedOfficersByFi,
} from "../repository.js";

const router = Router();
const T_PROVIDER_ONBOARDING = "Vetify.FinancingProvider:FinancingProviderOnboarding";
const T_AUTHORIZED_OFFICER  = "Vetify.Governance:AuthorizedOfficer";
const T_PROVIDER_VERIFICATION_POLICY = "Vetify.FinancingProvider:ProviderVerificationPolicy";

// ── Stage 0: Provider onboarding ────────────────────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const { partyRole, financialInstitutionPartyId } = req.authUser!;
    if (partyRole === "financer" && financialInstitutionPartyId) {
      return res.json(await listProviderOnboardingsByFi(financialInstitutionPartyId));
    }
    res.json(await listProviderOnboardings());
  } catch (e) { next(e); }
});

// Static-path GETs must be registered before the generic "/:contractId" below,
// otherwise Express matches "/approved"/"/officers" as a contractId value.
//
// Unlike GET / above (and unlike the Wad/Wakala/PurchaseRecord/Proposal routes in
// financing.ts), a financer session — including the legacy shared demo account with no
// financialInstitutionPartyId — is ALWAYS scoped to its own institution here, never falls
// through to the unscoped "every approved provider" view. Found live: the legacy account's
// unscoped view returned OTHER institutions' ApprovedProvider/AuthorizedOfficer records
// (self-serve-signed-up ones), and UnderwritingQueue.tsx had no way to tell those apart from
// its own — picking one of them for ApproveFunding's approvedProviderCid failed at the ledger
// with "Contract not found" (that record genuinely isn't this party's to use; Canton privacy
// caught what the frontend couldn't). resolveFinancerParty already computes exactly which
// party a financer session acts as (self-serve dynamic party or the static env fallback) —
// scoping by that instead of the raw financialInstitutionPartyId session field covers the
// legacy account too, since it makes "GET my own approved-provider record" unambiguous for
// every financer session uniformly.
router.get("/approved", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "financer") {
      return res.json(await listApprovedProvidersByFi(partyId(resolveFinancerParty(req.authUser!))));
    }
    res.json(await listApprovedProviders());
  } catch (e) { next(e); }
});

router.get("/officers", async (req, res, next) => {
  try {
    if (req.authUser!.partyRole === "financer") {
      return res.json(await listAuthorizedOfficersByFi(partyId(resolveFinancerParty(req.authUser!))));
    }
    res.json(await listAuthorizedOfficers());
  } catch (e) { next(e); }
});

// ProviderVerificationPolicy (Stage 0 scoring policy) — vetify-wide singleton,
// no observer clause (only vetify can see it), same queryContracts-direct
// pattern as VerificationPolicy/CompliancePolicy in policy.ts. Plain
// create/update (no maker-checker) — see the Daml template's own doc comment
// for why that's an acceptable scope limit here. Registered here (before the
// "/:contractId" catch-all below), same route-ordering discipline as
// "/approved"/"/officers" above.
router.get("/policy", async (_req, res, next) => {
  try {
    res.json(await queryContracts(T_PROVIDER_VERIFICATION_POLICY));
  } catch (e) { next(e); }
});

router.get("/:contractId", async (req, res, next) => {
  try {
    const result = await getProviderOnboardingById(req.params.contractId);
    if (!result) return res.status(404).json({ error: "Not found" });
    // Same tenant-scoping gap already closed on contracts.ts's GET /:contractId (see its
    // comment) — a financer session fetching by raw contractId must be checked here too,
    // otherwise any authenticated FI could read any other FI's provider registration.
    if (req.authUser!.partyRole === "financer") {
      const payload = (result as { payload?: { financialInstitution?: string } }).payload;
      const ownParty = partyId(resolveFinancerParty(req.authUser!));
      if (payload?.financialInstitution !== ownParty) {
        return res.status(403).json({ error: "Not authorized to view this provider registration" });
      }
    }
    res.json(result);
  } catch (e) { next(e); }
});

// FI self-registers as a financing provider (Draft status). financialInstitution
// is derived server-side from the session's own resolved party — previously
// trusted verbatim from the request body, which would have let any financer
// session create a FinancingProviderOnboarding under an arbitrary party
// (including another FI's). vetify is still the standard fixed party (the
// contract's observer, always the same one).
router.post("/", requireAuth("financer"), async (req, res, next) => {
  try {
    const { vetify, providerName, address, cacRegNumber, providerType,
      regulatoryBody, licenseNumber, governingDocRef, declaredInstruments } = req.body;
    const financialInstitution = partyId(resolveFinancerParty(req.authUser!));
    const result = await createContract(T_PROVIDER_ONBOARDING, {
      financialInstitution,
      vetify,
      providerName,
      address,
      cacRegNumber,
      providerType,
      regulatoryBody:  regulatoryBody  ?? null,
      licenseNumber:   licenseNumber   ?? null,
      governingDocRef,
      declaredInstruments,
      status:          "Draft",
      submittedAt:     null,
      amendmentCount:  0,
      agentScore:      null,
      agentRisk:       null,
      agentNote:       null,
      agentVersion:    null,
    }, resolveFinancerParty(req.authUser!));
    res.status(201).json(result);
  } catch (e) { next(e); }
});

router.post("/:contractId/submit", requireAuth("financer"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_PROVIDER_ONBOARDING, req.params.contractId,
      "SubmitProviderForReview", {}, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

router.post("/:contractId/amend", requireAuth("financer"), async (req, res, next) => {
  try {
    const { updatedProviderName, updatedAddress, updatedCacRegNumber, updatedLicenseNumber,
      updatedGoverningDocRef, updatedDeclaredInstruments } = req.body;
    res.json(await exerciseChoice(T_PROVIDER_ONBOARDING, req.params.contractId, "AmendProvider", {
      updatedProviderName,
      updatedAddress,
      updatedCacRegNumber,
      updatedLicenseNumber:   updatedLicenseNumber ?? null,
      updatedGoverningDocRef,
      updatedDeclaredInstruments,
    }, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

// Vetify reviews the provider registration
router.post("/:contractId/approve", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { approvedInstruments, regulator } = req.body;
    res.json(await exerciseChoice(T_PROVIDER_ONBOARDING, req.params.contractId, "ApproveProvider", {
      approvedInstruments,
      regulator: regulator ?? null,
    }, "vetify"));
  } catch (e) { next(e); }
});

// A human rejection from ManualReview simply omits the agent fields — only the
// scorer's own auto-Reject path (agents/src/agents/verifier.ts's
// runVerifierProviderStage) supplies them.
router.post("/:contractId/reject", requireAuth("vetify"), async (req, res, next) => {
  try {
    // policyCid is only consulted by RejectProvider when agentScore is Some — always null
    // here (human ManualReview path), so a real ContractId is never actually needed.
    res.json(await exerciseChoice(T_PROVIDER_ONBOARDING, req.params.contractId,
      "RejectProvider",
      { reason: req.body.reason, agentScore: null, agentRisk: null, agentVersion: null, policyCid: null },
      "vetify"));
  } catch (e) { next(e); }
});

router.post("/:contractId/request-amendment", requireAuth("vetify"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_PROVIDER_ONBOARDING, req.params.contractId,
      "RequestProviderAmendment", { note: req.body.note }, "vetify"));
  } catch (e) { next(e); }
});

// ── ApprovedProvider — the ledger credential ApproveFunding requires ───────
// (GET /approved is registered above, before the generic "/:contractId")

// ── AuthorizedOfficer registry (RBAC gate for ApproveFunding) ──────────────
// (GET /officers is registered above, before the generic "/:contractId")

// FI registers one of its own staff as an authorized officer. Same
// server-derived financialInstitution fix as POST / above.
router.post("/officers", requireAuth("financer"), async (req, res, next) => {
  try {
    const { vetify, officerId, officerName, roles, authorizedBy,
      approvalLimit, validUntil, department, branch, employeeId, email } = req.body;
    const financialInstitution = partyId(resolveFinancerParty(req.authUser!));
    res.status(201).json(await createContract(T_AUTHORIZED_OFFICER, {
      financialInstitution,
      vetify,
      officerId,
      officerName,
      roles,
      authorizedBy,
      authorizedAt:  new Date().toISOString(),
      active:        true,
      approvalLimit: approvalLimit ?? null,
      validUntil:    validUntil    ?? null,
      lastUpdatedBy: null,
      lastUpdatedAt: null,
      statusReason:  null,
      department:    department ?? null,
      branch:        branch     ?? null,
      employeeId:    employeeId ?? null,
      email:         email      ?? null,
    }, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

router.post("/officers/:contractId/deactivate", requireAuth("financer"), async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_OFFICER, req.params.contractId,
      "DeactivateOfficer", { reason, performedBy }, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

router.post("/officers/:contractId/reactivate", requireAuth("financer"), async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_OFFICER, req.params.contractId,
      "ReactivateOfficer", { reason, performedBy }, resolveFinancerParty(req.authUser!)));
  } catch (e) { next(e); }
});

router.post("/policy", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { policyVersion, autoRejectMax, effectiveFrom, scoringWeights } = req.body;
    res.status(201).json(await createContract(T_PROVIDER_VERIFICATION_POLICY, {
      vetify: partyId("vetify"),
      policyVersion,
      autoRejectMax,
      effectiveFrom,
      scoringWeights,
    }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/policy/:contractId/update", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { newPolicyVersion, newAutoRejectMax, newEffectiveFrom, newScoringWeights } = req.body;
    res.json(await exerciseChoice(T_PROVIDER_VERIFICATION_POLICY, req.params.contractId, "UpdatePolicy", {
      newPolicyVersion,
      newAutoRejectMax,
      newEffectiveFrom,
      newScoringWeights,
    }, "vetify"));
  } catch (e) { next(e); }
});

export default router;
