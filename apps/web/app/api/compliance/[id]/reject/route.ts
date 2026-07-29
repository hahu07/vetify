import { withRoute } from "@/lib/apiHelpers";
import { rejectCompliance } from "@/lib/domain/compliance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return rejectCompliance(session, idFromUrl(req.url), {
    completedChecks: body.completedChecks,
    riskScore: body.riskScore,
    riskLevel: body.riskLevel,
    autoDecided: body.autoDecided ?? false,
    reviewerParty: body.reviewerParty ?? session.partyRole,
    reviewedBy: body.reviewedBy ?? session.displayName,
    reason: body.reason,
  });
});
