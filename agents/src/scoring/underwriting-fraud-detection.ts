/**
 * Fraud Detection engine (Stage 6, one of five independent scoring engines — see
 * underwriting.ts for the orchestrator). Populates RiskAssessment.fraudScore.
 *
 * This is explicitly rule-based / heuristic pattern-matching over the raw transaction
 * list — NOT machine-learning fraud detection. There is no labeled fraud-outcome
 * dataset for this platform (same "no historical data yet" reasoning that keeps
 * PD/LGD/EAD unpopulated — see types.ts), so a real ML fraud model would have nothing
 * to train or validate against. These four checks are deterministic and explainable —
 * each one names exactly which transactions triggered it — at the cost of being far
 * less sensitive than a trained model would be. Treat this as a first-pass screen for
 * a human reviewer, not a final fraud determination.
 *
 * Starts at 100 and subtracts a policy-configurable penalty per triggered rule,
 * floored at 0 (unlike the other three engines, which score upward from 0).
 */
import type { NormalizedTransaction, EngineResult, UnderwritingRiskFlag, UnderwritingScoringWeights } from "./types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STRUCTURING_THRESHOLDS = [500_000, 1_000_000, 5_000_000, 10_000_000];
const STRUCTURING_WINDOW_DAYS = 7;
const STRUCTURING_MIN_COUNT = 3;
const ROUND_TRIP_WINDOW_DAYS = 5;
const ROUND_TRIP_TOLERANCE = 0.05;
const INCOME_SPIKE_WINDOW_DAYS = 30;
const INCOME_SPIKE_MULTIPLE = 2.0;
const VELOCITY_WINDOW_DAYS = 7;
const VELOCITY_MULTIPLE = 3.0;

function daysBefore(date: string, asOfMs: number): number {
  return (asOfMs - new Date(date).getTime()) / MS_PER_DAY;
}

/** Flags a rolling window (any STRUCTURING_WINDOW_DAYS-day span) containing at least
 * STRUCTURING_MIN_COUNT transactions each sitting just under one of the round-number
 * thresholds — a classic structuring/smurfing pattern (staying under a threshold that
 * would otherwise trigger reporting). */
function detectStructuring(transactions: NormalizedTransaction[]): boolean {
  const nearThreshold = transactions.filter((tx) =>
    STRUCTURING_THRESHOLDS.some((t) => tx.amount < t && tx.amount >= t * 0.9),
  );
  for (const anchor of nearThreshold) {
    const anchorMs = new Date(anchor.date).getTime();
    const count = nearThreshold.filter((tx) => {
      const diffDays = Math.abs(new Date(tx.date).getTime() - anchorMs) / MS_PER_DAY;
      return diffDays <= STRUCTURING_WINDOW_DAYS;
    }).length;
    if (count >= STRUCTURING_MIN_COUNT) return true;
  }
  return false;
}

/** Flags a counterparty with both a debit and a credit of near-equal amount within
 * ROUND_TRIP_WINDOW_DAYS of each other — money moving out and back with no apparent
 * economic purpose ("wash" pattern). */
function detectRoundTripping(transactions: NormalizedTransaction[]): boolean {
  const byCounterparty = new Map<string, NormalizedTransaction[]>();
  for (const tx of transactions) {
    if (!tx.counterparty) continue;
    const key = tx.counterparty.trim().toLowerCase();
    const list = byCounterparty.get(key) ?? [];
    list.push(tx);
    byCounterparty.set(key, list);
  }
  for (const list of byCounterparty.values()) {
    const debits = list.filter((tx) => tx.direction === "debit");
    const credits = list.filter((tx) => tx.direction === "credit");
    for (const d of debits) {
      for (const c of credits) {
        const diffDays = Math.abs(new Date(d.date).getTime() - new Date(c.date).getTime()) / MS_PER_DAY;
        const amountDiffRatio = Math.abs(d.amount - c.amount) / Math.max(d.amount, c.amount);
        if (diffDays <= ROUND_TRIP_WINDOW_DAYS && amountDiffRatio <= ROUND_TRIP_TOLERANCE) return true;
      }
    }
  }
  return false;
}

