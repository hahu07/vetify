import type { SessionContext } from "@/lib/db";
import { withTransaction } from "@/lib/db";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { DomainError } from "@/lib/errors";
import type { FinancingTerms, RiskAssessment, RiskLevel } from "@/lib/types-financing";
import type { AssetDetails } from "@/lib/types-murabahah";

// Phase 2, Stage 5-7 (Financing) -- ported from daml/Vetify/Financing.daml
// and Compliance.daml's ApprovedBusiness.RequestFinancing. See
// migrations/005_financing_stage5_7.sql's header for what's deliberately
// deferred (AssignAssessor, Withdraw/Expire/Cancel/ProposeAmendment,
// UnderwritingPolicy, OverrideUnderwriting/IssueCorrection,
// RecordGovernanceAssessment) and how ApproveFunding is simplified (no
// MurabahahWad/ApprovedProvider/AuthorizedOfficer -- the Murabahah module
// and Governance registries are both out of scope for this pass).

const PENDING_UNDERWRITING_STATUSES = ["Submitted", "UnderwritingManualReview"];
const OPEN_FINANCING_STATUSES = ["Submitted", "Underwriting"];

// ─── UnderwritingPolicy (vetify-wide singleton; create + UpdatePolicy) ────
// Phase 2, Thirty-Fifth Slice -- the last item from the original template
// survey. See migrations/036's header for why this has no maker-checker
// layer (unlike VerificationPolicy/CompliancePolicy) and why it's a
// singleton rather than per-institution.

interface UnderwritingPolicyArgs {
  policyVersion: string;
  autoApproveMin: number;
  autoRejectMax: number;
  minDscrRatio?: number | null;
  minLoanAmount?: number | null;
  maxLoanAmount?: number | null;
  indicativeProfitMarginPct?: number | null;
  requestSlaHours: number;
  offerValidityDays: number;
  effectiveFrom: string;
  writeOffThresholdAmount?: number | null;
  maxRestructuringsPerFacility?: number | null;
  permittedSectors?: string[] | null;
  requiredCollateralTypes?: string[];
  maxSectorConcentrationPct?: number | null;
  scoringWeights: Record<string, number>;
}

function validateUnderwritingPolicyFields(args: UnderwritingPolicyArgs): void {
  if (!args.policyVersion) throw new DomainError("policyVersion must not be empty");
  if (!(args.autoApproveMin > args.autoRejectMax)) throw new DomainError("autoApproveMin must exceed autoRejectMax");
  if (!(args.requestSlaHours > 0)) throw new DomainError("requestSlaHours must be positive");
  if (!(args.offerValidityDays > 0)) throw new DomainError("offerValidityDays must be positive");
  if (args.minLoanAmount != null && args.maxLoanAmount != null && args.minLoanAmount > args.maxLoanAmount) {
    throw new DomainError("minLoanAmount must not exceed maxLoanAmount");
  }
}

async function createUnderwritingPolicyImpl(session: SessionContext, args: UnderwritingPolicyArgs) {
  validateUnderwritingPolicyFields(args);
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `INSERT INTO underwriting_policy
         (policy_version, auto_approve_min, auto_reject_max, min_dscr_ratio, min_loan_amount, max_loan_amount,
          indicative_profit_margin_pct, request_sla_hours, offer_validity_days, effective_from,
          write_off_threshold_amount, max_restructurings_per_facility, permitted_sectors,
          required_collateral_types, max_sector_concentration_pct, scoring_weights)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        args.policyVersion, args.autoApproveMin, args.autoRejectMax, args.minDscrRatio ?? null,
        args.minLoanAmount ?? null, args.maxLoanAmount ?? null, args.indicativeProfitMarginPct ?? null,
        args.requestSlaHours, args.offerValidityDays, args.effectiveFrom, args.writeOffThresholdAmount ?? null,
        args.maxRestructuringsPerFacility ?? null, args.permittedSectors ? JSON.stringify(args.permittedSectors) : null,
        JSON.stringify(args.requiredCollateralTypes ?? []), args.maxSectorConcentrationPct ?? null,
        JSON.stringify(args.scoringWeights),
      ],
    );
    return { underwritingPolicyId: rows[0].id };
  });
}
export const createUnderwritingPolicy = withAuthorization(["vetify"], createUnderwritingPolicyImpl);

async function updateUnderwritingPolicyImpl(session: SessionContext, policyId: number, args: UnderwritingPolicyArgs) {
  validateUnderwritingPolicyFields(args);
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT id FROM underwriting_policy WHERE id = $1 FOR UPDATE", [policyId]);
    if (!rows[0]) throw new DomainError("UnderwritingPolicy not found");

    const { rows: updated } = await client.query(
      `UPDATE underwriting_policy
         SET policy_version = $2, auto_approve_min = $3, auto_reject_max = $4, min_dscr_ratio = $5,
             min_loan_amount = $6, max_loan_amount = $7, indicative_profit_margin_pct = $8,
             request_sla_hours = $9, offer_validity_days = $10, effective_from = $11,
             write_off_threshold_amount = $12, max_restructurings_per_facility = $13, permitted_sectors = $14,
             required_collateral_types = $15, max_sector_concentration_pct = $16, scoring_weights = $17,
             effective_to = NULL, updated_at = now()
         WHERE id = $1
         RETURNING id`,
      [
        policyId, args.policyVersion, args.autoApproveMin, args.autoRejectMax, args.minDscrRatio ?? null,
        args.minLoanAmount ?? null, args.maxLoanAmount ?? null, args.indicativeProfitMarginPct ?? null,
        args.requestSlaHours, args.offerValidityDays, args.effectiveFrom, args.writeOffThresholdAmount ?? null,
        args.maxRestructuringsPerFacility ?? null, args.permittedSectors ? JSON.stringify(args.permittedSectors) : null,
        JSON.stringify(args.requiredCollateralTypes ?? []), args.maxSectorConcentrationPct ?? null,
        JSON.stringify(args.scoringWeights),
      ],
    );
    return { underwritingPolicyId: updated[0].id };
  });
}
export const updateUnderwritingPolicy = withAuthorization(["vetify"], updateUnderwritingPolicyImpl);

export async function listUnderwritingPolicies(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM underwriting_policy ORDER BY created_at DESC`);
    return rows;
  });
}

