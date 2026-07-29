import { withRoute } from "@/lib/apiHelpers";
import { writeOffContract } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return writeOffContract(session, idFromUrl(req.url), {
    writeOffDate: body.writeOffDate,
    writeOffRef: body.writeOffRef,
    totalRecovered: body.totalRecovered,
    writeOffApprovedBy: body.writeOffApprovedBy,
    proposedByOfficerId: body.proposedByOfficerId,
    confirmedByOfficerId: body.confirmedByOfficerId,
  });
});
