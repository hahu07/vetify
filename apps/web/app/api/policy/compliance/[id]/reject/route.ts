import { withRoute } from "@/lib/apiHelpers";
import { rejectCompliancePolicyChange } from "@/lib/domain/policy";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return rejectCompliancePolicyChange(session, idFromUrl(req.url), {
    rejectedBy: body.rejectedBy,
    rejectionReason: body.rejectionReason,
  });
});
