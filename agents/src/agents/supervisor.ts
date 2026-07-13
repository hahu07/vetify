/**
 * Supervisor Agent
 *
 * Polls the Canton ledger for contracts requiring agent action and
 * delegates to the appropriate sub-agent. Runs as a continuous loop.
 *
 * Lifecycle routing:
 *   BusinessOnboarding (UnderReview)                       → Verifier Agent (Stage 2)
 *   ComplianceReview   (Pending, shariahVerdict=None)      → Shariah Agent, then RecordShariahPreCheck
 *   ComplianceReview   (Pending, shariahVerdict=Some(...)) → Verifier Agent (Stage 3)
 *   FinancingRequest   (Submitted)                         → Underwriting Agent (Stage 6)
 *   MurabahahContract  (Active/Delinquent), daily          → Delinquency Monitor + Collections Agent (Stage 9)
 *   ApprovedBusiness   (Active, stale), daily              → RequestRecertification (G14 rescreen scheduler)
 *   Monthly (cursor = latest on-ledger PortfolioReport)    → Reporting Agent (Ongoing)
 *
 * Orchestration fixes from docs/platform-review-2026-07.md Phase 0 (G5a):
 * - Every dispatch is individually try/caught — one contract's failure no
 *   longer aborts every subsequent dispatch in the same tick.
 * - Stage 9 runs as a DAILY sweep, not per-10s-tick: delinquency evidence
 *   (bank transactions vs. installment schedule) changes on a daily cadence
 *   at most, and the per-tick version was one full LLM evidence pass per
 *   Active contract every 10 seconds — a pure cost/latency bug. The sweep
 *   marker is in-memory; a restart re-runs at most one extra sweep that day,
 *   which is harmless (every resulting decision is guarded by on-ledger
 *   status transitions and scoreDelinquency no-ops when nothing changed).
 * - The monthly report cursor is derived from the LEDGER (latest
 *   PortfolioReport.reportDate), not from in-memory state — the previous
 *   `lastReportTime = 0` module variable regenerated a report on every
 *   process restart, minting duplicate regulatory reports.
 */
import "dotenv/config";
import { runVerifierVerificationStage, runVerifierComplianceStage, runVerifierProviderStage } from "./verifier.js";
import { runShariahAgent } from "./shariah.js";
import { runUnderwritingAgent } from "./underwriting.js";
import { runDelinquencyMonitor, runCollectionsAgent } from "./monitoring.js";
import { runReportingAgent } from "./reporting.js";
import { queryActiveContracts, exerciseLedgerChoice, partyId } from "../mcp/canton-client.js";
import { validateAgentsConfig } from "../config.js";
import { logger } from "../logger.js";

// Fail fast with the full list of missing/placeholder env values (G7) —
// previously CANTON_FI_PARTY silently defaulted to the role name
// "financialInstitution" and flowed into PortfolioReport's party-typed field.
const config = validateAgentsConfig();

const T_COMPLIANCE_REVIEW = "Vetify.Compliance:ComplianceReview";
const T_PORTFOLIO_REPORT  = "Vetify.Reporting:PortfolioReport";
const T_APPROVED_BUSINESS = "Vetify.Compliance:ApprovedBusiness";
const POLL_INTERVAL_MS    = 10_000;

// G14 rescreen scheduler (Gaps 24/M-RS): no periodic AML/KYB rescreening of
// already-approved businesses existed — a business could clear Stage 3 once,
// years ago, and never be looked at again. Interval is deliberately generous
// (CBN NIFI periodic-review norms, not a specific published number this
// project can cite) — policy-configurable via env rather than hardcoded, same
// treatment as RISK_THRESHOLD_AUTO_APPROVE/_REJECT.
const RESCREEN_INTERVAL_DAYS = parseInt(process.env.RESCREEN_INTERVAL_DAYS ?? "180", 10);

/** YYYY-MM-DD of the last completed Stage 9 sweep (in-memory by design — see header). */
let lastMonitoringSweepDate = "";
/** YYYY-MM-DD of the last completed rescreen sweep (in-memory — see header; a
 * restart re-checks the same day at most once more, harmless since a business
 * already past due for recertification stays past due). */
let lastRescreenSweepDate = "";

async function queryContracts(templateId: string): Promise<Array<{ contractId: string; payload: unknown }>> {
  return queryActiveContracts(templateId, "vetify");
}

