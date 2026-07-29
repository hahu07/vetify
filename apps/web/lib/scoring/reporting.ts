/**
 * Portfolio aggregation (Ongoing — PortfolioReport). Pure function, no LLM
 * involvement — ported verbatim from agents/src/scoring/reporting.ts (the
 * same deterministic engine the real Reporting Agent uses), since this
 * migration has no LLM at all and the arithmetic is identical either way:
 * a miscounted or mis-summed regulatory report is a real risk, so it stays
 * in code, not in a narrative.
 *
 * Unlike Stage 2/3/6/9, there's no new registry for this stage — aggregation
 * isn't a judgment call with a "who is accountable for this decision"
 * question to close; `vetify` remains the signatory. This migration has no
 * LLM to write the narrative paragraph either, so the `summary` on the
 * created report is a deterministic templated sentence built from these
 * pre-computed numbers, not a fabricated narrative.
 */

export interface MurabahahContractSnapshot {
  status: "Active" | "Delinquent" | "Completed" | "Defaulted" | "DelinquencyManualReview";
  salePrice: number;
  outstandingBalance: number;
}

export interface PortfolioMetrics {
  /** Non-terminal contracts: Active, Delinquent, and DelinquencyManualReview
   * (an ambiguous case still under review, not yet confirmed either way) is
   * still an open facility, not resolved. */
  totalActiveContracts: number;
  /** Sum of salePrice across every contract ever created, regardless of status. */
  totalDisbursed: number;
  /** Sum of outstandingBalance across non-terminal contracts only. */
  totalOutstanding: number;
  /** Derived: totalDisbursed - totalOutstanding. */
  totalRepaid: number;
  /** Strictly confirmed Delinquent — DelinquencyManualReview is deliberately
   * excluded, same distinction lib/domain/murabahah.ts's flagDelinquent
   * already draws between an ambiguous signal and a confirmed one. */
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

/** Deterministic templated summary -- stands in for the real Reporting
 * Agent's LLM-authored narrative, which this migration has no LLM to run. */
export function buildSummary(metrics: PortfolioMetrics): string {
  return (
    `Portfolio snapshot: ${metrics.totalActiveContracts} active facilit${metrics.totalActiveContracts === 1 ? "y" : "ies"}, ` +
    `${metrics.totalDisbursed.toFixed(2)} disbursed and ${metrics.totalOutstanding.toFixed(2)} outstanding. ` +
    `${metrics.delinquentCount} delinquent (${metrics.delinquencyRatePct.toFixed(1)}% of active), ` +
    `${metrics.completedCount} completed (${metrics.completionRatePct.toFixed(1)}% of all facilities ever opened), ` +
    `${metrics.defaultedCount} defaulted.`
  );
}
