import { withRoute } from "@/lib/apiHelpers";
import { listShariahCertificationRevocations } from "@/lib/domain/murabahah";
import { serializeShariahCertificationRevocation } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listShariahCertificationRevocations(session);
  return rows.map(serializeShariahCertificationRevocation);
});
