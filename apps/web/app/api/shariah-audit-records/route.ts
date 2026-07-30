import { withRoute } from "@/lib/apiHelpers";
import { createShariahAuditRecord, listShariahAuditRecords } from "@/lib/domain/murabahah";
import { serializeShariahAuditRecord } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listShariahAuditRecords(session);
  return rows.map(serializeShariahAuditRecord);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createShariahAuditRecord(session, {
    cacRegNumber: body.cacRegNumber,
    businessName: body.businessName,
    facilityRef: body.facilityRef ?? null,
    auditDate: body.auditDate,
    auditPeriod: body.auditPeriod,
    auditorRef: body.auditorRef,
    findings: body.findings ?? [],
    overallCompliant: body.overallCompliant,
    recommendations: body.recommendations ?? [],
    nextAuditDate: body.nextAuditDate ?? null,
  });
});
