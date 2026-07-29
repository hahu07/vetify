import { withRoute } from "@/lib/apiHelpers";
import { proceedDirectly } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return proceedDirectly(session, idFromUrl(req.url), {
    actualCost: body.actualCost,
    purchaseDate: body.purchaseDate,
    invoiceRef: body.invoiceRef,
    freightCost: body.freightCost,
    customsDuty: body.customsDuty,
    insurancePremium: body.insurancePremium,
    otherAcquisitionCosts: body.otherAcquisitionCosts,
  });
});
