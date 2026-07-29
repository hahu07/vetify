import { withRoute } from "@/lib/apiHelpers";
import { submitForReview } from "@/lib/domain/onboarding";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  return submitForReview(session, idFromUrl(req.url));
});
