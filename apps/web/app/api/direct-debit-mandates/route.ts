import { withRoute } from "@/lib/apiHelpers";
import { listDirectDebitMandates } from "@/lib/domain/murabahah";
import { serializeDirectDebitMandate } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listDirectDebitMandates(session);
  return rows.map(serializeDirectDebitMandate);
});
