import { withRoute } from "@/lib/apiHelpers";
import { listEddCases } from "@/lib/domain/compliance";

export const GET = withRoute(async (session) => listEddCases(session));
