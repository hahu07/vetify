import { withRoute } from "@/lib/apiHelpers";
import { closeInspection } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return closeInspection(session, idFromUrl(req.url), {
    findings: body.findings ?? [],
    passed: body.passed,
    followUpNeeded: body.followUpNeeded,
    closingNote: body.closingNote,
  });
});
