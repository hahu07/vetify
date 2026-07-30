import { withRoute } from "@/lib/apiHelpers";
import { listInspectionResponses } from "@/lib/domain/murabahah";
import { serializeInspectionResponse } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listInspectionResponses(session);
  return rows.map(serializeInspectionResponse);
});
