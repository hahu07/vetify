import { withRoute } from "@/lib/apiHelpers";
import { submitCollateralValuation } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return submitCollateralValuation(session, idFromUrl(req.url), {
    valuatorRef: body.valuatorRef,
    valuationAmount: body.valuationAmount,
    valuationDate: body.valuationDate,
    notes: body.notes ?? null,
    docType: body.docType,
    contentHash: body.contentHash,
    storageRef: body.storageRef,
    fileSize: body.fileSize ?? null,
  });
});
