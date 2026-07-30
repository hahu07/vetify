import { withRoute } from "@/lib/apiHelpers";
import { proposeAmendment } from "@/lib/domain/financing";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return proposeAmendment(session, idFromUrl(req.url), {
    proposedTerms: body.proposedTerms,
    proposalNote: body.proposalNote ?? null,
  });
});
