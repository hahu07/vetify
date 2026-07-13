/**
 * Ported from agents/src/scoring/underwriting-cashflow-risk.ts — see scoring/types.ts's
 * doc comment for why this copy exists (dev-only Stage 6 simulation route,
 * routes/dev.ts). Logic is identical to the agents-package original.
 *
 * Cashflow Risk engine (one of five independent Stage 6 scoring engines). Calculates
 * net cashflow, DSCR, cash reserve months, and stress-tests affordability at three
 * haircut scenarios. Populates RiskAssessment.cashflowRiskScore.
 */
import type {
  NormalizedTransaction,
  CreditworthinessEvidence,
  EngineResult,
  UnderwritingRiskFlag,
  UnderwritingScoringWeights,
} from "./types.js";
import {
  deriveCashFlowMetrics,
  averageMonthlyOutflow,
  averageMonthlyGrossInflow,
  latestBalance,
} from "./underwriting-transactions.js";

function scoreDscr(dscr: number | undefined, w: UnderwritingScoringWeights): number {
  if (dscr === undefined) return 0;
  if (dscr >= w.dscrHighThreshold) return w.dscrHigh;
  if (dscr >= w.dscrMediumThreshold) return w.dscrMedium;
  return w.dscrLow;
}

function scoreDebtObligations(existingMonthlyDebt: number, averageMonthlyNetInflow: number, w: UnderwritingScoringWeights): number {
  if (averageMonthlyNetInflow <= 0) return w.debtObligationsHigh;
  const ratio = existingMonthlyDebt / averageMonthlyNetInflow;
  if (ratio <= w.debtObligationsLowThreshold) return w.debtObligationsLow;
  if (ratio <= w.debtObligationsModerateThreshold) return w.debtObligationsModerate;
  return w.debtObligationsHigh;
}

function scoreCashReserve(balance: number | undefined, outflow: number, w: UnderwritingScoringWeights): number {
  if (balance === undefined) return 0;
  if (outflow <= 0) return w.cashReserveStrong;
  const months = balance / outflow;
  if (months >= w.cashReserveStrongMonths) return w.cashReserveStrong;
  if (months >= w.cashReserveAdequateMonths) return w.cashReserveAdequate;
  return w.cashReserveWeak;
}

function stressScenarioPasses(grossInflow: number, haircut: number, existingDebt: number, installment: number): boolean {
  const debtService = existingDebt + installment;
  if (debtService <= 0) return true;
  return (grossInflow * (1 - haircut)) / debtService >= 1.0;
}

function scoreStressTest(
  grossInflow: number,
  existingDebt: number,
  estimatedInstallment: number | undefined,
  w: UnderwritingScoringWeights,
): { score: number; passCount: number | undefined; scenarioCount: number } {
  const scenarios = [w.stressTestHaircutMild, w.stressTestHaircutModerate, w.stressTestHaircutSevere];
  if (estimatedInstallment === undefined) return { score: 0, passCount: undefined, scenarioCount: scenarios.length };
  const passCount = scenarios.filter((h) => stressScenarioPasses(grossInflow, h, existingDebt, estimatedInstallment)).length;
  if (passCount === scenarios.length) return { score: w.stressTestPassAll, passCount, scenarioCount: scenarios.length };
  if (passCount > 0) return { score: w.stressTestPassPartial, passCount, scenarioCount: scenarios.length };
  return { score: w.stressTestFail, passCount, scenarioCount: scenarios.length };
}

function buildFlags(
  dscr: number | undefined,
  existingMonthlyDebt: number,
  averageMonthlyNetInflow: number,
  balance: number | undefined,
  stressPassCount: number | undefined,
  scenarioCount: number,
  w: UnderwritingScoringWeights,
): UnderwritingRiskFlag[] {
  const flags: UnderwritingRiskFlag[] = [];
  if (dscr === undefined) {
    flags.push({ code: "DSCR_UNAVAILABLE", description: "Creditworthiness result was not available in time (webhook did not arrive) — DSCR factor not scored and recommended limit capped conservatively" });
  } else if (dscr < w.dscrMediumThreshold) {
    flags.push({ code: "DSCR_BELOW_ONE", description: `DSCR below ${w.dscrMediumThreshold} — business cannot cover proposed installments from current income` });
  }
  if (averageMonthlyNetInflow > 0 && existingMonthlyDebt / averageMonthlyNetInflow > w.debtObligationsModerateThreshold) {
    flags.push({ code: "OVER_LEVERAGED", description: `Existing debt obligations exceed ${w.debtObligationsModerateThreshold * 100}% of monthly inflow — already over-leveraged` });
  }
  if (balance === undefined) {
    flags.push({ code: "CASH_RESERVE_UNAVAILABLE", description: "Statement data did not include account balances — cash reserve factor not scored" });
  }
  if (stressPassCount === undefined) {
    flags.push({ code: "STRESS_TEST_UNAVAILABLE", description: "Requested tenure not available — stress-test scenarios not evaluated" });
  } else if (stressPassCount === 0) {
    flags.push({ code: "STRESS_TEST_FAILED", description: `Affordability fails under all ${scenarioCount} stress scenarios (${w.stressTestHaircutMild * 100}%/${w.stressTestHaircutModerate * 100}%/${w.stressTestHaircutSevere * 100}% revenue haircuts)` });
  } else if (stressPassCount < scenarioCount) {
    flags.push({ code: "STRESS_TEST_PARTIAL", description: `Affordability holds under ${stressPassCount} of ${scenarioCount} stress scenarios` });
  }
  return flags;
}

export function scoreCashflowRisk(
  transactions: NormalizedTransaction[],
  creditworthiness: CreditworthinessEvidence,
  requestedAmount: number,
  tenureMonths: number | undefined,
  weights: UnderwritingScoringWeights,
  asOf?: string,
): EngineResult {
  const { averageMonthlyNetInflow, existingMonthlyDebtObligations } = deriveCashFlowMetrics(transactions, asOf);
  const grossInflow = averageMonthlyGrossInflow(transactions, asOf);
  const outflow = averageMonthlyOutflow(transactions, asOf);
  const balance = latestBalance(transactions);
  const estimatedInstallment = tenureMonths && tenureMonths > 0 ? requestedAmount / tenureMonths : undefined;

  const { score: stressScore, passCount, scenarioCount } = scoreStressTest(grossInflow, existingMonthlyDebtObligations, estimatedInstallment, weights);

  const score =
    scoreDscr(creditworthiness.dscr, weights) +
    scoreDebtObligations(existingMonthlyDebtObligations, averageMonthlyNetInflow, weights) +
    scoreCashReserve(balance, outflow, weights) +
    stressScore;

  return {
    score: Math.max(0, Math.min(100, score)),
    flags: buildFlags(creditworthiness.dscr, existingMonthlyDebtObligations, averageMonthlyNetInflow, balance, passCount, scenarioCount, weights),
  };
}
