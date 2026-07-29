import { withRoute } from "@/lib/apiHelpers";
import { supersedeShariahVerdict } from "@/lib/domain/compliance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return supersedeShariahVerdict(session, idFromUrl(req.url), {
    correctionRef: body.correctionRef,
    newVerdict: {
      verdict: body.newVerdict.verdict,
      activitiesScreened: body.newVerdict.activitiesScreened ?? [],
      prohibitedRevenuePct: body.newVerdict.prohibitedRevenuePct ?? null,
      aaoifiStandards: body.newVerdict.aaoifiStandards ?? [],
      scholarDecision: body.newVerdict.scholarDecision ?? null,
      rationale: body.newVerdict.rationale,
    },
    reason: body.reason,
    correctedBy: body.correctedBy,
  });
});
