import { withRoute } from "@/lib/apiHelpers";
import { revokeCertification } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return revokeCertification(session, idFromUrl(req.url), {
    revocationRef: body.revocationRef,
    reason: body.reason,
    revokedBy: body.revokedBy,
  });
});
