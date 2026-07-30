import { withRoute } from "@/lib/apiHelpers";
import { acceptAmendment } from "@/lib/domain/financing";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => acceptAmendment(session, idFromUrl(req.url)));
