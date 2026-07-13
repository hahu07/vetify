/**
 * Final Decision engine (Stage 6, the combinator over the other four independent
 * scoring engines — see underwriting.ts for the orchestrator). Combines Financial
 * Behaviour, Cashflow Risk, Creditworthiness, and Fraud Detection sub-scores using
 * policy-configurable engine-level weights, computes the recommended limit, and
 * produces the final composite score/riskCategory/recommendation. Pure function, no
 * LLM involvement.
 *
 * Hard override: a Fraud Detection score below the policy's fraudReviewThreshold
 * forces riskCategory to High regardless of the weighted composite — mirroring
 * Stage 3's AML hard-override precedent (scoring/compliance.ts), where a bad
 * hard-rule signal is never just averaged away by good scores elsewhere. The
 * threshold is per-institution policy data (UnderwritingScoringWeights.
 * fraudReviewThreshold), not a hardcoded constant — risk tolerance for a
 * rule-based (non-ML) fraud signal is a genuine FI-specific judgment call.
 *
 * decision mirrors VerificationDecision/ComplianceDecision's action-branching
 * exactly: Low -> BeginUnderwriting (auto-qualify), Medium -> Flag (human
 * assessor review), High -> RejectUnderwriting (hard veto, business never
 * reaches the FI) — the fraud override above naturally routes to Reject since
 * it forces riskCategory to High. This replaces Stage 6's previous "no
 * Approve/Reject branching, BeginUnderwriting always proceeds" behavior now that
 * `assessor` is a real party with its own screening authority, mirroring how
 * verifier already screens businesses before Stage 5.
 *
 * Amount-vs-limit is a disclosure comparison here, not a scored factor: it's
 * reported as a flag/recommendation line rather than contributing points, since the
 * recommended limit itself is already derived from the other engines' evidence.
 */
import type { EngineResult, UnderwritingAssessment, UnderwritingDecision, UnderwritingRiskFlag, UnderwritingScoringWeights } from "./types.js";
import { classifyRisk } from "../types/index.js";

export interface CombineEngineInputs {
  financialBehaviour: EngineResult;
  cashflowRisk: EngineResult;
  creditworthiness: EngineResult;
  fraudDetection: EngineResult;
}

/** recommendedLimit = min(requestedAmount, multiplier x averageMonthlyNetInflow),
 * multiplier 3 if DSCR < 1.0 or unavailable (conservative default), else 6. Rounded to
 * the nearest NGN 100,000. */
function computeRecommendedLimit(averageMonthlyNetInflow: number, dscr: number | undefined, requestedAmount: number): number {
  const multiplier = dscr !== undefined && dscr >= 1.0 ? 6 : 3;
  const cap = multiplier * averageMonthlyNetInflow;
  const raw = Math.min(requestedAmount, Math.max(cap, 0));
  return Math.round(raw / 100_000) * 100_000;
}

function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

function buildRecommendation(
  engines: CombineEngineInputs,
  requestedAmount: number,
  recommendedLimit: number,
  fraudOverrideTriggered: boolean,
  allFlags: UnderwritingRiskFlag[],
): string {
  const parts = [
    `Financial Behaviour ${engines.financialBehaviour.score}/100, Cashflow Risk ${engines.cashflowRisk.score}/100, ` +
      `Creditworthiness ${engines.creditworthiness.score}/100, Fraud Detection ${engines.fraudDetection.score}/100.`,
    requestedAmount > recommendedLimit
      ? `Requested amount of ${formatNaira(requestedAmount)} exceeds the recommended limit of ${formatNaira(recommendedLimit)}.`
      : `Requested amount of ${formatNaira(requestedAmount)} is within the recommended limit of ${formatNaira(recommendedLimit)}.`,
  ];
  if (fraudOverrideTriggered) {
    parts.push(`Fraud Detection score of ${engines.fraudDetection.score}/100 is below the review threshold — risk category forced to High regardless of the weighted composite.`);
  }
  if (allFlags.length > 0) {
    parts.push(`Risk flags: ${allFlags.map((f) => f.description).join("; ")}.`);
  } else {
    parts.push("No risk flags identified.");
  }
  return parts.join(" ");
}

export function combineEngines(
  engines: CombineEngineInputs,
  weights: UnderwritingScoringWeights,
  requestedAmount: number,
  averageMonthlyNetInflow: number,
  dscr: number | undefined,
): { assessment: UnderwritingAssessment; riskFlags: UnderwritingRiskFlag[]; decision: UnderwritingDecision } {
  const weightedSum =
    engines.financialBehaviour.score * weights.financialBehaviourEngineWeight +
    engines.cashflowRisk.score * weights.cashflowRiskEngineWeight +
    engines.creditworthiness.score * weights.creditworthinessEngineWeight +
    engines.fraudDetection.score * weights.fraudDetectionEngineWeight;
  const compositeScore = Math.max(0, Math.min(100, Math.round(weightedSum / 100)));

  const recommendedLimit = computeRecommendedLimit(averageMonthlyNetInflow, dscr, requestedAmount);

  const fraudOverrideTriggered = engines.fraudDetection.score < weights.fraudReviewThreshold;
  const riskCategory = fraudOverrideTriggered ? "High" : classifyRisk(compositeScore);

  const disclosureFlags: UnderwritingRiskFlag[] = [];
  if (fraudOverrideTriggered) {
    disclosureFlags.push({ code: "FRAUD_REVIEW_REQUIRED", description: "Fraud Detection score fell below the review threshold — risk category forced to High" });
  }
  if (averageMonthlyNetInflow > 0 && requestedAmount > 6 * averageMonthlyNetInflow) {
    disclosureFlags.push({ code: "REQUEST_DISPROPORTIONATE", description: "Requested amount exceeds 6x monthly net inflow — disproportionate to income" });
  }

  const riskFlags = [
    ...engines.financialBehaviour.flags,
    ...engines.cashflowRisk.flags,
    ...engines.creditworthiness.flags,
    ...engines.fraudDetection.flags,
    ...disclosureFlags,
  ];

  const assessment: UnderwritingAssessment = {
    score: compositeScore,
    riskCategory,
    recommendedLimit,
    recommendation: buildRecommendation(engines, requestedAmount, recommendedLimit, fraudOverrideTriggered, riskFlags),
    behaviouralScore: engines.financialBehaviour.score,
    cashflowRiskScore: engines.cashflowRisk.score,
    creditworthinessScore: engines.creditworthiness.score,
    fraudScore: engines.fraudDetection.score,
  };

  let decision: UnderwritingDecision;
  if (riskCategory === "Low") {
    decision = { action: "BeginUnderwriting", autoDecided: true };
  } else if (riskCategory === "Medium") {
    decision = { action: "FlagUnderwritingForManualReview", note: assessment.recommendation };
  } else {
    const reason = fraudOverrideTriggered
      ? `Fraud Detection score of ${engines.fraudDetection.score}/100 fell below the review threshold.`
      : `Composite risk score ${compositeScore}/100 falls in the High-risk band.`;
    decision = { action: "RejectUnderwriting", autoDecided: true, reason };
  }

  return { assessment, riskFlags, decision };
}