// RecordShariahPreCheck is dual-controller [advisor, vetify]: advisor
// (a genuinely independent party, like riskCommittee — not "vetify's own team")
// makes the real call; vetify co-signs so `create this` is authorized
// (ComplianceReview's own signatory is vetify alone). Gated by
// requireActiveAdvisor on the Daml side.
//
// No contract keys on SDK 3.4.11 / Daml-LF 2.1/2.2, so RecordShariahPreCheck can no
// longer resolve the AuthorizedAdvisor registry entry itself via lookupByKey — this
// resolves it off-ledger first and passes the ContractId in explicitly.
async function recordShariahPreCheck(contractId: string, verdict: unknown): Promise<void> {
  const advisors = await queryActiveContracts("Vetify.Governance:AuthorizedAdvisor", "vetify");
  const advisorParty = partyId("advisor");
  const advisorCid = advisors.find((a) => (a.payload as { advisor?: string }).advisor === advisorParty)?.contractId;
  if (!advisorCid) throw new Error("advisor is not a registered AuthorizedAdvisor");
  await exerciseLedgerChoice(T_COMPLIANCE_REVIEW, contractId, "RecordShariahPreCheck", { verdict, advisorCid }, ["advisor", "vetify"]);
}

/** Isolates one dispatch: a failure is logged with its contract ID and the
 * tick moves on to the next contract instead of aborting the whole cycle. */
async function dispatch(label: string, contractId: string, run: () => Promise<void>): Promise<void> {
  try {
    logger.info({ label, contractId }, `Dispatching ${label} for ${contractId}`);
    await run();
  } catch (err) {
    logger.error({ label, contractId, err: err instanceof Error ? err.message : err }, `${label} failed for ${contractId}`);
  }
}

/** G14: RequestRecertification archives the current ApprovedBusiness and opens
 * a fresh ComplianceReview, restarting the full Stage 3 AML/KYB/CDD cycle —
 * naturally idempotent per contract instance, since a recertified business no
 * longer appears in the ApprovedBusiness ACS as BusinessActive until the new
 * cycle completes and produces a new one (with a fresh approvedAt). */
async function requestRecertification(contractId: string, cacRegNumber: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await exerciseLedgerChoice(T_APPROVED_BUSINESS, contractId, "RequestRecertification", {
    verifier: config.verifierPartyId,
    advisor: config.advisorPartyId,
    newComplianceRef: `RESCREEN-${cacRegNumber}-${today}`,
    reason: `Periodic AML/KYB rescreening — ${RESCREEN_INTERVAL_DAYS}-day interval elapsed since last approval`,
  }, "vetify");
}

/** True when the ledger already holds a PortfolioReport dated in the current
 * calendar month (UTC). The ledger is the cursor — survives restarts. */
async function monthlyReportAlreadyExists(): Promise<boolean> {
  const reports = await queryContracts(T_PORTFOLIO_REPORT);
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  return reports.some((r) => {
    const reportDate = (r.payload as Record<string, unknown>).reportDate;
    return typeof reportDate === "string" && reportDate.startsWith(currentMonth);
  });
}

