import { withRoute } from "@/lib/apiHelpers";
import { recordGsmSweep } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordGsmSweep(session, idFromUrl(req.url), {
    sweepAmount: body.sweepAmount,
    sweepDate: body.sweepDate,
    nibssSweepRef: body.nibssSweepRef,
  });
});
