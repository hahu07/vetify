import { withRoute } from "@/lib/apiHelpers";
import { listHamishJiddiyyah } from "@/lib/domain/murabahah";
import { serializeHamishJiddiyyah } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listHamishJiddiyyah(session);
  return rows.map(serializeHamishJiddiyyah);
});
