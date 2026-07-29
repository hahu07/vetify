import { withRoute } from "@/lib/apiHelpers";
import { listGsmInvocations } from "@/lib/domain/murabahah";
import { serializeGsmInvocation } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listGsmInvocations(session);
  return rows.map(serializeGsmInvocation);
});
