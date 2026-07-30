import { withRoute } from "@/lib/apiHelpers";
import { proceedWithWakala } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  return proceedWithWakala(session, idFromUrl(req.url));
});
