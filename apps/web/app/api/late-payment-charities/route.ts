import { withRoute } from "@/lib/apiHelpers";
import { listLatePaymentCharities } from "@/lib/domain/murabahah";
import { serializeLatePaymentCharity } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listLatePaymentCharities(session);
  return rows.map(serializeLatePaymentCharity);
});
