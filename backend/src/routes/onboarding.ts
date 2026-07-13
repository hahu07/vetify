/**
 * Stages 1–4: Onboarding, Verification, Compliance, Approved Business
 *
 * GET  → PQS (PostgreSQL via repository.ts) — fast, indexed reads
 * POST → Canton HTTP JSON API (canton.ts)   — transactional writes
 */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { exerciseChoice, createContract, queryContracts, partyId } from "../canton.js";
import { requireAuth, issueSessionToken } from "../auth.js";
import { findUserById, findUserByCacRegNumber, setUserCacRegNumber } from "../appdb.js";
import {
  listOnboardingApplications,
  listOnboardingByStatus,
  listOnboardingByBusinessCac,
  getOnboardingById,
  listVerificationResults,
  listVerificationResultByCac,
  listComplianceReviews,
  listComplianceReviewByCac,
  listComplianceByStatus,
  listComplianceResults,
  listComplianceResultByCac,
  listApprovedBusinesses,
  listApprovedBusinessByCac,
  getOnboardingDocumentsByCac,
  listEddCases,
  listEddCasesByStatus,
} from "../repository.js";

const router = Router();
const T_ONBOARDING        = "Vetify.Onboarding:BusinessOnboarding";
const T_VERIFICATION      = "Vetify.Onboarding:VerificationResult";
const T_VERIFICATION_POLICY = "Vetify.Onboarding:VerificationPolicy";
const T_COMPLIANCE           = "Vetify.Compliance:ComplianceReview";
const T_COMPLIANCE_POLICY    = "Vetify.Compliance:CompliancePolicy";
const T_COMPLIANCE_RESULT    = "Vetify.Compliance:ComplianceResult";
const T_APPROVED_BUSINESS    = "Vetify.Compliance:ApprovedBusiness";
const T_AUTHORIZED_REVIEWER  = "Vetify.Compliance:AuthorizedReviewer";
const T_AUTHORIZED_ADVISOR = "Vetify.Governance:AuthorizedAdvisor";
const T_EDD_CASE = "Vetify.Compliance:EDDCase"; // G14

// SDK 3.4.11 / Daml-LF 2.1/2.2 has no contract keys, so the choices below can
// no longer resolve their active policy/registry contract via lookupByKey —
// these small helpers do the equivalent lookup off-ledger (queryContracts is
// already audited for exactly this: headcount/singleton-sized registries and
// policy singletons, see canton.ts's queryContracts comment) and the routes
// pass the resulting ContractId(s) in explicitly.
async function getActivePolicyCid(templateId: string): Promise<string | null> {
  const active = await queryContracts(templateId);
  return active[0]?.contractId ?? null;
}

async function getAuthorizedReviewerCid(verifierParty: string): Promise<string | null> {
  const reviewers = await queryContracts(T_AUTHORIZED_REVIEWER);
  return (reviewers.find((r: any) => r.payload.verifier === verifierParty))?.contractId ?? null;
}

// ── Stage 1: Onboarding ──────────────────────────────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const { partyRole, cacRegNumber } = req.authUser!;
    // Self-serve business signups only ever see their own onboarding (keyed
    // by the CAC number their account is linked to at first submission,
    // see POST / below) — every other role (vetify/verifier staff reviewing
    // the queue) keeps today's unrestricted/status-filtered view.
    if (partyRole === "business") {
      return res.json(cacRegNumber ? await listOnboardingByBusinessCac(cacRegNumber) : []);
    }
    const { status } = req.query;
    const result = status
      ? await listOnboardingByStatus(status as string)
      : await listOnboardingApplications();
    res.json(result);
  } catch (e) { next(e); }
});

