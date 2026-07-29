import { withRoute } from "@/lib/apiHelpers";
import { acceptProposal } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return acceptProposal(session, idFromUrl(req.url), { certificationId: Number(body.certificationId) });
});
