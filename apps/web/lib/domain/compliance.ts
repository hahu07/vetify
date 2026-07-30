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

// ─── Choice: RecordShariahPreCheck (advisor, vetify dual-controller) ──────
// Phase 2, Fifteenth Slice. Records the decoupled Shariah Agent's (or a
// human advisor's) verdict before StartReview picks up AML/KYB/CDD -- does
// not transition status, mirroring the Daml original exactly. Gated by
// requireActiveAdvisor's Postgres equivalent, checked inline against the
// same client/transaction (not governance.ts's requireActiveAdvisor, which
// opens its own withTransaction -- the atomicity-composition rule the Ninth
// Slice's collections work established: a helper meant to compose inside an
// existing transaction takes a client, never opens its own).

interface ShariahAssessmentArgs {
  verdict: "COMPLIANT" | "REQUIRES_REVIEW" | "NON_COMPLIANT";
  activitiesScreened: string[];
  prohibitedRevenuePct?: number | null;
  aaoifiStandards: string[];
  scholarDecision?: string | null;
  rationale: string;
}

async function recordShariahPreCheckImpl(
  session: SessionContext,
  reviewId: number,
  args: { verdict: ShariahAssessmentArgs; advisorId: number },
) {
  if (!args.verdict.rationale) throw new DomainError("rationale must not be empty");
  return withTransaction(session, async (client) => {
    const { rows: advisorRows } = await client.query(
      "SELECT active FROM authorized_advisor WHERE id = $1",
      [args.advisorId],
    );
    const advisor = advisorRows[0];
    if (!advisor) throw new DomainError(`Advisor ${args.advisorId} not found`);
    if (!advisor.active) throw new DomainError(`Advisor ${args.advisorId} is not active`);

    const { rows } = await client.query(
      "SELECT status, shariah_verdict FROM compliance_review WHERE id = $1 FOR UPDATE",
      [reviewId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Compliance review not found");
    if (row.status !== "Pending") {
      throw new DomainError("Can only record a Shariah pre-check on a Pending review");
    }
    if (row.shariah_verdict != null) {
      throw new DomainError("Shariah pre-check already recorded for this review");
    }

    const { rows: updated } = await client.query(
      `UPDATE compliance_review
         SET shariah_verdict = $2, shariah_activities_screened = $3, shariah_prohibited_revenue_pct = $4,
             shariah_aaoifi_standards = $5, shariah_scholar_decision = $6, shariah_rationale = $7,
             shariah_screened_at = now(), updated_at = now()
         WHERE id = $1
         RETURNING id, shariah_verdict, shariah_screened_at`,
      [
        reviewId, args.verdict.verdict, JSON.stringify(args.verdict.activitiesScreened),
        args.verdict.prohibitedRevenuePct ?? null, JSON.stringify(args.verdict.aaoifiStandards),
        args.verdict.scholarDecision ?? null, args.verdict.rationale,
      ],
    );
    return updated[0];
  });
}
export const recordShariahPreCheck = withAuthorization(["advisor", "vetify"], recordShariahPreCheckImpl);

// ─── Choice: SupersedeShariahVerdict (vetify alone) ────────────────────────
// Post-hoc audit correction mirroring VerificationResult/ComplianceResult's
// own Supersede choices exactly, including the deliberate choice of
// controller vetify alone: advisor made the original call and should not
// unilaterally correct its own past decision. Usable regardless of
// ComplianceReview.status (a documented correction for the record, not a
// reversal of whatever already happened downstream). Nonconsuming in the
// Daml original -- the review row itself is field-replaced (design doc §3's
// "create this with" collapse rule), not archived.

async function supersedeShariahVerdictImpl(
  session: SessionContext,
  reviewId: number,
  args: { correctionRef: string; newVerdict: ShariahAssessmentArgs; reason: string; correctedBy: string },
) {
  if (!args.correctionRef) throw new DomainError("Correction reference must not be empty");
  if (!args.reason) throw new DomainError("Correction reason must not be empty");
  if (!args.correctedBy) throw new DomainError("correctedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM compliance_review WHERE id = $1 FOR UPDATE",
      [reviewId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Compliance review not found");
    if (row.shariah_verdict == null) {
      throw new DomainError("Cannot supersede a Shariah verdict that was never recorded");
    }

    const originalVerdict = {
      verdict: row.shariah_verdict,
      activitiesScreened: row.shariah_activities_screened ?? [],
      prohibitedRevenuePct: row.shariah_prohibited_revenue_pct != null ? Number(row.shariah_prohibited_revenue_pct) : null,
      aaoifiStandards: row.shariah_aaoifi_standards ?? [],
      scholarDecision: row.shariah_scholar_decision,
      rationale: row.shariah_rationale,
    };

    await client.query(
      `UPDATE compliance_review
         SET shariah_verdict = $2, shariah_activities_screened = $3, shariah_prohibited_revenue_pct = $4,
             shariah_aaoifi_standards = $5, shariah_scholar_decision = $6, shariah_rationale = $7,
             shariah_screened_at = now(), updated_at = now()
         WHERE id = $1`,
      [
        reviewId, args.newVerdict.verdict, JSON.stringify(args.newVerdict.activitiesScreened),
        args.newVerdict.prohibitedRevenuePct ?? null, JSON.stringify(args.newVerdict.aaoifiStandards),
        args.newVerdict.scholarDecision ?? null, args.newVerdict.rationale,
      ],
    );

    const { rows: correction } = await client.query(
      `INSERT INTO shariah_verdict_correction
         (compliance_review_id, business_name, cac_reg_number, compliance_ref, original_verdict,
          correction_ref, corrected_verdict, reason, corrected_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        reviewId, row.business_name, row.cac_reg_number, row.compliance_ref, JSON.stringify(originalVerdict),
        args.correctionRef, JSON.stringify(args.newVerdict), args.reason, args.correctedBy,
      ],
    );

    return { shariahVerdictCorrectionId: correction[0].id };
  });
}
export const supersedeShariahVerdict = withAuthorization(["vetify"], supersedeShariahVerdictImpl);

// ─── EDDCase (G14): OpenEddCase / UpdateEddChecklist / CloseEddCase ───────
// Phase 2, Seventeenth Slice. OpenEddCase is nonconsuming on ComplianceReview
// (does not itself change status -- the agent's FlagComplianceForManualReview
// call alongside it does that, same as the real Daml original). No requireActive*
// registry gate here -- OpenEddCase's real controller is vetify alone.

async function openEddCaseImpl(session: SessionContext, reviewId: number, args: { triggerReason: string }) {
  if (!args.triggerReason) throw new DomainError("Trigger reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT business_name, cac_reg_number FROM compliance_review WHERE id = $1",
      [reviewId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Compliance review not found");

    const { rows: created } = await client.query(
      `INSERT INTO edd_case (compliance_review_id, business_name, cac_reg_number, trigger_reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, status, opened_at`,
      [reviewId, row.business_name, row.cac_reg_number, args.triggerReason],
    );
    return created[0];
  });
}
export const openEddCase = withAuthorization(["vetify"], openEddCaseImpl);

interface UpdateEddChecklistArgs {
  sourceOfWealthVerified?: boolean | null;
  sourceOfWealthNote?: string | null;
  enhancedMediaSearchDone?: boolean | null;
  seniorManagementSignoff?: string | null;
  monitoringFrequency?: string | null;
}

async function updateEddChecklistImpl(session: SessionContext, eddCaseId: number, args: UpdateEddChecklistArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT status FROM edd_case WHERE id = $1 FOR UPDATE", [eddCaseId]);
    const row = rows[0];
    if (!row) throw new DomainError("EDD case not found");
    if (row.status !== "EddOpen") throw new DomainError("Can only update an Open EDD case");

    // Each arg is a partial update -- null/undefined keeps the existing
    // value, mirroring the Daml original's `case x of Some v -> v; None ->
    // checklist.x` per-field merge exactly.
    const { rows: updated } = await client.query(
      `UPDATE edd_case
         SET source_of_wealth_verified  = COALESCE($2, source_of_wealth_verified),
             source_of_wealth_note      = COALESCE($3, source_of_wealth_note),
             enhanced_media_search_done = COALESCE($4, enhanced_media_search_done),
             senior_management_signoff  = COALESCE($5, senior_management_signoff),
             monitoring_frequency       = COALESCE($6, monitoring_frequency)
         WHERE id = $1
         RETURNING id, source_of_wealth_verified, enhanced_media_search_done,
                   senior_management_signoff, monitoring_frequency`,
      [
        eddCaseId, args.sourceOfWealthVerified ?? null, args.sourceOfWealthNote ?? null,
        args.enhancedMediaSearchDone ?? null, args.seniorManagementSignoff ?? null, args.monitoringFrequency ?? null,
      ],
    );
    return updated[0];
  });
}
export const updateEddChecklist = withAuthorization(["verifier"], updateEddChecklistImpl);

async function closeEddCaseImpl(session: SessionContext, eddCaseId: number, args: { closedBy: string }) {
  if (!args.closedBy) throw new DomainError("closedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM edd_case WHERE id = $1 FOR UPDATE", [eddCaseId]);
    const row = rows[0];
    if (!row) throw new DomainError("EDD case not found");
    if (row.status !== "EddOpen") throw new DomainError("Can only close an Open EDD case");
    if (!row.source_of_wealth_verified) throw new DomainError("Source of wealth must be verified before closing");
    if (!row.enhanced_media_search_done) throw new DomainError("Enhanced media search must be done before closing");
    if (row.senior_management_signoff == null) throw new DomainError("Senior management sign-off is required before closing");
    if (row.monitoring_frequency == null) throw new DomainError("Ongoing monitoring frequency must be set before closing");

    const { rows: updated } = await client.query(
      `UPDATE edd_case SET status = 'EddClosed', closed_at = now(), closed_by = $2 WHERE id = $1 RETURNING id, status, closed_at`,
      [eddCaseId, args.closedBy],
    );
    return updated[0];
  });
}
export const closeEddCase = withAuthorization(["verifier"], closeEddCaseImpl);

export async function listEddCases(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM edd_case ORDER BY opened_at DESC");
    return rows;
  });
}

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
  // Sixteenth Slice: mandatory in the real Daml choice signature (not
  // Optional) -- see migrations/019's header.
  reviewerAuthId: number;
  // Seventeenth Slice (G14): Optional in the real Daml choice -- None for
  // the vast majority of reviews where OpenEddCase was never exercised.
  eddCaseId?: number | null;
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

    // The officer must be in the authorized reviewer registry -- checked
    // inline against this same transaction, not governance.ts's own
    // withTransaction-wrapped helpers, per the Ninth Slice's atomicity rule.
    const { rows: reviewerRows } = await client.query(
      "SELECT archived_at FROM authorized_reviewer WHERE id = $1",
      [args.reviewerAuthId],
    );
    const reviewer = reviewerRows[0];
    if (!reviewer) throw new DomainError("AuthorizedReviewer not found");
    if (reviewer.archived_at) throw new DomainError("Reviewer is not active");

    // G14 hard gate (Seventeenth Slice): a PEP hit's EDD case must be
    // Closed (every checklist item complete) before approval -- None is
    // fine for the vast majority of reviews where OpenEddCase was never
    // exercised at all.
    if (args.eddCaseId != null) {
      const { rows: eddRows } = await client.query(
        "SELECT compliance_review_id, status FROM edd_case WHERE id = $1",
        [args.eddCaseId],
      );
      const eddCase = eddRows[0];
      if (!eddCase) throw new DomainError("EDD case not found");
      // compliance_review_id is a BIGINT column -- node-postgres returns it
      // as a string. reviewId itself also arrives as a string at runtime
      // here despite its `number` type annotation (every caller passes an
      // id straight from a prior RETURNING id, same as everywhere else in
      // this codebase) -- so both sides must be coerced with Number(...)
      // before comparing, not just one (the same class of gotcha this
      // migration has hit and re-documented several times already).
      if (Number(eddCase.compliance_review_id) !== Number(reviewId)) {
        throw new DomainError("EDD case is for a different compliance review");
      }
      if (eddCase.status !== "EddClosed") {
        throw new DomainError("EDD case must be Closed before approval");
      }
    }

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
          compliance_ref, outcome, checks, risk_score, risk_level, auto_decided, reviewed_by, decided_at)
       VALUES ($1, $2, $3, $4, $5, 'Approved', $6, $7, $8, $9, $10, now())
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
        args.reviewedBy ?? null,
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
  reviewerAuthId: number;
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

    const { rows: reviewerRows } = await client.query(
      "SELECT archived_at FROM authorized_reviewer WHERE id = $1",
      [args.reviewerAuthId],
    );
    const reviewer = reviewerRows[0];
    if (!reviewer) throw new DomainError("AuthorizedReviewer not found");
    if (reviewer.archived_at) throw new DomainError("Reviewer is not active");

    const { rows: cr } = await client.query(
      `INSERT INTO compliance_result
         (compliance_review_id, cac_reg_number, business_name, verification_ref,
          compliance_ref, outcome, checks, risk_score, risk_level, auto_decided, reason, reviewed_by, decided_at)
       VALUES ($1, $2, $3, $4, $5, 'Rejected', $6, $7, $8, $9, $10, $11, now())
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
        args.reviewedBy ?? null,
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

// ─── Choice: Supersede on ComplianceResult (vetify) ────────────────────────
// Phase 2, Twenty-First Slice. Nonconsuming in the real Daml ("both the
// original and the correction coexist for a full audit trail") -- unlike
// VerificationResult's own Supersede (consuming), so this one never
// archives compliance_result, only inserts the correction row. Real
// maker-checker: "the corrector cannot be the same as the original human
// reviewer" -- now enforceable now that reviewed_by is actually persisted
// (see this slice's migration header for why it wasn't before).

interface SupersedeComplianceResultArgs {
  correctionRef: string;
  correctedOutcome: "Approved" | "Rejected";
  reason: string;
  correctedBy: string;
}

async function supersedeComplianceResultImpl(
  session: SessionContext,
  complianceResultId: number,
  args: SupersedeComplianceResultArgs,
) {
  if (!args.correctionRef) throw new DomainError("correctionRef must not be empty");
  if (!args.reason) throw new DomainError("Reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM compliance_result WHERE id = $1 FOR UPDATE",
      [complianceResultId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Compliance result not found");
    if (row.reviewed_by != null && args.correctedBy === row.reviewed_by) {
      throw new DomainError("Corrector cannot be the same as the original human reviewer");
    }

    const { rows: created } = await client.query(
      `INSERT INTO compliance_correction
         (compliance_result_id, business_name, cac_reg_number, verification_ref, original_compliance_ref,
          original_outcome, correction_ref, corrected_outcome, reason, corrected_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        complianceResultId, row.business_name, row.cac_reg_number, row.verification_ref, row.compliance_ref,
        row.outcome, args.correctionRef, args.correctedOutcome, args.reason, args.correctedBy,
      ],
    );

    return { complianceCorrectionId: created[0].id };
  });
}
export const supersedeComplianceResult = withAuthorization(["vetify"], supersedeComplianceResultImpl);

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

