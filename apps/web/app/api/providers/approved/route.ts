import { withRoute } from "@/lib/apiHelpers";
import { listApprovedProviders } from "@/lib/domain/providers";
import { serializeApprovedProvider } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listApprovedProviders(session);
  return rows.map(serializeApprovedProvider);
});
