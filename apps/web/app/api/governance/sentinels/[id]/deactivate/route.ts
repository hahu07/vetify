import { withRoute } from "@/lib/apiHelpers";
import { deactivateSentinel } from "@/lib/domain/governance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return deactivateSentinel(session, idFromUrl(req.url), { reason: body.reason, performedBy: body.performedBy });
});
