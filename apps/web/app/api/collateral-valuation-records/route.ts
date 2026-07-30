import { withRoute } from "@/lib/apiHelpers";
import { listCollateralValuationRecords } from "@/lib/domain/murabahah";
import { serializeCollateralValuationRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listCollateralValuationRecords(session);
  return rows.map(serializeCollateralValuationRecord);
});
