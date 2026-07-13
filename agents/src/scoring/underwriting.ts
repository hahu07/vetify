/**
 * Deterministic Stage 6 (underwriting) scoring — orchestrator over five independent
 * engines, mirroring the off-ledger determinism already applied to Stages 2/3
 * (agents/src/scoring/verification.ts, compliance.ts): the LLM gathers evidence (a
 * normalized transaction list plus mono.co creditworthiness) and reports it as
 * structured JSON; each engine below computes its own 0-100 sub-score from that
 * evidence, and this module combines them. Given the same evidence and the same
 * weights, this always produces the same result — no LLM involved in any number,
 * only in relaying/normalizing raw mono.co fields beforehand.
 *
 *   underwriting-financial-behaviour.ts  — income stability, expense discipline,
 *                                          liquidity, revenue consistency
 *   underwriting-cashflow-risk.ts        — net cashflow, DSCR, cash reserve months,
 *                                          3-scenario stress test
 *   underwriting-creditworthiness.ts     — bureau credit score banding
 *   underwriting-fraud-detection.ts      — rule-based transaction pattern flags
 *   underwriting-final-decision.ts       — weighted combinator + fraud hard override
 *
 * Mirrors scoreVerification/scoreCompliance's Approve/Reject/Flag decision pattern:
 * `assessor` is now a real Canton party with its own screening authority (mirrors
 * verifier screening businesses before Stage 5) — Low risk auto-qualifies
 * (BeginUnderwriting), Medium risk escalates to a human assessor
 * (FlagUnderwritingForManualReview), High risk is a hard veto (RejectUnderwriting)
 * that never reaches the FI. See underwriting-final-decision.ts's `decision` field.
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