// ─── Choice: Revoke (ApprovedBusiness, vetify) ─────────────────────────────
// Phase 2, Thirty-Fourth Slice (Batch E). Consuming -- archives
// ApprovedBusiness, creates an immutable RevocationRecord. Same
// archive-with-successor shape as every other decline/withdraw/cancel
// choice in this migration.

async function revokeBusinessImpl(session: SessionContext, approvedBusinessId: number, args: { reason: string; revokedBy: string }) {
  if (!args.reason) throw new DomainError("Reason must not be empty");
  if (!args.revokedBy) throw new DomainError("revokedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM approved_business WHERE id = $1 FOR UPDATE", [approvedBusinessId]);
    const business = rows[0];
    if (!business) throw new DomainError("ApprovedBusiness not found");
    if (business.archived_at) throw new DomainError("ApprovedBusiness is no longer active");

    const { rows: created } = await client.query(
      `INSERT INTO revocation_record
         (approved_business_id, cac_reg_number, business_name, verification_ref, compliance_ref, reason, revoked_by, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       RETURNING id`,
      [approvedBusinessId, business.cac_reg_number, business.business_name, business.verification_ref, business.compliance_ref, args.reason, args.revokedBy],
    );
    const revocationRecordId = created[0].id;

    await client.query(
      `UPDATE approved_business SET archived_at = now(), superseded_by_kind = 'revocation_record', superseded_by_id = $2 WHERE id = $1`,
      [approvedBusinessId, revocationRecordId],
    );
    return { revocationRecordId };
  });
}
export const revokeBusiness = withAuthorization(["vetify"], revokeBusinessImpl);

export async function listRevocationRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM revocation_record ORDER BY created_at DESC`);
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
