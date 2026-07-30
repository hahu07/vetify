import { withRoute } from "@/lib/apiHelpers";
import { listCollateralInspectionRecords } from "@/lib/domain/murabahah";
import { serializeCollateralInspectionRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listCollateralInspectionRecords(session);
  return rows.map(serializeCollateralInspectionRecord);
});
