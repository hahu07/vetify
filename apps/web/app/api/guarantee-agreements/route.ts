import { withRoute } from "@/lib/apiHelpers";
import { listGuaranteeAgreements } from "@/lib/domain/murabahah";
import { serializeGuaranteeAgreement } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listGuaranteeAgreements(session);
  return rows.map(serializeGuaranteeAgreement);
});
