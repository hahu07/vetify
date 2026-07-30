import { withRoute } from "@/lib/apiHelpers";
import { revalue } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return revalue(session, idFromUrl(req.url), {
    newValue: body.newValue,
    valuationDate: body.valuationDate,
    valuatorRef: body.valuatorRef,
    notes: body.notes ?? null,
  });
});
