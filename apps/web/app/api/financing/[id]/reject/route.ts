import { withRoute } from "@/lib/apiHelpers";
import { rejectFunding } from "@/lib/domain/financing";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return rejectFunding(session, idFromUrl(req.url), {
    reason: body.reason,
    rejectedByName: body.rejectedByName ?? session.displayName,
    reasonCode: body.reasonCode,
    decisionFactors: body.decisionFactors ?? [],
  });
});
