import { withRoute } from "@/lib/apiHelpers";
import { listRestructuringRejectionRecords } from "@/lib/domain/murabahah";
import { serializeRestructuringRejectionRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listRestructuringRejectionRecords(session);
  return rows.map(serializeRestructuringRejectionRecord);
});
