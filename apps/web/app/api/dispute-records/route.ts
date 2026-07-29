import { withRoute } from "@/lib/apiHelpers";
import { listDisputeRecords } from "@/lib/domain/murabahah";
import { serializeDisputeRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listDisputeRecords(session);
  return rows.map(serializeDisputeRecord);
});
