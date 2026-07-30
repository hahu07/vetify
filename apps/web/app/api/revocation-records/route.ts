import { withRoute } from "@/lib/apiHelpers";
import { listRevocationRecords } from "@/lib/domain/compliance";
import { serializeRevocationRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listRevocationRecords(session);
  return rows.map(serializeRevocationRecord);
});
