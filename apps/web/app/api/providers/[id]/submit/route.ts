import { withRoute } from "@/lib/apiHelpers";
import { submitProviderForReview } from "@/lib/domain/providers";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  return submitProviderForReview(session, idFromUrl(req.url));
});
