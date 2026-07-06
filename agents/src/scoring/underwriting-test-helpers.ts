/**
 * Test-only helpers for building synthetic NormalizedTransaction lists — not a
 * *.test.ts file itself (agents/package.json's test script globs src/scoring/*.test.ts
 * only), so this is never picked up as a test suite on its own.
 */
import type { NormalizedTransaction } from "./types.js";

const DAYS_PER_MONTH = 30.44;

function dateNDaysBefore(asOf: string, daysAgo: number): string {
  const ms = new Date(asOf).getTime() - daysAgo * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export interface MonthlyPattern {
  /** Gross credit total for this month, in NGN. */
  inflow: number;
  /** Gross miscellaneous debit total for this month (excluding recurringDebt), in NGN. */
  outflow?: number;
  /** If set, adds one recurring debit transaction this month at this amount, tagged
   * with a consistent counterparty so detectRecurringDebts() picks it up when present
   * across enough months. */
  recurringDebt?: number;
  /** If set, tags this month's last transaction with this closing balance. */
  balance?: number;
}

/** Builds a 6-month transaction history from oldest (index 0) to most recent (index 5)
 * monthly patterns, each rendered as one inflow transaction, one misc outflow
 * transaction, and (optionally) one recurring-debt transaction, dated at the midpoint
 * of their respective 30.44-day bucket relative to `asOf`. */
export function buildTestTransactions(months: MonthlyPattern[], asOf: string): NormalizedTransaction[] {
  const transactions: NormalizedTransaction[] = [];
  months.forEach((month, i) => {
    const bucketsAgo = months.length - 1 - i; // 0 = most recent month
    const midpointDaysAgo = bucketsAgo * DAYS_PER_MONTH + DAYS_PER_MONTH / 2;
    const date = dateNDaysBefore(asOf, midpointDaysAgo);

    if (month.inflow > 0) {
      transactions.push({ date, amount: month.inflow, direction: "credit", description: "Sales revenue" });
    }
    if (month.outflow) {
      transactions.push({ date, amount: month.outflow, direction: "debit", description: "Operating expenses" });
    }
    if (month.recurringDebt) {
      transactions.push({ date, amount: month.recurringDebt, direction: "debit", counterparty: "Recurring Loan Provider", description: "Loan repayment" });
    }
    if (month.balance !== undefined) {
      transactions[transactions.length - 1].balanceAfter = month.balance;
    }
  });
  return transactions;
}
