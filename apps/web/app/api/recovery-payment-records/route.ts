import { withRoute } from "@/lib/apiHelpers";
import { listRecoveryPaymentRecords } from "@/lib/domain/murabahah";
import { serializeRecoveryPaymentRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listRecoveryPaymentRecords(session);
  return rows.map(serializeRecoveryPaymentRecord);
});