/** Mirrors resolveUnderwritingPolicy: fetches the active policy (if any) and
 * enforces its gates. Returns the snapshot + computed SLA expiry, or
 * (null, null) when no policy is active -- exactly the real Daml's `None ->
 * return (None, None)` backward-compatible fallback. */
async function resolveUnderwritingPolicy(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  autoDecided: boolean,
  assessment: RiskAssessment,
  requestedAmount: number,
  businessSector: string,
): Promise<{ snapshot: Record<string, unknown> | null; expiresAt: string | null }> {
  const { rows } = await client.query(
    `SELECT * FROM underwriting_policy WHERE effective_to IS NULL ORDER BY created_at DESC LIMIT 1`,
  );
  const policy = rows[0];
  if (!policy) return { snapshot: null, expiresAt: null };

  if (!(new Date(policy.effective_from as string).getTime() <= Date.now())) {
    throw new DomainError("UnderwritingPolicy is not yet effective");
  }
  if (autoDecided && !(assessment.score >= (policy.auto_approve_min as number))) {
    throw new DomainError(`Agent auto-decision requires score >= ${policy.auto_approve_min}`);
  }
  if (policy.max_loan_amount != null && !(requestedAmount <= Number(policy.max_loan_amount))) {
    throw new DomainError("Requested amount exceeds policy maximum loan amount");
  }
  if (policy.min_loan_amount != null && !(requestedAmount >= Number(policy.min_loan_amount))) {
    throw new DomainError("Requested amount is below policy minimum loan amount");
  }
  if (policy.permitted_sectors != null && !(policy.permitted_sectors as string[]).includes(businessSector)) {
    throw new DomainError("Business sector is not permitted under this institution's lending policy");
  }

  const snapshot = {
    policyVersion: policy.policy_version,
    autoApproveMin: policy.auto_approve_min,
    autoRejectMax: policy.auto_reject_max,
    minDscrRatio: policy.min_dscr_ratio,
    minLoanAmount: policy.min_loan_amount,
    maxLoanAmount: policy.max_loan_amount,
    indicativeProfitMarginPct: policy.indicative_profit_margin_pct,
    requestSlaHours: policy.request_sla_hours,
    offerValidityDays: policy.offer_validity_days,
    effectiveFrom: policy.effective_from,
    capturedAt: new Date().toISOString(),
    scoringWeights: policy.scoring_weights,
  };
  const expiresAt = new Date(Date.now() + Number(policy.request_sla_hours) * 60 * 60 * 1000).toISOString();
  return { snapshot, expiresAt };
}

// ─── Choice: RequestFinancing (business, on ApprovedBusiness) ─────────────

interface RequestFinancingArgs {
  terms: FinancingTerms;
  financingRef: string;
  businessSector: string;
  verificationRef?: string | null;
  complianceRef?: string | null;
}

