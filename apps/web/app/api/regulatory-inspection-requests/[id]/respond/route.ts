import { withRoute } from "@/lib/apiHelpers";
import { respondToInspection } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return respondToInspection(session, idFromUrl(req.url), {
    responseRef: body.responseRef,
    documents: body.documents ?? [],
    respondedByName: body.respondedByName,
    responseDate: body.responseDate,
  });
});
