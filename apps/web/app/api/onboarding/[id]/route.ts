import { withRoute } from "@/lib/apiHelpers";
import { getOnboarding } from "@/lib/domain/onboarding";
import { serializeOnboarding } from "@/lib/serialize";

export const GET = withRoute(async (session, req) => {
  const id = Number(new URL(req.url).pathname.split("/").at(-1));
  const row = await getOnboarding(session, id);
  return row ? serializeOnboarding(row) : null;
});