// Staff-only document lookup, by CAC rather than contract ID — a business's
// documents live on BusinessOnboarding while still mid-pipeline, but Approve/
// Reject archives that contract without recreating it (see repository.ts's
// getOnboardingDocumentsByCac), so the contract ID a reviewer had on screen
// stops resolving the instant a decision is made. Keying by CAC instead means
// the same "Documents" action works regardless of which stage the business is
// currently in.
router.get("/documents/:cacRegNumber", requireAuth(), async (req, res, next) => {
  try {
    const { partyRole } = req.authUser!;
    if (partyRole !== "vetify" && partyRole !== "verifier") {
      return res.status(403).json({ error: "This action requires vetify or verifier staff access" });
    }
    const result = await getOnboardingDocumentsByCac(req.params.cacRegNumber);
    res.json(result ?? { source: null, documents: [], onboardingRef: null });
  } catch (e) { next(e); }
});

// Registered before "/:contractId" below — that catch-all responds 404
// directly (no next() fallthrough), so any single-segment GET route placed
// after it would be unreachable.
router.get("/advisors", async (_req, res, next) => {
  try {
    res.json(await queryContracts(T_AUTHORIZED_ADVISOR));
  } catch (e) { next(e); }
});

// Create a Draft onboarding application (business-signed via business JWT)
router.post("/", requireAuth("business"), async (req, res, next) => {
  try {
    const cacRegNumber: string | undefined = req.body?.kyc?.cacRegNumber;
    // A business's tenant key is fixed at their first onboarding and never
    // changes after (mirrors the Daml side's own "CAC number immutable" rule
    // on BusinessOnboarding.Amend) — a session already linked to one CAC
    // trying to create a onboarding under a different one is rejected, not
    // silently split across two identities.
    if (req.authUser!.cacRegNumber && cacRegNumber && req.authUser!.cacRegNumber !== cacRegNumber) {
      return res.status(409).json({
        error: `This account is already linked to CAC ${req.authUser!.cacRegNumber} — sign up again to onboard a different business`,
      });
    }

    const isFirstOnboarding = !!cacRegNumber && !req.authUser!.cacRegNumber;
    // users.cac_reg_number carries a UNIQUE constraint (one account per CAC,
    // platform-wide) — checked BEFORE writing to the ledger below. Found live:
    // without this pre-check, a CAC already claimed by a different account
    // only surfaced as a raw Postgres constraint violation on the post-create
    // linking step, by which point the Canton Draft had already committed —
    // every retry (the same conflict can never resolve itself) left behind
    // another orphaned duplicate Draft with no way to clean it up.
    if (isFirstOnboarding) {
      const claimedBy = await findUserByCacRegNumber(cacRegNumber);
      if (claimedBy && claimedBy.id !== req.authUser!.userId) {
        return res.status(409).json({
          error: `CAC ${cacRegNumber} is already registered to a different account. If this is your business, log in with that account instead.`,
        });
      }
    }

    // onboardingRef is a backend correlation ID (Onboarding.daml's own comment: e.g.
    // "ONB-2026-000001") — generated here, not accepted from the client, since it must
    // exist before SubmitForReview (Gap 9) and callers shouldn't be inventing ledger-facing
    // identifiers. Not a strict per-year sequence (that needs a backend-owned mutable store;
    // PQS is read-only, populated by Scribe) — a UUID-derived suffix avoids collisions
    // without new infra.
    const onboardingRef = `ONB-${new Date().getUTCFullYear()}-${randomUUID().split("-")[0].toUpperCase()}`;
    const result = await createContract(T_ONBOARDING, {
      ...req.body,
      status:          "Draft",
      agentScore:      null,
      agentRisk:       null,
      submittedAt:     null,
      amendmentCount:  0,
      documents:       req.body.documents ?? [],
      documentHistory: [],
      agentNote:       null,
      agentVersion:    null,
      onboardingRef,
      schemaVersion:   1,
      workflowVersion: 1,
    }, "business");

    // First-ever onboarding for this account: link the CAC number as its
    // tenant key and mint a fresh session token carrying it, so subsequent
    // GET /api/onboarding (and the financing/contracts routes downstream)
    // scope correctly without requiring a fresh login.
    let refreshedToken: string | undefined;
    if (isFirstOnboarding) {
      try {
        const linked = await setUserCacRegNumber(req.authUser!.userId, cacRegNumber!);
        if (linked) {
          const user = await findUserById(req.authUser!.userId);
          if (user) refreshedToken = issueSessionToken(user);
        }
      } catch (linkErr) {
        // Defensive backstop for the race the pre-check above can't fully
        // close (two concurrent first-submissions for the same CAC): the
        // Draft above already committed, so archive it rather than leave an
        // orphan behind, then report the same clean conflict as the pre-check.
        await exerciseChoice(T_ONBOARDING, result.contractId, "Archive", {}, "business").catch(() => {});
        return res.status(409).json({
          error: `CAC ${cacRegNumber} is already registered to a different account. If this is your business, log in with that account instead.`,
        });
      }
    }

    res.status(201).json({ ...result, ...(refreshedToken ? { refreshedToken } : {}) });
  } catch (e) { next(e); }
});

