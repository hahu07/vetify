import { withRoute } from "@/lib/apiHelpers";
import { createGuaranteeAgreement } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createGuaranteeAgreement(session, idFromUrl(req.url), {
    guaranteeType: body.guaranteeType,
    guaranteedAmount: body.guaranteedAmount,
    guarantorName: body.guarantorName,
    guarantorId: body.guarantorId,
    effectiveDate: body.effectiveDate,
    expiryDate: body.expiryDate ?? null,
  });
});
