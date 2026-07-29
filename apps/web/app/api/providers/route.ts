import { withRoute } from "@/lib/apiHelpers";
import { createProviderOnboarding, listProviderOnboardings } from "@/lib/domain/providers";
import { serializeProviderOnboarding } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listProviderOnboardings(session);
  return rows.map(serializeProviderOnboarding);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createProviderOnboarding(session, {
    providerName: body.providerName,
    address: body.address,
    cacRegNumber: body.cacRegNumber,
    providerType: body.providerType,
    regulatoryBody: body.regulatoryBody ?? null,
    licenseNumber: body.licenseNumber ?? null,
    governingDocRef: body.governingDocRef,
    declaredInstruments: body.declaredInstruments ?? [],
  });
});
