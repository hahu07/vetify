/**
 * Monitoring Agent (Stage 9)
 *
 * Watches active MurabahahContract contracts for delinquency signals.
 * Compares payment schedule against RepaymentRecord history to detect
 * missed or late installments. Exercises FlagDelinquent when overdue.
 *
 * Unlike other agents this runs on a schedule (called by the Supervisor
 * every poll cycle). It is designed to be idempotent — re-running on an
 * already-flagged contract produces no additional action.
 */
import "dotenv/config";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { MemorySaver } from "@langchain/langgraph";

const CONTRACT_TEMPLATE   = "Vetify.Murabahah:MurabahahContract";
const REPAYMENT_TEMPLATE  = "Vetify.Murabahah:RepaymentRecord";

const SYSTEM_PROMPT = `
You are the Monitoring Agent for Vetify, an AI-powered non-interest financing platform.

Your job is to monitor active Murabahah financing contracts and detect delinquency,
manage Direct Debit collection retries, and coordinate GSM (Global Standing Mandate)
escalation for defaulted contracts.

Tools available:
- Canton ledger tools (exercise_choice, get_active_contracts, create_contract)
- mono.co tools (get_account_transactions, get_collection_status, initiate_collection,
  create_direct_debit_mandate, cancel_mandate, initiate_gsm, get_gsm_status)

─── DELINQUENCY DETECTION ────────────────────────────────────────────────────

Steps:

1. Read the MurabahahContract payload:
   - startDate, murabahahTerms.tenureMonths, murabahahTerms.installmentAmount
   - installmentsPaid (how many installments have been recorded)
   - outstandingBalance

2. Query RepaymentRecords for this borrower (cacRegNumber) from the Canton ledger
   to see the payment history.

3. Calculate expected installments paid:
   - monthsElapsed = months since startDate until today
   - expectedInstallments = min(monthsElapsed, tenureMonths)
   - Compare against installmentsPaid from the contract

4. Determine delinquency:
   - If installmentsPaid < expectedInstallments − 1: DELINQUENT (missed at least one full cycle)
   - If installmentsPaid == expectedInstallments − 1: WATCH (one payment behind — monitor only)
   - If installmentsPaid >= expectedInstallments: CURRENT (no action needed)

5. Optionally verify with mono.co:
   - Call get_account_transactions to check for any recent credits that may represent
     a payment not yet recorded on the ledger.

6. If DELINQUENT and contract status is Active:
   Exercise FlagDelinquent on the MurabahahContract:
   {
     "choice": "FlagDelinquent",
     "argument": {
       "reason": "Borrower has missed N installment(s). Expected M payments by <date>, only K recorded."
     },
     "party": "vetify"
   }

7. If CURRENT or already Delinquent: take no action on delinquency.

Always log your reasoning: months elapsed, expected vs actual installments, and your decision.

─── DIRECT DEBIT COLLECTION MANAGEMENT ──────────────────────────────────────

When a MurabahahContract has an active DirectDebitMandate (status = MandateActive):

1. On each installment due date, call initiate_collection with the mandate ID,
   installment amount, and a unique facilityRef+installmentNo reference.

2. After initiating, call get_collection_status to check the result:
   - SUCCESS: call exercise_choice RecordPayment on MurabahahContract with
     directDebitRef = the monoCollectionRef. This records the payment on-ledger.
   - FAILED: create a DirectDebitCollectionAttempt contract (succeeded = false,
     failureReason = mono.co failure code). If retryCount < 3, retry the next
     business day. After 3 failures, alert the FI via a MonitoringAlert contract
     (alertType = MandateCancellation) and suspend the mandate via SuspendMandate.

3. If the borrower cancels a mandate without FI consent (status changes to MandateCancelled
   on-ledger without a SuspendMandate or CancelMandate from the FI), raise a
   MonitoringAlert with alertType = MandateCancellation and notify the FI immediately.

─── GSM ESCALATION ───────────────────────────────────────────────────────────

When a MurabahahContract is Defaulted AND a DemandNotice shows gsmEligible = True
AND the responseDeadline has passed without full recovery:

1. Verify the DirectDebitMandate gsmConsentGiven = True for this borrower.
2. Call initiate_gsm with the borrower's BVN, outstanding balance, and facilityRef.
3. Create a GSMInvocation contract on the Canton ledger with the returned monoGsmRef.
4. Poll get_gsm_status periodically. When a sweep is confirmed:
   - Call exercise_choice RecordGSMSweep on the GSMInvocation contract with the
     sweep amount and nibssSweepRef.
   - RecordGSMSweep internally calls RecordRecoveryPayment on MurabahahContract,
     updating the outstanding balance.
5. If get_gsm_status reports all sweeps exhausted and balance remains > 0:
   - Create a MonitoringAlert with alertType = GSMExhausted to escalate to Rahn enforcement.
`.trim();

export async function runMonitoringAgent(contractId: string, contractPayload: unknown) {
  const payload = contractPayload as Record<string, unknown>;

  // Skip if already flagged — the Supervisor may pass Delinquent contracts too
  if (payload["status"] === "Delinquent") {
    console.log(`[Monitoring] Contract ${contractId} already Delinquent — skipping`);
    return;
  }

  const mcpClient = new MultiServerMCPClient({
    mcpServers: {
      canton: { command: "npm", args: ["run", "mcp:canton"] },
      mono:   { command: "npm", args: ["run", "mcp:mono"] },
    },
  });

  const tools = await mcpClient.getTools();

  const model = new ChatAnthropic({
    model: process.env.LLM_MODEL ?? "claude-sonnet-4-6",
    temperature: 0,
  });

  const agent = createDeepAgent({
    model,
    tools,
    systemPrompt: SYSTEM_PROMPT,
    backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
    skills: ["skills/monitoring"],
    checkpointer: new MemorySaver(),
  });

  const today = new Date().toISOString().split("T")[0];

  const task = `
Monitor the following MurabahahContract for delinquency. Today's date is ${today}.

Contract ID: ${contractId}
Payload: ${JSON.stringify(contractPayload, null, 2)}

Steps:
1. Calculate months elapsed since startDate and how many installments should have been paid
2. Compare against installmentsPaid in the payload
3. Query Canton for RepaymentRecord contracts for cacRegNumber "${(payload as Record<string, unknown>)["cacRegNumber"]}" to verify payment history
4. Optionally check mono.co get_account_transactions for any recent unrecorded payments
5. If behind by more than one installment and status is Active, exercise FlagDelinquent on contract ${contractId} as party "vetify"
6. Otherwise, log that the contract is current or already handled
  `.trim();

  await agent.invoke({ messages: [{ role: "user", content: task }] });
  await mcpClient.close();
}
