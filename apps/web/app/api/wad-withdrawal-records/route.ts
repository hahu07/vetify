import { withRoute } from "@/lib/apiHelpers";
import { listWadWithdrawalRecords } from "@/lib/domain/murabahah";
import { serializeWadWithdrawalRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listWadWithdrawalRecords(session);
  return rows.map(serializeWadWithdrawalRecord);
});