async function requestFinancingImpl(session: SessionContext, args: RequestFinancingArgs) {
  return withTransaction(session, async (client) => {
    if (args.terms.amount <= 0) throw new DomainError("Financing amount must be positive");
    if (args.terms.tenureMonths <= 0) throw new DomainError("Tenure must be positive");
    if (!args.financingRef) throw new DomainError("financingRef must not be empty");
    if (!args.businessSector) throw new DomainError("businessSector must not be empty");

    const { rows } = await client.query(
      `SELECT * FROM approved_business WHERE cac_reg_number = $1 AND archived_at IS NULL`,
      [session.cacRegNumber],
    );
    const business = rows[0];
    if (!business) throw new DomainError("No active approved business found for this CAC number");
    if (business.status !== "BusinessActive") {
      throw new DomainError("Business must be Active to request financing");
    }

    const { rows: inserted } = await client.query(
      `INSERT INTO financing_request
         (cac_reg_number, business_name, terms_amount, terms_purpose, terms_tenure_months,
          financing_ref, verification_ref, compliance_ref, submitted_at, business_sector,
          incorporation_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9, $10)
       RETURNING id, status`,
      [
        session.cacRegNumber,
        business.business_name,
        args.terms.amount,
        args.terms.purpose,
        args.terms.tenureMonths,
        args.financingRef,
        args.verificationRef ?? business.verification_ref,
        args.complianceRef ?? business.compliance_ref,
        args.businessSector,
        business.incorporation_date,
      ],
    );
    return inserted[0];
  });
}
export const requestFinancing = withAuthorization(["business"], requestFinancingImpl);

// ─── Choice: BeginUnderwriting (assessor, vetify dual-controller) ─────────

interface BeginUnderwritingArgs {
  assessment: RiskAssessment;
  autoDecided: boolean;
}

async function beginUnderwritingImpl(session: SessionContext, financingRequestId: number, args: BeginUnderwritingArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM financing_request WHERE id = $1 FOR UPDATE",
      [financingRequestId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Financing request not found");
    if (!PENDING_UNDERWRITING_STATUSES.includes(row.status)) {
      throw new DomainError("Can only begin underwriting from Submitted or UnderwritingManualReview");
    }
    if (args.assessment.score < 0 || args.assessment.score > 100) {
      throw new DomainError("assessment.score must be between 0 and 100");
    }
    const inRange01 = (v?: number | null) => v == null || (v >= 0 && v <= 100);
    if (!inRange01(args.assessment.behaviouralScore)) {
      throw new DomainError("assessment.behaviouralScore must be between 0 and 100");
    }
    if (!inRange01(args.assessment.cashflowRiskScore)) {
      throw new DomainError("assessment.cashflowRiskScore must be between 0 and 100");
    }
    if (!inRange01(args.assessment.creditworthinessScore)) {
      throw new DomainError("assessment.creditworthinessScore must be between 0 and 100");
    }
    if (!inRange01(args.assessment.fraudScore)) {
      throw new DomainError("assessment.fraudScore must be between 0 and 100");
    }
    if (args.autoDecided && args.assessment.riskCategory === "High") {
      throw new DomainError("High-risk assessments cannot be auto-decided; human review required");
    }

    // Look up the active policy to capture a snapshot and compute the SLA
    // expiry -- mirrors resolveUnderwritingPolicy exactly; a no-policy
    // system behaves identically to before this slice.
    const { snapshot, expiresAt } = await resolveUnderwritingPolicy(
      client, args.autoDecided, args.assessment, Number(row.terms_amount), row.business_sector,
    );

    await client.query(
      `UPDATE financing_request SET status = 'Underwriting', expires_at = $2, updated_at = now() WHERE id = $1`,
      [financingRequestId, expiresAt],
    );

    const { rows: result } = await client.query(
      `INSERT INTO underwriting_result
         (financing_request_id, cac_reg_number, business_name, financing_ref, assessment_score,
          assessment_risk_category, assessment_recommended_limit, assessment_recommendation,
          assessment_probability_of_default, assessment_loss_given_default, assessment_exposure_at_default,
          assessment_behavioural_score, assessment_cashflow_risk_score, assessment_creditworthiness_score,
          assessment_fraud_score, auto_decided, underwriting_started_at, valid_until, policy_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), $17, $18)
       RETURNING id`,
      [
        financingRequestId,
        row.cac_reg_number,
        row.business_name,
        row.financing_ref,
        args.assessment.score,
        args.assessment.riskCategory,
        args.assessment.recommendedLimit,
        args.assessment.recommendation,
        args.assessment.probabilityOfDefault ?? null,
        args.assessment.lossGivenDefault ?? null,
        args.assessment.exposureAtDefault ?? null,
        args.assessment.behaviouralScore ?? null,
        args.assessment.cashflowRiskScore ?? null,
        args.assessment.creditworthinessScore ?? null,
        args.assessment.fraudScore ?? null,
        args.autoDecided,
        expiresAt,
        snapshot ? JSON.stringify(snapshot) : null,
      ],
    );
    return { underwritingResultId: result[0].id };
  });
}
export const beginUnderwriting = withAuthorization(["assessor", "vetify"], beginUnderwritingImpl);

// ─── Choice: FlagUnderwritingForManualReview (vetify) ──────────────────────