// Business submits the Draft application for review
router.post("/:contractId/submit", requireAuth("business"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "SubmitForReview", {}, "business"));
  } catch (e) { next(e); }
});

// Business withdraws a Draft it just created — used by the frontend as a
// compensating rollback when create succeeds but the immediately-following
// submit fails, so a broken submission never leaves an orphaned Draft behind
// (see the same reasoning on POST / above). Plain Archive, business-signed —
// BusinessOnboarding has no custom guard on it, so this works from any status
// the business's own signature is enough to archive, not just Draft.
router.post("/:contractId/withdraw", requireAuth("business"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "Archive", {}, "business"));
  } catch (e) { next(e); }
});

// Vetify returns the application to the business with a correction request
router.post("/:contractId/request-amendment", requireAuth("vetify"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "RequestAmendment",
      { note: req.body.note }, "vetify"));
  } catch (e) { next(e); }
});

// Business resubmits with corrections (CAC number immutable; limit from VerificationPolicy)
router.post("/:contractId/amend", requireAuth("business"), async (req, res, next) => {
  try {
    const { updatedProfile, updatedKyc, updatedDocuments, policyMaxAmendments } = req.body;
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "Amend",
      {
        updatedProfile,
        updatedKyc,
        updatedDocuments:    updatedDocuments    ?? [],
        policyMaxAmendments: policyMaxAmendments ?? null,
      }, "business"));
  } catch (e) { next(e); }
});

// Vetify escalates an overdue application that has exceeded its SLA window.
router.post("/:contractId/escalate-overdue", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { slaHours } = req.body;
    const policyCid = await getActivePolicyCid(T_VERIFICATION_POLICY);
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "EscalateOverdue",
      { slaHours, policyCid }, "vetify"));
  } catch (e) { next(e); }
});

// ── Stage 2: Verification ────────────────────────────────────────────────────

router.get("/verification-results", async (req, res, next) => {
  try {
    const { partyRole, cacRegNumber } = req.authUser!;
    if (partyRole === "business") {
      return res.json(cacRegNumber ? await listVerificationResultByCac(cacRegNumber) : []);
    }
    res.json(await listVerificationResults());
  } catch (e) { next(e); }
});

// Vetify supersedes an erroneous VerificationResult with a documented correction.
router.post("/verification-results/:contractId/supersede", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { correctionRef, correctedOutcome, reason } = req.body;
    // Supersede's correctedBy is a Canton Party (unlike SupersedeShariahVerdict's Text field of
    // the same name just below) — a client-typed human name is not a valid Party, so this is
    // derived server-side rather than trusted from the request body. Individual attribution for
    // who actually clicked this lives in the audit_log (Layer 3), not this on-ledger field.
    res.json(await exerciseChoice(T_VERIFICATION, req.params.contractId, "Supersede",
      { correctionRef, correctedOutcome, reason, correctedBy: partyId("vetify") }, "vetify"));
  } catch (e) { next(e); }
});

