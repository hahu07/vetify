/**
 * Delinquency scoring engine (Stage 9, one deterministic function — no LLM
 * involvement — mirrors the Stage 2/3/6 pattern). Computes months elapsed vs.
 * installments actually recorded on-ledger, cross-checks a possible unrecorded
 * bank credit, and returns the decision agents/src/agents/monitoring.ts's
 * runDelinquencyMonitor dispatches in code.
 *
 * Unlike Stage 2/3/6's Medium band (genuinely insufficient/conflicting
 * evidence), "one missed payment" alone isn't ambiguous — it's just early.
 * The genuinely ambiguous case — mirrored here as FlagForDelinquencyReview,
 * escalating to a human sentinel rather than auto-deciding either way — is
 * when the ledger's installment count and the bank's actual transaction
 * history disagree: either exactly one payment is behind (too early to be
 * sure it's a real default vs. a processing delay), or two-or-more appear
 * missed but a plausible matching credit sits unrecorded on the account.
 */
import type { MonitoringContractSnapshot, MonitoringDecision, MonitoringScoringResult, NormalizedTransaction } from "./types.js";
import { monthsSince } from "./underwriting-transactions.js";

const OFFSETTING_CREDIT_WINDOW_DAYS = 7;
/** How close a credit's amount must be to the installment amount to count as a
 * plausible (not just coincidental) offsetting payment. */
const OFFSETTING_CREDIT_TOLERANCE = 0.05;

function daysBetween(isoA: string, isoB: string): number {
  return Math.abs(new Date(isoA).getTime() - new Date(isoB).getTime()) / (1000 * 60 * 60 * 24);
}

/** Looks for a credit roughly matching the installment amount within the last
 * OFFSETTING_CREDIT_WINDOW_DAYS of asOf — a plausible bank-side payment that
 * hasn't been recorded on-ledger yet via RecordPayment. */
function findOffsettingCredit(transactions: NormalizedTransaction[], installmentAmount: number, asOf: string): boolean {
  if (installmentAmount <= 0) return false;
  return transactions.some((tx) => {
    if (tx.direction !== "credit") return false;
    if (daysBetween(tx.date, asOf) > OFFSETTING_CREDIT_WINDOW_DAYS) return false;
    return Math.abs(tx.amount - installmentAmount) / installmentAmount <= OFFSETTING_CREDIT_TOLERANCE;
  });
}

function buildDecision(
  status: MonitoringContractSnapshot["status"],
  missedCount: number,
  offsettingCreditFound: boolean,
): MonitoringDecision {
  if (missedCount <= 0) {
    if (status === "Delinquent" || status === "DelinquencyManualReview") {
      return { action: "ResumeActive", note: "Recorded installments now meet or exceed the expected schedule position." };
    }
    return { action: "NoOp" };
  }

  if (offsettingCreditFound) {
    if (status === "DelinquencyManualReview") return { action: "NoOp" };
    return {
      action: "FlagForDelinquencyReview",
      note: `${missedCount} installment(s) appear missed, but a bank credit approximately matching the installment amount was found within the last ${OFFSETTING_CREDIT_WINDOW_DAYS} days — may be an unrecorded payment.`,
    };
  }

  if (missedCount === 1) {
    if (status === "DelinquencyManualReview") return { action: "NoOp" };
    return {
      action: "FlagForDelinquencyReview",
      note: "One installment appears missed — too early to distinguish a real default from a processing delay.",
    };
  }

  // missedCount >= 2, no offsetting credit
  if (status === "Delinquent") return { action: "NoOp" };
  return {
    action: "FlagDelinquent",
    reason: `Business has missed ${missedCount} installment(s) with no offsetting bank credit found.`,
  };
}

export function scoreDelinquency(
  contract: MonitoringContractSnapshot,
  recentTransactions: NormalizedTransaction[],
  asOf?: string,
): MonitoringScoringResult {
  const effectiveAsOf = asOf ?? new Date().toISOString();

  if (contract.status === "Completed" || contract.status === "Defaulted") {
    return { missedCount: 0, decision: { action: "NoOp" } };
  }

  const monthsElapsed = Math.floor(monthsSince(contract.startDate, effectiveAsOf));
  const expectedPaid = Math.min(Math.max(monthsElapsed, 0), contract.tenureMonths);
  const missedCount = expectedPaid - contract.installmentsPaid;

  const offsettingCreditFound = missedCount > 0
    ? findOffsettingCredit(recentTransactions, contract.installmentAmount, effectiveAsOf)
    : false;

  return {
    missedCount,
    decision: buildDecision(contract.status, missedCount, offsettingCreditFound),
  };
}
