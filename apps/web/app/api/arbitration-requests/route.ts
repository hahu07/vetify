import { withRoute } from "@/lib/apiHelpers";
import { listArbitrationRequests } from "@/lib/domain/murabahah";
import { serializeArbitrationRequest } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listArbitrationRequests(session);
  return rows.map(serializeArbitrationRequest);
});
