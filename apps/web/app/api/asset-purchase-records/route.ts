import { withRoute } from "@/lib/apiHelpers";
import { listAssetPurchaseRecords } from "@/lib/domain/murabahah";
import { serializeAssetPurchaseRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listAssetPurchaseRecords(session);
  return rows.map(serializeAssetPurchaseRecord);
});
