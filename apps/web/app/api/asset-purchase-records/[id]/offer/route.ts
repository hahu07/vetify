import { withRoute } from "@/lib/apiHelpers";
import { offerMurabahah } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return offerMurabahah(session, idFromUrl(req.url), {
    murabahahTerms: body.murabahahTerms,
    paymentSchedule: body.paymentSchedule,
    facilityRef: body.facilityRef,
    startDate: body.startDate,
    acceptanceExpiresAt: body.acceptanceExpiresAt,
  });
});
