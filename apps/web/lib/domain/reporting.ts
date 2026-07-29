import type { SessionContext } from "@/lib/db";
import { withTransaction } from "@/lib/db";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { aggregatePortfolio, buildSummary, type MurabahahContractSnapshot } from "@/lib/scoring/reporting";

// Phase 2, fourth slice: Reporting -- see migrations/009_reporting.sql's
// header for scope. generatePortfolioReport queries every MurabahahContract
// (this app has exactly one financialInstitution tenant, so no per-FI
// filter is needed the way the real multi-FI system would require),
// aggregates deterministically via lib/scoring/reporting.ts, and creates the
// PortfolioReport row -- mirroring runReportingAgent's real shape minus the
// LLM narrative step, which this migration has no LLM to run at all.

async function generatePortfolioReportImpl(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(
      `SELECT status, sale_price, outstanding_balance FROM murabahah_contract`,
    );
    const snapshots: MurabahahContractSnapshot[] = rows.map((r) => ({
      status: r.status,
      salePrice: Number(r.sale_price),
      outstandingBalance: Number(r.outstanding_balance),
    }));
    const metrics = aggregatePortfolio(snapshots);
    const summary = buildSummary(metrics);

    const { rows: inserted } = await client.query(
      `INSERT INTO portfolio_report
         (report_date, total_active_contracts, total_disbursed, total_outstanding,
          delinquent_count, completed_count, defaulted_count, summary)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        metrics.totalActiveContracts,
        metrics.totalDisbursed,
        metrics.totalOutstanding,
        metrics.delinquentCount,
        metrics.completedCount,
        metrics.defaultedCount,
        summary,
      ],
    );
    return { portfolioReportId: inserted[0].id, metrics };
  });
}
export const generatePortfolioReport = withAuthorization(["vetify"], generatePortfolioReportImpl);

export async function listPortfolioReports(session: SessionContext) {
  return withTransaction(session, async (client) => {
    const { rows } = await client.query(`SELECT * FROM portfolio_report ORDER BY report_date DESC, created_at DESC`);
    return rows;
  });
}
