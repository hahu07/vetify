import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCashflowRisk } from "./underwriting-cashflow-risk.js";
import { DEFAULT_UNDERWRITING_WEIGHTS } from "./types.js";
import type { CreditworthinessEvidence } from "./types.js";
import { buildTestTransactions } from "./underwriting-test-helpers.js";

const ASOF = "2026-07-01T00:00:00.000Z";
const strongMonths = [1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000].map((inflow) => ({
  inflow,
  outflow: 200_000,
  balance: 2_500_000,
}));
const strongCredit: CreditworthinessEvidence = { dscr: 1.8, creditScore: 720 };

test("strong evidence across all four factors scores 100", () => {
  const result = scoreCashflowRisk(buildTestTransactions(strongMonths, ASOF), strongCredit, 1_200_000, 12, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 100); // 40 + 25 + 20 + 15
  assert.deepEqual(result.flags, []);
});

test("unavailable DSCR scores 0 for that factor and raises DSCR_UNAVAILABLE, not DSCR_BELOW_ONE", () => {
  const result = scoreCashflowRisk(buildTestTransactions(strongMonths, ASOF), { dscr: undefined }, 1_200_000, 12, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 60); // 0 + 25 + 20 + 15
  assert.ok(result.flags.some((f) => f.code === "DSCR_UNAVAILABLE"));
  assert.ok(!result.flags.some((f) => f.code === "DSCR_BELOW_ONE"));
});

test("DSCR below 1.0 scores 0 for that factor and raises DSCR_BELOW_ONE, not DSCR_UNAVAILABLE", () => {
  const result = scoreCashflowRisk(buildTestTransactions(strongMonths, ASOF), { dscr: 0.8 }, 1_200_000, 12, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 60); // 0 + 25 + 20 + 15
  assert.ok(result.flags.some((f) => f.code === "DSCR_BELOW_ONE"));
  assert.ok(!result.flags.some((f) => f.code === "DSCR_UNAVAILABLE"));
});

test("existing debt above 30% of net inflow raises OVER_LEVERAGED and scores 0 for debt obligations", () => {
  const overLeveragedMonths = strongMonths.map((m) => ({ ...m, recurringDebt: 300_000 }));
  const result = scoreCashflowRisk(buildTestTransactions(overLeveragedMonths, ASOF), strongCredit, 1_200_000, 12, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 75); // 40 + 0 + 20 + 15
  assert.ok(result.flags.some((f) => f.code === "OVER_LEVERAGED"));
});

test("missing balance data scores 0 for cash reserve and raises CASH_RESERVE_UNAVAILABLE", () => {
  const noBalanceMonths = strongMonths.map(({ balance: _balance, ...rest }) => rest);
  const result = scoreCashflowRisk(buildTestTransactions(noBalanceMonths, ASOF), strongCredit, 1_200_000, 12, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 80); // 40 + 25 + 0 + 15
  assert.ok(result.flags.some((f) => f.code === "CASH_RESERVE_UNAVAILABLE"));
});

test("missing tenure scores 0 for the stress test and raises STRESS_TEST_UNAVAILABLE", () => {
  const result = scoreCashflowRisk(buildTestTransactions(strongMonths, ASOF), strongCredit, 1_200_000, undefined, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 85); // 40 + 25 + 20 + 0
  assert.ok(result.flags.some((f) => f.code === "STRESS_TEST_UNAVAILABLE"));
});

test("stress test fails all three scenarios when the estimated installment swamps gross inflow", () => {
  // installment = 12,000,000 / 1 = 12,000,000, far above the 1,000,000 monthly gross inflow
  const result = scoreCashflowRisk(buildTestTransactions(strongMonths, ASOF), strongCredit, 12_000_000, 1, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 85); // 40 + 25 + 20 + 0
  assert.ok(result.flags.some((f) => f.code === "STRESS_TEST_FAILED"));
});

test("stress test passes some but not all scenarios", () => {
  // installment = 800,000 / 1 = 800,000: passes -10% (900k >= 800k), fails -25%/-40% (750k/600k < 800k)
  const result = scoreCashflowRisk(buildTestTransactions(strongMonths, ASOF), strongCredit, 800_000, 1, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 92); // 40 + 25 + 20 + 7
  assert.ok(result.flags.some((f) => f.code === "STRESS_TEST_PARTIAL"));
});

test("determinism: identical input produces identical output", () => {
  const transactions = buildTestTransactions(strongMonths, ASOF);
  const a = scoreCashflowRisk(transactions, strongCredit, 1_200_000, 12, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  const b = scoreCashflowRisk(transactions, strongCredit, 1_200_000, 12, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.deepEqual(a, b);
});

test("custom weights change the score", () => {
  const customWeights = { ...DEFAULT_UNDERWRITING_WEIGHTS, dscrHigh: 10 };
  const result = scoreCashflowRisk(buildTestTransactions(strongMonths, ASOF), strongCredit, 1_200_000, 12, customWeights, ASOF);
  assert.equal(result.score, 70); // 10 + 25 + 20 + 15
});

test("band boundaries are policy-configurable, not hardcoded: a laxer DSCR threshold reclassifies the same DSCR", () => {
  // DSCR 1.2 bands as Medium under the default dscrHighThreshold (1.5), but High
  // once an FI lowers its own threshold to 1.1.
  const defaultResult = scoreCashflowRisk(buildTestTransactions(strongMonths, ASOF), { dscr: 1.2 }, 1_200_000, 12, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.ok(defaultResult.flags.every((f) => f.code !== "DSCR_BELOW_ONE"));
  assert.equal(defaultResult.score, DEFAULT_UNDERWRITING_WEIGHTS.dscrMedium + 25 + 20 + 15);

  const laxWeights = { ...DEFAULT_UNDERWRITING_WEIGHTS, dscrHighThreshold: 1.1 };
  const laxResult = scoreCashflowRisk(buildTestTransactions(strongMonths, ASOF), { dscr: 1.2 }, 1_200_000, 12, laxWeights, ASOF);
  assert.equal(laxResult.score, DEFAULT_UNDERWRITING_WEIGHTS.dscrHigh + 25 + 20 + 15);
});