async function tick() {
  // Stage 0: route submitted provider registrations to the same Verifier Agent
  // module's provider-evidence function — the CAC check is genuinely the same
  // as Stage 2's, just against a different entity (see verifier.ts's doc
  // comment on runVerifierProviderStage for why this doesn't need its own
  // Canton party or a separate agent module).
  const providerContracts = await queryContracts("Vetify.FinancingProvider:FinancingProviderOnboarding");
  for (const contract of providerContracts) {
    const payload = contract.payload as Record<string, unknown>;
    if (payload["status"] === "UnderReview" && payload["agentScore"] == null) {
      await dispatch("Verifier Agent (provider stage)", contract.contractId, () =>
        runVerifierProviderStage(contract.contractId, payload));
    }
  }

  // Stage 2: route submitted onboarding applications to the Verifier Agent
  const onboardingContracts = await queryContracts("Vetify.Onboarding:BusinessOnboarding");
  for (const contract of onboardingContracts) {
    const payload = contract.payload as Record<string, unknown>;
    if (payload["status"] === "UnderReview") {
      await dispatch("Verifier Agent (verification stage)", contract.contractId, () =>
        runVerifierVerificationStage(contract.contractId, payload));
    }
  }

  // Stage 3: Shariah pre-check first (decoupled, standalone), then the Verifier
  // Agent's compliance stage once a verdict has been recorded on-ledger.
  const complianceContracts = await queryContracts(T_COMPLIANCE_REVIEW);
  for (const contract of complianceContracts) {
    const payload = contract.payload as Record<string, unknown>;
    if (payload["status"] !== "Pending") continue;

    if (payload["shariahVerdict"] == null) {
      await dispatch("Shariah Agent", contract.contractId, async () => {
        // ComplianceReview carries businessSector/businessActivity directly
        // (carried over from BusinessOnboarding.profile at creation time).
        const businessSector = (payload["businessSector"] as string) ?? "Unknown";
        const businessActivity = (payload["businessActivity"] as string) ?? "Unknown";
        // financingPurpose doesn't exist yet at Stage 3 (the financing request
        // is Stage 5) — the real purpose is screened later, in the Underwriting
        // Agent's Stage 6 pipeline (screenFinancingPurpose, review gap G4).
        // This placeholder only feeds the sector-level pre-check.
        const financingPurpose = "general business financing";
        const verdict = await runShariahAgent(businessSector, businessActivity, financingPurpose);
        logger.info({ contractId: contract.contractId, verdict: verdict.verdict }, `Shariah verdict for ${contract.contractId}: ${verdict.verdict}`);
        await recordShariahPreCheck(contract.contractId, verdict);
      });
    } else {
      await dispatch("Verifier Agent (compliance stage)", contract.contractId, () =>
        runVerifierComplianceStage(contract.contractId, payload));
    }
  }

  // Stage 6: route submitted financing requests to Underwriting Agent
  const financingContracts = await queryContracts("Vetify.Financing:FinancingRequest");
  for (const contract of financingContracts) {
    const payload = contract.payload as Record<string, unknown>;
    if (payload["status"] === "Submitted") {
      await dispatch("Underwriting Agent", contract.contractId, () =>
        runUnderwritingAgent(contract.contractId, payload));
    }
  }

  // Stage 9: DAILY sweep over active/delinquent Murabahah contracts (see header
  // for why not per-tick). DelinquencyManualReview is deliberately NOT swept —
  // once escalated to a human, only the ACP skills/monitoring-review path (a
  // real sentinel) resolves it, not the automated loop.
  const today = new Date().toISOString().split("T")[0];
  if (lastMonitoringSweepDate !== today) {
    const murabahahContracts = await queryContracts("Vetify.Murabahah:MurabahahContract");
    for (const contract of murabahahContracts) {
      const payload = contract.payload as Record<string, unknown>;
      if (payload["status"] === "Active" || payload["status"] === "Delinquent") {
        await dispatch("Delinquency Monitor", contract.contractId, () =>
          runDelinquencyMonitor(contract.contractId, payload));
        await dispatch("Collections Agent", contract.contractId, () =>
          runCollectionsAgent(contract.contractId, payload));
      }
    }
    lastMonitoringSweepDate = today;
  }

  // G14: DAILY rescreen sweep over Active ApprovedBusiness contracts whose
  // approvedAt is older than RESCREEN_INTERVAL_DAYS — closes the "screen once,
  // never again" gap (Gaps 24/M-RS). Pre-ApproveFunding sanctions refresh
  // (Gap F38) is deliberately NOT built as a hard Daml gate on ApproveFunding
  // itself — doing so would need threading fresh AML evidence through
  // FinancingRequest/UnderwritingResult all the way to a FI-controlled choice,
  // a much larger ripple for uncertain benefit given this sweep already keeps
  // ApprovedBusiness continuously fresh rather than gating one specific action.
  if (lastRescreenSweepDate !== today) {
    const approvedBusinesses = await queryContracts(T_APPROVED_BUSINESS);
    const rescreenCutoffMs = RESCREEN_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const contract of approvedBusinesses) {
      const payload = contract.payload as Record<string, unknown>;
      if (payload["status"] !== "BusinessActive") continue;
      const approvedAt = payload["approvedAt"];
      if (typeof approvedAt !== "string") continue;
      const ageMs = now - new Date(approvedAt).getTime();
      if (ageMs >= rescreenCutoffMs) {
        await dispatch("Rescreen scheduler (RequestRecertification)", contract.contractId, () =>
          requestRecertification(contract.contractId, payload["cacRegNumber"] as string));
      }
    }
    lastRescreenSweepDate = today;
  }

  // Ongoing: one PortfolioReport per calendar month, cursor derived from the
  // ledger itself (survives restarts; regulator sees no duplicates).
  if (!(await monthlyReportAlreadyExists())) {
    await dispatch("Reporting Agent", "(monthly portfolio report)", () =>
      runReportingAgent(config.fiPartyId, config.regulatorPartyId));
  }
}

async function run() {
  logger.info({ pollIntervalSeconds: POLL_INTERVAL_MS / 1000 }, `Supervisor started — polling Canton ledger every ${POLL_INTERVAL_MS / 1000}s`);
  while (true) {
    try {
      await tick();
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : err }, "Error in Supervisor tick");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

run();