// Verifier (or Verifier Agent) approves — all four verification checks must pass
router.post("/:contractId/approve", requireAuth("vetify"), async (req, res, next) => {
  try {
    const {
      checks, checkScores, riskScore, riskLevel, autoDecided,
      reviewerParty, reviewedBy, agentVersion, aiMetadata, verificationRef,
      overrideJustification, policyVersion, overrideType, reviewNotes,
    } = req.body;
    // Human portal decisions (this route, session-gated) identify the reviewer from the
    // authenticated session rather than trusting the request body — same Layer 3 pattern as
    // the policy endorse/approve/reject routes. autoDecided=true (agent path) still allows an
    // explicit override, though this route is never called by the agent in practice.
    const policyCid = await getActivePolicyCid(T_VERIFICATION_POLICY);
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "Approve",
      {
        checks, riskScore, riskLevel, autoDecided, verificationRef,
        checkScores:           checkScores           ?? null,
        reviewerParty:         reviewerParty         ?? (autoDecided ? null : partyId("verifier")),
        reviewedBy:            reviewedBy            ?? (autoDecided ? null : req.authUser!.displayName),
        agentVersion:          agentVersion          ?? null,
        aiMetadata:            aiMetadata            ?? null,
        overrideJustification: overrideJustification ?? null,
        policyVersion:         policyVersion         ?? "2026-v1",
        overrideType:          overrideType          ?? null,
        reviewNotes:           reviewNotes           ?? null,
        policyCid,
      }, ["verifier", "vetify"]));
  } catch (e) { next(e); }
});

// Verifier (or Verifier Agent) rejects
router.post("/:contractId/reject", requireAuth("vetify"), async (req, res, next) => {
  try {
    const {
      checks, checkScores, riskScore, riskLevel, autoDecided,
      reviewerParty, reviewedBy, agentVersion, aiMetadata, verificationRef, reason,
      overrideJustification, policyVersion, overrideType, reviewNotes,
    } = req.body;
    const policyCid = await getActivePolicyCid(T_VERIFICATION_POLICY);
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "Reject",
      {
        checks, riskScore, riskLevel, autoDecided, verificationRef, reason,
        checkScores:           checkScores           ?? null,
        reviewerParty:         reviewerParty         ?? (autoDecided ? null : partyId("verifier")),
        reviewedBy:            reviewedBy            ?? (autoDecided ? null : req.authUser!.displayName),
        agentVersion:          agentVersion          ?? null,
        aiMetadata:            aiMetadata            ?? null,
        overrideJustification: overrideJustification ?? null,
        policyVersion:         policyVersion         ?? "2026-v1",
        overrideType:          overrideType          ?? null,
        reviewNotes:           reviewNotes           ?? null,
        policyCid,
      }, ["verifier", "vetify"]));
  } catch (e) { next(e); }
});

// Verifier Agent flags medium-risk applications for human review
router.post("/:contractId/flag-manual", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { riskScore, riskLevel, agentVersion, note } = req.body;
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "FlagForManualReview",
      { riskScore, riskLevel, agentVersion: agentVersion ?? "unknown", note }, "verifier"));
  } catch (e) { next(e); }
});

// ── Stage 3: Compliance ──────────────────────────────────────────────────────

router.get("/compliance-reviews", async (req, res, next) => {
  try {
    const { partyRole, cacRegNumber } = req.authUser!;
    if (partyRole === "business") {
      return res.json(cacRegNumber ? await listComplianceReviewByCac(cacRegNumber) : []);
    }
    const { status } = req.query;
    const result = status
      ? await listComplianceByStatus(status as string)
      : await listComplianceReviews();
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/start", requireAuth("vetify"), async (req, res, next) => {
  try {
    const policyCid = await getActivePolicyCid(T_COMPLIANCE_POLICY);
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "StartReview", { policyCid }, "vetify"));
  } catch (e) { next(e); }
});

// Vetify escalates a Stage 3 review whose SLA window has expired (distinct choice from
// BusinessOnboarding's own EscalateOverdue at Stage 2 — same shape, different template).
router.post("/compliance/:contractId/escalate-overdue", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { fallbackSlaHours } = req.body;
    const policyCid = await getActivePolicyCid(T_COMPLIANCE_POLICY);
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "EscalateOverdue",
      { fallbackSlaHours, policyCid }, "vetify"));
  } catch (e) { next(e); }
});

