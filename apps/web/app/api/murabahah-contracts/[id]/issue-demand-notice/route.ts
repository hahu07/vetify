import { withRoute } from "@/lib/apiHelpers";
import { issueDemandNotice } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return issueDemandNotice(session, idFromUrl(req.url), {
    demandDate: body.demandDate,
    demandRef: body.demandRef,
    responseDeadline: body.responseDeadline,
    gsmEligible: body.gsmEligible,
  });
});
