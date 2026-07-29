import { withRoute } from "@/lib/apiHelpers";
import { listShariahContractCertifications } from "@/lib/domain/murabahah";
import { serializeShariahContractCertification } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listShariahContractCertifications(session);
  return rows.map(serializeShariahContractCertification);
});
