import { withRoute } from "@/lib/apiHelpers";
import { confirmCharityPayment } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return confirmCharityPayment(session, idFromUrl(req.url), {
    charityRef: body.charityRef,
    charityOrganization: body.charityOrganization,
  });
});
