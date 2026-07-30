import { withRoute } from "@/lib/apiHelpers";
import { createPortfolioRiskReport, listPortfolioRiskReports } from "@/lib/domain/murabahah";
import { serializePortfolioRiskReport } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listPortfolioRiskReports(session);
  return rows.map(serializePortfolioRiskReport);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createPortfolioRiskReport(session, {
    reportDate: body.reportDate,
    reportPeriod: body.reportPeriod,
    metrics: body.metrics,
    generatedByAgent: body.generatedByAgent,
    modelVersion: body.modelVersion,
  });
});
