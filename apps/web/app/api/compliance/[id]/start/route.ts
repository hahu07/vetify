import { withRoute } from "@/lib/apiHelpers";
import { startReview } from "@/lib/domain/compliance";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => startReview(session, idFromUrl(req.url)));
