import { withRoute } from "@/lib/apiHelpers";
import { recordProviderScore } from "@/lib/domain/providers";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordProviderScore(session, idFromUrl(req.url), {
    score: body.score,
    risk: body.risk,
    note: body.note ?? null,
    version: body.version,
    policyId: body.policyId ?? null,
  });
});
