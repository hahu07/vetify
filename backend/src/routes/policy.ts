/**
 * Policy Governance — VerificationPolicy / CompliancePolicy scoring-policy
 * changes (Vetify.Onboarding / Vetify.Compliance) and the PolicyApprover
 * registry (Vetify.Governance) that gates who may approve them.
 *
 * Cross-cutting infrastructure, not a lifecycle stage — see
 * docs/risk-governance-charter.md for the process this implements and
 * docs/deferred-gaps.md's "Policy-Approval Security Roadmap" for what it
 * does and doesn't guarantee. Layer 0/1: approvedBy/proposedBy/performedBy
 * are Text-identified, not separate Canton parties — the caller is
 * responsible for asserting the right individual's identity, the same trust
 * boundary already accepted for AuthorizedReviewer/AuthorizedOfficer
 * elsewhere in this codebase.
 *
 * Layer 2: the `/verification/:id/endorse` and `/compliance/:id/endorse`
 * routes exercise `EndorseByRiskCommittee` signed as the `riskCommittee`
 * party — a genuinely distinct Canton party from `vetify`. This must happen
 * (its own separate ledger transaction, its own JWT) before
 * `ApprovePolicyChange` will succeed. Deliberately two routes/two
 * transactions rather than one endpoint asking for both signatures at once:
 * a single combined exercise only proves whoever called this backend held
 * authority for both parties, which — since this one Express process holds
 * every party's JWT in `canton.ts`'s `PARTY_JWTS` — would prove nothing. Real
 * separation requires `CANTON_RISK_COMMITTEE_JWT` to actually be held by the
 * Risk Committee's own system, not by whoever manages this backend's env.
 *
 * Layer 3 (this pass): Layer 2 still lets *anyone* holding the shared
 * `riskCommittee`/`vetify` JWT submit `endorsedBy`/`approvedBy`/`rejectedBy`
 * as any Text they like — nothing verifies the specific human typing that
 * name is actually them. `requireAuth(partyRole)` below now gates the
 * endorse/approve/reject routes on a real human login (see auth.ts) —
 * `endorsedBy`/`approvedBy`/`rejectedBy` are *derived from the authenticated
 * session*, not accepted from the request body, and every action is written
 * to `audit_log` (appdb.ts). This still does not put individual identity on
 * the Canton ledger itself — the ledger only ever sees the shared party —
 * the audit log is where individual, non-repudiable attribution actually
 * lives. That's only as strong as "the ledger API is unreachable except
 * through this backend"; see docs/deferred-gaps.md's Layer 3 entry.
 */
import { Router } from "express";
import { exerciseChoice, createContract, queryContracts } from "../canton.js";
import { requireAuth } from "../auth.js";
import { recordAuditLog } from "../appdb.js";

const router = Router();

const T_VERIFICATION_POLICY         = "Vetify.Onboarding:VerificationPolicy";
const T_PENDING_VERIFICATION_POLICY = "Vetify.Onboarding:PendingVerificationPolicy";
const T_COMPLIANCE_POLICY           = "Vetify.Compliance:CompliancePolicy";
const T_PENDING_COMPLIANCE_POLICY   = "Vetify.Compliance:PendingCompliancePolicy";
const T_POLICY_APPROVER             = "Vetify.Governance:PolicyApprover";

// ── VerificationPolicy (Stage 2 scoring policy) ─────────────────────────────

router.get("/verification", async (_req, res, next) => {
  try {
    res.json(await queryContracts(T_VERIFICATION_POLICY));
  } catch (e) { next(e); }
});

router.get("/verification/pending", async (_req, res, next) => {
  try {
    res.json(await queryContracts(T_PENDING_VERIFICATION_POLICY));
  } catch (e) { next(e); }
});

// Propose a new VerificationPolicy — does not take effect until a different,
// registered PolicyApprover exercises ApprovePolicyChange (below).
router.post("/verification/propose", requireAuth("vetify"), async (req, res, next) => {
  try {
    const {
      vetify, riskCommittee, maxAmendments, slaHours, autoApproveMin, autoRejectMax,
      requiredDocTypes, policyVersion, scoringWeights, proposedBy, reason,
    } = req.body;
    res.status(201).json(await createContract(T_PENDING_VERIFICATION_POLICY, {
      vetify,
      riskCommittee,
      maxAmendments,
      slaHours,
      autoApproveMin,
      autoRejectMax,
      requiredDocTypes,
      policyVersion,
      scoringWeights,
      proposedBy,
      reason,
      proposedAt: new Date().toISOString(),
      riskCommitteeEndorsedBy: null,
      riskCommitteeEndorsedAt: null,
    }, "vetify"));
  } catch (e) { next(e); }
});

