import { withRoute } from "@/lib/apiHelpers";
import { listDocumentEntries } from "@/lib/domain/murabahah";
import { serializeDocumentEntry } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listDocumentEntries(session);
  return rows.map(serializeDocumentEntry);
});
