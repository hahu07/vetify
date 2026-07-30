import { withRoute } from "@/lib/apiHelpers";
import { listProposalDeclineRecords } from "@/lib/domain/murabahah";
import { serializeProposalDeclineRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listProposalDeclineRecords(session);
  return rows.map(serializeProposalDeclineRecord);
});
