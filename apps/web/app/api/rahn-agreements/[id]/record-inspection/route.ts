import { withRoute } from "@/lib/apiHelpers";
import { recordInspection } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordInspection(session, idFromUrl(req.url), {
    inspectionDate: body.inspectionDate,
    inspectedBy: body.inspectedBy,
    condition: body.condition,
    inspectionNotes: body.inspectionNotes ?? null,
    nextInspectionDate: body.nextInspectionDate ?? null,
    mandateStatus: body.mandateStatus ?? null,
    estimatedGsmRecoverable: body.estimatedGsmRecoverable ?? null,
  });
});
