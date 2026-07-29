import { withRoute } from "@/lib/apiHelpers";
import { rejectVerificationPolicyChange } from "@/lib/domain/policy";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return rejectVerificationPolicyChange(session, idFromUrl(req.url), {
    rejectedBy: body.rejectedBy,
    rejectionReason: body.rejectionReason,
  });
});
