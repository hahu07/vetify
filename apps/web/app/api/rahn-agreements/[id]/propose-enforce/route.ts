import { withRoute } from "@/lib/apiHelpers";
import { proposeEnforceCollateral } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return proposeEnforceCollateral(session, idFromUrl(req.url), {
    reason: body.reason,
    gsmExhausted: body.gsmExhausted ?? false,
    gsmRef: body.gsmRef ?? null,
    proposedByOfficerId: body.proposedByOfficerId,
  });
});
