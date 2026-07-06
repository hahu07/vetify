/**
 * Creditworthiness engine (Stage 6, one of five independent scoring engines — see
 * underwriting.ts for the orchestrator). Bands the bureau-backed credit score from
 * assess_creditworthiness. Populates RiskAssessment.creditworthinessScore.
 *
 * Previously creditScore was fetched and explicitly discarded ("captured for the
 * record; not itself a weighted factor" — the old single-file scorer's comment,
 * since DSCR was treated as the only quantitative proxy needed). This engine finally
 * gives it a job, separate from Cashflow Risk's DSCR factor.
 *
 * Band boundaries (700/650/550) are policy-configurable via UnderwritingScoringWeights,
 * not hardcoded — a real risk-appetite decision an FI should be able to retune
 * without a code deploy.
 */
import type { EngineResult, UnderwritingRiskFlag, UnderwritingScoringWeights } from "./types.js";

/** Returns w.creditScorePoor (not silently 0) when unavailable — an unknown score is
 * scored the same as the worst confirmed band, conservative by design, but the flag
 * below distinguishes "unavailable" from a confirmed poor score. */
function bandCreditScore(creditScore: number | undefined, w: UnderwritingScoringWeights): number {
  if (creditScore === undefined) return w.creditScorePoor;
  if (creditScore >= w.creditScoreExcellentThreshold) return w.creditScoreExcellent;
  if (creditScore >= w.creditScoreGoodThreshold) return w.creditScoreGood;
  if (creditScore >= w.creditScoreFairThreshold) return w.creditScoreFair;
  return w.creditScorePoor;
}

function buildFlags(creditScore: number | undefined, w: UnderwritingScoringWeights): UnderwritingRiskFlag[] {
  const flags: UnderwritingRiskFlag[] = [];
  if (creditScore === undefined) {
    flags.push({ code: "CREDIT_SCORE_UNAVAILABLE", description: "assess_creditworthiness did not return a bureau credit score — factor scored conservatively (treated as the lowest band)" });
  } else if (creditScore < w.creditScoreFairThreshold) {
    flags.push({ code: "CREDIT_SCORE_POOR", description: `Bureau credit score below ${w.creditScoreFairThreshold}` });
  }
  return flags;
}

export function scoreCreditworthiness(creditScore: number | undefined, weights: UnderwritingScoringWeights): EngineResult {
  const score = bandCreditScore(creditScore, weights);
  return {
    score: Math.max(0, Math.min(100, score)),
    flags: buildFlags(creditScore, weights),
  };
}
