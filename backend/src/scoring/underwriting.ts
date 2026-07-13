/**
 * Ported from agents/src/scoring/underwriting.ts — see scoring/types.ts's doc
 * comment for why this copy exists (dev-only Stage 6 simulation route,
 * routes/dev.ts). Logic is identical to the agents-package original.
 *
 * Deterministic Stage 6 (underwriting) scoring — orchestrator over five independent
 * engines. Given the same evidence and the same weights, this always produces the
 * same result — no LLM involved in any number.
 */
import type {
  CreditworthinessEvidence,
  TransactionEvidence,
  UnderwritingRequestContext,
  UnderwritingScoringResult,
  UnderwritingScoringWeights,
} from "./types.js";
import { DEFAULT_UNDERWRITING_POLICY_VERSION, DEFAULT_UNDERWRITING_WEIGHTS } from "./types.js";
import { deriveCashFlowMetrics } from "./underwriting-transactions.js";
import { scoreFinancialBehaviour } from "./underwriting-financial-behaviour.js";
import { scoreCashflowRisk } from "./underwriting-cashflow-risk.js";
import { scoreCreditworthiness } from "./underwriting-creditworthiness.js";
import { scoreFraudDetection } from "./underwriting-fraud-detection.js";
import { combineEngines } from "./underwriting-final-decision.js";

export function scoreUnderwriting(
  evidence: TransactionEvidence,
  creditworthiness: CreditworthinessEvidence,
  context: UnderwritingRequestContext,
  weights: UnderwritingScoringWeights = DEFAULT_UNDERWRITING_WEIGHTS,
  policyVersion: string = DEFAULT_UNDERWRITING_POLICY_VERSION,
): UnderwritingScoringResult {
  const asOf = context.asOf ?? evidence.asOf ?? new Date().toISOString();
  const { transactions } = evidence;

  const financialBehaviour = scoreFinancialBehaviour(transactions, context.businessIncorporationDate, weights, asOf);
  const cashflowRisk = scoreCashflowRisk(transactions, creditworthiness, context.requestedAmount, context.tenureMonths, weights, asOf);
  const creditworthinessResult = scoreCreditworthiness(creditworthiness.creditScore, weights);
  const fraudDetection = scoreFraudDetection(transactions, weights, asOf);

  const { averageMonthlyNetInflow } = deriveCashFlowMetrics(transactions, asOf);

  const { assessment, riskFlags, decision } = combineEngines(
    { financialBehaviour, cashflowRisk, creditworthiness: creditworthinessResult, fraudDetection },
    weights,
    context.requestedAmount,
    averageMonthlyNetInflow,
    creditworthiness.dscr,
  );

  return { assessment, riskFlags, decision, scoringPolicyVersion: policyVersion };
}
