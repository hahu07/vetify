import { withRoute } from "@/lib/apiHelpers";
import { reactivateOfficer } from "@/lib/domain/governance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return reactivateOfficer(session, idFromUrl(req.url), { reason: body.reason, performedBy: body.performedBy });
});
