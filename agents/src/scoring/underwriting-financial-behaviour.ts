/**
 * Financial Behaviour engine (Stage 6, one of five independent scoring engines — see
 * underwriting.ts for the orchestrator). Analyses income stability, expense discipline,
 * liquidity, and revenue consistency from the borrower's verified transaction history.
 * Populates RiskAssessment.behaviouralScore. Pure function, no LLM involvement.
 *
 * All band boundaries (revenue variance/business age/burn rate/liquidity cutoffs) are
 * policy-configurable via UnderwritingScoringWeights, not hardcoded — a real
 * risk-appetite decision an FI should be able to retune without a code deploy.
 */
import type {
  NormalizedTransaction,
  EngineResult,
  UnderwritingRiskFlag,
  UnderwritingScoringWeights,
} from "./types.js";
import {
  deriveCashFlowMetrics,
  averageMonthlyOutflow,
  averageMonthlyGrossInflow,
  latestBalance,
  monthsSince,
} from "./underwriting-transactions.js";

function scoreRevenueConsistency(varianceRatio: number, w: UnderwritingScoringWeights): number {
  if (varianceRatio < w.revenueConsistentThreshold) return w.revenueConsistent;
  if (varianceRatio <= w.revenueModerateThreshold) return w.revenueModerate;
  return w.revenueVolatile;
}

/** Returns 0 (not w.businessAgeNew) when incorporation date is unknown — an unknown
 * age is not the same claim as a confirmed new business (see buildFlags below). */
function scoreBusinessAge(months: number | undefined, w: UnderwritingScoringWeights): number {
  if (months === undefined) return 0;
  if (months >= w.businessAgeEstablishedMonths) return w.businessAgeEstablished;
  if (months >= w.businessAgeModerateMonths) return w.businessAgeModerate;
  return w.businessAgeNew;
}

/** Burn rate = average monthly outflow / average monthly gross inflow. Lower is more
 * disciplined. Undefined (0 gross inflow) is treated as poor, not skipped — a business
 * with no recorded income has no expense discipline to credit. */
function scoreExpenseDiscipline(grossInflow: number, outflow: number, w: UnderwritingScoringWeights): number {
  if (grossInflow <= 0) return w.expenseDisciplinePoor;
  const burnRate = outflow / grossInflow;
  if (burnRate <= w.expenseDisciplineStrongThreshold) return w.expenseDisciplineStrong;
  if (burnRate <= w.expenseDisciplineModerateThreshold) return w.expenseDisciplineModerate;
  return w.expenseDisciplinePoor;
}

/** Best-effort: buffer = latest observed balance / average monthly outflow. Returns 0
 * (not w.liquidityWeak) when no transaction reports a balance — data-unavailable is a
 * distinct claim from a confirmed thin buffer (see LIQUIDITY_DATA_UNAVAILABLE below). */
function scoreLiquidity(balance: number | undefined, outflow: number, w: UnderwritingScoringWeights): number {
  if (balance === undefined) return 0;
  if (outflow <= 0) return w.liquidityStrong; // no outflow to buffer against — treat as strong
  const bufferMonths = balance / outflow;
  if (bufferMonths >= w.liquidityStrongMonths) return w.liquidityStrong;
  if (bufferMonths >= w.liquidityAdequateMonths) return w.liquidityAdequate;
  return w.liquidityWeak;
}

function buildFlags(
  varianceRatio: number,
  businessAgeMonths: number | undefined,
  balance: number | undefined,
  grossInflow: number,
  outflow: number,
  w: UnderwritingScoringWeights,
): UnderwritingRiskFlag[] {
  const flags: UnderwritingRiskFlag[] = [];
  if (varianceRatio > w.revenueModerateThreshold) {
    flags.push({ code: "HIGH_REVENUE_VARIANCE", description: `Revenue variance exceeds ${w.revenueModerateThreshold * 100}% of average — highly seasonal or unstable business` });
  }
  if (businessAgeMonths === undefined) {
    flags.push({ code: "BUSINESS_AGE_UNKNOWN", description: "Incorporation date not available on this request — business-age factor not scored (data gap, not a confirmed new-business finding)" });
  } else if (businessAgeMonths < w.businessAgeModerateMonths) {
    flags.push({ code: "NEW_BUSINESS", description: `Business incorporated less than ${w.businessAgeModerateMonths} months ago — insufficient track record` });
  }
  if (grossInflow > 0 && outflow / grossInflow > w.expenseDisciplineModerateThreshold) {
    flags.push({ code: "HIGH_BURN_RATE", description: `Monthly outflow exceeds ${w.expenseDisciplineModerateThreshold * 100}% of monthly gross inflow — poor expense discipline` });
  }
  if (balance === undefined) {
    flags.push({ code: "LIQUIDITY_DATA_UNAVAILABLE", description: "Statement data did not include account balances — liquidity factor not scored" });
  }
  return flags;
}

export function scoreFinancialBehaviour(
  transactions: NormalizedTransaction[],
  businessIncorporationDate: string | undefined,
  weights: UnderwritingScoringWeights,
  asOf?: string,
): EngineResult {
  const effectiveAsOf = asOf ?? new Date().toISOString();
  const { revenueVarianceRatio } = deriveCashFlowMetrics(transactions, effectiveAsOf);
  const businessAgeMonths = businessIncorporationDate
    ? monthsSince(businessIncorporationDate, effectiveAsOf)
    : undefined;
  const grossInflow = averageMonthlyGrossInflow(transactions, effectiveAsOf);
  const outflow = averageMonthlyOutflow(transactions, effectiveAsOf);
  const balance = latestBalance(transactions);

  const score =
    scoreRevenueConsistency(revenueVarianceRatio, weights) +
    scoreBusinessAge(businessAgeMonths, weights) +
    scoreExpenseDiscipline(grossInflow, outflow, weights) +
    scoreLiquidity(balance, outflow, weights);

  return {
    score: Math.max(0, Math.min(100, score)),
    flags: buildFlags(revenueVarianceRatio, businessAgeMonths, balance, grossInflow, outflow, weights),
  };
}
