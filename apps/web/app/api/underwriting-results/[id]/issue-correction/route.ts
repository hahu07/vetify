import { withRoute } from "@/lib/apiHelpers";
import { issueUnderwritingCorrection } from "@/lib/domain/financing";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return issueUnderwritingCorrection(session, idFromUrl(req.url), {
    correctedAssessment: body.correctedAssessment,
    correctionRef: body.correctionRef,
    correctedOutcome: body.correctedOutcome,
    reason: body.reason,
    correctedBy: body.correctedBy,
  });
});
