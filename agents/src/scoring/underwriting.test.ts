import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreUnderwriting } from "./underwriting.js";
import { DEFAULT_UNDERWRITING_POLICY_VERSION, DEFAULT_UNDERWRITING_WEIGHTS } from "./types.js";
import type { CreditworthinessEvidence, TransactionEvidence, UnderwritingRequestContext } from "./types.js";
import { buildTestTransactions } from "./underwriting-test-helpers.js";

const ASOF = "2026-07-01T00:00:00.000Z";

const strongEvidence: TransactionEvidence = {
  transactions: buildTestTransactions(
    [1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000].map((inflow) => ({
      inflow,
      outflow: 600_000,
      balance: 2_500_000,
    })),
    ASOF,
  ),
  asOf: ASOF,
};
const strongCredit: CreditworthinessEvidence = { dscr: 1.8, creditScore: 720 };
const establishedContext: UnderwritingRequestContext = {
  requestedAmount: 1_200_000,
  tenureMonths: 12,
  businessIncorporationDate: "2020-01-01T00:00:00.000Z",
  asOf: ASOF,
};

test("orchestrator wires all five engines: strong evidence populates all four sub-scores and lands Low risk", () => {
  const result = scoreUnderwriting(strongEvidence, strongCredit, establishedContext);
  assert.equal(result.assessment.riskCategory, "Low");
  assert.equal(typeof result.assessment.behaviouralScore, "number");
  assert.equal(typeof result.assessment.cashflowRiskScore, "number");
  assert.equal(typeof result.assessment.creditworthinessScore, "number");
  assert.equal(typeof result.assessment.fraudScore, "number");
  assert.equal(result.scoringPolicyVersion, DEFAULT_UNDERWRITING_POLICY_VERSION);
});

test("weak evidence across engines lowers the composite score and surfaces flags from multiple engines", () => {
  const weakEvidence: TransactionEvidence = {
    transactions: buildTestTransactions(
      [200_000, 2_000_000, 200_000, 2_000_000, 200_000, 2_000_000].map((inflow) => ({ inflow, outflow: 1_900_000 })),
      ASOF,
    ),
    asOf: ASOF,
  };
  const weakCredit: CreditworthinessEvidence = { dscr: 0.6, creditScore: 400 };
  const result = scoreUnderwriting(weakEvidence, weakCredit, { requestedAmount: 1_200_000, tenureMonths: 12, asOf: ASOF });
  assert.ok(result.assessment.score < 60);
  assert.ok(result.riskFlags.some((f) => f.code === "DSCR_BELOW_ONE"));
  assert.ok(result.riskFlags.some((f) => f.code === "HIGH_REVENUE_VARIANCE"));
  assert.ok(result.riskFlags.some((f) => f.code === "CREDIT_SCORE_POOR"));
});

test("determinism: identical input produces identical output", () => {
  const a = scoreUnderwriting(strongEvidence, strongCredit, establishedContext);
  const b = scoreUnderwriting(strongEvidence, strongCredit, establishedContext);
  assert.deepEqual(a, b);
});

test("custom weights and policyVersion are threaded through to the result", () => {
  const customWeights = { ...DEFAULT_UNDERWRITING_WEIGHTS, financialBehaviourEngineWeight: 0, cashflowRiskEngineWeight: 100, creditworthinessEngineWeight: 0, fraudDetectionEngineWeight: 0 };
  const result = scoreUnderwriting(strongEvidence, strongCredit, establishedContext, customWeights, "policy-v2");
  assert.equal(result.scoringPolicyVersion, "policy-v2");
  assert.equal(result.assessment.score, result.assessment.cashflowRiskScore); // 100% weight on Cashflow Risk alone
});
