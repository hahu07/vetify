import { withRoute } from "@/lib/apiHelpers";
import { listTakafulPolicies } from "@/lib/domain/murabahah";
import { serializeTakafulPolicy } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listTakafulPolicies(session);
  return rows.map(serializeTakafulPolicy);
});
