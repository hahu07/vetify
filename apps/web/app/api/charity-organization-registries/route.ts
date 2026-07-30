import { withRoute } from "@/lib/apiHelpers";
import { createCharityOrganizationRegistry, listCharityOrganizationRegistries } from "@/lib/domain/murabahah";
import { serializeCharityOrganizationRegistry } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listCharityOrganizationRegistries(session);
  return rows.map(serializeCharityOrganizationRegistry);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createCharityOrganizationRegistry(session, {
    approvedOrganizations: body.approvedOrganizations,
    shariahBoardRef: body.shariahBoardRef,
    effectiveDate: body.effectiveDate,
    version: body.version,
  });
});
