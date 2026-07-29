import { withRoute } from "@/lib/apiHelpers";
import { deactivateAdvisor } from "@/lib/domain/governance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return deactivateAdvisor(session, idFromUrl(req.url), { reason: body.reason, performedBy: body.performedBy });
});
