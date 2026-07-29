import { withRoute } from "@/lib/apiHelpers";
import { amendProvider } from "@/lib/domain/providers";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return amendProvider(session, idFromUrl(req.url), {
    updatedProviderName: body.updatedProviderName,
    updatedAddress: body.updatedAddress,
    updatedCacRegNumber: body.updatedCacRegNumber,
    updatedLicenseNumber: body.updatedLicenseNumber ?? null,
    updatedGoverningDocRef: body.updatedGoverningDocRef,
    updatedDeclaredInstruments: body.updatedDeclaredInstruments ?? [],
  });
});
