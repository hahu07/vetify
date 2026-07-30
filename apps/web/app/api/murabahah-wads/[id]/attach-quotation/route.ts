import { withRoute } from "@/lib/apiHelpers";
import { attachQuotation } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return attachQuotation(session, idFromUrl(req.url), {
    supplierName: body.supplierName,
    quotationRef: body.quotationRef,
    quotedAmount: body.quotedAmount,
    validUntil: body.validUntil ?? null,
  });
});
