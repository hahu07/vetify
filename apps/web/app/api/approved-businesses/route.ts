import { withRoute } from "@/lib/apiHelpers";
import { listApprovedBusinesses } from "@/lib/domain/compliance";
import { serializeApprovedBusiness } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listApprovedBusinesses(session);
  return rows.map(serializeApprovedBusiness);
});
