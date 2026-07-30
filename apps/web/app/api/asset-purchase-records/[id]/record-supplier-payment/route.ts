import { withRoute } from "@/lib/apiHelpers";
import { recordSupplierPayment } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordSupplierPayment(session, idFromUrl(req.url), {
    supplierDetails: body.supplierDetails ?? null,
    amountPaid: body.amountPaid,
    paymentDate: body.paymentDate,
    paymentRef: body.paymentRef,
    bankConfirmationRef: body.bankConfirmationRef ?? null,
  });
});
