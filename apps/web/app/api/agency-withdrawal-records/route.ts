import { withRoute } from "@/lib/apiHelpers";
import { listAgencyWithdrawalRecords } from "@/lib/domain/murabahah";
import { serializeAgencyWithdrawalRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listAgencyWithdrawalRecords(session);
  return rows.map(serializeAgencyWithdrawalRecord);
});
