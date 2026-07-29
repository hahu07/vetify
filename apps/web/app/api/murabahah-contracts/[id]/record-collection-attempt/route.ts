import { withRoute } from "@/lib/apiHelpers";
import { recordCollectionAttempt } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return recordCollectionAttempt(session, idFromUrl(req.url), {
    monoCollectionRef: body.monoCollectionRef,
    installmentNo: body.installmentNo,
    attemptedAmount: body.attemptedAmount,
    attemptDate: body.attemptDate,
    succeeded: body.succeeded,
    failureReason: body.failureReason ?? null,
    retryCount: body.retryCount ?? 0,
  });
});
