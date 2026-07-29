import { withRoute } from "@/lib/apiHelpers";
import { approveProvider } from "@/lib/domain/providers";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return approveProvider(session, idFromUrl(req.url), {
    approvedInstruments: body.approvedInstruments ?? [],
    regulator: body.regulator ?? null,
  });
});
