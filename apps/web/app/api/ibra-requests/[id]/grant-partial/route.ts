import { withRoute } from "@/lib/apiHelpers";
import { grantPartialIbra } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return grantPartialIbra(session, idFromUrl(req.url), {
    rebateAmount: body.rebateAmount,
    approvedSettlementAmount: body.approvedSettlementAmount,
    proposedByOfficerId: body.proposedByOfficerId,
    confirmedByOfficerId: body.confirmedByOfficerId,
  });
});
