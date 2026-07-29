import { withRoute } from "@/lib/apiHelpers";
import { proposeVerificationPolicy, listVerificationPolicies } from "@/lib/domain/policy";

export const GET = withRoute(async (session) => {
  return listVerificationPolicies(session);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return proposeVerificationPolicy(session, {
    maxAmendments: body.maxAmendments,
    slaHours: body.slaHours,
    autoApproveMin: body.autoApproveMin,
    autoRejectMax: body.autoRejectMax,
    requiredDocTypes: body.requiredDocTypes ?? [],
    policyVersion: body.policyVersion,
    scoringWeights: body.scoringWeights,
    proposedBy: body.proposedBy,
    reason: body.reason,
  });
});
