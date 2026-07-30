import { withRoute } from "@/lib/apiHelpers";
import { listIbraRebateProposals } from "@/lib/domain/murabahah";
import { serializeIbraRebateProposal } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listIbraRebateProposals(session);
  return rows.map(serializeIbraRebateProposal);
});
