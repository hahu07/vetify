import { withRoute } from "@/lib/apiHelpers";
import { listDefaultRecords } from "@/lib/domain/murabahah";
import { serializeDefaultRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listDefaultRecords(session);
  return rows.map(serializeDefaultRecord);
});
