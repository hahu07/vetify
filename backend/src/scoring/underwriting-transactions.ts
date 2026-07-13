/**
 * Ported from agents/src/scoring/underwriting-transactions.ts — see scoring/types.ts's
 * doc comment for why this copy exists (dev-only Stage 6 simulation route,
 * routes/dev.ts). Logic is identical to the agents-package original.
 *
 * Shared transaction-derivation helpers for Stage 6's independent scoring engines.
 * All bucket NormalizedTransaction[] into a rolling 6-month window ending at `asOf`,
 * using a 30.44-day month approximation.
 */
import type { CashFlowEvidence, NormalizedTransaction } from "./types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.44;
const WINDOW_MONTHS = 6;

function monthIndex(date: string, asOfMs: number): number {
  const daysAgo = (asOfMs - new Date(date).getTime()) / MS_PER_DAY;
  return Math.floor(daysAgo / DAYS_PER_MONTH);
}

function inWindow(idx: number): boolean {
  return idx >= 0 && idx < WINDOW_MONTHS;
}

export function monthlyInflows(transactions: NormalizedTransaction[], asOf?: string): number[] {
  const asOfMs = new Date(asOf ?? new Date().toISOString()).getTime();
  const buckets = new Array(WINDOW_MONTHS).fill(0) as number[];
  for (const tx of transactions) {
    if (tx.direction !== "credit") continue;
    const idx = monthIndex(tx.date, asOfMs);
    if (!inWindow(idx)) continue;
    buckets[WINDOW_MONTHS - 1 - idx] += tx.amount;
  }
  return buckets;
}

export function detectRecurringDebts(transactions: NormalizedTransaction[], asOf?: string): number {
  const asOfMs = new Date(asOf ?? new Date().toISOString()).getTime();
  const groups = new Map<string, { amounts: number[]; months: Set<number> }>();

  for (const tx of transactions) {
    if (tx.direction !== "debit" || !tx.counterparty) continue;
    const idx = monthIndex(tx.date, asOfMs);
    if (!inWindow(idx)) continue;
    const key = tx.counterparty.trim().toLowerCase();
    const group = groups.get(key) ?? { amounts: [], months: new Set<number>() };
    group.amounts.push(tx.amount);
    group.months.add(idx);
    groups.set(key, group);
  }

  let total = 0;
  for (const group of groups.values()) {
    if (group.months.size < 3) continue;
    const avg = group.amounts.reduce((a, b) => a + b, 0) / group.amounts.length;
    const maxDeviationRatio = Math.max(...group.amounts.map((a) => Math.abs(a - avg) / avg));
    if (maxDeviationRatio > 0.15) continue;
    total += avg;
  }
  return total;
}

function averageMonthlyNetInflow(transactions: NormalizedTransaction[], asOf?: string): number {
  const asOfMs = new Date(asOf ?? new Date().toISOString()).getTime();
  let totalCredit = 0;
  let totalDebit = 0;
  for (const tx of transactions) {
    const idx = monthIndex(tx.date, asOfMs);
    if (!inWindow(idx)) continue;
    if (tx.direction === "credit") totalCredit += tx.amount;
    else totalDebit += tx.amount;
  }
  return (totalCredit - totalDebit) / WINDOW_MONTHS;
}

function revenueVarianceRatio(inflows: number[]): number {
  const mean = inflows.reduce((a, b) => a + b, 0) / inflows.length;
  if (mean <= 0) return 0;
  const variance = inflows.reduce((sum, v) => sum + (v - mean) ** 2, 0) / inflows.length;
  return Math.sqrt(variance) / mean;
}

export function deriveCashFlowMetrics(transactions: NormalizedTransaction[], asOf?: string): CashFlowEvidence {
  const inflows = monthlyInflows(transactions, asOf);
  return {
    averageMonthlyNetInflow: averageMonthlyNetInflow(transactions, asOf),
    revenueVarianceRatio: revenueVarianceRatio(inflows),
    existingMonthlyDebtObligations: detectRecurringDebts(transactions, asOf),
  };
}

export function latestBalance(transactions: NormalizedTransaction[]): number | undefined {
  let latest: { date: string; balance: number } | undefined;
  for (const tx of transactions) {
    if (tx.balanceAfter === undefined) continue;
    if (!latest || new Date(tx.date).getTime() >= new Date(latest.date).getTime()) {
      latest = { date: tx.date, balance: tx.balanceAfter };
    }
  }
  return latest?.balance;
}

export function averageMonthlyOutflow(transactions: NormalizedTransaction[], asOf?: string): number {
  const asOfMs = new Date(asOf ?? new Date().toISOString()).getTime();
  let totalDebit = 0;
  for (const tx of transactions) {
    const idx = monthIndex(tx.date, asOfMs);
    if (!inWindow(idx) || tx.direction !== "debit") continue;
    totalDebit += tx.amount;
  }
  return totalDebit / WINDOW_MONTHS;
}

export function averageMonthlyGrossInflow(transactions: NormalizedTransaction[], asOf?: string): number {
  const inflows = monthlyInflows(transactions, asOf);
  return inflows.reduce((a, b) => a + b, 0) / WINDOW_MONTHS;
}

export function monthsSince(isoDate: string, asOf: string): number {
  const start = new Date(isoDate).getTime();
  const now = new Date(asOf).getTime();
  return (now - start) / (MS_PER_DAY * DAYS_PER_MONTH);
}
