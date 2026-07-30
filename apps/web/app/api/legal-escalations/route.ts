import { withRoute } from "@/lib/apiHelpers";
import { listLegalEscalations } from "@/lib/domain/murabahah";
import { serializeLegalEscalation } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listLegalEscalations(session);
  return rows.map(serializeLegalEscalation);
});
