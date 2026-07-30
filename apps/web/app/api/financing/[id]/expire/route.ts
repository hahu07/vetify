import { withRoute } from "@/lib/apiHelpers";
import { expireRequest } from "@/lib/domain/financing";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return expireRequest(session, idFromUrl(req.url), { reason: body.reason });
});
