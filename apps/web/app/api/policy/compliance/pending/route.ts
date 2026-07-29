import { withRoute } from "@/lib/apiHelpers";
import { listPendingCompliancePolicies } from "@/lib/domain/policy";

export const GET = withRoute(async (session) => {
  return listPendingCompliancePolicies(session);
});
