import { withRoute } from "@/lib/apiHelpers";
import { registerPolicyApprover, listRegistry } from "@/lib/domain/governance";

export const GET = withRoute(async (session) => listRegistry(session, "policyApprover"));

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return registerPolicyApprover(session, { approverName: body.approverName, role: body.role, authorizedBy: body.authorizedBy });
});
