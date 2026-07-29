import { withRoute } from "@/lib/apiHelpers";
import { listDirectDebitCollectionAttempts } from "@/lib/domain/murabahah";
import { serializeDirectDebitCollectionAttempt } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listDirectDebitCollectionAttempts(session);
  return rows.map(serializeDirectDebitCollectionAttempt);
});
