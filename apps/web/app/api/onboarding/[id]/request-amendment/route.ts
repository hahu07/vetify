import { withRoute } from "@/lib/apiHelpers";
import { requestAmendment } from "@/lib/domain/onboarding";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return requestAmendment(session, idFromUrl(req.url), { note: body.note });
});
