import { withRoute } from "@/lib/apiHelpers";
import { deactivatePolicyApprover } from "@/lib/domain/governance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return deactivatePolicyApprover(session, idFromUrl(req.url), { reason: body.reason, performedBy: body.performedBy });
});
