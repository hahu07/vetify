import { withRoute } from "@/lib/apiHelpers";
import { registerOfficer, listRegistry } from "@/lib/domain/governance";

export const GET = withRoute(async (session) => listRegistry(session, "officer"));

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return registerOfficer(session, {
    officerId: body.officerId,
    officerName: body.officerName,
    roles: body.roles ?? [],
    authorizedBy: body.authorizedBy,
    approvalLimit: body.approvalLimit ?? null,
  });
});
