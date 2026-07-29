import { withRoute } from "@/lib/apiHelpers";
import { updateEddChecklist } from "@/lib/domain/compliance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return updateEddChecklist(session, idFromUrl(req.url), {
    sourceOfWealthVerified: body.sourceOfWealthVerified ?? null,
    sourceOfWealthNote: body.sourceOfWealthNote ?? null,
    enhancedMediaSearchDone: body.enhancedMediaSearchDone ?? null,
    seniorManagementSignoff: body.seniorManagementSignoff ?? null,
    monitoringFrequency: body.monitoringFrequency ?? null,
  });
});
