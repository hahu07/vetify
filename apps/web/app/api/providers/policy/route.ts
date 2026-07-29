import { withRoute } from "@/lib/apiHelpers";
import { createProviderVerificationPolicy, listProviderVerificationPolicies } from "@/lib/domain/providers";
import { serializeProviderVerificationPolicy } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listProviderVerificationPolicies(session);
  return rows.map(serializeProviderVerificationPolicy);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createProviderVerificationPolicy(session, {
    policyVersion: body.policyVersion,
    autoRejectMax: body.autoRejectMax,
    effectiveFrom: body.effectiveFrom,
    scoringWeights: body.scoringWeights,
  });
});
