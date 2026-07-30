import { withRoute } from "@/lib/apiHelpers";
import { updateRegistry } from "@/lib/domain/murabahah";

function idFromUrl(url: string): number {
  return Number(new URL(url).pathname.split("/").at(-2));
}

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return updateRegistry(session, idFromUrl(req.url), {
    newOrganizations: body.newOrganizations,
    newVersion: body.newVersion,
    updatedBoardRef: body.updatedBoardRef,
  });
});
