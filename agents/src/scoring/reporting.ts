/**
 * Portfolio aggregation (Ongoing — PortfolioReport). Pure function, no LLM
 * involvement — mirrors the same trust-boundary fix already applied to
 * Stage 6/9: the LLM previously counted and summed across every
 * MurabahahContract itself before writing PortfolioReport directly to the
 * ledger, a categorically different (and harder-to-verify) task than simple
 * categorical bucketing. A miscounted or mis-summed regulatory report is a
 * real risk, so the arithmetic now happens here, in code.
 *
 * Unlike Stage 2/3/6/9, there's no new party or registry for this stage —
 * aggregation isn't a judgment call with a "who is accountable for this
 * specific decision" question to close (there's nothing to be a real Shariah
 * board/sentinel/underwriter-style decision-maker over); `vetify` remains
 * the signatory. The LLM's only remaining role is writing the narrative
 * paragraph from these pre-computed numbers (agents/agents/reporting.ts) —
 * never the numbers themselves, and with no ledger-write tool access at all.
 */

/** The three MurabahahContract fields aggregation actually needs — everything
 * else on the real contract payload is irrelevant here. */
export interface MurabahahContractSnapshot {
  status: "Active" | "Delinquent" | "Completed" | "Defaulted" | "DelinquencyManualReview";
  salePrice: number;
  outstandingBalance: number;
}

export interface PortfolioMetrics {
  /** Non-terminal contracts: Active, Delinquent, and DelinquencyManualReview
   * (an ambiguous case still under review, not yet confirmed either way —
   * see scoring/monitoring.ts — is still an open facility, not resolved). */
  totalActiveContracts: number;
  /** Sum of salePrice across every contract ever created, regardless of status. */
  totalDisbursed: number;
  /** Sum of outstandingBalance across non-terminal contracts only. */
  totalOutstanding: number;
  /** Derived: totalDisbursed - totalOutstanding. */
  totalRepaid: number;
  /** Strictly confirmed Delinquent — DelinquencyManualReview is deliberately
   * excluded, same distinction scoring/monitoring.ts already draws between an
   * ambiguous signal and a confirmed one. */
  delinquentCount: number;
  completedCount: number;
  defaultedCount: number;
  /** delinquentCount / totalActiveContracts, as a percentage. 0 if no active contracts. */
  delinquencyRatePct: number;
  /** completedCount / total contracts ever created, as a percentage. 0 if none. */
  completionRatePct: number;
}

export function aggregatePortfolio(contracts: MurabahahContractSnapshot[]): PortfolioMetrics {
  let totalActiveContracts = 0;
  let totalDisbursed = 0;
  let totalOutstanding = 0;
  let delinquentCount = 0;
  let completedCount = 0;
  let defaultedCount = 0;

  for (const c of contracts) {
    totalDisbursed += c.salePrice;
    const isNonTerminal = c.status === "Active" || c.status === "Delinquent" || c.status === "DelinquencyManualReview";
    if (isNonTerminal) {
      totalActiveContracts += 1;
      totalOutstanding += c.outstandingBalance;
    }
    if (c.status === "Delinquent") delinquentCount += 1;
    if (c.status === "Completed") completedCount += 1;
    if (c.status === "Defaulted") defaultedCount += 1;
  }

  return {
    totalActiveContracts,
    totalDisbursed,
    totalOutstanding,
    totalRepaid: totalDisbursed - totalOutstanding,
    delinquentCount,
    completedCount,
    defaultedCount,
    delinquencyRatePct: totalActiveContracts > 0 ? (delinquentCount / totalActiveContracts) * 100 : 0,
    completionRatePct: contracts.length > 0 ? (completedCount / contracts.length) * 100 : 0,
  };
}
