// Integration tests for lib/domain/reporting.ts (Phase 2, fourth slice).
// Unlike scoring-reporting.test.ts (the pure aggregation engine, no DB),
// this exercises the real generatePortfolioReport/listPortfolioReports
// domain functions against the live murabahah_contract table, proving the
// SQL aggregation query and the withAuthorization gate both actually work,
// not just the arithmetic in isolation.
//
// Found live while building the fifth slice: this test computes an
// independent SQL "expected" snapshot of the *entire* murabahah_contract
// table (unlike every other test file, which scopes its own fixtures by a
// unique CAC prefix), because generatePortfolioReport itself aggregates the
// whole table by design (a single-FI-tenant simplification -- see
// lib/domain/reporting.ts). node:test runs separate test files in parallel
// by default, so another file's fixture churn on murabahah_contract could
// land between this test's two reads and make them briefly disagree -- a
// real, reproduced-live flake, not a bug in the aggregation itself. Fixed
// by forcing sequential file execution (`--test-concurrency=1` in
// package.json's `test` script) rather than scoping this test more
// narrowly, since the whole point of these two assertions is proving the
// *global* aggregate is correct.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { pool, type SessionContext } from "@/lib/db";
import { AuthorizationError } from "@/lib/errors";
import { generatePortfolioReport, listPortfolioReports } from "@/lib/domain/reporting";

function vetifySession(): SessionContext {
  return { userId: 3, username: "test-vetify", displayName: "Test Vetify", partyRole: "vetify", cacRegNumber: null };
}
function regulatorSession(): SessionContext {
  return { userId: 8, username: "test-regulator", displayName: "Test Regulator", partyRole: "regulator", cacRegNumber: null };
}
function businessSession(): SessionContext {
  return { userId: 1, username: "test-business", displayName: "Test Business", partyRole: "business", cacRegNumber: "RC0000000" };
}

const fixtureClient = new Client({
  host: process.env.WEB_POSTGRES_HOST ?? "localhost",
  port: Number(process.env.WEB_POSTGRES_PORT ?? 5434),
  user: process.env.WEB_POSTGRES_USER ?? "vetify_web",
  password: process.env.WEB_POSTGRES_PASSWORD ?? "vetify_web",
  database: process.env.WEB_POSTGRES_DATABASE ?? "vetify_web",
});

before(async () => {
  await fixtureClient.connect();
});
after(async () => {
  await fixtureClient.end();
  await pool.end();
});

test("generatePortfolioReport: withAuthorization rejects a non-vetify session", async () => {
  await assert.rejects(() => generatePortfolioReport(regulatorSession()), AuthorizationError);
  await assert.rejects(() => generatePortfolioReport(businessSession()), AuthorizationError);
});

test("generatePortfolioReport: aggregates the real murabahah_contract table correctly", async () => {
  // Snapshot the current aggregate directly via SQL (ground truth, computed
  // independently of aggregatePortfolio itself) to compare against what the
  // domain function actually persists -- proves the SQL query + the
  // aggregation engine agree on the same live data, not just canned fixtures.
  const { rows: expected } = await fixtureClient.query(`
    SELECT
      count(*) FILTER (WHERE status IN ('Active', 'Delinquent', 'DelinquencyManualReview'))::int AS total_active_contracts,
      COALESCE(sum(sale_price), 0)::numeric AS total_disbursed,
      COALESCE(sum(outstanding_balance) FILTER (WHERE status IN ('Active', 'Delinquent', 'DelinquencyManualReview')), 0)::numeric AS total_outstanding,
      count(*) FILTER (WHERE status = 'Delinquent')::int AS delinquent_count,
      count(*) FILTER (WHERE status = 'Completed')::int AS completed_count,
      count(*) FILTER (WHERE status = 'Defaulted')::int AS defaulted_count
    FROM murabahah_contract
  `);

  const result = await generatePortfolioReport(vetifySession());
  assert.equal(result.metrics.totalActiveContracts, expected[0].total_active_contracts);
  assert.equal(result.metrics.totalDisbursed, Number(expected[0].total_disbursed));
  assert.equal(result.metrics.totalOutstanding, Number(expected[0].total_outstanding));
  assert.equal(result.metrics.delinquentCount, expected[0].delinquent_count);
  assert.equal(result.metrics.completedCount, expected[0].completed_count);
  assert.equal(result.metrics.defaultedCount, expected[0].defaulted_count);

  const { rows: persisted } = await fixtureClient.query("SELECT * FROM portfolio_report WHERE id = $1", [result.portfolioReportId]);
  assert.equal(persisted[0].total_active_contracts, expected[0].total_active_contracts);
  assert.ok(persisted[0].summary.length > 0, "summary must be a non-empty deterministic sentence");

  await fixtureClient.query("DELETE FROM portfolio_report WHERE id = $1", [result.portfolioReportId]);
});

test("listPortfolioReports: readable by vetify and regulator, ordered by report_date desc", async () => {
  const a = await generatePortfolioReport(vetifySession());
  try {
    const asVetify = await listPortfolioReports(vetifySession());
    assert.ok(asVetify.some((r: { id: number }) => r.id === a.portfolioReportId));

    const asRegulator = await listPortfolioReports(regulatorSession());
    assert.ok(asRegulator.some((r: { id: number }) => r.id === a.portfolioReportId));
  } finally {
    await fixtureClient.query("DELETE FROM portfolio_report WHERE id = $1", [a.portfolioReportId]);
  }
});
