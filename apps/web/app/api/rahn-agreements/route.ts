import { withRoute } from "@/lib/apiHelpers";
import { listRahnAgreements } from "@/lib/domain/murabahah";
import { serializeRahnAgreement } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listRahnAgreements(session);
  return rows.map(serializeRahnAgreement);
});
