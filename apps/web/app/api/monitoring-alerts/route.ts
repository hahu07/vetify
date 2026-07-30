import { withRoute } from "@/lib/apiHelpers";
import { createMonitoringAlert, listMonitoringAlerts } from "@/lib/domain/murabahah";
import { serializeMonitoringAlert } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listMonitoringAlerts(session);
  return rows.map(serializeMonitoringAlert);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createMonitoringAlert(session, {
    cacRegNumber: body.cacRegNumber,
    businessName: body.businessName,
    facilityRef: body.facilityRef ?? null,
    alertType: body.alertType,
    alertSeverity: body.alertSeverity,
    alertDescription: body.alertDescription,
  });
});
