import { withRoute } from "@/lib/apiHelpers";
import { createCapitalCallRecord, listCapitalCallRecords } from "@/lib/domain/murabahah";
import { serializeCapitalCallRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listCapitalCallRecords(session);
  return rows.map(serializeCapitalCallRecord);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createCapitalCallRecord(session, {
    cacRegNumber: body.cacRegNumber,
    businessName: body.businessName,
    facilityRef: body.facilityRef,
    trancheNumber: body.trancheNumber,
    trancheAmount: body.trancheAmount,
    disbursementDate: body.disbursementDate,
    purposeOfTranche: body.purposeOfTranche,
    disbursementRef: body.disbursementRef,
    cumulativeDisbursed: body.cumulativeDisbursed,
    remainingFacility: body.remainingFacility,
  });
});
