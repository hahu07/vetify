/**
 * Stages 1–4: Onboarding, Verification, Compliance, Approved Borrower
 *
 * GET  → PQS (PostgreSQL via repository.ts) — fast, indexed reads
 * POST → Canton HTTP JSON API (canton.ts)   — transactional writes
 */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { exerciseChoice, createContract } from "../canton.js";
import {
  listOnboardingApplications,
  listOnboardingByStatus,
  getOnboardingById,
  listVerificationResults,
  listComplianceReviews,
  listComplianceByStatus,
  listApprovedBorrowers,
} from "../repository.js";

const router = Router();
const T_ONBOARDING        = "Vetify.Onboarding:BusinessOnboarding";
const T_VERIFICATION      = "Vetify.Onboarding:VerificationResult";
const T_COMPLIANCE           = "Vetify.Compliance:ComplianceReview";
const T_APPROVED_BORROWER    = "Vetify.Compliance:ApprovedBorrower";
const T_AUTHORIZED_REVIEWER  = "Vetify.Compliance:AuthorizedReviewer";

// ── Stage 1: Onboarding ──────────────────────────────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;
    const result = status
      ? await listOnboardingByStatus(status as string)
      : await listOnboardingApplications();
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/:contractId", async (req, res, next) => {
  try {
    const result = await getOnboardingById(req.params.contractId);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (e) { next(e); }
});

// Create a Draft onboarding application (borrower-signed via borrower JWT)
router.post("/", async (req, res, next) => {
  try {
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
    }, "borrower");
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Borrower submits the Draft application for review
router.post("/:contractId/submit", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "SubmitForReview", {}, "borrower"));
  } catch (e) { next(e); }
});

// Vetify returns the application to the borrower with a correction request
router.post("/:contractId/request-amendment", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "RequestAmendment",
      { note: req.body.note }, "vetify"));
  } catch (e) { next(e); }
});

// Borrower resubmits with corrections (CAC number immutable; limit from VerificationPolicy)
router.post("/:contractId/amend", async (req, res, next) => {
  try {
    const { updatedBusiness, updatedKyc, updatedDocuments, policyMaxAmendments } = req.body;
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "Amend",
      {
        updatedBusiness,
        updatedKyc,
        updatedDocuments:    updatedDocuments    ?? [],
        policyMaxAmendments: policyMaxAmendments ?? null,
      }, "borrower"));
  } catch (e) { next(e); }
});

// Vetify escalates an overdue application that has exceeded its SLA window.
router.post("/:contractId/escalate-overdue", async (req, res, next) => {
  try {
    const { slaHours } = req.body;
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "EscalateOverdue",
      { slaHours }, "vetify"));
  } catch (e) { next(e); }
});

// ── Stage 2: Verification ────────────────────────────────────────────────────

router.get("/verification-results", async (_req, res, next) => {
  try {
    res.json(await listVerificationResults());
  } catch (e) { next(e); }
});

// Vetify supersedes an erroneous VerificationResult with a documented correction.
router.post("/verification-results/:contractId/supersede", async (req, res, next) => {
  try {
    const { correctionRef, correctedOutcome, reason, correctedBy } = req.body;
    res.json(await exerciseChoice(T_VERIFICATION, req.params.contractId, "Supersede",
      { correctionRef, correctedOutcome, reason, correctedBy }, "vetify"));
  } catch (e) { next(e); }
});

// Verifier (or Verifier Agent) approves — all four verification checks must pass
router.post("/:contractId/approve", async (req, res, next) => {
  try {
    const {
      checks, checkScores, riskScore, riskLevel, autoDecided,
      reviewerParty, reviewedBy, agentVersion, aiMetadata, verificationRef,
      overrideJustification, policyVersion, overrideType, reviewNotes,
    } = req.body;
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "Approve",
      {
        checks, riskScore, riskLevel, autoDecided, verificationRef,
        checkScores:           checkScores           ?? null,
        reviewerParty:         reviewerParty         ?? null,
        reviewedBy:            reviewedBy            ?? null,
        agentVersion:          agentVersion          ?? null,
        aiMetadata:            aiMetadata            ?? null,
        overrideJustification: overrideJustification ?? null,
        policyVersion:         policyVersion         ?? "2026-v1",
        overrideType:          overrideType          ?? null,
        reviewNotes:           reviewNotes           ?? null,
      }, "verifier"));
  } catch (e) { next(e); }
});

// Verifier (or Verifier Agent) rejects
router.post("/:contractId/reject", async (req, res, next) => {
  try {
    const {
      checks, checkScores, riskScore, riskLevel, autoDecided,
      reviewerParty, reviewedBy, agentVersion, aiMetadata, verificationRef, reason,
      overrideJustification, policyVersion, overrideType, reviewNotes,
    } = req.body;
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "Reject",
      {
        checks, riskScore, riskLevel, autoDecided, verificationRef, reason,
        checkScores:           checkScores           ?? null,
        reviewerParty:         reviewerParty         ?? null,
        reviewedBy:            reviewedBy            ?? null,
        agentVersion:          agentVersion          ?? null,
        aiMetadata:            aiMetadata            ?? null,
        overrideJustification: overrideJustification ?? null,
        policyVersion:         policyVersion         ?? "2026-v1",
        overrideType:          overrideType          ?? null,
        reviewNotes:           reviewNotes           ?? null,
      }, "verifier"));
  } catch (e) { next(e); }
});

// Verifier Agent flags medium-risk applications for human review
router.post("/:contractId/flag-manual", async (req, res, next) => {
  try {
    const { riskScore, riskLevel, agentVersion, note } = req.body;
    res.json(await exerciseChoice(T_ONBOARDING, req.params.contractId, "FlagForManualReview",
      { riskScore, riskLevel, agentVersion: agentVersion ?? "unknown", note }, "verifier"));
  } catch (e) { next(e); }
});