// ComplianceResult: the Stage 3 audit record ApproveCompliance/RejectCompliance produce.
// Mirrors VerificationResult's own list+Supersede pair above exactly.
router.get("/compliance-results", async (req, res, next) => {
  try {
    const { partyRole, cacRegNumber } = req.authUser!;
    if (partyRole === "business") {
      return res.json(cacRegNumber ? await listComplianceResultByCac(cacRegNumber) : []);
    }
    res.json(await listComplianceResults());
  } catch (e) { next(e); }
});

// Vetify supersedes an erroneous ComplianceResult with a documented correction. correctedBy
// here is a genuine Text name (unlike VerificationResult.Supersede's Party field) — the Daml
// maker-checker assertion compares it against the original reviewedBy string, so it must stay
// a client-supplied name, not a derived Party.
router.post("/compliance-results/:contractId/supersede", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { correctionRef, correctedOutcome, reason, correctedBy } = req.body;
    res.json(await exerciseChoice(T_COMPLIANCE_RESULT, req.params.contractId, "Supersede",
      { correctionRef, correctedOutcome, reason, correctedBy }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/assign", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { newOfficer, assignedByName } = req.body;
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "AssignReview",
      { newOfficer, assignedByName }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/reassign", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { newOfficer, reason } = req.body;
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "ReassignReview",
      { newOfficer, reason }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/approve", requireAuth("vetify"), async (req, res, next) => {
  try {
    const {
      completedChecks, riskScore, riskLevel, autoDecided,
      reviewerParty, reviewedBy, agentVersion, aiMetadata,
      overrideJustification, reviewNotes, overrideType,
      complianceDocuments, shariahAssessment, amlEvidence, eddCaseCid,
    } = req.body;
    // Human portal decisions (this route, session-gated) identify the reviewer from the
    // authenticated session — same Layer 3 pattern as onboarding.ts's Stage 2 Approve/Reject.
    // ApproveCompliance asserts a non-None reviewerParty whenever autoDecided is false.
    const reviewerAuthCid = await getAuthorizedReviewerCid(partyId("verifier"));
    if (!reviewerAuthCid) {
      return res.status(409).json({ error: "verifier is not in the authorized reviewer registry" });
    }
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "ApproveCompliance",
      {
        completedChecks,
        riskScore,
        riskLevel,
        autoDecided,
        reviewerParty:         reviewerParty         ?? (autoDecided ? null : partyId("verifier")),
        reviewedBy:            reviewedBy            ?? (autoDecided ? null : req.authUser!.displayName),
        agentVersion:          agentVersion          ?? null,
        aiMetadata:            aiMetadata            ?? null,
        overrideJustification: overrideJustification ?? null,
        reviewNotes:           reviewNotes           ?? null,
        overrideType:          overrideType          ?? null,
        amlEvidence:           amlEvidence           ?? null,
        complianceDocuments:   complianceDocuments   ?? [],
        shariahAssessment:     shariahAssessment     ?? null,
        eddCaseCid:            eddCaseCid            ?? null, // G14
        reviewerAuthCid,
      }, "verifier"));
  } catch (e) { next(e); }
});

// ── G14: Enhanced Due Diligence case (PEP hits — distinct from the generic
// ManualReview queue) ────────────────────────────────────────────────────────

