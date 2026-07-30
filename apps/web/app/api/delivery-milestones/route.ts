import { withRoute } from "@/lib/apiHelpers";
import { listDeliveryMilestones } from "@/lib/domain/murabahah";
import { serializeDeliveryMilestone } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listDeliveryMilestones(session);
  return rows.map(serializeDeliveryMilestone);
});
