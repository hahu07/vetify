import { withRoute } from "@/lib/apiHelpers";
import { createSarReport, listSarReports } from "@/lib/domain/murabahah";
import { serializeSarReport } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listSarReports(session);
  return rows.map(serializeSarReport);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createSarReport(session, {
    cacRegNumber: body.cacRegNumber,
    businessName: body.businessName,
    sarRef: body.sarRef,
    suspiciousActivity: body.suspiciousActivity,
    reportDate: body.reportDate,
    reportedByParty: body.reportedByParty,
    confidential: body.confidential ?? true,
  });
});
