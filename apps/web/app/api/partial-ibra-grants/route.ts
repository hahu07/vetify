import { withRoute } from "@/lib/apiHelpers";
import { listPartialIbraGrants } from "@/lib/domain/murabahah";
import { serializePartialIbraGrant } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listPartialIbraGrants(session);
  return rows.map(serializePartialIbraGrant);
});
