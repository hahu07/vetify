import { withRoute } from "@/lib/apiHelpers";
import { listMurabahahWads } from "@/lib/domain/murabahah";
import { serializeMurabahahWad } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listMurabahahWads(session);
  return rows.map(serializeMurabahahWad);
});
