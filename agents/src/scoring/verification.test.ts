import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreVerification } from "./verification.js";
import { DEFAULT_VERIFICATION_WEIGHTS } from "./types.js";
import type { CacResult, MashupResult, TinResult } from "./types.js";

const okMashup = (over: Partial<{ ninVerified: boolean; bvnVerified: boolean; dobProvided: boolean; dobMatch: boolean }> = {}): MashupResult => ({
  kind: "ok",
  data: { ninVerified: true, bvnVerified: true, dobProvided: true, dobMatch: true, ...over },
});
const okCac = (over: Partial<{ found: boolean; status: string; nameMatch: "exact" | "close" | "mismatch" }> = {}): CacResult => ({
  kind: "ok",
  data: { found: true, status: "Active", nameMatch: "exact", ...over },
});
const okTin: TinResult = { kind: "verifiedMatchesCac" };

test("perfect evidence scores 100 and auto-approves", () => {
  const result = scoreVerification(okMashup(), okCac(), okTin);
  assert.equal(result.riskScore, 100);
  assert.equal(result.riskLevel, "Low");
  assert.deepEqual(result.decision, { action: "Approve", autoDecided: true });
});

test("DOB missing from contract scores 30 for identity, still true", () => {
  const result = scoreVerification(okMashup({ dobProvided: false }), okCac(), okTin);
  assert.equal(result.checkScores.identityScore, 30);
  assert.equal(result.checks.identityVerified, true);
});

test("DOB mismatch scores 20 for identity", () => {
  const result = scoreVerification(okMashup({ dobMatch: false }), okCac(), okTin);
  assert.equal(result.checkScores.identityScore, 20);
});

test("BVN not found scores 15, identityVerified false", () => {
  const result = scoreVerification(okMashup({ bvnVerified: false }), okCac(), okTin);
  assert.equal(result.checkScores.identityScore, 15);
  assert.equal(result.checks.identityVerified, false);
});

test("NIN not found scores 0", () => {
  const result = scoreVerification(okMashup({ ninVerified: false }), okCac(), okTin);
  assert.equal(result.checkScores.identityScore, 0);
});

test("CAC close name match scores 28", () => {
  const result = scoreVerification(okMashup(), okCac({ nameMatch: "close" }), okTin);
  assert.equal(result.checkScores.cacScore, 28);
});

test("CAC active but serious name mismatch always flags, regardless of score", () => {
  const result = scoreVerification(okMashup(), okCac({ nameMatch: "mismatch" }), okTin);
  assert.equal(result.decision.action, "FlagForManualReview");
});

test("CAC inactive scores 10 but cacRegistered stays true", () => {
  const result = scoreVerification(okMashup(), okCac({ status: "Inactive" }), okTin);
  assert.equal(result.checkScores.cacScore, 10);
  assert.equal(result.checks.cacRegistered, true);
});

test("CAC pending scores 20", () => {
  const result = scoreVerification(okMashup(), okCac({ status: "Pending" }), okTin);
  assert.equal(result.checkScores.cacScore, 20);
});

test("CAC not found scores 0, cacRegistered false", () => {
  const result = scoreVerification(okMashup(), okCac({ found: false }), okTin);
  assert.equal(result.checkScores.cacScore, 0);
  assert.equal(result.checks.cacRegistered, false);
});

test("TIN verified but different entity scores 10", () => {
  const result = scoreVerification(okMashup(), okCac(), { kind: "verifiedDifferentEntity" });
  assert.equal(result.checkScores.tinScore, 10);
  assert.equal(result.checks.dataConsistent, true);
});

test("TIN not found scores 5, dataConsistent false", () => {
  const result = scoreVerification(okMashup(), okCac(), { kind: "notFound" });
  assert.equal(result.checkScores.tinScore, 5);
  assert.equal(result.checks.dataConsistent, false);
});

test("TIN API error scores 10, dataConsistent assumed true", () => {
  const result = scoreVerification(okMashup(), okCac(), { kind: "error", httpStatus: 500 });
  assert.equal(result.checkScores.tinScore, 10);
  assert.equal(result.checks.dataConsistent, true);
});

test("regression: a TIN-only API error must flag, never Approve — even though identity+CAC alone would score Low band, documentsValid is false and the ledger's Approve assertion would refuse it", () => {
  const result = scoreVerification(okMashup(), okCac(), { kind: "error", httpStatus: 500 });
  assert.equal(result.riskScore, 85); // 40 + 35 + 10 — would be "Low" band on its own
  assert.equal(result.checks.documentsValid, false);
  assert.equal(result.decision.action, "FlagForManualReview");
});

test("mono.co API error on identity never auto-rejects, even with everything else failing", () => {
  const result = scoreVerification(
    { kind: "error", httpStatus: 500 },
    okCac({ found: false }),
    { kind: "notFound" },
  );
  assert.equal(result.decision.action, "FlagForManualReview");
});

test("mono.co API error marks documentsValid false", () => {
  const result = scoreVerification({ kind: "error", httpStatus: 500 }, okCac(), okTin);
  assert.equal(result.checks.documentsValid, false);
});

test("both identity and CAC failing (no API error) auto-rejects", () => {
  const result = scoreVerification(okMashup({ ninVerified: false }), okCac({ found: false }), okTin);
  assert.equal(result.decision.action, "Reject");
  assert.equal(result.decision.autoDecided, true);
});

test("only identity failing (CAC fine) always flags, never auto-approves or auto-rejects", () => {
  const result = scoreVerification(okMashup({ ninVerified: false }), okCac(), okTin);
  assert.equal(result.decision.action, "FlagForManualReview");
});

test("Medium band (50-79) flags for manual review", () => {
  // identity 20 (dob mismatch) + cac 20 (pending) + tin 10 (different entity) = 50
  const result = scoreVerification(okMashup({ dobMatch: false }), okCac({ status: "Pending" }), { kind: "verifiedDifferentEntity" });
  assert.equal(result.riskScore, 50);
  assert.equal(result.riskLevel, "Medium");
  assert.equal(result.decision.action, "FlagForManualReview");
});

test("scoring is deterministic — same evidence always produces the same result", () => {
  const a = scoreVerification(okMashup(), okCac(), okTin);
  const b = scoreVerification(okMashup(), okCac(), okTin);
  assert.deepEqual(a, b);
});

test("custom weights actually change the score — a retuned policy is not ignored", () => {
  const retuned = { ...DEFAULT_VERIFICATION_WEIGHTS, identityPerfect: 50, cacActiveExactMatch: 45, tinVerifiedMatchesCac: 5 };
  const result = scoreVerification(okMashup(), okCac(), okTin, retuned, "custom-policy-v9");
  assert.equal(result.riskScore, 100); // 50 + 45 + 5
  assert.equal(result.checkScores.identityScore, 50);
  assert.equal(result.checkScores.cacScore, 45);
  assert.equal(result.checkScores.tinScore, 5);
  assert.equal(result.scoringPolicyVersion, "custom-policy-v9");
});

test("omitting weights/policyVersion falls back to the built-in defaults", () => {
  const result = scoreVerification(okMashup(), okCac(), okTin);
  assert.equal(result.riskScore, 100);
  assert.equal(result.scoringPolicyVersion, "scoring-engine-default-2026-v1");
});
