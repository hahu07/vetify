import { withRoute } from "@/lib/apiHelpers";
import { listWriteOffRecords } from "@/lib/domain/murabahah";
import { serializeWriteOffRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listWriteOffRecords(session);
  return rows.map(serializeWriteOffRecord);
});
