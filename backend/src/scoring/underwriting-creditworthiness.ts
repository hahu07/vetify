/**
 * Ported from agents/src/scoring/underwriting-creditworthiness.ts — see
 * scoring/types.ts's doc comment for why this copy exists (dev-only Stage 6
 * simulation route, routes/dev.ts). Logic is identical to the agents-package
 * original.
 *
 * Creditworthiness engine (one of five independent Stage 6 scoring engines). Bands
 * the bureau-backed credit score. Populates RiskAssessment.creditworthinessScore.
 */
import type { EngineResult, UnderwritingRiskFlag, UnderwritingScoringWeights } from "./types.js";

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
