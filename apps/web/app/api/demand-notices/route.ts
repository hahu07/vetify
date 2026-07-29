import { withRoute } from "@/lib/apiHelpers";
import { listDemandNotices } from "@/lib/domain/murabahah";
import { serializeDemandNotice } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listDemandNotices(session);
  return rows.map(serializeDemandNotice);
});
