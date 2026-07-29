import { withRoute } from "@/lib/apiHelpers";
import { listVerificationResults } from "@/lib/domain/compliance";
import { serializeVerificationResult } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listVerificationResults(session);
  return rows.map(serializeVerificationResult);
});
