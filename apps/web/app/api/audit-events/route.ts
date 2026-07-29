import { withRoute } from "@/lib/apiHelpers";
import { listAuditEvents } from "@/lib/domain/murabahah";
import { serializeAuditEvent } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listAuditEvents(session);
  return rows.map(serializeAuditEvent);
});
