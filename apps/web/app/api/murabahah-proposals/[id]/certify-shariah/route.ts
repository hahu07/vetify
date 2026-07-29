import { withRoute } from "@/lib/apiHelpers";
import { certifyShariahTerms } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return certifyShariahTerms(session, idFromUrl(req.url), {
    certificationRef: body.certificationRef,
    aaoifiStandards: body.aaoifiStandards ?? [],
    rationale: body.rationale,
    certifiedBy: body.certifiedBy,
  });
});
