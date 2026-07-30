import { withRoute } from "@/lib/apiHelpers";
import { listRequestClosureRecords } from "@/lib/domain/financing";
import { serializeRequestClosureRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listRequestClosureRecords(session);
  return rows.map(serializeRequestClosureRecord);
});
