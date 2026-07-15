/**
 * Stage 9 (Repayment Monitoring) — split into two independent agent functions.
 *
 * Off-ledger determinism, delinquency only: mirrors the Verifier/Underwriting
 * Agents' architecture — the LLM in runDelinquencyMonitor only relays recent
 * transactions as structured JSON (mono.co only, no canton MCP server at all,
 * so it is architecturally incapable of exercising any choice). scoreDelinquency
 * (agents/src/scoring/monitoring.ts) computes the decision deterministically;
 * this module calls the Canton MCP tools directly, in code, based on its output.
 *
 * Why two functions instead of one: giving the delinquency decision the same
 * "LLM can't freelance this" guarantee requires zero exercise_choice access for
 * that concern — but Direct Debit collection retries and GSM escalation are
 * sequential API-orchestration workflows, not a scored judgment call (a
 * deliberate scope decision, not an oversight), and still need full ledger
 * write access. Splitting into runDelinquencyMonitor (evidence-only, code
 * dispatches) and runCollectionsAgent (today's LLM-driven design, unchanged)
 * is what keeps the guarantee real instead of "the LLM could still call
 * FlagDelinquent, we're just trusting it not to."
 *
 * sentinel (vetify's own portfolio-monitoring team) makes the real delinquency
 * call — FlagDelinquent/ResumeActive are dual-controller [sentinel, vetify],
 * gated by AuthorizedSentinel (fails closed if unregistered/deactivated).
 * FlagForDelinquencyReview (vetify alone) is pure escalation for the case the
 * engine can't confidently resolve — see scoring/monitoring.ts's doc comment
 * for what counts as ambiguous here.
 */
import "dotenv/config";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { MemorySaver } from "@langchain/langgraph";
import { type McpTool, invokeTool, buildModel, parseEvidence, extractJsonObject, fenceUntrusted, UNTRUSTED_DATA_GUIDANCE, withLlmResilience, checkpointConfig } from "./util.js";
import { MonitoringEvidenceSchema } from "./evidence-schemas.js";
import { scoreDelinquency } from "../scoring/monitoring.js";
import { partyId } from "../mcp/canton-client.js";
import type { MonitoringContractSnapshot, NormalizedTransaction } from "../scoring/types.js";

const T_CONTRACT = "Vetify.Murabahah:MurabahahContract";
const MAX_TRANSACTIONS = 100;

/** Resolves the AuthorizedSentinel ContractId for `(vetify, sentinel)` — no contract keys
 * on SDK 3.4.11 / Daml-LF 2.1/2.2, so FlagDelinquent/ResumeActive can no longer resolve it
 * themselves via lookupByKey. */
async function fetchAuthorizedSentinelCid(tools: McpTool[]): Promise<string | null> {
  const raw = await invokeTool(tools, "get_active_contracts", { templateId: "Vetify.Governance:AuthorizedSentinel", party: "vetify" });
  const parsed = extractJsonObject(raw) as { result?: Array<{ contractId: string; payload: Record<string, unknown> }> };
  return parsed.result?.find((r) => r.payload.sentinel === partyId("sentinel"))?.contractId ?? null;
}





const DELINQUENCY_EVIDENCE_PROMPT = `
You are the Monitoring Agent for Vetify, an AI-powered non-interest financing platform.

You are gathering Stage 9 transaction evidence for a MurabahahContract. You do NOT decide
whether the business is delinquent, and you have no tool access to exercise any Canton choice —
a deterministic scoring engine computes that decision from the evidence you report.

Call get_account_transactions for the business's linked account, covering the last 14 days.

Your only job is to RELAY the transactions, normalized — do not aggregate, compute a delinquency
verdict, or decide anything. For each transaction, map mono.co's fields onto:
{
  "date": <ISO 8601 date>,
  "amount": <number, always positive, NGN>,
  "direction": "credit" | "debit",
  "description": <string, optional>,
  "counterparty": <string, optional>
}

Respond with ONLY a JSON object, no other text:
{
  "transactions": [ ...as above... ]
}
`.trim() + "\n\n" + UNTRUSTED_DATA_GUIDANCE;

/** Evidence-only: mono.co transactions relay, then code computes the decision and
 * dispatches ResumeActive/FlagDelinquent/FlagForDelinquencyReview directly. No LLM
 * involvement in the decision itself. */
