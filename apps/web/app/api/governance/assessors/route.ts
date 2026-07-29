import { withRoute } from "@/lib/apiHelpers";
import { registerAssessor, listRegistry } from "@/lib/domain/governance";

export const GET = withRoute(async (session) => listRegistry(session, "assessor"));

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return registerAssessor(session, { assessor: body.assessor, role: body.role, authorizedBy: body.authorizedBy });
});
