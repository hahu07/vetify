import { withRoute } from "@/lib/apiHelpers";
import { listInspectionRecords } from "@/lib/domain/murabahah";
import { serializeInspectionRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listInspectionRecords(session);
  return rows.map(serializeInspectionRecord);
});
