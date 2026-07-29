import { withRoute } from "@/lib/apiHelpers";
import { updateProviderVerificationPolicy } from "@/lib/domain/providers";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return updateProviderVerificationPolicy(session, idFromUrl(req.url), {
    policyVersion: body.newPolicyVersion,
    autoRejectMax: body.newAutoRejectMax,
    effectiveFrom: body.newEffectiveFrom,
    scoringWeights: body.newScoringWeights,
  });
});
