import { withRoute } from "@/lib/apiHelpers";
import { listUnderwritingResults } from "@/lib/domain/financing";
import { serializeUnderwritingResult } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listUnderwritingResults(session);
  return rows.map(serializeUnderwritingResult);
});
