import { withRoute } from "@/lib/apiHelpers";
import { listFinancingDecisions } from "@/lib/domain/financing";
import { serializeFinancingDecision } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listFinancingDecisions(session);
  return rows.map(serializeFinancingDecision);
});
