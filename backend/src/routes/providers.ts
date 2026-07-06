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
import { exerciseChoice, createContract } from "../canton.js";
import {
  listProviderOnboardings,
  getProviderOnboardingById,
  listApprovedProviders,
  listAuthorizedOfficers,
} from "../repository.js";

const router = Router();
const T_PROVIDER_ONBOARDING = "Vetify.FinancingProvider:FinancingProviderOnboarding";
const T_AUTHORIZED_OFFICER  = "Vetify.Governance:AuthorizedOfficer";

// ── Stage 0: Provider onboarding ────────────────────────────────────────────

router.get("/", async (_req, res, next) => {
  try {
    res.json(await listProviderOnboardings());
  } catch (e) { next(e); }
});

// Static-path GETs must be registered before the generic "/:contractId" below,
// otherwise Express matches "/approved"/"/officers" as a contractId value.
router.get("/approved", async (_req, res, next) => {
  try {
    res.json(await listApprovedProviders());
  } catch (e) { next(e); }
});

router.get("/officers", async (_req, res, next) => {
  try {
    res.json(await listAuthorizedOfficers());
  } catch (e) { next(e); }
});

router.get("/:contractId", async (req, res, next) => {
  try {
    const result = await getProviderOnboardingById(req.params.contractId);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (e) { next(e); }
});

// FI self-registers as a financing provider (Draft status)
router.post("/", async (req, res, next) => {
  try {
    const { financialInstitution, vetify, providerName, address, providerType,
      regulatoryBody, licenseNumber, governingDocRef, declaredInstruments } = req.body;
    const result = await createContract(T_PROVIDER_ONBOARDING, {
      financialInstitution,
      vetify,
      providerName,
      address,
      providerType,
      regulatoryBody:  regulatoryBody  ?? null,
      licenseNumber:   licenseNumber   ?? null,
      governingDocRef,
      declaredInstruments,
      status:          "Draft",
      submittedAt:     null,
      amendmentCount:  0,
    }, "financialInstitution");
    res.status(201).json(result);
  } catch (e) { next(e); }
});

router.post("/:contractId/submit", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_PROVIDER_ONBOARDING, req.params.contractId,
      "SubmitProviderForReview", {}, "financialInstitution"));
  } catch (e) { next(e); }
});

router.post("/:contractId/amend", async (req, res, next) => {
  try {
    const { updatedProviderName, updatedAddress, updatedLicenseNumber,
      updatedGoverningDocRef, updatedDeclaredInstruments } = req.body;
    res.json(await exerciseChoice(T_PROVIDER_ONBOARDING, req.params.contractId, "AmendProvider", {
      updatedProviderName,
      updatedAddress,
      updatedLicenseNumber:   updatedLicenseNumber ?? null,
      updatedGoverningDocRef,
      updatedDeclaredInstruments,
    }, "financialInstitution"));
  } catch (e) { next(e); }
});

// Vetify reviews the provider registration
router.post("/:contractId/approve", async (req, res, next) => {
  try {
    const { approvedInstruments, regulator } = req.body;
    res.json(await exerciseChoice(T_PROVIDER_ONBOARDING, req.params.contractId, "ApproveProvider", {
      approvedInstruments,
      regulator: regulator ?? null,
    }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/:contractId/reject", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_PROVIDER_ONBOARDING, req.params.contractId,
      "RejectProvider", { reason: req.body.reason }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/:contractId/request-amendment", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_PROVIDER_ONBOARDING, req.params.contractId,
      "RequestProviderAmendment", { note: req.body.note }, "vetify"));
  } catch (e) { next(e); }
});

// ── ApprovedProvider — the ledger credential ApproveFunding requires ───────
// (GET /approved is registered above, before the generic "/:contractId")

// ── AuthorizedOfficer registry (RBAC gate for ApproveFunding) ──────────────
// (GET /officers is registered above, before the generic "/:contractId")

// FI registers one of its own staff as an authorized officer
router.post("/officers", async (req, res, next) => {
  try {
    const { financialInstitution, vetify, officerId, officerName, roles, authorizedBy,
      approvalLimit, validUntil, department, branch, employeeId, email } = req.body;
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
    }, "financialInstitution"));
  } catch (e) { next(e); }
});

router.post("/officers/:contractId/deactivate", async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_OFFICER, req.params.contractId,
      "DeactivateOfficer", { reason, performedBy }, "financialInstitution"));
  } catch (e) { next(e); }
});

router.post("/officers/:contractId/reactivate", async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_OFFICER, req.params.contractId,
      "ReactivateOfficer", { reason, performedBy }, "financialInstitution"));
  } catch (e) { next(e); }
});

export default router;