router.get("/edd", async (req, res, next) => {
  try {
    const { status } = req.query;
    res.json(status ? await listEddCasesByStatus(status as string) : await listEddCases());
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/edd/open", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { triggerReason } = req.body;
    res.status(201).json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "OpenEddCase",
      { triggerReason }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/edd/:contractId/update", requireAuth("vetify"), async (req, res, next) => {
  try {
    const {
      sourceOfWealthVerified, sourceOfWealthNote,
      enhancedMediaSearchDone, seniorManagementSignoff, monitoringFrequency,
    } = req.body;
    res.json(await exerciseChoice(T_EDD_CASE, req.params.contractId, "UpdateEddChecklist",
      {
        sourceOfWealthVerified:  sourceOfWealthVerified  ?? null,
        sourceOfWealthNote:      sourceOfWealthNote      ?? null,
        enhancedMediaSearchDone: enhancedMediaSearchDone ?? null,
        seniorManagementSignoff: seniorManagementSignoff ?? null,
        monitoringFrequency:     monitoringFrequency     ?? null,
      }, "verifier"));
  } catch (e) { next(e); }
});

router.post("/edd/:contractId/close", requireAuth("vetify"), async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_EDD_CASE, req.params.contractId, "CloseEddCase",
      { closedBy_: req.body.closedBy }, "verifier"));
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/reject", requireAuth("vetify"), async (req, res, next) => {
  try {
    const {
      completedChecks, riskScore, riskLevel, autoDecided, reason,
      reviewerParty, reviewedBy, agentVersion, aiMetadata,
      overrideJustification, reviewNotes, overrideType,
      complianceDocuments, shariahAssessment,
    } = req.body;
    const reviewerAuthCid = await getAuthorizedReviewerCid(partyId("verifier"));
    if (!reviewerAuthCid) {
      return res.status(409).json({ error: "verifier is not in the authorized reviewer registry" });
    }
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "RejectCompliance",
      {
        completedChecks,
        riskScore,
        riskLevel,
        autoDecided,
        reason,
        reviewerParty:         reviewerParty         ?? (autoDecided ? null : partyId("verifier")),
        reviewedBy:            reviewedBy            ?? (autoDecided ? null : req.authUser!.displayName),
        agentVersion:          agentVersion          ?? null,
        aiMetadata:            aiMetadata            ?? null,
        overrideJustification: overrideJustification ?? null,
        reviewNotes:           reviewNotes           ?? null,
        overrideType:          overrideType          ?? null,
        complianceDocuments:   complianceDocuments   ?? [],
        shariahAssessment:     shariahAssessment     ?? null,
        reviewerAuthCid,
      }, "verifier"));
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/flag-manual", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { riskScore, riskLevel, agentVersion, note } = req.body;
    const policyCid = await getActivePolicyCid(T_COMPLIANCE_POLICY);
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "FlagComplianceForManualReview",
      { riskScore, riskLevel, agentVersion: agentVersion ?? "unknown", note, policyCid }, "vetify"));
  } catch (e) { next(e); }
});

// Post-hoc audit correction for an erroneous Shariah verdict — mirrors the existing
// /verification-results/:contractId/supersede route exactly. Controller vetify alone
// (Option A): advisor, who made the original call, cannot unilaterally correct it.
router.post("/compliance-reviews/:contractId/supersede-shariah-verdict", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { correctionRef, newVerdict, reason, correctedBy } = req.body;
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "SupersedeShariahVerdict",
      { correctionRef, newVerdict, reason, correctedBy }, "vetify"));
  } catch (e) { next(e); }
});

// ── AuthorizedAdvisor registry (who may act as advisor) ─────
// Mirrors AuthorizedSentinel/AuthorizedAssessor's register/deactivate/reactivate pattern.
// GET moved before this file's "/:contractId" catch-all (below) — that handler
// responds 404 directly rather than falling through via next(), so any GET route
// with a single path segment registered after it would be unreachable (same
// shadowing risk already avoided in contracts.ts for "/sentinels").

router.post("/advisors", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { vetify, advisor, role, authorizedBy } = req.body;
    res.status(201).json(await createContract(T_AUTHORIZED_ADVISOR, {
      vetify,
      advisor,
      role,
      authorizedBy,
      authorizedAt: new Date().toISOString(),
      active: true,
    }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/advisors/:contractId/deactivate", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_ADVISOR, req.params.contractId,
      "DeactivateAdvisor", { reason, performedBy }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/advisors/:contractId/reactivate", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_ADVISOR, req.params.contractId,
      "ReactivateAdvisor", { reason, performedBy }, "vetify"));
  } catch (e) { next(e); }
});

// ── Stage 4: Approved Businesses ──────────────────────────────────────────────

// Same self-serve scoping as GET / above: a business session only ever sees
// its own approval, keyed by the CAC number its account is linked to — found
// live that this was previously unscoped, so any business session could see
// every other business's approved status. Once BusinessOnboarding.Approve
// archives BusinessOnboarding (Onboarding.daml — no recreated contract on
// approval), this is also the *only* place a business's own dashboard can
// still find its Stage 4 status; GET / legitimately returns [] at that point.
router.get("/approved", async (req, res, next) => {
  try {
    const { partyRole, cacRegNumber } = req.authUser!;
    if (partyRole === "business") {
      return res.json(cacRegNumber ? await listApprovedBusinessByCac(cacRegNumber) : []);
    }
    res.json(await listApprovedBusinesses());
  } catch (e) { next(e); }
});

