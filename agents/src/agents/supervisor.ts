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
 *   MurabahahContract  (Active)                            → Monitoring Agent (Stage 9)
 *   Monthly schedule                                       → Reporting Agent (Ongoing)
 */
import "dotenv/config";
import { runVerifierVerificationStage, runVerifierComplianceStage } from "./verifier.js";
import { runShariahAgent } from "./shariah.js";
import { runUnderwritingAgent } from "./underwriting.js";
import { runMonitoringAgent } from "./monitoring.js";
import { runReportingAgent } from "./reporting.js";
import { queryActiveContracts, exerciseLedgerChoice } from "../mcp/canton-client.js";

const FI_PARTY            = process.env.CANTON_FI_PARTY       ?? "financialInstitution";
const REGULATOR_PARTY     = process.env.CANTON_REGULATOR_PARTY ?? "regulator";
const T_COMPLIANCE_REVIEW = "Vetify.Compliance:ComplianceReview";
const POLL_INTERVAL_MS    = 10_000;
const REPORT_INTERVAL_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days

let lastReportTime = 0;

async function queryContracts(templateId: string): Promise<Array<{ contractId: string; payload: unknown }>> {
  return queryActiveContracts(templateId, "vetify");
}

// RecordShariahPreCheck is controller vetify, and ComplianceReview's signatory is already
// vetify, so this is a plain vetify-authorized exercise — no other party's JWT is needed.
async function recordShariahPreCheck(contractId: string, verdict: unknown): Promise<void> {
  await exerciseLedgerChoice(T_COMPLIANCE_REVIEW, contractId, "RecordShariahPreCheck", { verdict }, "vetify");
}

async function tick() {
  // Stage 2: route submitted onboarding applications to the Verifier Agent
  const onboardingContracts = await queryContracts("Vetify.Onboarding:BusinessOnboarding");
  for (const contract of onboardingContracts) {
    const payload = contract.payload as Record<string, unknown>;
    if (payload["status"] === "UnderReview") {
      console.log(`[Supervisor] Dispatching Verifier Agent (verification stage) for ${contract.contractId}`);
      await runVerifierVerificationStage(contract.contractId, payload);
    }
  }

  // Stage 3: Shariah pre-check first (decoupled, standalone), then the Verifier
  // Agent's compliance stage once a verdict has been recorded on-ledger.
  const complianceContracts = await queryContracts(T_COMPLIANCE_REVIEW);
  for (const contract of complianceContracts) {
    const payload = contract.payload as Record<string, unknown>;
    if (payload["status"] !== "Pending") continue;

    if (payload["shariahVerdict"] == null) {
      console.log(`[Supervisor] Dispatching Shariah Agent for ${contract.contractId}`);
      // ComplianceReview now carries businessSector/businessActivity directly
      // (carried over from BusinessOnboarding.business at creation time — see
      // verifier.ts's post-Approve ComplianceReview creation), closing what
      // was previously a data-completeness gap requiring a businessName proxy.
      const businessSector = (payload["businessSector"] as string) ?? "Unknown";
      const businessActivity = (payload["businessActivity"] as string) ?? "Unknown";
      // financingPurpose isn't available on ComplianceReview or FinancingRequest at this
      // point in the lifecycle (Stage 3 runs before Stage 5's financing request exists) —
      // still a genuine gap, unrelated to the sector/activity fix above.
      const financingPurpose = "general business financing";
      const verdict = await runShariahAgent(businessSector, businessActivity, financingPurpose);
      console.log(`[Supervisor] Shariah verdict for ${contract.contractId}: ${verdict.verdict}`);
      await recordShariahPreCheck(contract.contractId, verdict);
    } else {
      console.log(`[Supervisor] Dispatching Verifier Agent (compliance stage) for ${contract.contractId}`);
      await runVerifierComplianceStage(contract.contractId, payload);
    }
  }

  // Stage 6: route submitted financing requests to Underwriting Agent
  const financingContracts = await queryContracts("Vetify.Financing:FinancingRequest");
  for (const contract of financingContracts) {
    const payload = contract.payload as Record<string, unknown>;
    if (payload["status"] === "Submitted") {
      console.log(`[Supervisor] Dispatching Underwriting Agent for ${contract.contractId}`);
      await runUnderwritingAgent(contract.contractId, payload);
    }
  }

  // Stage 9: monitor active Murabahah contracts for delinquency
  const murabahahContracts = await queryContracts("Vetify.Murabahah:MurabahahContract");
  for (const contract of murabahahContracts) {
    const payload = contract.payload as Record<string, unknown>;
    if (payload["status"] === "Active" || payload["status"] === "Delinquent") {
      console.log(`[Supervisor] Dispatching Monitoring Agent for ${contract.contractId}`);
      await runMonitoringAgent(contract.contractId, payload);
    }
  }

  // Ongoing: generate PortfolioReport once per month
  const now = Date.now();
  if (now - lastReportTime >= REPORT_INTERVAL_MS) {
    console.log("[Supervisor] Dispatching Reporting Agent (monthly portfolio report)");
    await runReportingAgent(FI_PARTY, REGULATOR_PARTY);
    lastReportTime = now;
  }
}

async function run() {
  console.log("[Supervisor] Started — polling Canton ledger every", POLL_INTERVAL_MS / 1000, "s");
  while (true) {
    try {
      await tick();
    } catch (err) {
      console.error("[Supervisor] Error in tick:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

run();
