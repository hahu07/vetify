import { withRoute } from "@/lib/apiHelpers";
import { rejectUnderwriting } from "@/lib/domain/financing";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return rejectUnderwriting(session, idFromUrl(req.url), {
    reason: body.reason,
    autoDecided: body.autoDecided ?? false,
    reviewerParty: body.reviewerParty ?? session.partyRole,
    reviewedBy: body.reviewedBy ?? session.displayName,
    assessment: body.assessment ?? null,
  });
});
