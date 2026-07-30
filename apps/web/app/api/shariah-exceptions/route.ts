import { withRoute } from "@/lib/apiHelpers";
import { createShariahException, listShariahExceptions } from "@/lib/domain/murabahah";
import { serializeShariahException } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listShariahExceptions(session);
  return rows.map(serializeShariahException);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createShariahException(session, {
    cacRegNumber: body.cacRegNumber,
    businessName: body.businessName,
    facilityRef: body.facilityRef ?? null,
    exceptionType: body.exceptionType,
    description: body.description,
    severity: body.severity,
  });
});
