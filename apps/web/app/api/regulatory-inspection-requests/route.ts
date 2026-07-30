import { withRoute } from "@/lib/apiHelpers";
import { createRegulatoryInspectionRequest, listRegulatoryInspectionRequests } from "@/lib/domain/murabahah";
import { serializeRegulatoryInspectionRequest } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listRegulatoryInspectionRequests(session);
  return rows.map(serializeRegulatoryInspectionRequest);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createRegulatoryInspectionRequest(session, {
    cacRegNumber: body.cacRegNumber,
    businessName: body.businessName,
    inspectionRef: body.inspectionRef,
    inspectionScope: body.inspectionScope,
    responseDeadline: body.responseDeadline,
  });
});
