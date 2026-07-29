import { withRoute } from "@/lib/apiHelpers";
import { requestFinancing, listFinancingRequests } from "@/lib/domain/financing";
import { serializeFinancingRequest } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listFinancingRequests(session);
  return rows.map(serializeFinancingRequest);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return requestFinancing(session, {
    terms: body.terms,
    financingRef: body.financingRef,
    businessSector: body.businessSector,
    verificationRef: body.verificationRef,
    complianceRef: body.complianceRef,
  });
});