export async function runDelinquencyMonitor(contractId: string, contractPayload: unknown): Promise<void> {
  const payload = contractPayload as Record<string, unknown>;
  const status = payload.status as MonitoringContractSnapshot["status"];

  // Both MCP clients are tracked here and closed in the outer finally below —
  // each spawns real child processes (npm run mcp:* -> node), so .close() must
  // run even when the code in between throws, or the process tree leaks
  // (confirmed live in verifier.ts's identical pattern — see its comment).
  let evidenceMcp: MultiServerMCPClient | undefined;
  let cantonMcp: MultiServerMCPClient | undefined;
  try {
  evidenceMcp = new MultiServerMCPClient({
    mcpServers: { mono: { command: "npm", args: ["run", "mcp:mono"] } },
  });
  const evidenceTools = await evidenceMcp.getTools();
  const evidenceAgent = createDeepAgent({
    model: buildModel(),
    tools: evidenceTools,
    systemPrompt: DELINQUENCY_EVIDENCE_PROMPT,
    backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
    skills: ["skills/monitoring"],
    checkpointer: new MemorySaver(),
  });

  const task = `
Gather Stage 9 transaction evidence for the following MurabahahContract.

Contract ID: ${contractId}
${fenceUntrusted("canton-contract-payload", contractPayload)}
  `.trim();

  const result = await withLlmResilience("Delinquency evidence", () => evidenceAgent.invoke({ messages: [{ role: "user", content: task }] }, checkpointConfig()));
  await evidenceMcp.close();
  evidenceMcp = undefined;
  const lastMessage = result.messages[result.messages.length - 1];
  // Schema-validated (G3/G13): malformed evidence throws here — fails closed,
  // no decision reaches the ledger on unvalidated shapes.
  const evidence = parseEvidence(lastMessage.content, MonitoringEvidenceSchema, "Delinquency Monitor");

  const transactions: NormalizedTransaction[] = evidence.transactions.slice(0, MAX_TRANSACTIONS).map((tx) => ({
    date: tx.date,
    amount: tx.amount,
    direction: tx.direction,
    description: tx.description ?? undefined,
    counterparty: tx.counterparty ?? undefined,
  }));

  const murabahahTerms = payload.murabahahTerms as Record<string, unknown>;
  const snapshot: MonitoringContractSnapshot = {
    status,
    startDate: String(payload.startDate),
    tenureMonths: Number(murabahahTerms.tenureMonths),
    installmentAmount: Number(murabahahTerms.installmentAmount),
    installmentsPaid: Number(payload.installmentsPaid ?? 0),
  };

  const { decision } = scoreDelinquency(snapshot, transactions);
  if (decision.action === "NoOp") return;

  cantonMcp = new MultiServerMCPClient({
    mcpServers: { canton: { command: "npm", args: ["run", "mcp:canton"] } },
  });
  const cantonTools = (await cantonMcp.getTools()) as unknown as McpTool[];

  switch (decision.action) {
    case "ResumeActive": {
      const sentinelCid = await fetchAuthorizedSentinelCid(cantonTools);
      if (!sentinelCid) throw new Error("sentinel is not a registered AuthorizedSentinel");
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_CONTRACT, contractId, choice: "ResumeActive",
        party: ["sentinel", "vetify"], argument: { note: decision.note, sentinelCid },
      });
      break;
    }
    case "FlagDelinquent": {
      const sentinelCid = await fetchAuthorizedSentinelCid(cantonTools);
      if (!sentinelCid) throw new Error("sentinel is not a registered AuthorizedSentinel");
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_CONTRACT, contractId, choice: "FlagDelinquent",
        party: ["sentinel", "vetify"], argument: { reason: decision.reason, sentinelCid },
      });
      break;
    }
    case "FlagForDelinquencyReview":
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_CONTRACT, contractId, choice: "FlagForDelinquencyReview",
        party: "vetify", argument: { note: decision.note },
      });
      break;
  }
  } finally {
    if (evidenceMcp) await (evidenceMcp as MultiServerMCPClient).close().catch(() => {});
    if (cantonMcp) await (cantonMcp as MultiServerMCPClient).close().catch(() => {});
  }
}

