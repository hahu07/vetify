import { withRoute } from "@/lib/apiHelpers";
import { supersedeComplianceResult } from "@/lib/domain/compliance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return supersedeComplianceResult(session, idFromUrl(req.url), {
    correctionRef: body.correctionRef,
    correctedOutcome: body.correctedOutcome,
    reason: body.reason,
    correctedBy: body.correctedBy,
  });
});
