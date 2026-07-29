import { withRoute } from "@/lib/apiHelpers";
import { createHamishJiddiyyah } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createHamishJiddiyyah(session, idFromUrl(req.url), {
    depositAmount: body.depositAmount,
    depositRef: body.depositRef,
    depositDate: body.depositDate,
    returnDeadline: body.returnDeadline,
  });
});
