import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFraudDetection } from "./underwriting-fraud-detection.js";
import { DEFAULT_UNDERWRITING_WEIGHTS } from "./types.js";
import type { NormalizedTransaction } from "./types.js";
import { buildTestTransactions } from "./underwriting-test-helpers.js";

const ASOF = "2026-07-01T00:00:00.000Z";

const cleanMonths = [1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000].map((inflow) => ({
  inflow,
  outflow: 600_000,
}));

const structuringTransactions: NormalizedTransaction[] = [
  { date: "2026-06-25T00:00:00.000Z", amount: 950_000, direction: "debit" },
  { date: "2026-06-27T00:00:00.000Z", amount: 960_000, direction: "debit" },
  { date: "2026-06-29T00:00:00.000Z", amount: 940_000, direction: "debit" },
];

const roundTripTransactions: NormalizedTransaction[] = [
  { date: "2026-06-20T00:00:00.000Z", amount: 500_000, direction: "debit", counterparty: "Acme Traders" },
  { date: "2026-06-23T00:00:00.000Z", amount: 495_000, direction: "credit", counterparty: "Acme Traders" },
];

const incomeSpikeTransactions: NormalizedTransaction[] = [
  { date: "2026-05-02T00:00:00.000Z", amount: 200_000, direction: "credit" }, // ~60 days ago
  { date: "2026-04-02T00:00:00.000Z", amount: 200_000, direction: "credit" }, // ~90 days ago
  { date: "2026-03-03T00:00:00.000Z", amount: 200_000, direction: "credit" }, // ~120 days ago
  { date: "2026-02-01T00:00:00.000Z", amount: 200_000, direction: "credit" }, // ~150 days ago
  { date: "2026-01-02T00:00:00.000Z", amount: 200_000, direction: "credit" }, // ~180 days ago
  { date: "2026-06-21T00:00:00.000Z", amount: 3_000_000, direction: "credit" }, // ~10 days ago — the spike
];

const velocityAnomalyTransactions: NormalizedTransaction[] = [
  ...[40, 70, 100, 130, 160, 175].map((daysAgo) => ({
    date: new Date(new Date(ASOF).getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    amount: 50_000,
    direction: "debit" as const,
  })),
  ...[1, 2, 3, 4, 5, 6].flatMap((daysAgo) =>
    Array.from({ length: 2 }, () => ({
      date: new Date(new Date(ASOF).getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
      amount: 50_000,
      direction: "debit" as const,
    })),
  ),
];

test("clean transaction history scores 100 with no flags", () => {
  const result = scoreFraudDetection(buildTestTransactions(cleanMonths, ASOF), DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 100);
  assert.deepEqual(result.flags, []);
});

test("3+ near-threshold transactions within 7 days raises FRAUD_STRUCTURING_PATTERN", () => {
  const result = scoreFraudDetection(structuringTransactions, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 60); // 100 - 40
  assert.ok(result.flags.some((f) => f.code === "FRAUD_STRUCTURING_PATTERN"));
});

test("matching in/out transfers with the same counterparty raises FRAUD_ROUND_TRIPPING", () => {
  const result = scoreFraudDetection(roundTripTransactions, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 70); // 100 - 30
  assert.ok(result.flags.some((f) => f.code === "FRAUD_ROUND_TRIPPING"));
});

test("inflow spike in the last 30 days raises FRAUD_INCOME_SPIKE_PRE_APPLICATION", () => {
  const result = scoreFraudDetection(incomeSpikeTransactions, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 80); // 100 - 20
  assert.ok(result.flags.some((f) => f.code === "FRAUD_INCOME_SPIKE_PRE_APPLICATION"));
});

test("transaction burst in the last 7 days raises FRAUD_VELOCITY_ANOMALY", () => {
  const result = scoreFraudDetection(velocityAnomalyTransactions, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 80); // 100 - 20
  assert.ok(result.flags.some((f) => f.code === "FRAUD_VELOCITY_ANOMALY"));
});

test("multiple triggered rules stack and floor at 0, not negative", () => {
  const combined = [...structuringTransactions, ...roundTripTransactions, ...incomeSpikeTransactions, ...velocityAnomalyTransactions];
  const result = scoreFraudDetection(combined, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.equal(result.score, 0); // 100 - (40+30+20+20) = -10, floored at 0
  assert.equal(result.flags.length, 4);
});

test("determinism: identical input produces identical output", () => {
  const a = scoreFraudDetection(structuringTransactions, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  const b = scoreFraudDetection(structuringTransactions, DEFAULT_UNDERWRITING_WEIGHTS, ASOF);
  assert.deepEqual(a, b);
});

test("custom weights change the penalty applied", () => {
  const customWeights = { ...DEFAULT_UNDERWRITING_WEIGHTS, fraudStructuringPenalty: 10 };
  const result = scoreFraudDetection(structuringTransactions, customWeights, ASOF);
  assert.equal(result.score, 90); // 100 - 10
});
