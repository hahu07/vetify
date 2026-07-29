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

    await client.query(`UPDATE financing_request SET status = 'Underwriting', updated_at = now() WHERE id = $1`, [
      financingRequestId,
    ]);

    const { rows: result } = await client.query(
      `INSERT INTO underwriting_result
         (financing_request_id, cac_reg_number, business_name, financing_ref, assessment_score,
          assessment_risk_category, assessment_recommended_limit, assessment_recommendation,
          assessment_probability_of_default, assessment_loss_given_default, assessment_exposure_at_default,
          assessment_behavioural_score, assessment_cashflow_risk_score, assessment_creditworthiness_score,
          assessment_fraud_score, auto_decided, underwriting_started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now())
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

// ─── Choice: ApproveFunding (financialInstitution) -- simplified ─────────
// Daml's original also checks ApprovedProvider/AuthorizedOfficer -- out of
// scope here (see migrations/005's header; the Governance registries are a
// separate pass). It does still create the MurabahahWad (Stage 8's entry
// point), now that migrations/006 brings that table into scope.

interface ApproveFundingArgs {
  assetDetails: AssetDetails;
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
