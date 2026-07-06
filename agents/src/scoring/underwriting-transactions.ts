/**
 * Shared transaction-derivation helpers for Stage 6's independent scoring engines
 * (underwriting-financial-behaviour.ts, -cashflow-risk.ts, -fraud-detection.ts). All
 * bucket NormalizedTransaction[] into a rolling 6-month window ending at `asOf`, using
 * the same 30.44-day month approximation already used elsewhere in this codebase
 * (agents/src/scoring/underwriting.ts's monthsSince, for business-age calculation).
 *
 * Centralizing this here means every engine reads the same computed cash-flow numbers
 * instead of each re-deriving them slightly differently.
 */
import type { CashFlowEvidence, NormalizedTransaction } from "./types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.44;
const WINDOW_MONTHS = 6;

/** 0 = the most recent month (asOf falls inside it), 5 = the oldest of the 6-month
 * window. Returns a value >= WINDOW_MONTHS (or negative, for future-dated rows) for
 * transactions outside the window — callers filter those out. */
function monthIndex(date: string, asOfMs: number): number {
  const daysAgo = (asOfMs - new Date(date).getTime()) / MS_PER_DAY;
  return Math.floor(daysAgo / DAYS_PER_MONTH);
}

function inWindow(idx: number): boolean {
  return idx >= 0 && idx < WINDOW_MONTHS;
}

/** Monthly inflow (credit) totals across the 6-month window, oldest first. Used both
 * for revenue-variance scoring and as the base series the Cashflow Risk engine's
 * stress test applies haircuts to. */
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

/** Groups debit transactions by counterparty and flags a group as a recurring debt
 * obligation only if it (a) has a named counterparty (a generic recurring expense
 * with no counterparty — rent, utilities, payroll — isn't debt service and would
 * otherwise be indistinguishable from a loan repayment by description alone), (b)
 * appears in at least 3 of the 6 months, and (c) has a consistent amount (every
 * occurrence within 15% of the group's average) — a one-off large debit or an
 * irregular series doesn't qualify. Sums each qualifying group's average amount as
 * its monthly contribution. */
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

/** Total credits minus total debits across the 6-month window, divided by 6. */
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

/** Coefficient of variation (stddev / mean) of the 6 monthly inflow totals. Returns 0
 * for a zero-mean series rather than dividing by zero — treated as neither consistent
 * nor volatile since there's no revenue to measure variance against. */
function revenueVarianceRatio(inflows: number[]): number {
  const mean = inflows.reduce((a, b) => a + b, 0) / inflows.length;
  if (mean <= 0) return 0;
  const variance = inflows.reduce((sum, v) => sum + (v - mean) ** 2, 0) / inflows.length;
  return Math.sqrt(variance) / mean;
}

/** The single entry point most engines use: derives net inflow, revenue variance, and
 * recurring debt obligations from the same raw transaction list in one pass. */
export function deriveCashFlowMetrics(transactions: NormalizedTransaction[], asOf?: string): CashFlowEvidence {
  const inflows = monthlyInflows(transactions, asOf);
  return {
    averageMonthlyNetInflow: averageMonthlyNetInflow(transactions, asOf),
    revenueVarianceRatio: revenueVarianceRatio(inflows),
    existingMonthlyDebtObligations: detectRecurringDebts(transactions, asOf),
  };
}

/** Most recent balanceAfter observed in the transaction list (by date), or undefined
 * if no transaction reports a balance — the liquidity/cash-reserve factors treat that
 * as data-unavailable rather than assuming a zero or infinite buffer. */
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

/** Average monthly outflow (debits only) across the 6-month window — the denominator
 * for both liquidity (Financial Behaviour) and cash-reserve-months (Cashflow Risk). */
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

/** Average monthly gross inflow (credits only) across the 6-month window — the
 * denominator for the Financial Behaviour engine's expense-discipline (burn rate)
 * factor. Distinct from averageMonthlyNetInflow (credits minus debits). */
export function averageMonthlyGrossInflow(transactions: NormalizedTransaction[], asOf?: string): number {
  const inflows = monthlyInflows(transactions, asOf);
  return inflows.reduce((a, b) => a + b, 0) / WINDOW_MONTHS;
}

/** Months between an ISO incorporation date and `asOf`, using the same 30.44-day
 * month approximation as the rest of this file. Shared by the Financial Behaviour
 * engine's business-age factor. */
export function monthsSince(isoDate: string, asOf: string): number {
  const start = new Date(isoDate).getTime();
  const now = new Date(asOf).getTime();
  return (now - start) / (MS_PER_DAY * DAYS_PER_MONTH);
}
