import { withRoute } from "@/lib/apiHelpers";
import { listMurabahahProposals } from "@/lib/domain/murabahah";
import { serializeMurabahahProposal } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listMurabahahProposals(session);
  return rows.map(serializeMurabahahProposal);
});
