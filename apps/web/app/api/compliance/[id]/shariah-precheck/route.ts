import { withRoute } from "@/lib/apiHelpers";
import { recordShariahPreCheck } from "@/lib/domain/compliance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordShariahPreCheck(session, idFromUrl(req.url), {
    verdict: {
      verdict: body.verdict,
      activitiesScreened: body.activitiesScreened ?? [],
      prohibitedRevenuePct: body.prohibitedRevenuePct ?? null,
      aaoifiStandards: body.aaoifiStandards ?? [],
      scholarDecision: body.scholarDecision ?? null,
      rationale: body.rationale,
    },
    advisorId: body.advisorId,
  });
});
