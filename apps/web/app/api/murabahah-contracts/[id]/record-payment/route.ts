import { withRoute } from "@/lib/apiHelpers";
import { recordPayment } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordPayment(session, idFromUrl(req.url), {
    paymentDate: body.paymentDate,
    amountPaid: body.amountPaid,
    installmentNo: body.installmentNo,
    directDebitRef: body.directDebitRef ?? null,
  });
});
