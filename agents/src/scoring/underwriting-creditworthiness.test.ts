import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCreditworthiness } from "./underwriting-creditworthiness.js";
import { DEFAULT_UNDERWRITING_WEIGHTS } from "./types.js";

test("score >= 700 bands as excellent with no flags", () => {
  const result = scoreCreditworthiness(720, DEFAULT_UNDERWRITING_WEIGHTS);
  assert.equal(result.score, 100);
  assert.deepEqual(result.flags, []);
});

test("score 650-699 bands as good", () => {
  const result = scoreCreditworthiness(670, DEFAULT_UNDERWRITING_WEIGHTS);
  assert.equal(result.score, 70);
  assert.deepEqual(result.flags, []);
});

test("score 550-649 bands as fair", () => {
  const result = scoreCreditworthiness(600, DEFAULT_UNDERWRITING_WEIGHTS);
  assert.equal(result.score, 40);
  assert.deepEqual(result.flags, []);
});

test("score below 550 bands as poor and raises CREDIT_SCORE_POOR", () => {
  const result = scoreCreditworthiness(400, DEFAULT_UNDERWRITING_WEIGHTS);
  assert.equal(result.score, 0);
  assert.ok(result.flags.some((f) => f.code === "CREDIT_SCORE_POOR"));
});

test("unavailable score bands as poor (conservative) and raises CREDIT_SCORE_UNAVAILABLE, not CREDIT_SCORE_POOR", () => {
  const result = scoreCreditworthiness(undefined, DEFAULT_UNDERWRITING_WEIGHTS);
  assert.equal(result.score, 0);
  assert.ok(result.flags.some((f) => f.code === "CREDIT_SCORE_UNAVAILABLE"));
  assert.ok(!result.flags.some((f) => f.code === "CREDIT_SCORE_POOR"));
});

test("determinism: identical input produces identical output", () => {
  const a = scoreCreditworthiness(670, DEFAULT_UNDERWRITING_WEIGHTS);
  const b = scoreCreditworthiness(670, DEFAULT_UNDERWRITING_WEIGHTS);
  assert.deepEqual(a, b);
});

test("custom weights change the score", () => {
  const customWeights = { ...DEFAULT_UNDERWRITING_WEIGHTS, creditScoreGood: 50 };
  const result = scoreCreditworthiness(670, customWeights);
  assert.equal(result.score, 50);
});

test("band boundaries are policy-configurable, not hardcoded: a laxer threshold reclassifies the same score", () => {
  // 600 bands as Fair under the default creditScoreGoodThreshold (650), but Good
  // once an FI lowers its own threshold to 580.
  const defaultResult = scoreCreditworthiness(600, DEFAULT_UNDERWRITING_WEIGHTS);
  assert.equal(defaultResult.score, DEFAULT_UNDERWRITING_WEIGHTS.creditScoreFair);

  const laxWeights = { ...DEFAULT_UNDERWRITING_WEIGHTS, creditScoreGoodThreshold: 580 };
  const laxResult = scoreCreditworthiness(600, laxWeights);
  assert.equal(laxResult.score, DEFAULT_UNDERWRITING_WEIGHTS.creditScoreGood);
});
