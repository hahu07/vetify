import { withRoute } from "@/lib/apiHelpers";
import { approve } from "@/lib/domain/onboarding";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return approve(session, idFromUrl(req.url), {
    checks: body.checks,
    riskScore: body.riskScore,
    riskLevel: body.riskLevel,
    autoDecided: body.autoDecided ?? false,
    reviewerParty: body.reviewerParty ?? session.partyRole,
    reviewedBy: body.reviewedBy ?? session.displayName,
    verificationRef: body.verificationRef,
  });
});