async function flagUnderwritingForManualReviewImpl(
  session: SessionContext,
  financingRequestId: number,
  args: { riskScore: number; riskLevel: RiskLevel; agentVersion: string; note: string },
) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT status FROM financing_request WHERE id = $1 FOR UPDATE",
      [financingRequestId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Financing request not found");
    if (row.status !== "Submitted") {
      throw new DomainError("Can only flag from Submitted");
    }
    if (args.riskScore < 0 || args.riskScore > 100) {
      throw new DomainError("Risk score must be 0-100");
    }
    // If a policy is active, this institution's own Medium band must be
    // respected -- mirrors resolveUnderwritingPolicy's band check; a
    // no-policy system skips this, unchanged from before this slice.
    const { rows: policyRows } = await client.query(
      `SELECT auto_approve_min, auto_reject_max FROM underwriting_policy WHERE effective_to IS NULL ORDER BY created_at DESC LIMIT 1`,
    );
    const policy = policyRows[0];
    if (policy && !(args.riskScore > policy.auto_reject_max && args.riskScore < policy.auto_approve_min)) {
      throw new DomainError("Risk score is outside the Medium band for this institution's policy");
    }
    const { rows: updated } = await client.query(
      `UPDATE financing_request
         SET status = 'UnderwritingManualReview', agent_score = $2, agent_risk = $3,
             agent_note = $4, agent_version = $5, updated_at = now()
         WHERE id = $1
         RETURNING id, status`,
      [financingRequestId, args.riskScore, args.riskLevel, args.note, args.agentVersion],
    );
    return updated[0];
  });
}
export const flagUnderwritingForManualReview = withAuthorization(["vetify"], flagUnderwritingForManualReviewImpl);

// ─── Choice: RejectUnderwriting (assessor, vetify dual-controller) ────────

interface RejectUnderwritingArgs {
  reason: string;
  autoDecided: boolean;
  reviewerParty?: string | null;
  reviewedBy?: string | null;
  assessment?: RiskAssessment | null;
}

async function rejectUnderwritingImpl(session: SessionContext, financingRequestId: number, args: RejectUnderwritingArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM financing_request WHERE id = $1 FOR UPDATE",
      [financingRequestId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Financing request not found");
    if (!PENDING_UNDERWRITING_STATUSES.includes(row.status)) {
      throw new DomainError("Can only reject underwriting from Submitted or UnderwritingManualReview");
    }
    if (!args.reason) throw new DomainError("Rejection reason must not be empty");
    if (!args.autoDecided && !args.reviewerParty) {
      throw new DomainError("Human decisions require a reviewer party (reviewerParty)");
    }
    if (args.assessment && args.autoDecided && args.assessment.riskCategory !== "High") {
      throw new DomainError("Auto-decided rejection requires a High-risk assessment");
    }

    await client.query(
      `UPDATE financing_request
         SET status = 'FinancingRejected', archived_at = now(), updated_at = now()
         WHERE id = $1`,
      [financingRequestId],
    );

    const { rows: rejection } = await client.query(
      `INSERT INTO underwriting_rejection
         (financing_request_id, cac_reg_number, business_name, financing_ref, reason,
          auto_decided, reviewer_party, reviewed_by, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       RETURNING id`,
      [
        financingRequestId,
        row.cac_reg_number,
        row.business_name,
        row.financing_ref,
        args.reason,
        args.autoDecided,
        args.reviewerParty ?? null,
        args.reviewedBy ?? null,
      ],
    );
    return { underwritingRejectionId: rejection[0].id };
  });
}
export const rejectUnderwriting = withAuthorization(["assessor", "vetify"], rejectUnderwritingImpl);

// ─── Choice: IssueCorrection on UnderwritingResult (vetify) ────────────────
// Phase 2, Twenty-First Slice. Nonconsuming in the real Daml ("the original
// result is preserved for audit") -- mirrors ComplianceResult.Supersede's
// shape, not VerificationResult.Supersede's (no archival here). No
// maker-checker check in the real Daml body (unlike ComplianceResult's),
// confirmed by reading the source directly rather than assumed symmetric
// with the other two.

interface IssueUnderwritingCorrectionArgs {
  correctedAssessment: RiskAssessment;
  correctionRef: string;
  correctedOutcome: string;
  reason: string;
  correctedBy: string;
}

