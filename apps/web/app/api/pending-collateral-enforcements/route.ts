import { withRoute } from "@/lib/apiHelpers";
import { listPendingCollateralEnforcements } from "@/lib/domain/murabahah";
import { serializePendingCollateralEnforcement } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listPendingCollateralEnforcements(session);
  return rows.map(serializePendingCollateralEnforcement);
});
