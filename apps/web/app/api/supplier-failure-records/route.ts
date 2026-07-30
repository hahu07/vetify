import { withRoute } from "@/lib/apiHelpers";
import { listSupplierFailureRecords } from "@/lib/domain/murabahah";
import { serializeSupplierFailureRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listSupplierFailureRecords(session);
  return rows.map(serializeSupplierFailureRecord);
});
