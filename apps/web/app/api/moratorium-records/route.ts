import { withRoute } from "@/lib/apiHelpers";
import { listMoratoriumRecords } from "@/lib/domain/murabahah";
import { serializeMoratoriumRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listMoratoriumRecords(session);
  return rows.map(serializeMoratoriumRecord);
});
