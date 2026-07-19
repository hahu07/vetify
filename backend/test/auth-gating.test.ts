/**
 * G1/G8/G16/G17 route-level tests (docs/platform-review-2026-07.md).
 *
 * These run with NO database and NO ledger: everything asserted here rejects
 * (or short-circuits) before reaching either — which is precisely the
 * property under test. Session tokens are minted directly with the same
 * dev-default SESSION_JWT_SECRET auth.ts uses.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";

process.env.MONO_WEBHOOK_SECRET = "test-webhook-secret";
// Pin the "NO database and NO ledger" environment this file documents (see
// header). The developer's real backend/.env may point at a live devnet
// (READS_VIA_LEDGER=1 + real OIDC credentials), which would silently turn
// these sanitized-failure assertions into live remote ledger calls. Set (not
// delete) each var: dotenv only fills vars that are still unset, so values
// pinned here before app.ts's dynamic import always win over .env.
process.env.READS_VIA_LEDGER = "0";
process.env.CANTON_LEDGER_URL = "http://127.0.0.1:9";  // unreachable (discard port)
process.env.CANTON_OIDC_CLIENT_ID = "";                 // "" = OIDC mode off
process.env.CANTON_OIDC_CLIENT_SECRET = "";
process.env.PQS_POSTGRES_HOST = "127.0.0.1";
process.env.PQS_POSTGRES_PORT = "9";                    // unreachable
const SECRET = process.env.SESSION_JWT_SECRET ?? "dev-only-insecure-secret-change-me";

function sessionToken(partyRole: string): string {
  return jwt.sign(
    { type: "session", userId: 1, username: "test.user", displayName: "Test User", partyRole },
    SECRET,
    { expiresIn: "5m" },
  );
}

let app: Express;
before(async () => {
  const { buildApp } = await import("../src/app.js");
  app = buildApp();
});

test("GET /health is open", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
});

test("operational GETs require a session: 401 without a token", async () => {
  for (const path of ["/api/onboarding", "/api/financing", "/api/contracts", "/api/providers", "/api/policy/approvers"]) {
    const res = await request(app).get(path);
    assert.equal(res.status, 401, `${path} should 401 without a session`);
  }
});

test("garbage and mfa_pending tokens are rejected", async () => {
  const garbage = await request(app).get("/api/onboarding").set("Authorization", "Bearer not-a-jwt");
  assert.equal(garbage.status, 401);

  // Layer 4: an mfa_pending token must never satisfy requireAuth.
  const pending = jwt.sign({ type: "mfa_pending", userId: 1 }, SECRET, { expiresIn: "5m" });
  const res = await request(app).get("/api/onboarding").set("Authorization", `Bearer ${pending}`);
  assert.equal(res.status, 401);
});

test("role gates: a business session cannot register an assessor (vetify-only route)", async () => {
  const res = await request(app)
    .post("/api/financing/assessors")
    .set("Authorization", `Bearer ${sessionToken("business")}`)
    .send({ vetify: "V::1", assessor: "A::1", role: "x", authorizedBy: "y" });
  assert.equal(res.status, 403);
});

test("role gates: a financer session cannot flag delinquency (vetify-only route)", async () => {
  const res = await request(app)
    .post("/api/contracts/some-contract-id/flag-delinquent")
    .set("Authorization", `Bearer ${sessionToken("financer")}`)
    .send({ reason: "test" });
  assert.equal(res.status, 403);
});

test("role gates: a vetify session cannot approve funding (financer-only route)", async () => {
  const res = await request(app)
    .post("/api/financing/some-contract-id/approve")
    .set("Authorization", `Bearer ${sessionToken("vetify")}`)
    .send({});
  assert.equal(res.status, 403);
});

test("G16: a correctly-authorized request that reaches an unreachable ledger returns a sanitized 500/502, never a raw internal message", async () => {
  const res = await request(app)
    .post("/api/financing/assessors")
    .set("Authorization", `Bearer ${sessionToken("vetify")}`)
    .send({ vetify: "V::1", assessor: "A::1", role: "x", authorizedBy: "y" });
  // No ledger is running in this test: the handler's fetch fails. Whatever
  // the status (500 internal / 502 upstream), the body must be sanitized.
  assert.ok(res.status >= 500, `expected 5xx, got ${res.status}`);
  assert.ok(
    res.body.error === "Internal server error" || res.body.error === "Ledger request failed.",
    `unexpected error body: ${JSON.stringify(res.body)}`,
  );
  assert.ok(!JSON.stringify(res.body).includes("ECONNREFUSED"), "raw network error leaked to client");
});

test("G17: webhook with a wrong shared secret is rejected before any processing", async () => {
  const res = await request(app)
    .post("/api/webhooks/mono/creditworthiness")
    .set("mono-webhook-secret", "wrong-secret")
    .send({ reference: "REF-1", dscr: 1.2 });
  assert.equal(res.status, 401);
});

test("login validates input shape", async () => {
  const res = await request(app).post("/api/auth/login").send({});
  assert.equal(res.status, 400);
});

// V2 (docs/platform-review-2026-07.md §23.9/§23.15): the Phase 2 validation
// audit found these five routes — three vetify-only role gates fixed the same
// day on policy.ts, plus financing.ts's certify-shariah/certifications-revoke
// and onboarding.ts's recertify — had zero test coverage. Closing that gap
// with the same no-DB/no-ledger role-gate pattern used above.

test("role gates: a business session cannot certify Shariah terms (vetify-only route)", async () => {
  const res = await request(app)
    .post("/api/financing/proposals/some-proposal-id/certify-shariah")
    .set("Authorization", `Bearer ${sessionToken("business")}`)
    .send({ certificationRef: "SSB-CERT-1", aaoifiStandards: ["Std No. 8"], rationale: "x", certifiedBy: "y" });
  assert.equal(res.status, 403);
});

test("role gates: a financer session cannot revoke a Shariah certification (vetify-only route)", async () => {
  const res = await request(app)
    .post("/api/financing/certifications/some-cert-id/revoke")
    .set("Authorization", `Bearer ${sessionToken("financer")}`)
    .send({ revocationRef: "SSB-REV-1", reason: "x", revokedBy: "y" });
  assert.equal(res.status, 403);
});

test("role gates: a business session cannot trigger recertification (vetify-only route)", async () => {
  const res = await request(app)
    .post("/api/onboarding/approved/some-contract-id/recertify")
    .set("Authorization", `Bearer ${sessionToken("business")}`)
    .send({ newComplianceRef: "x", reason: "y" });
  assert.equal(res.status, 403);
});

test("policy.ts role gates: a business session cannot propose a policy change or register an approver", async () => {
  for (const path of ["/api/policy/verification/propose", "/api/policy/compliance/propose", "/api/policy/approvers"]) {
    const res = await request(app)
      .post(path)
      .set("Authorization", `Bearer ${sessionToken("business")}`)
      .send({});
    assert.equal(res.status, 403, `${path} should 403 for a non-vetify session`);
  }
});

test("G12: paginated contracts list reaches the real query path and fails sanitized when PQS is unreachable", async () => {
  const res = await request(app)
    .get("/api/contracts?limit=5&offset=0")
    .set("Authorization", `Bearer ${sessionToken("vetify")}`);
  // PQS in this test environment either isn't running or rejects these
  // credentials — either way, pg throws a plain Error (not a LedgerError),
  // which errorHandler.ts sanitizes generically. Assert the exact sanitized
  // shape, not just the absence of one substring: no pg/connection/auth
  // detail (host, user, password-related text) may reach the client body.
  assert.equal(res.status, 500);
  assert.deepEqual(Object.keys(res.body).sort(), ["correlationId", "error"]);
  assert.equal(res.body.error, "Internal server error");
});

test("G12: clampPage clamps untrusted limit/offset into safe bounds", async () => {
  const { clampPage } = await import("../src/pqs.js");
  assert.deepEqual(clampPage(undefined, undefined), { limit: 50, offset: 0 }, "defaults when both absent");
  assert.deepEqual(clampPage("10", "20"), { limit: 10, offset: 20 }, "numeric strings parsed");
  assert.deepEqual(clampPage("9999", "0"), { limit: 200, offset: 0 }, "limit clamped to MAX_PAGE_LIMIT");
  assert.deepEqual(clampPage("-5", "-100"), { limit: 1, offset: 0 }, "limit floored to 1, offset floored to 0");
  assert.deepEqual(clampPage("not-a-number", "also-not"), { limit: 50, offset: 0 }, "non-numeric falls back to defaults");
  assert.deepEqual(clampPage("12.9", "3.9"), { limit: 12, offset: 3 }, "fractional values truncated, not rounded");
});