// ── Stage 3: Compliance ──────────────────────────────────────────────────────

router.get("/compliance-reviews", async (req, res, next) => {
  try {
    const { status } = req.query;
    const result = status
      ? await listComplianceByStatus(status as string)
      : await listComplianceReviews();
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/start", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "StartReview", {}, "vetify"));
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/assign", async (req, res, next) => {
  try {
    const { newOfficer, assignedByName } = req.body;
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "AssignReview",
      { newOfficer, assignedByName }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/reassign", async (req, res, next) => {
  try {
    const { newOfficer, reason } = req.body;
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "ReassignReview",
      { newOfficer, reason }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/approve", async (req, res, next) => {
  try {
    const {
      completedChecks, riskScore, riskLevel, autoDecided,
      reviewerParty, reviewedBy, agentVersion, aiMetadata,
      overrideJustification, reviewNotes, overrideType,
      complianceDocuments, shariahAssessment,
    } = req.body;
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "ApproveCompliance",
      {
        completedChecks,
        riskScore,
        riskLevel,
        autoDecided,
        reviewerParty:         reviewerParty         ?? null,
        reviewedBy:            reviewedBy            ?? null,
        agentVersion:          agentVersion          ?? null,
        aiMetadata:            aiMetadata            ?? null,
        overrideJustification: overrideJustification ?? null,
        reviewNotes:           reviewNotes           ?? null,
        overrideType:          overrideType          ?? null,
        complianceDocuments:   complianceDocuments   ?? [],
        shariahAssessment:     shariahAssessment     ?? null,
      }, "verifier"));
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/reject", async (req, res, next) => {
  try {
    const {
      completedChecks, riskScore, riskLevel, autoDecided, reason,
      reviewerParty, reviewedBy, agentVersion, aiMetadata,
      overrideJustification, reviewNotes, overrideType,
      complianceDocuments, shariahAssessment,
    } = req.body;
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "RejectCompliance",
      {
        completedChecks,
        riskScore,
        riskLevel,
        autoDecided,
        reason,
        reviewerParty:         reviewerParty         ?? null,
        reviewedBy:            reviewedBy            ?? null,
        agentVersion:          agentVersion          ?? null,
        aiMetadata:            aiMetadata            ?? null,
        overrideJustification: overrideJustification ?? null,
        reviewNotes:           reviewNotes           ?? null,
        overrideType:          overrideType          ?? null,
        complianceDocuments:   complianceDocuments   ?? [],
        shariahAssessment:     shariahAssessment     ?? null,
      }, "verifier"));
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/flag-manual", async (req, res, next) => {
  try {
    const { riskScore, riskLevel, agentVersion, note } = req.body;
    res.json(await exerciseChoice(T_COMPLIANCE, req.params.contractId, "FlagComplianceForManualReview",
      { riskScore, riskLevel, agentVersion: agentVersion ?? "unknown", note }, "vetify"));
  } catch (e) { next(e); }
});

// ── Stage 4: Approved Borrowers ──────────────────────────────────────────────

router.get("/approved", async (_req, res, next) => {
  try {
    res.json(await listApprovedBorrowers());
  } catch (e) { next(e); }
});

// Vetify suspends an active borrower (e.g. adverse media alert, monitoring flag)
router.post("/approved/:contractId/suspend", async (req, res, next) => {
  try {
    const { reason } = req.body;
    res.json(await exerciseChoice(T_APPROVED_BORROWER, req.params.contractId, "Suspend",
      { reason }, "vetify"));
  } catch (e) { next(e); }
});

// Vetify lifts a suspension after the alert is cleared
router.post("/approved/:contractId/reinstate", async (req, res, next) => {
  try {
    const { reason } = req.body;
    res.json(await exerciseChoice(T_APPROVED_BORROWER, req.params.contractId, "Reinstate",
      { reason }, "vetify"));
  } catch (e) { next(e); }
});

// Vetify permanently revokes approval; creates an immutable RevocationRecord on-ledger
router.post("/approved/:contractId/revoke", async (req, res, next) => {
  try {
    const { reason, revokedBy } = req.body;
    res.json(await exerciseChoice(T_APPROVED_BORROWER, req.params.contractId, "Revoke",
      { reason, revokedBy }, "vetify"));
  } catch (e) { next(e); }
});

// Borrower requests re-certification; archives current ApprovedBorrower and opens a new ComplianceReview
router.post("/approved/:contractId/recertify", async (req, res, next) => {
  try {
    res.json(await exerciseChoice(T_APPROVED_BORROWER, req.params.contractId, "RequestRecertification",
      {}, "borrower"));
  } catch (e) { next(e); }
});

// Vetify marks an ApprovedBorrower as expired once its expiresAt date has passed
router.post("/approved/:contractId/expire", async (req, res, next) => {
  try {
    const { reason } = req.body;
    res.json(await exerciseChoice(T_APPROVED_BORROWER, req.params.contractId, "ExpireBorrower",
      { reason }, "vetify"));
  } catch (e) { next(e); }
});

// ── Authorized Reviewer Registry ─────────────────────────────────────────────

// Vetify registers a verifier as an authorized reviewer
router.post("/compliance/authorized-reviewers", async (req, res, next) => {
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
router.post("/compliance/authorized-reviewers/:contractId/deauthorize", async (req, res, next) => {
  try {
    const { reason } = req.body;
    res.json(await exerciseChoice(T_AUTHORIZED_REVIEWER, req.params.contractId, "Deauthorize",
      { reason }, "vetify"));
  } catch (e) { next(e); }
});

export default router;
