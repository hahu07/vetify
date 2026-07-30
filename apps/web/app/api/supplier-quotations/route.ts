import { withRoute } from "@/lib/apiHelpers";
import { listSupplierQuotations } from "@/lib/domain/murabahah";
import { serializeSupplierQuotation } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listSupplierQuotations(session);
  return rows.map(serializeSupplierQuotation);
});
