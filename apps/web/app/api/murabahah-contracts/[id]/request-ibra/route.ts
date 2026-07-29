import { withRoute } from "@/lib/apiHelpers";
import { requestIbra } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return requestIbra(session, idFromUrl(req.url), {
    requestedSettlementDate: body.requestedSettlementDate,
    settlementType: body.settlementType,
    requestedAmount: body.requestedAmount ?? null,
  });
});
