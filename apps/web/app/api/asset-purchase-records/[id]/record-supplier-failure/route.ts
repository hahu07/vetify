import { withRoute } from "@/lib/apiHelpers";
import { recordSupplierFailure } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordSupplierFailure(session, idFromUrl(req.url), {
    failureType: body.failureType,
    failureDescription: body.failureDescription,
    refundAmount: body.refundAmount ?? null,
  });
});
