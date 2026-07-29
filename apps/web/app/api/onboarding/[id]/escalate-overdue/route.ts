import { withRoute } from "@/lib/apiHelpers";
import { escalateOverdue } from "@/lib/domain/onboarding";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return escalateOverdue(session, idFromUrl(req.url), { slaHours: body.slaHours, policyId: body.policyId ?? null });
});
