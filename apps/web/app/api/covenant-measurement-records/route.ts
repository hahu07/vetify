import { withRoute } from "@/lib/apiHelpers";
import { listCovenantMeasurementRecords } from "@/lib/domain/murabahah";
import { serializeCovenantMeasurementRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listCovenantMeasurementRecords(session);
  return rows.map(serializeCovenantMeasurementRecord);
});
