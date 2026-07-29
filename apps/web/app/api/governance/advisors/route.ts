import { withRoute } from "@/lib/apiHelpers";
import { registerAdvisor, listRegistry } from "@/lib/domain/governance";

export const GET = withRoute(async (session) => listRegistry(session, "advisor"));

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return registerAdvisor(session, { advisor: body.advisor, role: body.role, authorizedBy: body.authorizedBy });
});
