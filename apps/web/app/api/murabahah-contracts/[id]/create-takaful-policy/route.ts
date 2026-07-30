import { withRoute } from "@/lib/apiHelpers";
import { createTakafulPolicy } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createTakafulPolicy(session, idFromUrl(req.url), {
    policyNumber: body.policyNumber,
    takafulOperator: body.takafulOperator,
    coverageType: body.coverageType,
    coverageAmount: body.coverageAmount,
    premiumAmount: body.premiumAmount,
    startDate: body.startDate,
    expiryDate: body.expiryDate,
    assetRef: body.assetRef ?? null,
  });
});
