import { withRoute } from "@/lib/apiHelpers";
import { getProviderOnboarding } from "@/lib/domain/providers";
import { serializeProviderOnboarding } from "@/lib/serialize";

export const GET = withRoute(async (session, req) => {
  const id = Number(new URL(req.url).pathname.split("/").at(-1));
  const row = await getProviderOnboarding(session, id);
  return row ? serializeProviderOnboarding(row) : null;
});
