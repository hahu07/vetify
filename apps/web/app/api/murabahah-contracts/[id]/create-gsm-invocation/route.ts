import { withRoute } from "@/lib/apiHelpers";
import { createGsmInvocation } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createGsmInvocation(session, idFromUrl(req.url), {
    businessBvn: body.businessBvn,
    invokedAmount: body.invokedAmount,
    monoGsmRef: body.monoGsmRef,
  });
});
