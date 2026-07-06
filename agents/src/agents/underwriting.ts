/**
 * Underwriting Agent (Stage 6)
 *
 * Off-ledger determinism: mirrors the Verifier Agent's architecture
 * (agents/src/agents/verifier.ts) — the LLM here only gathers evidence from mono.co
 * Connect/Creditworthiness tool calls, reporting it as structured JSON. It never
 * decides any score, risk category, or recommended limit, and it has no tool access
 * to exercise_choice at all — agents/src/scoring/underwriting.ts's five independent
 * engines (Financial Behaviour, Cashflow Risk, Creditworthiness, Fraud Detection,
 * Final Decision) compute those deterministically from the reported evidence, and
 * this module calls the Canton MCP tools directly, in code, based on their output.
 *
 * The LLM's job is now pure relay/normalization, not aggregation: it maps mono.co's
 * raw get_account_statement/get_account_transactions fields into a normalized
 * transaction list (date/amount/direction/description/counterparty/balanceAfter) and
 * reports that list verbatim. All arithmetic — net cashflow, revenue variance,
 * recurring debt detection, fraud pattern matching — happens deterministically in
 * code from that list (agents/src/scoring/underwriting-transactions.ts and the five
 * engine files). This tightens the trust boundary from an earlier version of this
 * agent, which had the LLM itself aggregate "dozens of raw transaction records" into
 * pre-computed numbers — a categorically different (and harder-to-verify) task than
 * Stage 2/3's evidence-gathering, which only does categorical bucketing of a single
 * API field (e.g. AML status "clear"/"review_required"/"not_cleared").
 *
 * mono-server.ts's assess_creditworthiness result arrives via webhook, not
 * synchronously — pollCreditworthinessResult below polls the backend's
 * webhook receiver (backend/src/routes/webhooks.ts) for a bounded window
 * after triggering the check. If nothing arrives in time, dscr is left
 * undefined rather than fabricated, and scoreUnderwriting scores that factor
 * 0 with a DSCR_UNAVAILABLE flag, the same principled-gap-handling as the
 * incorporationDate case below.
 *
 * FinancingRequest carries incorporationDate (closed in an earlier pass) —
 * fetched from the contract payload below and passed straight to the scorer
 * as businessIncorporationDate.
 *
 * UnderwritingPolicy (Vetify.Financing) carries scoringWeights, mirroring
 * VerificationPolicy/CompliancePolicy — fetchActiveUnderwritingPolicy below
 * looks it up per (vetify, financialInstitution), since unlike Verification/
 * CompliancePolicy this is a per-institution policy, not a vetify-wide
 * singleton, and falls back to DEFAULT_UNDERWRITING_WEIGHTS if none is active
 * for this specific FI.
 */
import "dotenv/config";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { MemorySaver } from "@langchain/langgraph";
import { scoreUnderwriting } from "../scoring/underwriting.js";
import { DEFAULT_UNDERWRITING_POLICY_VERSION, DEFAULT_UNDERWRITING_WEIGHTS, numifyWeights } from "../scoring/types.js";
import type { CreditworthinessEvidence, NormalizedTransaction, TransactionEvidence, UnderwritingScoringWeights } from "../scoring/types.js";

const T_FINANCING = "Vetify.Financing:FinancingRequest";
const T_UNDERWRITING_POLICY = "Vetify.Financing:UnderwritingPolicy";
const WEBHOOK_POLL_TIMEOUT_MS = 30_000;
const WEBHOOK_POLL_INTERVAL_MS = 3_000;
/** Bounds the transaction list the LLM relays — a 6-month statement for an active
 * SME account could run into the thousands of rows; this keeps the prompt/response
 * size manageable while still giving every engine a representative sample. */
const MAX_TRANSACTIONS = 300;

function buildModel() {
  return new ChatAnthropic({
    model: process.env.LLM_MODEL ?? "claude-sonnet-4-6",
    temperature: 0,
  });
}

/** Extracts the JSON object from an agent's final message text. */
function extractJson(content: unknown): Record<string, unknown> {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Expected a JSON evidence object in the agent's response.\nResponse: ${text}`);
  return JSON.parse(match[0]) as Record<string, unknown>;
}

interface McpTool { name: string; invoke: (input: Record<string, unknown>) => Promise<unknown> }

