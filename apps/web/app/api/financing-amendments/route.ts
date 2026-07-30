import { withRoute } from "@/lib/apiHelpers";
import { listFinancingAmendments } from "@/lib/domain/financing";
import { serializeFinancingAmendment } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listFinancingAmendments(session);
  return rows.map(serializeFinancingAmendment);
});
