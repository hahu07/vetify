import { withRoute } from "@/lib/apiHelpers";
import { flagUnderwritingForManualReview } from "@/lib/domain/financing";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return flagUnderwritingForManualReview(session, idFromUrl(req.url), {
    riskScore: body.riskScore,
    riskLevel: body.riskLevel,
    agentVersion: body.agentVersion ?? "manual-v1",
    note: body.note,
  });
});