async function issueUnderwritingCorrectionImpl(
  session: SessionContext,
  underwritingResultId: number,
  args: IssueUnderwritingCorrectionArgs,
) {
  if (!args.correctionRef) throw new DomainError("Correction reference must not be empty");
  if (!args.reason) throw new DomainError("Reason must not be empty");
  if (!args.correctedBy) throw new DomainError("correctedBy must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM underwriting_result WHERE id = $1 FOR UPDATE",
      [underwritingResultId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Underwriting result not found");

    const originalAssessment: RiskAssessment = {
      score: row.assessment_score,
      riskCategory: row.assessment_risk_category,
      recommendedLimit: Number(row.assessment_recommended_limit),
      recommendation: row.assessment_recommendation,
      probabilityOfDefault: row.assessment_probability_of_default != null ? Number(row.assessment_probability_of_default) : null,
      lossGivenDefault: row.assessment_loss_given_default != null ? Number(row.assessment_loss_given_default) : null,
      exposureAtDefault: row.assessment_exposure_at_default != null ? Number(row.assessment_exposure_at_default) : null,
      behaviouralScore: row.assessment_behavioural_score,
      cashflowRiskScore: row.assessment_cashflow_risk_score,
      creditworthinessScore: row.assessment_creditworthiness_score,
      fraudScore: row.assessment_fraud_score,
    };

    const { rows: created } = await client.query(
      `INSERT INTO underwriting_correction
         (underwriting_result_id, business_name, cac_reg_number, financing_ref, original_assessment,
          corrected_assessment, correction_ref, corrected_outcome, reason, corrected_by, previous_auto_decided)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        underwritingResultId, row.business_name, row.cac_reg_number, row.financing_ref,
        JSON.stringify(originalAssessment), JSON.stringify(args.correctedAssessment),
        args.correctionRef, args.correctedOutcome, args.reason, args.correctedBy, row.auto_decided,
      ],
    );

    return { underwritingCorrectionId: created[0].id };
  });
}
export const issueUnderwritingCorrection = withAuthorization(["vetify"], issueUnderwritingCorrectionImpl);

// ─── Choice: ApproveFunding (financialInstitution) ─────────────────────────
// Stage 0/Governance gates wired in (previously deferred -- see
// migrations/016's header and the design doc's Eleventh Slice entry): the
// real Daml choice fetches `approvedProviderCid` and asserts Murabahah is
// in its approvedInstruments, then calls `requireActiveOfficer` for a
// registered, active CreditOfficer and checks that officer's approvalLimit.
// Both checks are done inline against the *same* `client`/transaction this
// function already holds -- not via governance.ts's `requireActiveOfficerWithRole`,
// which opens its own withTransaction -- per the atomicity lesson recorded
// in the design doc's Ninth Slice entry (a helper meant to compose inside
// an existing transaction must take a client, not open its own).
//
// Still deferred, named explicitly rather than silently skipped: the
// maker-checker "approver != assessor" check (Daml's `assessorName` arg) --
// financing_request has no column recording who ran BeginUnderwriting by
// name, so there is nothing to compare `approvedByName` against yet; this
// system's single-FI-tenant simplification also means `ap.financialInstitution
// == financialInstitution` has no column to check against (approved_provider
// carries no per-row tenant party here, same simplification every other
// FI-facing table in this migration already makes); `offerExpiresAt`,
// `approvalSignature`, `decisionDocuments` (evidence/signature fields, no
// UI or storage layer for them yet).

interface ApproveFundingArgs {
  assetDetails: AssetDetails;
  approvedProviderId: number;
  approvingOfficerId: string;
  approvedByName?: string | null;
  reasonCode?: string | null;
  decisionFactors?: string[];
}

async function approveFundingImpl(session: SessionContext, financingRequestId: number, args: ApproveFundingArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM financing_request WHERE id = $1 FOR UPDATE",
      [financingRequestId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Financing request not found");
    if (row.status !== "Underwriting") {
      throw new DomainError("Can only approve from Underwriting");
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      throw new DomainError("Underwriting assessment has expired — re-underwriting required");
    }
    if (args.assetDetails.estimatedCost <= 0) {
      throw new DomainError("assetDetails.estimatedCost must be positive");
    }

    // Stage 0 gate: the FI must be onboarded and approved for Murabahah financing.
    const { rows: providerRows } = await client.query(
      "SELECT approved_instruments FROM approved_provider WHERE id = $1",
      [args.approvedProviderId],
    );
    const provider = providerRows[0];
    if (!provider) throw new DomainError("ApprovedProvider not found");
    const approvedInstruments: string[] = provider.approved_instruments ?? [];
    if (!approvedInstruments.includes("Murabahah")) {
      throw new DomainError("Financial institution is not approved to offer Murabahah financing");
    }

    // The approving officer must be a registered, active CreditOfficer.
    const { rows: officerRows } = await client.query(
      "SELECT officer_name, roles, active, approval_limit FROM authorized_officer WHERE officer_id = $1",
      [args.approvingOfficerId],
    );
    const officer = officerRows[0];
    if (!officer) throw new DomainError(`Officer ${args.approvingOfficerId} not found`);
    if (!officer.active) throw new DomainError(`Officer ${args.approvingOfficerId} is not active`);
    const officerRoles: string[] = officer.roles ?? [];
    if (!officerRoles.includes("CreditOfficer")) {
      throw new DomainError(`Officer ${args.approvingOfficerId} does not hold the required role`);
    }
    if (args.approvedByName != null && args.approvedByName !== officer.officer_name) {
      throw new DomainError("approvedByName does not match the registered officer");
    }
    // NUMERIC columns arrive as strings from node-postgres (addendum A) --
    // both sides must be coerced before comparing, same numifyWeights-class
    // gotcha this migration has hit and re-documented several times before.
    if (officer.approval_limit != null && Number(row.terms_amount) > Number(officer.approval_limit)) {
      throw new DomainError("Financing amount exceeds officer's approval limit");
    }

    await client.query(
      `UPDATE financing_request
         SET status = 'FinancingApproved', archived_at = now(), updated_at = now()
         WHERE id = $1`,
      [financingRequestId],
    );

    const { rows: decision } = await client.query(
      `INSERT INTO financing_decision
         (financing_request_id, cac_reg_number, business_name, financing_ref, outcome,
          decided_at, decided_by_name, reason_code, decision_factors)
       VALUES ($1, $2, $3, $4, 'FinancingApproved', now(), $5, $6, $7)
       RETURNING id`,
      [
        financingRequestId,
        row.cac_reg_number,
        row.business_name,
        row.financing_ref,
        args.approvedByName ?? null,
        args.reasonCode ?? null,
        JSON.stringify(args.decisionFactors ?? []),
      ],
    );

    const { rows: wad } = await client.query(
      `INSERT INTO murabahah_wad
         (financing_request_id, cac_reg_number, business_name, terms_amount, terms_purpose,
          terms_tenure_months, asset_description, asset_supplier, asset_supplier_ref,
          asset_estimated_cost, financing_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        financingRequestId,
        row.cac_reg_number,
        row.business_name,
        row.terms_amount,
        row.terms_purpose,
        row.terms_tenure_months,
        args.assetDetails.description,
        args.assetDetails.supplier,
        args.assetDetails.supplierRef,
        args.assetDetails.estimatedCost,
        row.financing_ref,
      ],
    );

    return { financingDecisionId: decision[0].id, murabahahWadId: wad[0].id };
  });
}
export const approveFunding = withAuthorization(["financialInstitution"], approveFundingImpl);

// ─── Choice: RejectFunding (financialInstitution) ──────────────────────────

interface RejectFundingArgs {
  reason: string;
  rejectedByName?: string | null;
  reasonCode?: string | null;
  decisionFactors?: string[];
}

async function rejectFundingImpl(session: SessionContext, financingRequestId: number, args: RejectFundingArgs) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM financing_request WHERE id = $1 FOR UPDATE",
      [financingRequestId],
    );
    const row = rows[0];
    if (!row) throw new DomainError("Financing request not found");
    if (!OPEN_FINANCING_STATUSES.includes(row.status)) {
      throw new DomainError("Can only reject from Submitted or Underwriting");
    }
    if (!args.reason) throw new DomainError("Rejection reason must not be empty");

    await client.query(
      `UPDATE financing_request
         SET status = 'FinancingRejected', archived_at = now(), updated_at = now()
         WHERE id = $1`,
      [financingRequestId],
    );

    const { rows: decision } = await client.query(
      `INSERT INTO financing_decision
         (financing_request_id, cac_reg_number, business_name, financing_ref, outcome, reason,
          decided_at, decided_by_name, reason_code, decision_factors)
       VALUES ($1, $2, $3, $4, 'FinancingRejected', $5, now(), $6, $7, $8)
       RETURNING id`,
      [
        financingRequestId,
        row.cac_reg_number,
        row.business_name,
        row.financing_ref,
        args.reason,
        args.rejectedByName ?? null,
        args.reasonCode ?? null,
        JSON.stringify(args.decisionFactors ?? []),
      ],
    );
    return { financingDecisionId: decision[0].id };
  });
}
export const rejectFunding = withAuthorization(["financialInstitution"], rejectFundingImpl);

// ─── Reads ──────────────────────────────────────────────────────────────

export async function listFinancingRequests(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM financing_request WHERE archived_at IS NULL ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function listUnderwritingResults(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM underwriting_result ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listUnderwritingRejections(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM underwriting_rejection ORDER BY created_at DESC`);
    return rows;
  });
}

export async function listFinancingDecisions(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM financing_decision ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Phase 2, Thirty-Second Slice: Batch C (Withdraw/Expire/Cancel/Amend) ──
// WithdrawRequest/ExpireRequest/CancelRequest are all consuming -- the same
// archive-with-successor shape this migration has used since the Second
// Slice. ProposeAmendment is nonconsuming; AcceptAmendment is the same
// keyless field-replace shape as ProceedWithReplacement/Revalue.

// ─── Choice: WithdrawRequest (FinancingRequest, business) ──────────────────

async function withdrawRequestImpl(session: SessionContext, requestId: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Withdrawal reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM financing_request WHERE id = $1 FOR UPDATE", [requestId]);
    const request = rows[0];
    if (!request) throw new DomainError("Financing request not found");
    if (request.archived_at || !OPEN_FINANCING_STATUSES.includes(request.status)) {
      throw new DomainError("Can only withdraw a Submitted or Underwriting request");
    }

    const { rows: created } = await client.query(
      `INSERT INTO withdrawal_record (financing_request_id, cac_reg_number, business_name, financing_ref, reason, withdrawn_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id`,
      [requestId, request.cac_reg_number, request.business_name, request.financing_ref, args.reason],
    );
    const withdrawalRecordId = created[0].id;

    await client.query(
      `UPDATE financing_request SET archived_at = now(), superseded_by_kind = 'withdrawal_record', superseded_by_id = $2 WHERE id = $1`,
      [requestId, withdrawalRecordId],
    );
    return { withdrawalRecordId };
  });
}
export const withdrawRequest = withAuthorization(["business"], withdrawRequestImpl);

export async function listWithdrawalRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM withdrawal_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: ExpireRequest / CancelRequest (FinancingRequest, vetify) ──────

async function expireRequestImpl(session: SessionContext, requestId: number, args: { reason: string }) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM financing_request WHERE id = $1 FOR UPDATE", [requestId]);
    const request = rows[0];
    if (!request) throw new DomainError("Financing request not found");
    if (request.archived_at || !OPEN_FINANCING_STATUSES.includes(request.status)) {
      throw new DomainError("Can only expire a Submitted or Underwriting request");
    }
    if (!request.expires_at) throw new DomainError("No SLA expiry configured on this request");
    if (!(new Date(request.expires_at).getTime() < Date.now())) {
      throw new DomainError("Request SLA has not yet elapsed");
    }

    const { rows: created } = await client.query(
      `INSERT INTO request_closure_record (financing_request_id, cac_reg_number, business_name, financing_ref, outcome, reason, closed_at)
       VALUES ($1, $2, $3, $4, 'Expired', $5, now())
       RETURNING id`,
      [requestId, request.cac_reg_number, request.business_name, request.financing_ref, args.reason ?? null],
    );
    const requestClosureRecordId = created[0].id;

    await client.query(
      `UPDATE financing_request SET archived_at = now(), superseded_by_kind = 'request_closure_record', superseded_by_id = $2 WHERE id = $1`,
      [requestId, requestClosureRecordId],
    );
    return { requestClosureRecordId };
  });
}
export const expireRequest = withAuthorization(["vetify"], expireRequestImpl);

