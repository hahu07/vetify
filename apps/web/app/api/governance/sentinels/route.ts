import { withRoute } from "@/lib/apiHelpers";
import { registerSentinel, listRegistry } from "@/lib/domain/governance";

// Closes the gap noted in the Financing UI pass: registerSentinel already
// existed in lib/domain/governance.ts, but the codegen pass only ever wired
// routes for assessors/advisors, not officers/policyApprovers/sentinels.
// Needed now so the Stage 9-10 delinquency page can look up a registered
// AuthorizedSentinel id to pass to flagDelinquent/resumeActive.

export const GET = withRoute(async (session) => listRegistry(session, "sentinel"));

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return registerSentinel(session, { sentinel: body.sentinel, role: body.role, authorizedBy: body.authorizedBy });
});
