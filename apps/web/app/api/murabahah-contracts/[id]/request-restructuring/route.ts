import { withRoute } from "@/lib/apiHelpers";
import { requestRestructuring } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return requestRestructuring(session, idFromUrl(req.url), {
    proposedSchedule: body.proposedSchedule,
    reason: body.reason,
    requestDate: body.requestDate,
  });
});
