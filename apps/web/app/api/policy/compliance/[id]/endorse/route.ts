import { withRoute } from "@/lib/apiHelpers";
import { endorseCompliancePolicy } from "@/lib/domain/policy";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return endorseCompliancePolicy(session, idFromUrl(req.url), { endorsedBy: body.endorsedBy });
});
