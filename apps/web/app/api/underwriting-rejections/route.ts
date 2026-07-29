import { withRoute } from "@/lib/apiHelpers";
import { listUnderwritingRejections } from "@/lib/domain/financing";
import { serializeUnderwritingRejection } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listUnderwritingRejections(session);
  return rows.map(serializeUnderwritingRejection);
});
