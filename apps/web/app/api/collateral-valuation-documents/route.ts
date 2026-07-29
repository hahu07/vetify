import { withRoute } from "@/lib/apiHelpers";
import { listCollateralValuationDocuments } from "@/lib/domain/murabahah";
import { serializeCollateralValuationDocument } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listCollateralValuationDocuments(session);
  return rows.map(serializeCollateralValuationDocument);
});
