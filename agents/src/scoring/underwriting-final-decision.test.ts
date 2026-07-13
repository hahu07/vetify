import { test } from "node:test";
import assert from "node:assert/strict";
import { combineEngines } from "./underwriting-final-decision.js";
import type { CombineEngineInputs } from "./underwriting-final-decision.js";
import { DEFAULT_UNDERWRITING_WEIGHTS } from "./types.js";
import type { EngineResult } from "./types.js";

const strong: EngineResult = { score: 100, flags: [] };

function engines(overrides: Partial<CombineEngineInputs> = {}): CombineEngineInputs {
  return {
    financialBehaviour: strong,
    cashflowRisk: strong,
    creditworthiness: strong,
    fraudDetection: strong,
    ...overrides,
  };
}

test("weighted average of four strong engines composes to 100 and Low risk", () => {
  const { assessment, riskFlags } = combineEngines(engines(), DEFAULT_UNDERWRITING_WEIGHTS, 1_000_000, 500_000, 1.8);
  assert.equal(assessment.score, 100);
  assert.equal(assessment.riskCategory, "Low");
  assert.equal(assessment.behaviouralScore, 100);
  assert.equal(assessment.cashflowRiskScore, 100);
  assert.equal(assessment.creditworthinessScore, 100);
  assert.equal(assessment.fraudScore, 100);
  assert.deepEqual(riskFlags, []);
});

test("a severely low fraud score forces High risk regardless of a high weighted composite", () => {
  const { assessment, riskFlags } = combineEngines(
    engines({ fraudDetection: { score: 20, flags: [] } }),
    DEFAULT_UNDERWRITING_WEIGHTS,
    1_000_000,
    500_000,
    1.8,
  );
  assert.equal(assessment.score, 88); // (100*30 + 100*35 + 100*20 + 20*15) / 100
  assert.equal(assessment.riskCategory, "High"); // overridden — would otherwise be Low
  assert.ok(riskFlags.some((f) => f.code === "FRAUD_REVIEW_REQUIRED"));
});

test("fraudReviewThreshold is policy-configurable per institution, not a hardcoded constant", () => {
  // A fraud score of 20 is below the default threshold (30) but above a laxer,
  // FI-configured threshold of 10 — the override should not fire in that case.
  const laxWeights = { ...DEFAULT_UNDERWRITING_WEIGHTS, fraudReviewThreshold: 10 };
  const { assessment, riskFlags } = combineEngines(engines({ fraudDetection: { score: 20, flags: [] } }), laxWeights, 1_000_000, 500_000, 1.8);
  assert.equal(assessment.riskCategory, "Low"); // not overridden — 20 >= this FI's threshold of 10
  assert.ok(!riskFlags.some((f) => f.code === "FRAUD_REVIEW_REQUIRED"));
});

test("recommendedLimit is capped and requested-amount-vs-limit is a disclosure flag, not a scored factor", () => {
  const { assessment, riskFlags } = combineEngines(engines(), DEFAULT_UNDERWRITING_WEIGHTS, 10_000_000, 500_000, 1.8);
  assert.equal(assessment.recommendedLimit, 3_000_000); // 6 * 500,000
  assert.equal(assessment.score, 100); // amount-vs-limit no longer contributes to the score
  assert.ok(riskFlags.some((f) => f.code === "REQUEST_DISPROPORTIONATE"));
  assert.ok(assessment.recommendation.includes("exceeds the recommended limit"));
});

test("recommendedLimit rounds to the nearest 100,000", () => {
  const { assessment } = combineEngines(engines(), DEFAULT_UNDERWRITING_WEIGHTS, 1_234_567, 1_000_000, 1.8);
  assert.equal(assessment.recommendedLimit, 1_200_000);
});

test("aggregates flags from all four engines", () => {
  const { riskFlags } = combineEngines(
    engines({
      financialBehaviour: { score: 100, flags: [{ code: "FB_FLAG", description: "x" }] },
      cashflowRisk: { score: 100, flags: [{ code: "CR_FLAG", description: "x" }] },
      creditworthiness: { score: 100, flags: [{ code: "CW_FLAG", description: "x" }] },
      fraudDetection: { score: 100, flags: [{ code: "FD_FLAG", description: "x" }] },
    }),
    DEFAULT_UNDERWRITING_WEIGHTS,
    1_000_000,
    500_000,
    1.8,
  );
  for (const code of ["FB_FLAG", "CR_FLAG", "CW_FLAG", "FD_FLAG"]) {
    assert.ok(riskFlags.some((f) => f.code === code), `expected ${code} to be present`);
  }
});

test("determinism: identical input produces identical output", () => {
  const a = combineEngines(engines(), DEFAULT_UNDERWRITING_WEIGHTS, 1_000_000, 500_000, 1.8);
  const b = combineEngines(engines(), DEFAULT_UNDERWRITING_WEIGHTS, 1_000_000, 500_000, 1.8);
  assert.deepEqual(a, b);
});

// ── decision: mirrors VerificationDecision/ComplianceDecision's action-branching ──

test("Low risk composite decides BeginUnderwriting (auto-qualify)", () => {
  const { decision } = combineEngines(engines(), DEFAULT_UNDERWRITING_WEIGHTS, 1_000_000, 500_000, 1.8);
  assert.deepEqual(decision, { action: "BeginUnderwriting", autoDecided: true });
});

test("Medium risk composite decides FlagUnderwritingForManualReview", () => {
  const medium: EngineResult = { score: 65, flags: [] };
  const { assessment, decision } = combineEngines(
    { financialBehaviour: medium, cashflowRisk: medium, creditworthiness: medium, fraudDetection: medium },
    DEFAULT_UNDERWRITING_WEIGHTS, 1_000_000, 500_000, 1.2,
  );
  assert.equal(assessment.riskCategory, "Medium");
  assert.equal(decision.action, "FlagUnderwritingForManualReview");
  if (decision.action === "FlagUnderwritingForManualReview") {
    assert.equal(decision.note, assessment.recommendation);
  }
});

test("High risk composite decides RejectUnderwriting (hard veto) with a reason", () => {
  // fraudDetection stays strong (100) here specifically to isolate the plain
  // composite-score High-risk path from the fraud hard-override path (tested
  // separately below) — a weak fraud score would trigger both at once.
  const weak: EngineResult = { score: 20, flags: [] };
  const { assessment, decision } = combineEngines(
    { financialBehaviour: weak, cashflowRisk: weak, creditworthiness: weak, fraudDetection: strong },
    DEFAULT_UNDERWRITING_WEIGHTS, 1_000_000, 500_000, 0.5,
  );
  assert.equal(assessment.riskCategory, "High");
  assert.equal(decision.action, "RejectUnderwriting");
  if (decision.action === "RejectUnderwriting") {
    assert.equal(decision.autoDecided, true);
    assert.match(decision.reason, /High-risk band/);
  }
});

test("fraud hard override routes to RejectUnderwriting, not just a Flag, since riskCategory is forced High", () => {
  const { assessment, decision } = combineEngines(
    engines({ fraudDetection: { score: 20, flags: [] } }),
    DEFAULT_UNDERWRITING_WEIGHTS, 1_000_000, 500_000, 1.8,
  );
  assert.equal(assessment.riskCategory, "High");
  assert.equal(decision.action, "RejectUnderwriting");
  if (decision.action === "RejectUnderwriting") {
    assert.match(decision.reason, /Fraud Detection score/);
  }
});
