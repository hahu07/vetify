import { withRoute } from "@/lib/apiHelpers";
import { generatePortfolioReport, listPortfolioReports } from "@/lib/domain/reporting";
import { serializePortfolioReport } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listPortfolioReports(session);
  return rows.map(serializePortfolioReport);
});

export const POST = withRoute(async (session) => generatePortfolioReport(session));
