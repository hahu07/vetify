import { withRoute } from "@/lib/apiHelpers";
import { listComplianceResults } from "@/lib/domain/compliance";
import { serializeComplianceResult } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listComplianceResults(session);
  return rows.map(serializeComplianceResult);
});
