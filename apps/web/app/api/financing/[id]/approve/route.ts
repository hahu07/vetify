import { withRoute } from "@/lib/apiHelpers";
import { approveFunding } from "@/lib/domain/financing";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return approveFunding(session, idFromUrl(req.url), {
    assetDetails: body.assetDetails,
    approvedByName: body.approvedByName ?? session.displayName,
    reasonCode: body.reasonCode,
    decisionFactors: body.decisionFactors ?? [],
  });
});
