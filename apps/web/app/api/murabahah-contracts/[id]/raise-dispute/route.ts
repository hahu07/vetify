import { withRoute } from "@/lib/apiHelpers";
import { raiseDispute } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return raiseDispute(session, idFromUrl(req.url), {
    disputeType: body.disputeType,
    disputeDesc: body.disputeDesc,
    evidenceRef: body.evidenceRef ?? null,
  });
});
