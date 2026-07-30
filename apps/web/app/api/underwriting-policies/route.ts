import { withRoute } from "@/lib/apiHelpers";
import { createUnderwritingPolicy, listUnderwritingPolicies } from "@/lib/domain/financing";
import { serializeUnderwritingPolicy } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listUnderwritingPolicies(session);
  return rows.map(serializeUnderwritingPolicy);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createUnderwritingPolicy(session, {
    policyVersion: body.policyVersion,
    autoApproveMin: body.autoApproveMin,
    autoRejectMax: body.autoRejectMax,
    minDscrRatio: body.minDscrRatio ?? null,
    minLoanAmount: body.minLoanAmount ?? null,
    maxLoanAmount: body.maxLoanAmount ?? null,
    indicativeProfitMarginPct: body.indicativeProfitMarginPct ?? null,
    requestSlaHours: body.requestSlaHours,
    offerValidityDays: body.offerValidityDays,
    effectiveFrom: body.effectiveFrom,
    writeOffThresholdAmount: body.writeOffThresholdAmount ?? null,
    maxRestructuringsPerFacility: body.maxRestructuringsPerFacility ?? null,
    permittedSectors: body.permittedSectors ?? null,
    requiredCollateralTypes: body.requiredCollateralTypes ?? [],
    maxSectorConcentrationPct: body.maxSectorConcentrationPct ?? null,
    scoringWeights: body.scoringWeights,
  });
});
