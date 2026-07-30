import { withRoute } from "@/lib/apiHelpers";
import { createMurabahahStatement, listMurabahahStatements } from "@/lib/domain/murabahah";
import { serializeMurabahahStatement } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listMurabahahStatements(session);
  return rows.map(serializeMurabahahStatement);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createMurabahahStatement(session, {
    cacRegNumber: body.cacRegNumber,
    businessName: body.businessName,
    statementDate: body.statementDate,
    statementPeriod: body.statementPeriod,
    totalFinanced: body.totalFinanced,
    totalRepaid: body.totalRepaid,
    outstandingBalance: body.outstandingBalance,
    installmentsPaid: body.installmentsPaid,
    totalInstallments: body.totalInstallments,
    contractStatus: body.contractStatus,
    shariahAuditRef: body.shariahAuditRef ?? null,
  });
});
