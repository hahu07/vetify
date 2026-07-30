import { withRoute } from "@/lib/apiHelpers";
import { createCreditCovenant } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createCreditCovenant(session, idFromUrl(req.url), {
    covenantType: body.covenantType,
    threshold: body.threshold,
    measurementFrequency: body.measurementFrequency,
  });
});