// Vetify suspends an active business (e.g. adverse media alert, monitoring flag)
router.post("/approved/:contractId/suspend", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason } = req.body;
    res.json(await exerciseChoice(T_APPROVED_BUSINESS, req.params.contractId, "Suspend",
      { reason }, "vetify"));
  } catch (e) { next(e); }
});

// Vetify lifts a suspension after the alert is cleared
router.post("/approved/:contractId/reinstate", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason } = req.body;
    res.json(await exerciseChoice(T_APPROVED_BUSINESS, req.params.contractId, "Reinstate",
      { reason }, "vetify"));
  } catch (e) { next(e); }
});

// Vetify permanently revokes approval; creates an immutable RevocationRecord on-ledger
router.post("/approved/:contractId/revoke", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason, revokedBy } = req.body;
    res.json(await exerciseChoice(T_APPROVED_BUSINESS, req.params.contractId, "Revoke",
      { reason, revokedBy }, "vetify"));
  } catch (e) { next(e); }
});

// Business requests re-certification; archives current ApprovedBusiness and opens a new
// ComplianceReview. advisor is supplied here from server config, not the request body —
// same reasoning as AcceptProposal's sentinel argument (Murabahah.daml): it's an internal party
// the business's own session has no reason to know.
// NOTE: `verifier` is also a required RequestRecertification argument but was already missing
// from this route's body destructure before this change — pre-existing, out of scope here.
// Vetify triggers periodic re-certification (CBN NIFI re-KYC). Fixed during the
// G1 auth pass: this route previously submitted as "business" (the Daml
// controller is vetify — it would have failed authorization live) and omitted
// the choice's required verifier/newComplianceRef/reason arguments entirely.
router.post("/approved/:contractId/recertify", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { newComplianceRef, reason } = req.body;
    res.json(await exerciseChoice(T_APPROVED_BUSINESS, req.params.contractId, "RequestRecertification",
      {
        verifier: partyId("verifier"),
        advisor: partyId("advisor"),
        newComplianceRef,
        reason,
      }, "vetify"));
  } catch (e) { next(e); }
});

// Vetify marks an ApprovedBusiness as expired once its expiresAt date has passed
router.post("/approved/:contractId/expire", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason } = req.body;
    res.json(await exerciseChoice(T_APPROVED_BUSINESS, req.params.contractId, "ExpireBusiness",
      { reason }, "vetify"));
  } catch (e) { next(e); }
});

// ── Authorized Reviewer Registry ─────────────────────────────────────────────

router.get("/compliance/authorized-reviewers", async (_req, res, next) => {
  try {
    res.json(await queryContracts(T_AUTHORIZED_REVIEWER));
  } catch (e) { next(e); }
});

// Vetify registers a verifier as an authorized reviewer
router.post("/compliance/authorized-reviewers", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { vetify, verifier, authorizedBy, role } = req.body;
    res.status(201).json(await createContract(T_AUTHORIZED_REVIEWER, {
      vetify,
      verifier,
      authorizedBy,
      role,
      authorizedAt: new Date().toISOString(),
    }, "vetify"));
  } catch (e) { next(e); }
});

// Vetify removes a verifier from the authorized reviewer registry
router.post("/compliance/authorized-reviewers/:contractId/deauthorize", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_REVIEWER, req.params.contractId, "Deauthorize",
      { reason }, "vetify"));
  } catch (e) { next(e); }
});

// Registered last: a catch-all responding 404 directly (no next() fallthrough) for any
// single-segment GET, so every literal-path GET route above must come before this one or
// it becomes unreachable (see the /advisors comment above for the same rule).
router.get("/:contractId", async (req, res, next) => {
  try {
    const result = await getOnboardingById(req.params.contractId);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