/** Flags total inflow in the 30 days immediately before `asOf` exceeding
 * INCOME_SPIKE_MULTIPLE times the average monthly inflow of the preceding 5 months —
 * possible "window dressing" of income shortly before applying. */
function detectIncomeSpike(transactions: NormalizedTransaction[], asOfMs: number): boolean {
  let recent = 0;
  let priorTotal = 0;
  for (const tx of transactions) {
    if (tx.direction !== "credit") continue;
    const daysAgo = daysBefore(tx.date, asOfMs);
    if (daysAgo < 0) continue;
    if (daysAgo <= INCOME_SPIKE_WINDOW_DAYS) recent += tx.amount;
    else if (daysAgo <= 6 * 30.44) priorTotal += tx.amount;
  }
  const priorMonthlyAvg = priorTotal / 5;
  if (priorMonthlyAvg <= 0) return false;
  return recent > INCOME_SPIKE_MULTIPLE * priorMonthlyAvg;
}

/** Minimum total transactions in the 6-month window before the velocity check runs at
 * all — with only a handful of transactions, "the average" isn't a statistically
 * meaningful baseline, and a small recent cluster would trip the multiple test on
 * noise alone (same "don't draw a conclusion from too little data" principle as the
 * *_UNAVAILABLE flags elsewhere in this codebase). */
const VELOCITY_MIN_SAMPLE_SIZE = 10;

/** Flags transaction count in the 7 days before `asOf` exceeding VELOCITY_MULTIPLE
 * times the trailing weekly average over the full 6-month window. */
function detectVelocityAnomaly(transactions: NormalizedTransaction[], asOfMs: number): boolean {
  let recentCount = 0;
  let totalCount = 0;
  for (const tx of transactions) {
    const daysAgo = daysBefore(tx.date, asOfMs);
    if (daysAgo < 0 || daysAgo > 6 * 30.44) continue;
    totalCount += 1;
    if (daysAgo <= VELOCITY_WINDOW_DAYS) recentCount += 1;
  }
  if (totalCount < VELOCITY_MIN_SAMPLE_SIZE) return false;
  const weeklyAvg = totalCount / ((6 * 30.44) / VELOCITY_WINDOW_DAYS);
  if (weeklyAvg <= 0) return false;
  return recentCount > VELOCITY_MULTIPLE * weeklyAvg;
}

export function scoreFraudDetection(transactions: NormalizedTransaction[], weights: UnderwritingScoringWeights, asOf?: string): EngineResult {
  const asOfMs = new Date(asOf ?? new Date().toISOString()).getTime();
  const flags: UnderwritingRiskFlag[] = [];
  let penalty = 0;

  if (detectStructuring(transactions)) {
    penalty += weights.fraudStructuringPenalty;
    flags.push({ code: "FRAUD_STRUCTURING_PATTERN", description: `${STRUCTURING_MIN_COUNT}+ transactions just under a round-number threshold within a ${STRUCTURING_WINDOW_DAYS}-day window — possible structuring` });
  }
  if (detectRoundTripping(transactions)) {
    penalty += weights.fraudRoundTrippingPenalty;
    flags.push({ code: "FRAUD_ROUND_TRIPPING", description: `Matching in/out transfers with the same counterparty within ${ROUND_TRIP_WINDOW_DAYS} days — possible wash pattern` });
  }
  if (detectIncomeSpike(transactions, asOfMs)) {
    penalty += weights.fraudIncomeSpikePenalty;
    flags.push({ code: "FRAUD_INCOME_SPIKE_PRE_APPLICATION", description: `Inflow in the last ${INCOME_SPIKE_WINDOW_DAYS} days exceeds ${INCOME_SPIKE_MULTIPLE}x the trailing 5-month average — possible income window-dressing` });
  }
  if (detectVelocityAnomaly(transactions, asOfMs)) {
    penalty += weights.fraudVelocityAnomalyPenalty;
    flags.push({ code: "FRAUD_VELOCITY_ANOMALY", description: `Transaction count in the last ${VELOCITY_WINDOW_DAYS} days exceeds ${VELOCITY_MULTIPLE}x the trailing weekly average` });
  }

  return { score: Math.max(0, 100 - penalty), flags };
}
