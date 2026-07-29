import { withRoute } from "@/lib/apiHelpers";
import { openEddCase } from "@/lib/domain/compliance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return openEddCase(session, idFromUrl(req.url), { triggerReason: body.triggerReason });
});
