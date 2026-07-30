import { withRoute } from "@/lib/apiHelpers";
import { listWithdrawalRecords } from "@/lib/domain/financing";
import { serializeWithdrawalRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listWithdrawalRecords(session);
  return rows.map(serializeWithdrawalRecord);
});
