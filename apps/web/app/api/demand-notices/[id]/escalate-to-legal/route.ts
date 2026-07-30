import { withRoute } from "@/lib/apiHelpers";
import { escalateToLegal } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return escalateToLegal(session, idFromUrl(req.url), {
    escalationDate: body.escalationDate,
    solicitorRef: body.solicitorRef,
    legalAction: body.legalAction,
  });
});
