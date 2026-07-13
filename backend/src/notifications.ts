/**
 * In-app notification poller — watches PQS for new UnderwritingResult (Stage 6
 * qualified) and UnderwritingRejection (Stage 6 rejected) contracts and creates
 * notification rows for the affected business (and, on qualification, the
 * financial institution the request now sits with).
 *
 * A poller rather than a hook on the choice-exercise routes: the autonomous
 * Underwriting Agent (agents/ package) calls Canton's MCP tools directly against
 * the ledger, bypassing this backend's REST routes entirely (see
 * agents/src/agents/underwriting.ts's dispatch switch) — a route-level hook would
 * only ever fire for the dev-tools simulator or a human's ACP/portal action.
 * Watching the ledger itself via PQS, which mirrors every write regardless of
 * who made it, is the only point that sees all three paths uniformly.
 *
 * Re-scans the full active() set on every tick rather than tracking a
 * cursor/offset — appdb.ts's createNotificationIfNew relies on the
 * (source_contract_id, user_id) unique constraint for idempotency instead, so
 * there's no cursor state to lose on a restart.
 */
import { listUnderwritingResults, listUnderwritingRejections } from "./repository.js";
import { findUserByCacRegNumber, findFinancerRecipients, createNotificationIfNew } from "./appdb.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 15_000;

interface UnderwritingResultPayload {
  business: string;
  businessName: string;
  cacRegNumber: string;
  financialInstitution: string;
  financingRef: string;
  assessment: { score: string | number; riskCategory: string; recommendedLimit: string | number };
}

interface UnderwritingRejectionPayload {
  businessName: string;
  cacRegNumber: string;
  financingRef: string;
  reason: string;
}

async function pollUnderwritingResults(): Promise<void> {
  const results = await listUnderwritingResults();
  for (const { contractId, payload } of results) {
    const p = payload as unknown as UnderwritingResultPayload;

    const businessUser = await findUserByCacRegNumber(p.cacRegNumber);
    if (businessUser) {
      await createNotificationIfNew({
        userId: businessUser.id,
        title: "Financing request qualified",
        body: `${p.financingRef} passed underwriting (score ${p.assessment.score}/100, ${p.assessment.riskCategory} risk) and is now with the financial institution for final review.`,
        link: "/business/financing",
        category: "underwriting_qualified",
        sourceContractId: contractId,
      });
    }

    const financerUsers = await findFinancerRecipients(p.financialInstitution);
    for (const financer of financerUsers) {
      await createNotificationIfNew({
        userId: financer.id,
        title: "New financing request ready for review",
        body: `${p.businessName} (${p.financingRef}) qualified underwriting and is awaiting your decision.`,
        link: "/fi/underwriting",
        category: "underwriting_ready_for_fi",
        sourceContractId: contractId,
      });
    }
  }
}

async function pollUnderwritingRejections(): Promise<void> {
  const rejections = await listUnderwritingRejections();
  for (const { contractId, payload } of rejections) {
    const p = payload as unknown as UnderwritingRejectionPayload;
    const businessUser = await findUserByCacRegNumber(p.cacRegNumber);
    if (!businessUser) continue;
    await createNotificationIfNew({
      userId: businessUser.id,
      title: "Financing request not approved",
      body: `${p.financingRef} was not approved at underwriting: ${p.reason}`,
      link: "/business/financing",
      category: "underwriting_rejected",
      sourceContractId: contractId,
    });
  }
}

async function pollOnce(): Promise<void> {
  try {
    await Promise.all([pollUnderwritingResults(), pollUnderwritingRejections()]);
  } catch (e) {
    logger.error({ err: e }, "Notification poll failed");
  }
}

let timer: NodeJS.Timeout | undefined;

export function startNotificationPoller(): void {
  if (timer) return;
  void pollOnce();
  timer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
}

export function stopNotificationPoller(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
