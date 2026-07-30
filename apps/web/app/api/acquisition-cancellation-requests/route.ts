import { withRoute } from "@/lib/apiHelpers";
import { listAcquisitionCancellationRequests } from "@/lib/domain/murabahah";
import { serializeAcquisitionCancellationRequest } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listAcquisitionCancellationRequests(session);
  return rows.map(serializeAcquisitionCancellationRequest);
});
