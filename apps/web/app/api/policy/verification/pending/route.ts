import { withRoute } from "@/lib/apiHelpers";
import { listPendingVerificationPolicies } from "@/lib/domain/policy";

export const GET = withRoute(async (session) => {
  return listPendingVerificationPolicies(session);
});
