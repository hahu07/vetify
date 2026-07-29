import { withRoute } from "@/lib/apiHelpers";
import { cancelGsm } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return cancelGsm(session, idFromUrl(req.url), { reason: body.reason });
});
