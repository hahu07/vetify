import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCompliance } from "./compliance.js";
import { DEFAULT_COMPLIANCE_WEIGHTS } from "./types.js";
import type { AmlEvidence, KybEvidence } from "./types.js";

const clearAml: AmlEvidence = { businessStatus: "clear", directorStatus: "clear" };
const fullKyb: KybEvidence = { status: "active_full_match" };

test("NON_COMPLIANT Shariah verdict rejects immediately, before any AML/KYB is scored", () => {
  const result = scoreCompliance("NON_COMPLIANT", clearAml, fullKyb, "clean");
  assert.equal(result.decision.action, "RejectCompliance");
  assert.equal(result.checks.shariahCompliant, false);
  assert.equal(result.quantifiableScore, 0);
});

test("confirmed AML not_cleared always rejects, regardless of everything else", () => {
  const result = scoreCompliance(
    "COMPLIANT",
    { businessStatus: "not_cleared", directorStatus: "clear" },
    fullKyb,
    "clean",
  );
  assert.equal(result.decision.action, "RejectCompliance");
  assert.equal(result.checks.amlCleared, false);
});

test("KYB struck off / dissolved always rejects", () => {
  const result = scoreCompliance("COMPLIANT", clearAml, { status: "struck_off_or_dissolved" }, "clean");
  assert.equal(result.decision.action, "RejectCompliance");
});

test("AML review_required never auto-rejects but never approves either — always flags", () => {
  const result = scoreCompliance(
    "COMPLIANT",
    { businessStatus: "review_required", directorStatus: "clear" },
    fullKyb,
    "clean",
  );
  assert.equal(result.decision.action, "FlagComplianceForManualReview");
  assert.equal(result.checks.amlCleared, false);
});

test("cddCompleted is never claimed true by the deterministic scorer", () => {
  const result = scoreCompliance("COMPLIANT", clearAml, fullKyb, "clean");
  assert.equal(result.checks.cddCompleted, false);
});

test("scoreCompliance can never resolve to ApproveCompliance, even with perfect quantifiable evidence", () => {
  const result = scoreCompliance("COMPLIANT", clearAml, fullKyb, "clean", {
    incorporationDate: "2020-01-01",
    asOf: "2026-01-01",
  });
  assert.notEqual(result.decision.action, "ApproveCompliance");
  assert.equal(result.decision.action, "FlagComplianceForManualReview");
});

test("REQUIRES_REVIEW Shariah verdict is noted in the flag message even with clean AML/KYB", () => {
  const result = scoreCompliance("REQUIRES_REVIEW", clearAml, fullKyb, "clean");
  assert.equal(result.decision.action, "FlagComplianceForManualReview");
  if (result.decision.action === "FlagComplianceForManualReview") {
    assert.match(result.decision.note, /REQUIRES_REVIEW/);
  }
});

test("business age omitted contributes 0, not a fabricated value", () => {
  const withAge = scoreCompliance("COMPLIANT", clearAml, fullKyb, "clean", {
    incorporationDate: "2024-12-01",
    asOf: "2026-01-01", // > 12 months → +5
  });
  const withoutAge = scoreCompliance("COMPLIANT", clearAml, fullKyb, "clean");
  assert.equal(withAge.quantifiableScore - withoutAge.quantifiableScore, 5);
});

test("newly registered business (<3 months) deducts 5 points", () => {
  const result = scoreCompliance("COMPLIANT", clearAml, fullKyb, "clean", {
    incorporationDate: "2026-06-01",
    asOf: "2026-07-01",
  });
  const baseline = scoreCompliance("COMPLIANT", clearAml, fullKyb, "clean");
  assert.equal(result.quantifiableScore - baseline.quantifiableScore, -5);
});

test("scoring is deterministic — same evidence always produces the same result", () => {
  const a = scoreCompliance("COMPLIANT", clearAml, fullKyb, "clean");
  const b = scoreCompliance("COMPLIANT", clearAml, fullKyb, "clean");
  assert.deepEqual(a, b);
});

test("custom weights actually change the score — a retuned policy is not ignored", () => {
  const retuned = { ...DEFAULT_COMPLIANCE_WEIGHTS, amlBothClear: 50, kybActiveFullMatch: 40, creditClean: 20 };
  const result = scoreCompliance("COMPLIANT", clearAml, fullKyb, "clean", undefined, retuned, "custom-policy-v9");
  assert.equal(result.quantifiableScore, 110); // 50 + 40 + 20
  assert.equal(result.scoringPolicyVersion, "custom-policy-v9");
});

test("omitting weights/policyVersion falls back to the built-in defaults", () => {
  const result = scoreCompliance("COMPLIANT", clearAml, fullKyb, "clean");
  assert.equal(result.quantifiableScore, 75); // 35 + 30 + 10
  assert.equal(result.scoringPolicyVersion, "scoring-engine-default-2026-v1");
});
