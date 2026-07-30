import { withRoute } from "@/lib/apiHelpers";
import { updateUnderwritingPolicy } from "@/lib/domain/financing";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return updateUnderwritingPolicy(session, idFromUrl(req.url), {
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
