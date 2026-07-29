import { withRoute } from "@/lib/apiHelpers";
import { listIbraRequests } from "@/lib/domain/murabahah";
import { serializeIbraRequest } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listIbraRequests(session);
  return rows.map(serializeIbraRequest);
});