async function invokeTool(tools: McpTool[], name: string, input: Record<string, unknown>): Promise<unknown> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`MCP tool "${name}" not found among available tools`);
  return tool.invoke(input);
}

/** UnderwritingPolicy is keyed per (vetify, financialInstitution) — unlike
 * VerificationPolicy/CompliancePolicy's vetify-wide singleton, this queries all
 * active policies (vetify is signatory of every one) and picks the one matching
 * this specific FI. Returns undefined if none is active for this institution —
 * callers fall back to DEFAULT_UNDERWRITING_WEIGHTS, same as the Daml choice
 * itself already does when lookupByKey finds nothing. */
async function fetchActiveUnderwritingPolicy(
  tools: McpTool[],
  financialInstitution: string,
): Promise<Record<string, unknown> | undefined> {
  const raw = await invokeTool(tools, "get_active_contracts", { templateId: T_UNDERWRITING_POLICY, party: "vetify" });
  const parsed = extractJson(raw) as { result?: Array<{ contractId: string; payload: Record<string, unknown> }> };
  return parsed.result?.find((c) => c.payload.financialInstitution === financialInstitution)?.payload;
}

/** assess_creditworthiness's result is delivered via webhook (mono-server.ts's own
 * tool description), not synchronously — this polls the backend's webhook receiver
 * for the persisted result, keyed by the reference the initiating call returned.
 * Returns undefined (not a fabricated DSCR) if nothing arrives within the timeout. */
