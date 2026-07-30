import { withRoute } from "@/lib/apiHelpers";
import { recordDeliveryMilestone } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordDeliveryMilestone(session, idFromUrl(req.url), {
    milestoneDescription: body.milestoneDescription,
    quantityDelivered: body.quantityDelivered,
    milestoneDate: body.milestoneDate,
    evidenceRef: body.evidenceRef ?? null,
  });
});
