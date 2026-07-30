import { withRoute } from "@/lib/apiHelpers";
import { createForceMajeureDeclaration, listForceMajeureDeclarations } from "@/lib/domain/murabahah";
import { serializeForceMajeureDeclaration } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listForceMajeureDeclarations(session);
  return rows.map(serializeForceMajeureDeclaration);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createForceMajeureDeclaration(session, {
    declarationRef: body.declarationRef,
    eventDescription: body.eventDescription,
    affectedRegion: body.affectedRegion,
    suspensionStart: body.suspensionStart,
    suspensionEnd: body.suspensionEnd,
    regulatoryBasis: body.regulatoryBasis,
  });
});
