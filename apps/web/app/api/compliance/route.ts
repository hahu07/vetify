import { withRoute } from "@/lib/apiHelpers";
import { listComplianceReviews, openComplianceReview } from "@/lib/domain/compliance";
import { serializeComplianceReview } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listComplianceReviews(session);
  return rows.map(serializeComplianceReview);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return openComplianceReview(session, body.verificationResultId);
});
