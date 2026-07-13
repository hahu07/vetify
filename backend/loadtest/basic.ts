/**
 * Load test scaffold — audit finding N-1 (Phase 3 Enterprise Production
 * Readiness Audit, 2026-07-08): no load/performance testing existed at any
 * layer, so every performance statement in that audit was structural
 * inference, not measurement. This is a real, runnable baseline, not just
 * a config file — see docs/performance-baseline.md for actual numbers from
 * running it against this machine.
 *
 * Requires a running backend (npm run dev, or npm start) — this only
 * generates load against it, it doesn't start one itself, since a load test
 * sharing a process with the thing it's measuring would skew every number.
 *
 * Usage:
 *   BACKEND_URL=http://localhost:3000 SESSION_JWT_SECRET=... npm run loadtest
 *
 * SESSION_JWT_SECRET must match whatever the running server is using (its
 * own env, or the dev default) — this mints a short-lived session token
 * directly, the same technique backend/test/auth-gating.test.ts uses,
 * rather than driving a real login flow (which would benchmark bcrypt's
 * deliberately-slow hashing, not the routes this is meant to measure).
 */
import jwt from "jsonwebtoken";
import autocannon, { type Result } from "autocannon";

const BASE_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
const SECRET = process.env.SESSION_JWT_SECRET ?? "dev-only-insecure-secret-change-me";
const DURATION_SECONDS = parseInt(process.env.LOADTEST_DURATION ?? "10", 10);
const CONNECTIONS = parseInt(process.env.LOADTEST_CONNECTIONS ?? "10", 10);

function sessionToken(partyRole: string): string {
  return jwt.sign(
    { type: "session", userId: 1, username: "loadtest", displayName: "Load Test", partyRole },
    SECRET,
    { expiresIn: "5m" },
  );
}

interface Scenario {
  name: string;
  path: string;
  headers?: Record<string, string>;
}

const scenarios: Scenario[] = [
  { name: "GET /health (liveness, no dependencies)", path: "/health" },
  { name: "GET /ready (checks both Postgres pools)", path: "/ready" },
  { name: "GET /metrics (Prometheus scrape)", path: "/metrics" },
  {
    name: "GET /api/onboarding (authenticated, PQS-backed)",
    path: "/api/onboarding",
    headers: { authorization: `Bearer ${sessionToken("vetify")}` },
  },
];

function summarize(result: Result) {
  return {
    requestsPerSecond: result.requests.average,
    latencyMs: { p50: result.latency.p50, p99: result.latency.p99, max: result.latency.max },
    throughputBytesPerSecond: result.throughput.average,
    errors: result.errors,
    non2xx: result.non2xx,
    timeouts: result.timeouts,
  };
}

async function run() {
  console.log(`Target: ${BASE_URL} — ${CONNECTIONS} connections, ${DURATION_SECONDS}s per scenario\n`);
  const results: Record<string, ReturnType<typeof summarize>> = {};

  for (const scenario of scenarios) {
    console.log(`--- ${scenario.name} ---`);
    const result = await autocannon({
      url: `${BASE_URL}${scenario.path}`,
      connections: CONNECTIONS,
      duration: DURATION_SECONDS,
      headers: scenario.headers,
    });
    const summary = summarize(result);
    results[scenario.name] = summary;
    console.log(
      `  ${summary.requestsPerSecond.toFixed(0)} req/s | ` +
      `p50 ${summary.latencyMs.p50}ms, p99 ${summary.latencyMs.p99}ms, max ${summary.latencyMs.max}ms | ` +
      `errors: ${summary.errors}, non-2xx: ${summary.non2xx}, timeouts: ${summary.timeouts}\n`,
    );
  }

  console.log("Full results (JSON):");
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
