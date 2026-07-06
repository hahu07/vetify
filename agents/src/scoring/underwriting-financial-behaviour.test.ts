import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFinancialBehaviour } from "./underwriting-financial-behaviour.js";
import { DEFAULT_UNDERWRITING_WEIGHTS } from "./types.js";
import { buildTestTransactions } from "./underwriting-test-helpers.js";

const ASOF = "2026-07-01T00:00:00.000Z";
const ESTABLISHED_INCORPORATION = "2020-01-01T00:00:00.000Z"; // > 24 months before ASOF
const NEW_BUSINESS_INCORPORATION = "2026-02-01T00:00:00.000Z"; // < 12 months before ASOF

const strongMonths = [1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000].map((inflow) => ({
  inflow,
  outflow: 600_000, // 60% burn rate — strong
  balance: 2_500_000, // buffer 2_500_000 / 600_000 ≈ 4.2x — strong
}));

test("strong evidence across all four factors scores 100 with no flags", () => {
  const result = scoreFinancialBehaviour(buildTestTransactions(strongMonths, ASOF), ESTABLISHED_INCORPORATION, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 100);
  assert.deepEqual(result.flags, []);
});

test("high revenue variance scores 0 for that factor and raises HIGH_REVENUE_VARIANCE", () => {
  const volatileMonths = [100_000, 2_000_000, 100_000, 2_000_000, 100_000, 2_000_000].map((inflow) => ({
    inflow,
    outflow: 600_000,
    balance: 2_500_000,
  }));
  const result = scoreFinancialBehaviour(buildTestTransactions(volatileMonths, ASOF), ESTABLISHED_INCORPORATION, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 70); // 0 (revenue) + 25 + 25 + 20
  assert.ok(result.flags.some((f) => f.code === "HIGH_REVENUE_VARIANCE"));
});

test("missing incorporation date flags BUSINESS_AGE_UNKNOWN, not NEW_BUSINESS", () => {
  const result = scoreFinancialBehaviour(buildTestTransactions(strongMonths, ASOF), undefined, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 75); // 30 + 0 (unknown) + 25 + 20
  assert.ok(result.flags.some((f) => f.code === "BUSINESS_AGE_UNKNOWN"));
  assert.ok(!result.flags.some((f) => f.code === "NEW_BUSINESS"));
});

test("business incorporated under 12 months ago flags NEW_BUSINESS, not BUSINESS_AGE_UNKNOWN", () => {
  const result = scoreFinancialBehaviour(buildTestTransactions(strongMonths, ASOF), NEW_BUSINESS_INCORPORATION, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 75); // 30 + 0 (new) + 25 + 20
  assert.ok(result.flags.some((f) => f.code === "NEW_BUSINESS"));
  assert.ok(!result.flags.some((f) => f.code === "BUSINESS_AGE_UNKNOWN"));
});

test("burn rate above 90% scores 0 for expense discipline and raises HIGH_BURN_RATE", () => {
  const poorDisciplineMonths = strongMonths.map((m) => ({ ...m, outflow: 950_000 }));
  const result = scoreFinancialBehaviour(buildTestTransactions(poorDisciplineMonths, ASOF), ESTABLISHED_INCORPORATION, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 75); // 30 + 25 + 0 + 20
  assert.ok(result.flags.some((f) => f.code === "HIGH_BURN_RATE"));
});

test("missing balance data scores 0 for liquidity and raises LIQUIDITY_DATA_UNAVAILABLE", () => {
  const noBalanceMonths = strongMonths.map(({ balance: _balance, ...rest }) => rest);
  const result = scoreFinancialBehaviour(buildTestTransactions(noBalanceMonths, ASOF), ESTABLISHED_INCORPORATION, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 80); // 30 + 25 + 25 + 0
  assert.ok(result.flags.some((f) => f.code === "LIQUIDITY_DATA_UNAVAILABLE"));
});

test("determinism: identical input produces identical output", () => {
  const transactions = buildTestTransactions(strongMonths, ASOF);
  const a = scoreFinancialBehaviour(transactions, ESTABLISHED_INCORPORATION, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  const b = scoreFinancialBehaviour(transactions, ESTABLISHED_INCORPORATION, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.deepEqual(a, b);
});

test("custom weights change the score", () => {
  const customWeights = { ...DEFAULT_UNDERWRITING_WEIGHTS, revenueConsistent: 10 };
  const result = scoreFinancialBehaviour(buildTestTransactions(strongMonths, ASOF), ESTABLISHED_INCORPORATION, customWeights, ASOF);
  assert.equal(result.score, 80); // 10 + 25 + 25 + 20
});

test("band boundaries are policy-configurable, not hardcoded: a laxer business-age threshold reclassifies the same age", () => {
  // NEW_BUSINESS_INCORPORATION is ~5 months before ASOF — New under the default
  // businessAgeModerateMonths (12), but Moderate once an FI lowers its own
  // threshold to 4 months.
  const defaultResult = scoreFinancialBehaviour(buildTestTransactions(strongMonths, ASOF), NEW_BUSINESS_INCORPORATION, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.ok(defaultResult.flags.some((f) => f.code === "NEW_BUSINESS"));

  const laxWeights = { ...DEFAULT_UNDERWRITING_WEIGHTS, businessAgeModerateMonths: 4 };
  const laxResult = scoreFinancialBehaviour(buildTestTransactions(strongMonths, ASOF), NEW_BUSINESS_INCORPORATION, laxWeights, ASOF);
  assert.ok(!laxResult.flags.some((f) => f.code === "NEW_BUSINESS"));
  assert.equal(laxResult.score, 30 + DEFAULT_UNDERWRITING_WEIGHTS.businessAgeModerate + 25 + 20);
});
