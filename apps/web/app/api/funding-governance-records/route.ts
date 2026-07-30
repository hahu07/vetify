import { withRoute } from "@/lib/apiHelpers";
import { listFundingGovernanceRecords } from "@/lib/domain/financing";
import { serializeFundingGovernanceRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listFundingGovernanceRecords(session);
  return rows.map(serializeFundingGovernanceRecord);
});