async function pollCreditworthinessResult(reference: string): Promise<{ dscr: number; creditScore?: number } | undefined> {
  const base = process.env.BACKEND_URL ?? "http://localhost:3000";
  const deadline = Date.now() + WEBHOOK_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/api/webhooks/mono/creditworthiness/${encodeURIComponent(reference)}`);
    if (res.ok) {
      const data = await res.json() as { dscr: number; creditScore?: number };
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, WEBHOOK_POLL_INTERVAL_MS));
  }
  return undefined;
}

const EVIDENCE_PROMPT = `
You are the Underwriting Agent for Vetify, an AI-powered non-interest financing platform.

You are gathering Stage 6 transaction and creditworthiness evidence for a FinancingRequest. You
do NOT decide any risk score, risk category, or recommended limit, and you have no tool access to
exercise any Canton choice — five independent deterministic engines compute those from the
evidence you report.

Call, in this order:
1. get_account_statement — the borrower's account, last 6 months
2. get_account_transactions — enriched transaction data for the same account
3. assess_creditworthiness — mono.co's DSCR and bureau credit score. Its result is delivered via
   webhook, not synchronously — the call's own response only returns a "reference" you must
   report; you will NOT get the DSCR figure directly from this call. Report the reference exactly
   as given, and dscr/creditScore ONLY if the response happens to also include them synchronously.

Your only job with the statement and transactions is to RELAY them, normalized — do not aggregate,
average, or otherwise compute anything from them. For every transaction in the last 6 months (cap
at the ${MAX_TRANSACTIONS} most recent if there are more), map mono.co's fields onto:
{
  "date": <ISO 8601 date>,
  "amount": <number, always positive, NGN>,
  "direction": "credit" | "debit",
  "description": <string, optional>,
  "counterparty": <string, optional — the other party's name if the statement identifies one>,
  "balanceAfter": <number, optional — the account's running/closing balance after this
    transaction, ONLY if the statement actually reports one; do not estimate or compute it>
}

Respond with ONLY a JSON object, no other text:
{
  "transactions": [ ...as above... ],
  "creditworthinessReference": <string, the reference from assess_creditworthiness's response>,
  "dscr": <number, omit if not returned synchronously>,
  "creditScore": <number, omit if not returned synchronously>
}
`.trim();

export async function runUnderwritingAgent(contractId: string, contractPayload: unknown): Promise<void> {
  const payload = contractPayload as Record<string, unknown>;

  // Evidence-gathering agent: mono.co tools only. It cannot reach the Canton
  // MCP server at all, so it is architecturally incapable of exercising any
  // choice, not merely instructed not to.
  const evidenceMcp = new MultiServerMCPClient({
    mcpServers: { mono: { command: "npm", args: ["run", "mcp:mono"] } },
  });
  const evidenceTools = await evidenceMcp.getTools();
  const evidenceAgent = createDeepAgent({
    model: buildModel(),
    tools: evidenceTools,
    systemPrompt: EVIDENCE_PROMPT,
    backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
    skills: ["skills/underwriting"],
    checkpointer: new MemorySaver(),
  });

  const task = `
Gather Stage 6 underwriting evidence for the following FinancingRequest contract.

Contract ID: ${contractId}
Payload: ${JSON.stringify(contractPayload, null, 2)}
  `.trim();

  const result = await evidenceAgent.invoke({ messages: [{ role: "user", content: task }] });
  await evidenceMcp.close();
  const lastMessage = result.messages[result.messages.length - 1];
  const evidence = extractJson(lastMessage.content);

  // Deterministic decision execution from here — no LLM involved.
  const cantonMcp = new MultiServerMCPClient({
    mcpServers: { canton: { command: "npm", args: ["run", "mcp:canton"] } },
  });
  const cantonTools = (await cantonMcp.getTools()) as unknown as McpTool[];

  const financialInstitution = payload.financialInstitution as string | undefined;
  const policyPayload = financialInstitution
    ? await fetchActiveUnderwritingPolicy(cantonTools, financialInstitution)
    : undefined;
  // Daml Int fields arrive as JSON strings from the ledger — numifyWeights converts them to
  // real numbers before scoreUnderwriting sums them (see its doc comment in scoring/types.ts).
  const weights = policyPayload?.scoringWeights
    ? numifyWeights<UnderwritingScoringWeights>(policyPayload.scoringWeights as Record<string, unknown>)
    : DEFAULT_UNDERWRITING_WEIGHTS;
  const policyVersion = (policyPayload?.policyVersion as string | undefined) ?? DEFAULT_UNDERWRITING_POLICY_VERSION;

  // dscr/creditScore only come back synchronously if evidenceAgent's assess_creditworthiness
  // call happened to get them directly (unlikely per its own "delivered via webhook" tool
  // description) — otherwise poll the webhook receiver using the reference it reported.
  let dscr = evidence.dscr != null ? Number(evidence.dscr) : undefined;
  let creditScore = evidence.creditScore != null ? Number(evidence.creditScore) : undefined;
  if (dscr === undefined && typeof evidence.creditworthinessReference === "string") {
    const webhookResult = await pollCreditworthinessResult(evidence.creditworthinessReference);
    dscr = webhookResult?.dscr;
    creditScore = creditScore ?? webhookResult?.creditScore;
  }

  const rawTransactions = Array.isArray(evidence.transactions) ? evidence.transactions as Record<string, unknown>[] : [];
  const transactions: NormalizedTransaction[] = rawTransactions.slice(0, MAX_TRANSACTIONS).map((tx) => ({
    date: String(tx.date),
    amount: Number(tx.amount),
    direction: tx.direction === "credit" ? "credit" : "debit",
    description: typeof tx.description === "string" ? tx.description : undefined,
    counterparty: typeof tx.counterparty === "string" ? tx.counterparty : undefined,
    balanceAfter: tx.balanceAfter != null ? Number(tx.balanceAfter) : undefined,
  }));
  const transactionEvidence: TransactionEvidence = { transactions };
  const creditworthiness: CreditworthinessEvidence = { dscr, creditScore };
  const terms = payload.terms as Record<string, unknown> | undefined;
  const incorporationDate = payload.incorporationDate as string | undefined;

  const scoring = scoreUnderwriting(
    transactionEvidence,
    creditworthiness,
    {
      requestedAmount: Number(terms?.amount ?? 0),
      tenureMonths: terms?.tenureMonths != null ? Number(terms.tenureMonths) : undefined,
      businessIncorporationDate: incorporationDate,
    },
    weights,
    policyVersion,
  );

  await invokeTool(cantonTools, "exercise_choice", {
    templateId: T_FINANCING,
    contractId,
    choice: "BeginUnderwriting",
    party: "vetify",
    argument: {
      assessment: scoring.assessment,
      autoDecided: true,
      aiMetadata: null,
      agentVersion: scoring.scoringPolicyVersion,
      underwriterName: null,
      underwritingRef: null,
      decisionDocuments: [],
    },
  });

  await cantonMcp.close();
}
