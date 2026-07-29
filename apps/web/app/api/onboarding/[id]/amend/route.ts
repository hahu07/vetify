import { withRoute } from "@/lib/apiHelpers";
import { amend } from "@/lib/domain/onboarding";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return amend(session, idFromUrl(req.url), {
    updatedProfile: body.updatedProfile,
    updatedKyc: body.updatedKyc,
    updatedDocuments: body.updatedDocuments ?? [],
    policyMaxAmendments: body.policyMaxAmendments ?? null,
  });
});
