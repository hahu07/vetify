import { withRoute } from "@/lib/apiHelpers";
import { listRestructuringRequests } from "@/lib/domain/murabahah";
import { serializeRestructuringRequest } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listRestructuringRequests(session);
  return rows.map(serializeRestructuringRequest);
});
