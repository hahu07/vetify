import { withRoute } from "@/lib/apiHelpers";
import { forfeitDeposit } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return forfeitDeposit(session, idFromUrl(req.url), { actualLoss: body.actualLoss, reason: body.reason });
});
