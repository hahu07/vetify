import { withRoute } from "@/lib/apiHelpers";
import { proposeCompliancePolicy, listCompliancePolicies } from "@/lib/domain/policy";

export const GET = withRoute(async (session) => {
  return listCompliancePolicies(session);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return proposeCompliancePolicy(session, {
    autoApproveMin: body.autoApproveMin,
    autoRejectMax: body.autoRejectMax,
    escalationSlaHours: body.escalationSlaHours,
    shariahPolicyVersion: body.shariahPolicyVersion,
    policyVersion: body.policyVersion,
    effectiveFrom: body.effectiveFrom,
    effectiveTo: body.effectiveTo ?? null,
    scoringWeights: body.scoringWeights,
    proposedBy: body.proposedBy,
    reason: body.reason,
  });
});
