import { withRoute } from "@/lib/apiHelpers";
import { rejectProvider } from "@/lib/domain/providers";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return rejectProvider(session, idFromUrl(req.url), {
    reason: body.reason,
    agentScore: body.agentScore ?? null,
    agentRisk: body.agentRisk ?? null,
    agentVersion: body.agentVersion ?? null,
    policyId: body.policyId ?? null,
  });
});
