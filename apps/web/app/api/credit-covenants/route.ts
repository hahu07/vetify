import { withRoute } from "@/lib/apiHelpers";
import { listCreditCovenants } from "@/lib/domain/murabahah";
import { serializeCreditCovenant } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listCreditCovenants(session);
  return rows.map(serializeCreditCovenant);
});
