import { withRoute } from "@/lib/apiHelpers";
import { proceedWithReplacement } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return proceedWithReplacement(session, idFromUrl(req.url), {
    newActualCost: body.newActualCost,
    newPurchaseDate: body.newPurchaseDate,
    newInvoiceRef: body.newInvoiceRef,
    replacementNote: body.replacementNote,
  });
});