async function cancelRequestImpl(session: SessionContext, requestId: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Cancellation reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM financing_request WHERE id = $1 FOR UPDATE", [requestId]);
    const request = rows[0];
    if (!request) throw new DomainError("Financing request not found");
    if (request.archived_at || !OPEN_FINANCING_STATUSES.includes(request.status)) {
      throw new DomainError("Can only cancel a Submitted or Underwriting request");
    }

    const { rows: created } = await client.query(
      `INSERT INTO request_closure_record (financing_request_id, cac_reg_number, business_name, financing_ref, outcome, reason, closed_at)
       VALUES ($1, $2, $3, $4, 'Cancelled', $5, now())
       RETURNING id`,
      [requestId, request.cac_reg_number, request.business_name, request.financing_ref, args.reason],
    );
    const requestClosureRecordId = created[0].id;

    await client.query(
      `UPDATE financing_request SET archived_at = now(), superseded_by_kind = 'request_closure_record', superseded_by_id = $2 WHERE id = $1`,
      [requestId, requestClosureRecordId],
    );
    return { requestClosureRecordId };
  });
}
export const cancelRequest = withAuthorization(["vetify"], cancelRequestImpl);

export async function listRequestClosureRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM request_closure_record ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: ProposeAmendment (FinancingRequest, financialInstitution) ────
// Nonconsuming -- the original request stays active.

