import { withRoute } from "@/lib/apiHelpers";
import { listSupplierPaymentRecords } from "@/lib/domain/murabahah";
import { serializeSupplierPaymentRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listSupplierPaymentRecords(session);
  return rows.map(serializeSupplierPaymentRecord);
});
