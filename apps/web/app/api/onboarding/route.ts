import { withRoute } from "@/lib/apiHelpers";
import { createOnboarding, listOnboardings } from "@/lib/domain/onboarding";
import { serializeOnboarding } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listOnboardings(session);
  return rows.map(serializeOnboarding);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createOnboarding(session, {
    profile: body.profile,
    kyc: body.kyc,
    documents: body.documents ?? [],
    onboardingRef: body.onboardingRef,
  });
});