interface ProposeAmendmentArgs {
  proposedTerms: FinancingTerms;
  proposalNote?: string | null;
}

async function proposeAmendmentImpl(session: SessionContext, requestId: number, args: ProposeAmendmentArgs) {
  if (!(args.proposedTerms.amount > 0)) throw new DomainError("Proposed amount must be positive");
  if (!(args.proposedTerms.tenureMonths > 0)) throw new DomainError("Proposed tenure must be positive");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM financing_request WHERE id = $1", [requestId]);
    const request = rows[0];
    if (!request) throw new DomainError("Financing request not found");
    if (request.archived_at || !OPEN_FINANCING_STATUSES.includes(request.status)) {
      throw new DomainError("Can only propose amendments to Submitted or Underwriting requests");
    }

    const { rows: created } = await client.query(
      `INSERT INTO financing_amendment
         (financing_request_id, cac_reg_number, business_name, financing_ref,
          original_amount, original_purpose, original_tenure_months,
          proposed_amount, proposed_purpose, proposed_tenure_months, proposed_at, proposal_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $11)
       RETURNING id`,
      [
        requestId, request.cac_reg_number, request.business_name, request.financing_ref,
        request.terms_amount, request.terms_purpose, request.terms_tenure_months,
        args.proposedTerms.amount, args.proposedTerms.purpose, args.proposedTerms.tenureMonths, args.proposalNote ?? null,
      ],
    );
    return { financingAmendmentId: created[0].id };
  });
}
export const proposeAmendment = withAuthorization(["financialInstitution"], proposeAmendmentImpl);

