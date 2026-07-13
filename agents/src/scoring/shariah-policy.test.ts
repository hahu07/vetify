import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyShariahCompliance, classifyFinancingPurpose } from "./shariah-policy.js";

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

// ─── classifyFinancingPurpose — the Stage 6 purpose-only re-screen (G4) ─────

test("purpose screen: refinancing is caught as a prohibited structure", () => {
  const hit = classifyFinancingPurpose("Refinancing our existing bank loan");
  assert.equal(hit?.verdict, "NON_COMPLIANT");
  assert.match(hit!.citation, /Clause 3\/1/);
});

test("purpose screen: working capital and cash advance are caught", () => {
  assert.equal(classifyFinancingPurpose("working capital for operations")?.verdict, "NON_COMPLIANT");
  assert.equal(classifyFinancingPurpose("short-term cash advance")?.verdict, "NON_COMPLIANT");
});

test("purpose screen: a prohibited-sector keyword inside the purpose text is caught even when the declared sector was clean", () => {
  const hit = classifyFinancingPurpose("Purchase of beer inventory for resale");
  assert.equal(hit?.verdict, "NON_COMPLIANT");
});

test("purpose screen: a clean asset-purchase purpose passes (returns undefined, pipeline proceeds)", () => {
  assert.equal(classifyFinancingPurpose("Purchase of 50 metric tonnes of white flour"), undefined);
});

test("purpose screen: does NOT re-flag mixed-sector keywords in the purpose — sector review already happened at Stage 3", () => {
  // "restaurant" is a MIXED_REVIEW sector keyword; a purpose mentioning it must
  // not re-open a case Stage 3 already resolved at the sector level.
  assert.equal(classifyFinancingPurpose("Kitchen equipment for our restaurant"), undefined);
});
