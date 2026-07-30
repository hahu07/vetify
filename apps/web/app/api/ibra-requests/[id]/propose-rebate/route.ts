import { withRoute } from "@/lib/apiHelpers";
import { proposeRebate } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return proposeRebate(session, idFromUrl(req.url), {
    suggestedRebate: body.suggestedRebate,
    rationale: body.rationale,
  });
});