// ─── Collections: Direct Debit retries + GSM escalation ─────────────────────
// Unchanged from the pre-split design — sequential API orchestration, not a
// scored judgment call, so it keeps full LLM-driven canton+mono tool access
// (out of scope for the deterministic-engine/real-party treatment above).

const COLLECTIONS_SYSTEM_PROMPT = `
You are the Collections Agent for Vetify, an AI-powered non-interest financing platform.

Your job is to manage Direct Debit collection retries and coordinate GSM (Global Standing
Mandate) escalation for defaulted contracts.

Tools available:
- Canton ledger tools (exercise_choice, get_active_contracts, create_contract)
- mono.co tools (get_collection_status, initiate_collection, create_direct_debit_mandate,
  cancel_mandate, initiate_gsm, get_gsm_status)

─── ACTING PARTY (critical — wrong party = authorization failure) ───────────

Each financial institution on this platform now has its own Canton party
(self-serve signup allocates one per FI — no longer always the single fixed
"financialInstitution" role). The MurabahahContract payload given to you
below carries the correct party for THIS SPECIFIC contract in its
financialInstitution field — always read that literal value from the
payload and use it as the acting party. Do not hardcode the string
"financialInstitution" — it only works for the platform's original demo
institution and silently misattributes (or fails ledger authorization
entirely) for every other one.

- DirectDebitCollectionAttempt and GSMInvocation are SIGNED BY the financial
  institution: create them with create_contract's party set to this
  contract's own financialInstitution value.
- DirectDebitMandate choices (SuspendMandate, ReinstateMandate, CancelMandate),
  GSMInvocation choices (RecordGSMSweep, CancelGSM), and RecordPayment on
  MurabahahContract are FI-controlled: exercise them as that same party.
- MonitoringAlert is vetify-signed: create it as party "vetify" (the default).

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

3. If the business cancels a mandate without FI consent (status changes to MandateCancelled
   on-ledger without a SuspendMandate or CancelMandate from the FI), raise a
   MonitoringAlert with alertType = MandateCancellation and notify the FI immediately.

─── GSM ESCALATION ───────────────────────────────────────────────────────────

When a MurabahahContract is Defaulted AND a DemandNotice shows gsmEligible = True
AND the responseDeadline has passed without full recovery:

1. Verify the DirectDebitMandate gsmConsentGiven = True for this business.
2. Call initiate_gsm with the business's BVN, outstanding balance, and facilityRef.
3. Create a GSMInvocation contract on the Canton ledger with the returned monoGsmRef.
4. Poll get_gsm_status periodically. When a sweep is confirmed:
   - Call exercise_choice RecordGSMSweep on the GSMInvocation contract with the
     sweep amount and nibssSweepRef.
   - RecordGSMSweep internally calls RecordRecoveryPayment on MurabahahContract,
     updating the outstanding balance.
5. If get_gsm_status reports all sweeps exhausted and balance remains > 0:
   - Create a MonitoringAlert with alertType = GSMExhausted to escalate to Rahn enforcement.
`.trim() + "\n\n" + UNTRUSTED_DATA_GUIDANCE;

export async function runCollectionsAgent(contractId: string, contractPayload: unknown) {
  const mcpClient = new MultiServerMCPClient({
    mcpServers: {
      canton: { command: "npm", args: ["run", "mcp:canton"] },
      mono:   { command: "npm", args: ["run", "mcp:mono"] },
    },
  });

  // try/finally guarantees .close() runs even if the agent invocation throws —
  // otherwise the MCP server's child process tree leaks (see runDelinquencyMonitor).
  try {
    const tools = await mcpClient.getTools();
    const model = buildModel();

    const agent = createDeepAgent({
      model,
      tools,
      systemPrompt: COLLECTIONS_SYSTEM_PROMPT,
      backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
      skills: ["skills/collections"],
      checkpointer: new MemorySaver(),
    });

    const today = new Date().toISOString().split("T")[0];

    const task = `
Manage Direct Debit collections and GSM escalation for the following MurabahahContract.
Today's date is ${today}.

Contract ID: ${contractId}
${fenceUntrusted("canton-contract-payload", contractPayload)}
    `.trim();

    await withLlmResilience("Collections run", () => agent.invoke({ messages: [{ role: "user", content: task }] }, checkpointConfig()));
  } finally {
    await mcpClient.close();
  }
}
