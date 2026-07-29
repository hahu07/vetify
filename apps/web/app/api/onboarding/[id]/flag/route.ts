import { withRoute } from "@/lib/apiHelpers";
import { flagForManualReview } from "@/lib/domain/onboarding";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return flagForManualReview(session, idFromUrl(req.url), {
    riskScore: body.riskScore,
    riskLevel: body.riskLevel,
    agentVersion: body.agentVersion ?? "manual-v1",
    note: body.note,
  });
});
