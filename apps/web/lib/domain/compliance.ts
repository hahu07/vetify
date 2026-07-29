import type { SessionContext } from "@/lib/db";
import { withTransaction } from "@/lib/db";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { DomainError } from "@/lib/errors";
import type { ComplianceCheck, RiskLevel } from "@/lib/types";

const ACTIVE_REVIEW_STATUSES = ["UnderReview", "ManualReview"];

// ─── Opens a ComplianceReview from an Approved VerificationResult ─────────
// Daml/Onboarding.daml's own module comment: "ComplianceReview (Stage 3) is
// created off-ledger by the backend/agent after an approved
// VerificationResult" -- so this isn't a Daml *choice* on VerificationResult
// itself, it's the same off-ledger creation step, ported verbatim. `vetify`
// performs this in both the Daml original and here.

async function openComplianceReviewImpl(session: SessionContext, verificationResultId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT vr.*, bo.profile
         FROM verification_result vr
         JOIN business_onboarding bo ON bo.id = vr.business_onboarding_id
         WHERE vr.id = $1`,
      [verificationResultId],
    );
    const vr = rows[0];
    if (!vr) throw new DomainError("Verification result not found");
    if (vr.outcome !== "Approved") {
      throw new DomainError("Can only open a compliance review from an Approved verification result");
    }

    const complianceRef = `COM-${new Date().getFullYear()}-${String(verificationResultId).padStart(6, "0")}`;
    const { rows: inserted } = await client.query(
      `INSERT INTO compliance_review
         (verification_result_id, cac_reg_number, business_name, business_sector,
          business_activity, incorporation_date, verification_ref, compliance_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, status`,
      [
        verificationResultId,
        vr.cac_reg_number,
        vr.business_name,
        vr.profile.businessSector,
        vr.profile.businessActivity,
        vr.profile.incorporationDate,
        vr.verification_ref,
        complianceRef,
      ],
    );
    return inserted[0];
  });
}
export const openComplianceReview = withAuthorization(["vetify"], openComplianceReviewImpl);

// ─── Choice: StartReview (vetify) ──────────────────────────────────────────

async function startReviewImpl(session: SessionContext, reviewId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT status FROM compliance_review WHERE id = $1 FOR UPDATE",
      [reviewId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Compliance review not found");
    if (row.status !== "Pending") {
      throw new DomainError("Can only start a Pending review");
    }
    const { rows: updated } = await client.query(
      `UPDATE compliance_review
         SET status = 'UnderReview', review_started_at = now(), updated_at = now()
         WHERE id = $1
         RETURNING id, status, review_started_at`,
      [reviewId],
    );
    return updated[0];
  });
}
export const startReview = withAuthorization(["vetify"], startReviewImpl);

// ─── Choice: FlagComplianceForManualReview (vetify) ────────────────────────

async function flagComplianceForManualReviewImpl(
  session: SessionContext,
  reviewId: number,
  args: { riskScore: number; riskLevel: RiskLevel; agentVersion: string; note: string },
) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT status FROM compliance_review WHERE id = $1 FOR UPDATE",
      [reviewId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Compliance review not found");
    if (row.status !== "UnderReview") {
      throw new DomainError("Can only flag from UnderReview");
    }
    if (args.riskScore < 0 || args.riskScore > 100) {
      throw new DomainError("Risk score must be 0-100");
    }
    const { rows: updated } = await client.query(
      `UPDATE compliance_review
         SET status = 'ManualReview', agent_score = $2, agent_risk = $3,
             agent_note = $4, agent_version = $5, updated_at = now()
         WHERE id = $1
         RETURNING id, status`,
      [reviewId, args.riskScore, args.riskLevel, args.note, args.agentVersion],
    );
    return updated[0];
  });
}
export const flagComplianceForManualReview = withAuthorization(
  ["vetify"],
  flagComplianceForManualReviewImpl,
);

// ─── Choice: ApproveCompliance (verifier) ──────────────────────────────────
// Creates ApprovedBusiness + ComplianceResult, archives the ComplianceReview.

interface ApproveComplianceArgs {
  completedChecks: ComplianceCheck;
  riskScore: number;
  riskLevel: RiskLevel;
  autoDecided: boolean;
  reviewerParty?: string | null;
  reviewedBy?: string | null;
}

async function approveComplianceImpl(
  session: SessionContext,
  reviewId: number,
  args: ApproveComplianceArgs,
) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM compliance_review WHERE id = $1 FOR UPDATE",
      [reviewId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Compliance review not found");

    if (!ACTIVE_REVIEW_STATUSES.includes(row.status)) {
      throw new DomainError("Can only approve from UnderReview or ManualReview");
    }
    if (args.riskScore < 0 || args.riskScore > 100) {
      throw new DomainError("Risk score must be 0-100");
    }
    const consistent =
      (args.riskLevel === "Low" && args.riskScore >= 80) ||
      (args.riskLevel === "Medium" && args.riskScore >= 50 && args.riskScore < 80) ||
      (args.riskLevel === "High" && args.riskScore < 50);
    if (!consistent) {
      throw new DomainError("Risk score is inconsistent with risk level");
    }
    if (!args.autoDecided && !args.reviewerParty) {
      throw new DomainError("Human decisions require a reviewer party (reviewerParty)");
    }
    if (args.autoDecided && args.riskLevel === "High") {
      throw new DomainError(
        "High-risk applications cannot be auto-approved; human review required",
      );
    }
    if (!args.completedChecks.shariahCompliant)
      throw new DomainError("Cannot approve: Shariah compliance check failed");
    if (!args.completedChecks.amlCleared) throw new DomainError("Cannot approve: AML not cleared");
    if (!args.completedChecks.kycValidated)
      throw new DomainError("Cannot approve: KYC not validated");
    if (!args.completedChecks.cddCompleted)
      throw new DomainError("Cannot approve: CDD not completed");

    const { rows: ab } = await client.query(
      `INSERT INTO approved_business
         (cac_reg_number, business_name, business_sector, business_activity,
          incorporation_date, verification_ref, compliance_ref, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       RETURNING id`,
      [
        row.cac_reg_number,
        row.business_name,
        row.business_sector,
        row.business_activity,
        row.incorporation_date,
        row.verification_ref,
        row.compliance_ref,
      ],
    );

    const { rows: cr } = await client.query(
      `INSERT INTO compliance_result
         (compliance_review_id, cac_reg_number, business_name, verification_ref,
          compliance_ref, outcome, checks, risk_score, risk_level, auto_decided, decided_at)
       VALUES ($1, $2, $3, $4, $5, 'Approved', $6, $7, $8, $9, now())
       RETURNING id`,
      [
        reviewId,
        row.cac_reg_number,
        row.business_name,
        row.verification_ref,
        row.compliance_ref,
        JSON.stringify(args.completedChecks),
        args.riskScore,
        args.riskLevel,
        args.autoDecided,
      ],
    );

    await client.query(
      `UPDATE compliance_review
         SET status = 'Approved', archived_at = now(),
             superseded_by_kind = 'compliance_result', superseded_by_id = $2,
             updated_at = now()
         WHERE id = $1`,
      [reviewId, cr[0].id],
    );

    return { approvedBusinessId: ab[0].id, complianceResultId: cr[0].id };
  });
}
export const approveCompliance = withAuthorization(["verifier"], approveComplianceImpl);

// ─── Choice: RejectCompliance (verifier) ───────────────────────────────────

interface RejectComplianceArgs {
  completedChecks: ComplianceCheck;
  riskScore: number;
  riskLevel: RiskLevel;
  autoDecided: boolean;
  reviewerParty?: string | null;
  reviewedBy?: string | null;
  reason: string;
}

async function rejectComplianceImpl(
  session: SessionContext,
  reviewId: number,
  args: RejectComplianceArgs,
) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM compliance_review WHERE id = $1 FOR UPDATE",
      [reviewId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Compliance review not found");

    if (!ACTIVE_REVIEW_STATUSES.includes(row.status)) {
      throw new DomainError("Can only reject from UnderReview or ManualReview");
    }
    if (args.riskScore < 0 || args.riskScore > 100) {
      throw new DomainError("Risk score must be 0-100");
    }
    if (!args.reason) throw new DomainError("Rejection reason must not be empty");
    if (!args.autoDecided && !args.reviewerParty) {
      throw new DomainError("Human decisions require a reviewer party (reviewerParty)");
    }

    const { rows: cr } = await client.query(
      `INSERT INTO compliance_result
         (compliance_review_id, cac_reg_number, business_name, verification_ref,
          compliance_ref, outcome, checks, risk_score, risk_level, auto_decided, reason, decided_at)
       VALUES ($1, $2, $3, $4, $5, 'Rejected', $6, $7, $8, $9, $10, now())
       RETURNING id`,
      [
        reviewId,
        row.cac_reg_number,
        row.business_name,
        row.verification_ref,
        row.compliance_ref,
        JSON.stringify(args.completedChecks),
        args.riskScore,
        args.riskLevel,
        args.autoDecided,
        args.reason,
      ],
    );

    await client.query(
      `UPDATE compliance_review
         SET status = 'Rejected', archived_at = now(),
             superseded_by_kind = 'compliance_result', superseded_by_id = $2,
             updated_at = now()
         WHERE id = $1`,
      [reviewId, cr[0].id],
    );

    return { complianceResultId: cr[0].id };
  });
}
export const rejectCompliance = withAuthorization(["verifier"], rejectComplianceImpl);

// ─── Reads ──────────────────────────────────────────────────────────────

export async function listComplianceReviews(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM compliance_review WHERE archived_at IS NULL ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function listComplianceResults(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM compliance_result ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function listApprovedBusinesses(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM approved_business WHERE archived_at IS NULL ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function listVerificationResults(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM verification_result ORDER BY created_at DESC`,
    );
    return rows;
  });
}
