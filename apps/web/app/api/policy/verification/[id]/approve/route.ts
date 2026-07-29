import { withRoute } from "@/lib/apiHelpers";
import { approveVerificationPolicyChange } from "@/lib/domain/policy";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return approveVerificationPolicyChange(session, idFromUrl(req.url), { approvedBy: body.approvedBy });
});
