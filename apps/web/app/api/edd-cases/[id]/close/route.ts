import { withRoute } from "@/lib/apiHelpers";
import { closeEddCase } from "@/lib/domain/compliance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return closeEddCase(session, idFromUrl(req.url), { closedBy: body.closedBy });
});
