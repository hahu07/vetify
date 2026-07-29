import { withRoute } from "@/lib/apiHelpers";
import { registerReviewer, listRegistry } from "@/lib/domain/governance";

export const GET = withRoute(async (session) => listRegistry(session, "reviewer"));

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return registerReviewer(session, { role: body.role, authorizedBy: body.authorizedBy });
});
