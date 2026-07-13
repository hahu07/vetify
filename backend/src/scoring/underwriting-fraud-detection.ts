/**
 * Ported from agents/src/scoring/underwriting-fraud-detection.ts — see
 * scoring/types.ts's doc comment for why this copy exists (dev-only Stage 6
 * simulation route, routes/dev.ts). Logic is identical to the agents-package
 * original.
 *
 * Fraud Detection engine (one of five independent Stage 6 scoring engines).
 * Rule-based / heuristic pattern-matching over the raw transaction list — NOT
 * machine-learning fraud detection. Populates RiskAssessment.fraudScore. Starts at
 * 100 and subtracts a penalty per triggered rule, floored at 0.
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

const VELOCITY_MIN_SAMPLE_SIZE = 10;

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
