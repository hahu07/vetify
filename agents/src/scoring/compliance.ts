/**
 * Deterministic Stage 3 (AML/KYB/CDD) scoring — items 2 and 3 of the
 * off-ledger determinism work. AML and KYB are fully quantifiable from
 * Youverify's own status fields (aml-decision-guide.md); business age is
 * quantifiable from the onboarding record. But cdd-framework.md's "Purpose &
 * Profile Coherence" bucket (financing purpose vs. declared business
 * activity, amount proportionality, director-industry fit) has no
 * structured data source anywhere in the current schema — there is no field
 * for business turnover, employee count, or director employment history.
 *
 * Rather than fabricate a formula for data that doesn't exist, this scorer
 * never claims that bucket. Consequence, by design: `scoreCompliance` can
 * only ever auto-reject (on a clear hard-rule violation) or flag for a
 * human — it can never resolve to ApproveCompliance on its own. Only a human
 * reviewer, who can actually assess purpose coherence and proportionality,
 * can complete the CDD judgment and approve.
 *
 * The point values themselves are data (ComplianceScoringWeights), not
 * constants — callers should pass the active on-ledger CompliancePolicy's
 * scoringWeights when one exists (DEFAULT_COMPLIANCE_WEIGHTS otherwise).
 */
import type {
  AmlEvidence,
  ComplianceCheck,
  ComplianceDecision,
  ComplianceScoringResult,
  ComplianceScoringWeights,
  CreditHistoryResult,
  KybEvidence,
  QuantifiableCddEvidence,
} from "./types.js";
import { DEFAULT_COMPLIANCE_POLICY_VERSION, DEFAULT_COMPLIANCE_WEIGHTS } from "./types.js";

export type ShariahVerdict = "COMPLIANT" | "REQUIRES_REVIEW" | "NON_COMPLIANT";

function scoreAml(evidence: AmlEvidence, w: ComplianceScoringWeights): { points: number; amlCleared: boolean; hardReject: boolean } {
  const { businessStatus, directorStatus } = evidence;
  if (businessStatus === "not_cleared" || directorStatus === "not_cleared") {
    return { points: 0, amlCleared: false, hardReject: true };
  }
  if (businessStatus === "review_required" || directorStatus === "review_required") {
    return { points: w.amlOneReviewRequired, amlCleared: false, hardReject: false };
  }
  return { points: w.amlBothClear, amlCleared: true, hardReject: false };
}

function scoreKyb(evidence: KybEvidence, w: ComplianceScoringWeights): { points: number; kycValidated: boolean; hardReject: boolean } {
  switch (evidence.status) {
    case "active_full_match":        return { points: w.kybActiveFullMatch, kycValidated: true,  hardReject: false };
    case "active_minor_discrepancy": return { points: w.kybActiveMinorDiscrepancy, kycValidated: true,  hardReject: false };
    case "inactive_or_mismatch":     return { points: w.kybInactiveOrMismatch, kycValidated: false, hardReject: false };
    case "not_found":                return { points: w.kybNotFound, kycValidated: false, hardReject: false };
    case "struck_off_or_dissolved":  return { points: 0, kycValidated: false, hardReject: true };
  }
}

function scoreCreditHistory(result: CreditHistoryResult, w: ComplianceScoringWeights): number {
  switch (result) {
    case "clean":                 return w.creditClean;
    case "minor_resolved":        return w.creditMinorResolved;
    case "delinquent_or_default": return w.creditDelinquentOrDefault;
  }
}

/** Established (>12mo) bonus / newly-registered (<3mo) penalty, 0 otherwise. */
function scoreBusinessAge(evidence: QuantifiableCddEvidence, w: ComplianceScoringWeights): number {
  const asOf = evidence.asOf ? new Date(evidence.asOf) : new Date();
  const incorporated = new Date(evidence.incorporationDate);
  const ageMonths = (asOf.getTime() - incorporated.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (ageMonths > 12) return w.businessAgeEstablishedBonus;
  if (ageMonths < 3) return w.businessAgeNewlyRegisteredPenalty;
  return 0;
}

export function scoreCompliance(
  shariahVerdict: ShariahVerdict,
  aml: AmlEvidence,
  kyb: KybEvidence,
  creditHistory: CreditHistoryResult,
  // Optional for backward compatibility with any caller that can't supply it, but
  // ComplianceReview does carry incorporationDate (carried over from BusinessOnboarding at
  // creation time) — verifier.ts's compliance-stage caller passes it. The age component
  // simply contributes 0 when not supplied.
  age?: QuantifiableCddEvidence,
  weights: ComplianceScoringWeights = DEFAULT_COMPLIANCE_WEIGHTS,
  policyVersion: string = DEFAULT_COMPLIANCE_POLICY_VERSION,
): ComplianceScoringResult {
  if (shariahVerdict === "NON_COMPLIANT") {
    return {
      checks: { shariahCompliant: false, amlCleared: false, kycValidated: false, cddCompleted: false },
      quantifiableScore: 0,
      decision: {
        action: "RejectCompliance",
        autoDecided: true,
        reason: "Shariah pre-check verdict: NON_COMPLIANT — prohibited sector or financing structure.",
      },
      scoringPolicyVersion: policyVersion,
    };
  }

  const amlOutcome = scoreAml(aml, weights);
  const kybOutcome = scoreKyb(kyb, weights);
  const creditPoints = scoreCreditHistory(creditHistory, weights);
  const agePoints = age ? scoreBusinessAge(age, weights) : 0;
  const quantifiableScore = amlOutcome.points + kybOutcome.points + creditPoints + agePoints;
  const quantifiableCeiling = weights.amlBothClear + weights.kybActiveFullMatch + weights.creditClean;

  const checks: ComplianceCheck = {
    shariahCompliant: shariahVerdict === "COMPLIANT",
    amlCleared: amlOutcome.amlCleared,
    kycValidated: kybOutcome.kycValidated,
    // Never claimed true by the deterministic scorer — see module doc comment.
    cddCompleted: false,
  };

  let decision: ComplianceDecision;
  if (amlOutcome.hardReject) {
    decision = { action: "RejectCompliance", autoDecided: true, reason: "AML screening returned a confirmed sanctions/PEP hit (not_cleared)." };
  } else if (kybOutcome.hardReject) {
    decision = { action: "RejectCompliance", autoDecided: true, reason: "KYB shows the business struck off or dissolved." };
  } else {
    const shariahNote = shariahVerdict === "REQUIRES_REVIEW"
      ? " Shariah pre-check verdict REQUIRES_REVIEW — a Shariah officer must also assess this case."
      : "";
    decision = {
      action: "FlagComplianceForManualReview",
      note: `Quantifiable evidence score ${quantifiableScore}/${quantifiableCeiling} — AML=${amlOutcome.amlCleared ? "cleared" : "not cleared"}, `
        + `KYB=${kybOutcome.kycValidated ? "validated" : "not validated"}, credit history ${creditPoints}/${weights.creditClean}, business age ${agePoints >= 0 ? "+" : ""}${agePoints}. `
        + `Purpose/activity coherence, amount proportionality, and director-industry fit require human CDD judgment — no auto-approval is possible.`
        + shariahNote,
    };
  }

  return { checks, quantifiableScore, decision, scoringPolicyVersion: policyVersion };
}
