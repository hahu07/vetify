import { withRoute } from "@/lib/apiHelpers";
import { listAssetRejectionRecords } from "@/lib/domain/murabahah";
import { serializeAssetRejectionRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listAssetRejectionRecords(session);
  return rows.map(serializeAssetRejectionRecord);
});
