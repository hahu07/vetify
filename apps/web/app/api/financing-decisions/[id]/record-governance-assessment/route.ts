import { withRoute } from "@/lib/apiHelpers";
import { recordGovernanceAssessment } from "@/lib/domain/financing";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordGovernanceAssessment(session, idFromUrl(req.url), {
    aiRecommendationFollowed: body.aiRecommendationFollowed,
    governanceNote: body.governanceNote ?? null,
    assessedBy: body.assessedBy,
  });
});