// Layer 2 + 3: the Risk Committee's own transaction, signed with its own
// JWT, submitted only after a real human login as a riskCommittee-role user —
// endorsedBy comes from that session, not the request body.
router.post("/verification/:contractId/endorse", requireAuth("riskCommittee"), async (req, res, next) => {
  try {
    const { userId, username, displayName, partyRole } = req.authUser!;
    const result = await exerciseChoice(T_PENDING_VERIFICATION_POLICY, req.params.contractId,
      "EndorseByRiskCommittee", { endorsedBy: displayName }, "riskCommittee");
    await recordAuditLog({
      userId, username, displayName, partyRole,
      action: "EndorseByRiskCommittee", contractId: req.params.contractId,
      details: { templateId: T_PENDING_VERIFICATION_POLICY },
    });
    res.json(result);
  } catch (e) { next(e); }
});

// approvedBy must differ from proposedBy AND match a currently-active
// PolicyApprover, and the Risk Committee must have already endorsed
// (Layer 2) — all asserted on-ledger. approvedBy now comes from the
// authenticated session (Layer 3), not the request body.
//
// approverCid/currentPolicyCid: SDK 3.4.11 / Daml-LF 2.1/2.2 has no contract
// keys, so ApprovePolicyChange can no longer resolve the active PolicyApprover
// or VerificationPolicy itself via lookupByKey — this route resolves both via
// queryContracts (same headcount/singleton-sized ACS query already used
// elsewhere in this file) and passes their ContractIds explicitly.
router.post("/verification/:contractId/approve", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { userId, username, displayName, partyRole } = req.authUser!;
    const approvers = await queryContracts(T_POLICY_APPROVER);
    const approver = approvers.find((a: any) => a.payload.approverName === displayName);
    if (!approver) {
      return res.status(409).json({ error: `${displayName} is not a registered PolicyApprover` });
    }
    const activePolicies = await queryContracts(T_VERIFICATION_POLICY);
    const currentPolicyCid = activePolicies[0]?.contractId ?? null;
    const result = await exerciseChoice(T_PENDING_VERIFICATION_POLICY, req.params.contractId,
      "ApprovePolicyChange",
      { approvedBy: displayName, approverCid: approver.contractId, currentPolicyCid },
      "vetify");
    await recordAuditLog({
      userId, username, displayName, partyRole,
      action: "ApprovePolicyChange", contractId: req.params.contractId,
      details: { templateId: T_PENDING_VERIFICATION_POLICY },
    });
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/verification/:contractId/reject", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    const { userId, username, displayName, partyRole } = req.authUser!;
    const result = await exerciseChoice(T_PENDING_VERIFICATION_POLICY, req.params.contractId,
      "RejectPolicyChange", { rejectedBy: displayName, rejectionReason }, "vetify");
    await recordAuditLog({
      userId, username, displayName, partyRole,
      action: "RejectPolicyChange", contractId: req.params.contractId,
      details: { templateId: T_PENDING_VERIFICATION_POLICY, rejectionReason },
    });
    res.json(result);
  } catch (e) { next(e); }
});

// ── CompliancePolicy (Stage 3 scoring policy) ───────────────────────────────

router.get("/compliance", async (_req, res, next) => {
  try {
    res.json(await queryContracts(T_COMPLIANCE_POLICY));
  } catch (e) { next(e); }
});

router.get("/compliance/pending", async (_req, res, next) => {
  try {
    res.json(await queryContracts(T_PENDING_COMPLIANCE_POLICY));
  } catch (e) { next(e); }
});

