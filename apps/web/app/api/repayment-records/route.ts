import { withRoute } from "@/lib/apiHelpers";
import { listRepaymentRecords } from "@/lib/domain/murabahah";
import { serializeRepaymentRecord } from "@/lib/serialize";

export const GET = withRoute(async (session, req) => {
  const contractIdParam = new URL(req.url).searchParams.get("murabahahContractId");
  const rows = await listRepaymentRecords(session, contractIdParam ? Number(contractIdParam) : undefined);
  return rows.map(serializeRepaymentRecord);
});
