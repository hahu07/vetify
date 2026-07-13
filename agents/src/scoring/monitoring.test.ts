import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreDelinquency } from "./monitoring.js";
import { monthsSince } from "./underwriting-transactions.js";
import type { MonitoringContractSnapshot, NormalizedTransaction } from "./types.js";

const ASOF = "2026-07-01T00:00:00.000Z";
const START_DATE = "2026-01-01";
// monthsSince uses a 30.44-day average-month convention (same as underwriting's
// business-age scoring), so this floors to fewer than 6 even though the
// calendar gap is exactly 6 months — derive it rather than hardcode a wrong
// number so these fixtures stay correct if that convention ever changes.
const EXPECTED_PAID = Math.floor(monthsSince(START_DATE, ASOF));

function baseContract(overrides: Partial<MonitoringContractSnapshot> = {}): MonitoringContractSnapshot {
  return {
    status: "Active",
    startDate: START_DATE,
    tenureMonths: 12,
    installmentAmount: 200_000,
    installmentsPaid: EXPECTED_PAID, // on schedule by default
    ...overrides,
  };
}

test("current (paid up to schedule) is a no-op", () => {
  const result = scoreDelinquency(baseContract(), [], ASOF);
  assert.equal(result.missedCount, 0);
  assert.deepEqual(result.decision, { action: "NoOp" });
});

test("ahead of schedule (paid more than expected) is a no-op", () => {
  const result = scoreDelinquency(baseContract({ installmentsPaid: EXPECTED_PAID + 2 }), [], ASOF);
  assert.ok(result.missedCount < 0);
  assert.deepEqual(result.decision, { action: "NoOp" });
});

test("exactly one missed installment, no offsetting credit, flags for review (ambiguous, not auto-decided)", () => {
  const result = scoreDelinquency(baseContract({ installmentsPaid: EXPECTED_PAID - 1 }), [], ASOF);
  assert.equal(result.missedCount, 1);
  assert.equal(result.decision.action, "FlagForDelinquencyReview");
});

test("two or more missed installments, no offsetting credit, auto-flags delinquent", () => {
  const result = scoreDelinquency(baseContract({ installmentsPaid: EXPECTED_PAID - 2 }), [], ASOF);
  assert.equal(result.missedCount, 2);
  assert.equal(result.decision.action, "FlagDelinquent");
  if (result.decision.action === "FlagDelinquent") {
    assert.match(result.decision.reason, /2 installment/);
  }
});

test("two missed installments but a matching recent bank credit found flags for review instead of auto-flagging", () => {
  const offsettingCredit: NormalizedTransaction = {
    date: "2026-06-28",
    amount: 198_000, // within 5% tolerance of the 200,000 installment
    direction: "credit",
  };
  const result = scoreDelinquency(baseContract({ installmentsPaid: EXPECTED_PAID - 2 }), [offsettingCredit], ASOF);
  assert.equal(result.decision.action, "FlagForDelinquencyReview");
});

test("a credit far outside the tolerance does not count as offsetting", () => {
  const unrelatedCredit: NormalizedTransaction = {
    date: "2026-06-28",
    amount: 5_000, // nowhere near the installment amount
    direction: "credit",
  };
  const result = scoreDelinquency(baseContract({ installmentsPaid: EXPECTED_PAID - 2 }), [unrelatedCredit], ASOF);
  assert.equal(result.decision.action, "FlagDelinquent");
});

test("a matching credit outside the time window does not count as offsetting", () => {
  const staleCredit: NormalizedTransaction = {
    date: "2026-05-01", // well outside the 7-day window before ASOF
    amount: 200_000,
    direction: "credit",
  };
  const result = scoreDelinquency(baseContract({ installmentsPaid: EXPECTED_PAID - 2 }), [staleCredit], ASOF);
  assert.equal(result.decision.action, "FlagDelinquent");
});

test("a debit matching the installment amount does not count as an offsetting credit", () => {
  const debit: NormalizedTransaction = {
    date: "2026-06-28",
    amount: 200_000,
    direction: "debit",
  };
  const result = scoreDelinquency(baseContract({ installmentsPaid: EXPECTED_PAID - 2 }), [debit], ASOF);
  assert.equal(result.decision.action, "FlagDelinquent");
});

test("already Delinquent and back on schedule resolves via ResumeActive, not a silent no-op", () => {
  const result = scoreDelinquency(baseContract({ status: "Delinquent", installmentsPaid: EXPECTED_PAID + 2 }), [], ASOF);
  assert.equal(result.decision.action, "ResumeActive");
});

test("already DelinquencyManualReview and back on schedule resolves via ResumeActive", () => {
  const result = scoreDelinquency(baseContract({ status: "DelinquencyManualReview", installmentsPaid: EXPECTED_PAID + 2 }), [], ASOF);
  assert.equal(result.decision.action, "ResumeActive");
});

test("already Delinquent with 2+ still missed is a no-op, not a re-flag", () => {
  const result = scoreDelinquency(baseContract({ status: "Delinquent", installmentsPaid: EXPECTED_PAID - 2 }), [], ASOF);
  assert.deepEqual(result.decision, { action: "NoOp" });
});

test("already DelinquencyManualReview with exactly 1 missed and no new evidence is a no-op, not a re-flag", () => {
  const result = scoreDelinquency(baseContract({ status: "DelinquencyManualReview", installmentsPaid: EXPECTED_PAID - 1 }), [], ASOF);
  assert.deepEqual(result.decision, { action: "NoOp" });
});

test("Completed contracts are always a no-op regardless of installment math", () => {
  const result = scoreDelinquency(baseContract({ status: "Completed", installmentsPaid: 0 }), [], ASOF);
  assert.deepEqual(result.decision, { action: "NoOp" });
});

test("Defaulted contracts are always a no-op regardless of installment math", () => {
  const result = scoreDelinquency(baseContract({ status: "Defaulted", installmentsPaid: 0 }), [], ASOF);
  assert.deepEqual(result.decision, { action: "NoOp" });
});

test("determinism: identical input produces identical output", () => {
  const a = scoreDelinquency(baseContract({ installmentsPaid: EXPECTED_PAID - 2 }), [], ASOF);
  const b = scoreDelinquency(baseContract({ installmentsPaid: EXPECTED_PAID - 2 }), [], ASOF);
  assert.deepEqual(a, b);
});

test("respects tenureMonths as a ceiling on expected installments", () => {
  // 18 months elapsed but tenure is only 12 — expected caps at 12, not 18.
  const result = scoreDelinquency(
    baseContract({ startDate: "2025-01-01", tenureMonths: 12, installmentsPaid: 12 }),
    [],
    ASOF,
  );
  assert.equal(result.missedCount, 0);
  assert.deepEqual(result.decision, { action: "NoOp" });
});
