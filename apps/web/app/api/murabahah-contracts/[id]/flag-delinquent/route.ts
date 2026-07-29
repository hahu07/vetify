import { withRoute } from "@/lib/apiHelpers";
import { flagDelinquent } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return flagDelinquent(session, idFromUrl(req.url), {
    reason: body.reason,
    sentinelId: body.sentinelId,
  });
});
