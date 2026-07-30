import { withRoute } from "@/lib/apiHelpers";
import { recordCovenantMeasurement } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordCovenantMeasurement(session, idFromUrl(req.url), {
    measuredValue: body.measuredValue,
    measureDate: body.measureDate,
    measuredBy: body.measuredBy,
  });
});
