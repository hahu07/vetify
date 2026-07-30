import { withRoute } from "@/lib/apiHelpers";
import { listMurabahahWakalas } from "@/lib/domain/murabahah";
import { serializeMurabahahWakala } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listMurabahahWakalas(session);
  return rows.map(serializeMurabahahWakala);
});
