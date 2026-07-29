import { withRoute } from "@/lib/apiHelpers";
import { listMurabahahContracts } from "@/lib/domain/murabahah";
import { serializeMurabahahContract } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listMurabahahContracts(session);
  return rows.map(serializeMurabahahContract);
});
