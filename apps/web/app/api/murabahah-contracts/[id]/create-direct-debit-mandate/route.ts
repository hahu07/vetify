import { withRoute } from "@/lib/apiHelpers";
import { createDirectDebitMandate } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createDirectDebitMandate(session, idFromUrl(req.url), {
    monoMandateRef: body.monoMandateRef,
    accountRef: body.accountRef,
    bankName: body.bankName,
    maxCollectionAmount: body.maxCollectionAmount,
    frequency: body.frequency ?? "MONTHLY",
    mandateStartDate: body.mandateStartDate,
    mandateEndDate: body.mandateEndDate ?? null,
    gsmConsentGiven: body.gsmConsentGiven,
    gsmConsentDate: body.gsmConsentDate ?? null,
  });
});
