import { withRoute } from "@/lib/apiHelpers";
import { supersedeVerificationResult } from "@/lib/domain/onboarding";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return supersedeVerificationResult(session, idFromUrl(req.url), {
    correctionRef: body.correctionRef,
    correctedOutcome: body.correctedOutcome,
    reason: body.reason,
    correctedBy: body.correctedBy,
  });
});
