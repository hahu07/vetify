import { withRoute } from "@/lib/apiHelpers";
import { closeDefaultedContract } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => closeDefaultedContract(session, idFromUrl(req.url)));