// ─── Choice: AcceptAmendment (FinancingAmendment, business) ───────────────
// Keyless field-replace on FinancingRequest (archive+recreate with new
// terms in the real Daml) -- collapses to a plain UPDATE, same convention as
// ProceedWithReplacement/Revalue. Capped at 10 amendments.

async function acceptAmendmentImpl(session: SessionContext, amendmentId: number) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM financing_amendment WHERE id = $1 FOR UPDATE", [amendmentId]);
    const amendment = rows[0];
    if (!amendment) throw new DomainError("FinancingAmendment not found");
    if (amendment.status !== "Pending") throw new DomainError("FinancingAmendment is not pending");

    const { rows: reqRows } = await client.query(
      "SELECT * FROM financing_request WHERE id = $1 FOR UPDATE",
      [amendment.financing_request_id],
    );
    const request = reqRows[0];
    if (!request) throw new DomainError("Financing request not found");
    if (request.financing_ref !== amendment.financing_ref) {
      throw new DomainError("Amendment must reference the matching request");
    }
    if (!(request.amendment_count < 10)) {
      throw new DomainError("Maximum 10 amendments reached; a new financing request is required");
    }

    await client.query(
      `UPDATE financing_request
         SET terms_amount = $2, terms_purpose = $3, terms_tenure_months = $4,
             term_history = term_history || $5::jsonb,
             amendment_count = amendment_count + 1, status = 'Submitted', expires_at = NULL, updated_at = now()
         WHERE id = $1`,
      [
        amendment.financing_request_id, amendment.proposed_amount, amendment.proposed_purpose, amendment.proposed_tenure_months,
        JSON.stringify([{ amount: Number(request.terms_amount), purpose: request.terms_purpose, tenureMonths: request.terms_tenure_months }]),
      ],
    );
    await client.query(`UPDATE financing_amendment SET status = 'Accepted', updated_at = now() WHERE id = $1`, [amendmentId]);

    return { financingRequestId: amendment.financing_request_id };
  });
}
export const acceptAmendment = withAuthorization(["business"], acceptAmendmentImpl);

async function declineAmendmentImpl(session: SessionContext, amendmentId: number, args: { reason: string }) {
  if (!args.reason) throw new DomainError("Reason must not be empty");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT status FROM financing_amendment WHERE id = $1 FOR UPDATE", [amendmentId]);
    const amendment = rows[0];
    if (!amendment) throw new DomainError("FinancingAmendment not found");
    if (amendment.status !== "Pending") throw new DomainError("FinancingAmendment is not pending");

    await client.query(
      `UPDATE financing_amendment SET status = 'Declined', decline_reason = $2, updated_at = now() WHERE id = $1`,
      [amendmentId, args.reason],
    );
    return { financingAmendmentId: amendmentId };
  });
}
export const declineAmendment = withAuthorization(["business"], declineAmendmentImpl);

export async function listFinancingAmendments(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM financing_amendment ORDER BY created_at DESC`);
    return rows;
  });
}

// ─── Choice: RecordGovernanceAssessment (FinancingDecision, financialInstitution) ──
// Nonconsuming -- the decision record is immutable; governance is a
// separate side-contract.

interface RecordGovernanceAssessmentArgs {
  aiRecommendationFollowed: boolean;
  governanceNote?: string | null;
  assessedBy: string;
}

async function recordGovernanceAssessmentImpl(session: SessionContext, decisionId: number, args: RecordGovernanceAssessmentArgs) {
  if (!args.assessedBy) throw new DomainError("Governance assessor name required");
  return withTransaction(session, async (client) => {
    const { rows } = await client.query("SELECT * FROM financing_decision WHERE id = $1", [decisionId]);
    const decision = rows[0];
    if (!decision) throw new DomainError("FinancingDecision not found");

    const { rows: created } = await client.query(
      `INSERT INTO funding_governance_record
         (financing_decision_id, cac_reg_number, business_name, financing_ref, decision_outcome,
          ai_recommendation_followed, governance_note, assessed_by, assessed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       RETURNING id`,
      [
        decisionId, decision.cac_reg_number, decision.business_name, decision.financing_ref, decision.outcome,
        args.aiRecommendationFollowed, args.governanceNote ?? null, args.assessedBy,
      ],
    );
    return { fundingGovernanceRecordId: created[0].id };
  });
}
export const recordGovernanceAssessment = withAuthorization(["financialInstitution"], recordGovernanceAssessmentImpl);

export async function listFundingGovernanceRecords(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM funding_governance_record ORDER BY created_at DESC`);
    return rows;
  });
}
