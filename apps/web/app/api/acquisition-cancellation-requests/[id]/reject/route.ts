import { withRoute } from "@/lib/apiHelpers";
import { rejectCancellation } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => rejectCancellation(session, idFromUrl(req.url)));
