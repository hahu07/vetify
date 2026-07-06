import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyShariahCompliance } from "./shariah-policy.js";

test("alcohol sector is always NON_COMPLIANT", () => {
  const result = classifyShariahCompliance("Alcohol distribution", "Beer wholesale", "Inventory purchase");
  assert.equal(result.verdict, "NON_COMPLIANT");
  assert.ok(result.matchedKeyword);
});

test("gambling sector is always NON_COMPLIANT", () => {
  const result = classifyShariahCompliance("Betting shop", "Sports betting", "Equipment purchase");
  assert.equal(result.verdict, "NON_COMPLIANT");
});

test("refinancing conventional debt is NON_COMPLIANT regardless of sector", () => {
  const result = classifyShariahCompliance("Technology", "Software development", "Refinancing existing conventional loan");
  assert.equal(result.verdict, "NON_COMPLIANT");
  assert.match(result.citation, /Clause 3\/1/);
});

test("working capital purpose is NON_COMPLIANT (no identified asset)", () => {
  const result = classifyShariahCompliance("Technology", "Software development", "General working capital");
  assert.equal(result.verdict, "NON_COMPLIANT");
});

test("halal food retail is COMPLIANT", () => {
  const result = classifyShariahCompliance("Halal food retail", "Packaged foods", "Inventory purchase");
  assert.equal(result.verdict, "COMPLIANT");
});

test("halal food combined with a generic grocery/supermarket description stays REQUIRES_REVIEW (mixed keyword wins) — safety-biased: a self-declared 'halal' label alone doesn't override the alcohol/tobacco stocking risk a plain grocery/supermarket carries", () => {
  const result = classifyShariahCompliance("Halal food retail", "Grocery store", "Inventory purchase");
  assert.equal(result.verdict, "REQUIRES_REVIEW");
});

test("technology sector is COMPLIANT", () => {
  const result = classifyShariahCompliance("Technology", "Software development", "Office equipment");
  assert.equal(result.verdict, "COMPLIANT");
});

test("restaurant/hospitality is REQUIRES_REVIEW, not auto-compliant, due to alcohol risk", () => {
  const result = classifyShariahCompliance("Hospitality", "Restaurant", "Kitchen equipment");
  assert.equal(result.verdict, "REQUIRES_REVIEW");
});

test("insurance sector is REQUIRES_REVIEW (riba/gharar risk)", () => {
  const result = classifyShariahCompliance("Insurance", "Conventional insurance broker", "Office setup");
  assert.equal(result.verdict, "REQUIRES_REVIEW");
});

test("a completely novel sector fails closed to REQUIRES_REVIEW, never COMPLIANT or NON_COMPLIANT", () => {
  const result = classifyShariahCompliance("Quantum widget fabrication", "Novel activity", "Asset purchase");
  assert.equal(result.verdict, "REQUIRES_REVIEW");
  assert.equal(result.matchedKeyword, undefined);
});

test("prohibited financing structure overrides an otherwise-compliant sector", () => {
  const result = classifyShariahCompliance("Technology", "Software development", "Cash advance for operations");
  assert.equal(result.verdict, "NON_COMPLIANT");
});

test("classification is deterministic — same input always produces the same output", () => {
  const a = classifyShariahCompliance("Halal food retail", "Grocery store", "Inventory purchase");
  const b = classifyShariahCompliance("Halal food retail", "Grocery store", "Inventory purchase");
  assert.deepEqual(a, b);
});