router.post("/compliance/propose", requireAuth("vetify"), async (req, res, next) => {
  try {
    const {
      vetify, riskCommittee, autoApproveMin, autoRejectMax, escalationSlaHours,
      shariahPolicyVersion, policyVersion, effectiveFrom, effectiveTo,
      scoringWeights, proposedBy, reason,
    } = req.body;
    res.status(201).json(await createContract(T_PENDING_COMPLIANCE_POLICY, {
      vetify,
      riskCommittee,
      autoApproveMin,
      autoRejectMax,
      escalationSlaHours,
      shariahPolicyVersion,
      policyVersion,
      effectiveFrom,
      effectiveTo: effectiveTo ?? null,
      scoringWeights,
      proposedBy,
      reason,
      proposedAt: new Date().toISOString(),
      riskCommitteeEndorsedBy: null,
      riskCommitteeEndorsedAt: null,
    }, "vetify"));
  } catch (e) { next(e); }
});

// Layer 2 + 3 — see the identical reasoning on the verification routes above.
router.post("/compliance/:contractId/endorse", requireAuth("riskCommittee"), async (req, res, next) => {
  try {
    const { userId, username, displayName, partyRole } = req.authUser!;
    const result = await exerciseChoice(T_PENDING_COMPLIANCE_POLICY, req.params.contractId,
      "EndorseByRiskCommittee", { endorsedBy: displayName }, "riskCommittee");
    await recordAuditLog({
      userId, username, displayName, partyRole,
      action: "EndorseByRiskCommittee", contractId: req.params.contractId,
      details: { templateId: T_PENDING_COMPLIANCE_POLICY },
    });
    res.json(result);
  } catch (e) { next(e); }
});

// approverCid/currentPolicyCid: see the identical comment on the
// verification approve route above.
router.post("/compliance/:contractId/approve", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { userId, username, displayName, partyRole } = req.authUser!;
    const approvers = await queryContracts(T_POLICY_APPROVER);
    const approver = approvers.find((a: any) => a.payload.approverName === displayName);
    if (!approver) {
      return res.status(409).json({ error: `${displayName} is not a registered PolicyApprover` });
    }
    const activePolicies = await queryContracts(T_COMPLIANCE_POLICY);
    const currentPolicyCid = activePolicies[0]?.contractId ?? null;
    const result = await exerciseChoice(T_PENDING_COMPLIANCE_POLICY, req.params.contractId,
      "ApprovePolicyChange",
      { approvedBy: displayName, approverCid: approver.contractId, currentPolicyCid },
      "vetify");
    await recordAuditLog({
      userId, username, displayName, partyRole,
      action: "ApprovePolicyChange", contractId: req.params.contractId,
      details: { templateId: T_PENDING_COMPLIANCE_POLICY },
    });
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/compliance/:contractId/reject", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    const { userId, username, displayName, partyRole } = req.authUser!;
    const result = await exerciseChoice(T_PENDING_COMPLIANCE_POLICY, req.params.contractId,
      "RejectPolicyChange", { rejectedBy: displayName, rejectionReason }, "vetify");
    await recordAuditLog({
      userId, username, displayName, partyRole,
      action: "RejectPolicyChange", contractId: req.params.contractId,
      details: { templateId: T_PENDING_COMPLIANCE_POLICY, rejectionReason },
    });
    res.json(result);
  } catch (e) { next(e); }
});

// ── PolicyApprover registry (who may approve either policy above) ──────────

router.get("/approvers", async (_req, res, next) => {
  try {
    res.json(await queryContracts(T_POLICY_APPROVER));
  } catch (e) { next(e); }
});

// Registers a Risk & Credit Governance Committee member (docs/risk-governance-charter.md §3).
router.post("/approvers", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { vetify, approverName, role, authorizedBy } = req.body;
    res.status(201).json(await createContract(T_POLICY_APPROVER, {
      vetify,
      approverName,
      role,
      authorizedBy,
      authorizedAt: new Date().toISOString(),
      active: true,
    }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/approvers/:contractId/deactivate", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_POLICY_APPROVER, req.params.contractId,
      "DeactivatePolicyApprover", { reason, performedBy }, "vetify"));
  } catch (e) { next(e); }
});

router.post("/approvers/:contractId/reactivate", requireAuth("vetify"), async (req, res, next) => {
  try {
    const { reason, performedBy } = req.body;
    res.json(await exerciseChoice(T_POLICY_APPROVER, req.params.contractId,
      "ReactivatePolicyApprover", { reason, performedBy }, "vetify"));
  } catch (e) { next(e); }
});

export default router;
