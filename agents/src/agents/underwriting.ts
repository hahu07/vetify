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
 *
 * `assessor` is a real Canton party (vetify's own underwriting team, not a
 * third party — same framing as verifier), with its own screening authority
 * mirroring verifier's Stage 2/3 gatekeeping: the final switch below dispatches
 * on scoring.decision.action exactly like verifier.ts does — BeginUnderwriting
 * (Low risk, auto-qualify), FlagUnderwritingForManualReview (Medium, escalates
 * to a human assessor via the ACP skills/underwriting-review skill), or
 * RejectUnderwriting (High risk, a hard veto — the business never reaches the
 * FI at all). BeginUnderwriting/RejectUnderwriting are dual-controller
 * (assessor, vetify), so exercise_choice is called with both parties in
 * `party` — see canton-client.ts's exerciseLedgerChoice for why a single party
 * isn't enough for a dual-controller choice.
 */
import "dotenv/config";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { MemorySaver } from "@langchain/langgraph";
import { type McpTool, invokeTool, buildModel, extractJsonObject, parseEvidence, fenceUntrusted, UNTRUSTED_DATA_GUIDANCE, withLlmResilience, withPolicyCache } from "./util.js";
import { UnderwritingEvidenceSchema } from "./evidence-schemas.js";
import { scoreUnderwriting } from "../scoring/underwriting.js";
import { classifyFinancingPurpose } from "../scoring/shariah-policy.js";
import { partyId } from "../mcp/canton-client.js";
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





/** UnderwritingPolicy is keyed per (vetify, financialInstitution) — unlike
 * VerificationPolicy/CompliancePolicy's vetify-wide singleton, this queries all
 * active policies (vetify is signatory of every one) and picks the one matching
 * this specific FI. Returns undefined if none is active for this institution —
 * callers fall back to DEFAULT_UNDERWRITING_WEIGHTS, same as the Daml choice
 * itself already does when lookupByKey finds nothing. */
// Returns the ContractId alongside the payload (not just the payload) because SDK 3.4.11 /
// Daml-LF 2.1/2.2 has no contract keys — BeginUnderwriting/FlagUnderwritingForManualReview
// can no longer resolve the active UnderwritingPolicy via lookupByKey and now take its
// ContractId as an explicit argument.
async function fetchActiveUnderwritingPolicy(
  tools: McpTool[],
  financialInstitution: string,
): Promise<{ contractId: string; payload: Record<string, unknown> } | undefined> {
  return withPolicyCache(`${T_UNDERWRITING_POLICY}:${financialInstitution}`, async () => {
    const raw = await invokeTool(tools, "get_active_contracts", { templateId: T_UNDERWRITING_POLICY, party: "vetify" });
    const parsed = extractJsonObject(raw) as { result?: Array<{ contractId: string; payload: Record<string, unknown> }> };
    return parsed.result?.find((c) => c.payload.financialInstitution === financialInstitution);
  });
}

/** Resolves the AuthorizedAssessor ContractId for `(vetify, assessor)` — no contract keys
 * on SDK 3.4.11 / Daml-LF 2.1/2.2, so BeginUnderwriting/RejectUnderwriting can no longer
 * resolve it themselves via lookupByKey. */
async function fetchAuthorizedAssessorCid(tools: McpTool[]): Promise<string | null> {
  const raw = await invokeTool(tools, "get_active_contracts", { templateId: "Vetify.Governance:AuthorizedAssessor", party: "vetify" });
  const parsed = extractJsonObject(raw) as { result?: Array<{ contractId: string; payload: Record<string, unknown> }> };
  return parsed.result?.find((r) => r.payload.assessor === partyId("assessor"))?.contractId ?? null;
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
1. get_account_statement — the business's account, last 6 months
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
`.trim() + "\n\n" + UNTRUSTED_DATA_GUIDANCE;

export async function runUnderwritingAgent(contractId: string, contractPayload: unknown): Promise<void> {
  const payload = contractPayload as Record<string, unknown>;
  const terms = payload.terms as Record<string, unknown> | undefined;

  // Shariah purpose re-screen (review gap G4): Stage 3's pre-check ran before
  // this FinancingRequest existed, so the prohibited-STRUCTURE table
  // (refinancing, working capital, cash advance) was never exercised against
  // the business's real stated purpose — only against a placeholder. Screen it
  // here, deterministically, BEFORE spending an LLM evidence pass: a
  // prohibited purpose is a hard veto (RejectUnderwriting, mirroring
  // RejectCompliance's screening authority), same AAOIFI hard-gate precedent
  // as Stage 3's NON_COMPLIANT sector handling.
  const purpose = String(terms?.purpose ?? "");
  const purposeHit = classifyFinancingPurpose(purpose);
  if (purposeHit) {
    const rejectMcp = new MultiServerMCPClient({
      mcpServers: { canton: { command: "npm", args: ["run", "mcp:canton"] } },
    });
    const rejectTools = (await rejectMcp.getTools()) as unknown as McpTool[];
    const assessorCid = await fetchAuthorizedAssessorCid(rejectTools);
    if (!assessorCid) throw new Error("assessor is not a registered AuthorizedAssessor");
    await invokeTool(rejectTools, "exercise_choice", {
      templateId: T_FINANCING,
      contractId,
      choice: "RejectUnderwriting",
      party: ["assessor", "vetify"],
      argument: {
        reason: `Shariah screen: financing purpose "${purpose}" is not permissible — ${purposeHit.citation}`,
        autoDecided: true,
        reviewerParty: null,
        reviewedBy: null,
        // No RiskAssessment exists yet — this hard veto fires before the
        // scoring engines ever run (see the comment above).
        assessment: null,
        assessorCid,
      },
    });
    await rejectMcp.close();
    return;
  }

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
${fenceUntrusted("canton-contract-payload", contractPayload)}
  `.trim();

  const result = await withLlmResilience("Underwriting evidence", () => evidenceAgent.invoke({ messages: [{ role: "user", content: task }] }));
  await evidenceMcp.close();
  const lastMessage = result.messages[result.messages.length - 1];
  // Schema-validated (G3/G13): malformed evidence throws here — fails closed,
  // no decision reaches the ledger on unvalidated shapes.
  const evidence = parseEvidence(lastMessage.content, UnderwritingEvidenceSchema, "Underwriting Agent");

  // Deterministic decision execution from here — no LLM involved.
  const cantonMcp = new MultiServerMCPClient({
    mcpServers: { canton: { command: "npm", args: ["run", "mcp:canton"] } },
  });
  const cantonTools = (await cantonMcp.getTools()) as unknown as McpTool[];

  const financialInstitution = payload.financialInstitution as string | undefined;
  const activePolicy = financialInstitution
    ? await fetchActiveUnderwritingPolicy(cantonTools, financialInstitution)
    : undefined;
  // Daml Int fields arrive as JSON strings from the ledger — numifyWeights converts them to
  // real numbers before scoreUnderwriting sums them (see its doc comment in scoring/types.ts).
  const weights = activePolicy?.payload.scoringWeights
    ? numifyWeights<UnderwritingScoringWeights>(activePolicy.payload.scoringWeights as Record<string, unknown>)
    : DEFAULT_UNDERWRITING_WEIGHTS;
  const policyVersion = (activePolicy?.payload.policyVersion as string | undefined) ?? DEFAULT_UNDERWRITING_POLICY_VERSION;
  const policyCid = activePolicy?.contractId ?? null;

  // dscr/creditScore only come back synchronously if evidenceAgent's assess_creditworthiness
  // call happened to get them directly (unlikely per its own "delivered via webhook" tool
  // description) — otherwise poll the webhook receiver using the reference it reported.
  let dscr = evidence.dscr ?? undefined;
  let creditScore = evidence.creditScore ?? undefined;
  if (dscr === undefined && evidence.creditworthinessReference) {
    const webhookResult = await pollCreditworthinessResult(evidence.creditworthinessReference);
    dscr = webhookResult?.dscr;
    creditScore = creditScore ?? webhookResult?.creditScore;
  }

  // Already schema-validated (date/amount/direction shapes) — normalize
  // nullish optionals to undefined for the scoring engine's types.
  const transactions: NormalizedTransaction[] = evidence.transactions.slice(0, MAX_TRANSACTIONS).map((tx) => ({
    date: tx.date,
    amount: tx.amount,
    direction: tx.direction,
    description: tx.description ?? undefined,
    counterparty: tx.counterparty ?? undefined,
    balanceAfter: tx.balanceAfter ?? undefined,
  }));
  const transactionEvidence: TransactionEvidence = { transactions };
  const creditworthiness: CreditworthinessEvidence = { dscr, creditScore };
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

  // Mirrors verifier.ts's switch on scoring.decision.action exactly — pure
  // mechanical dispatch off the deterministic engine's decision, no LLM/branching
  // logic here. BeginUnderwriting/RejectUnderwriting are dual-controller
  // (assessor, vetify) since both need vetify's UnderwritingPolicy lookupByKey
  // authority; FlagUnderwritingForManualReview is vetify alone (pure escalation,
  // no assessor decision made yet).
  switch (scoring.decision.action) {
    case "BeginUnderwriting": {
      const assessorCid = await fetchAuthorizedAssessorCid(cantonTools);
      if (!assessorCid) throw new Error("assessor is not a registered AuthorizedAssessor");
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_FINANCING,
        contractId,
        choice: "BeginUnderwriting",
        party: ["assessor", "vetify"],
        argument: {
          assessment: scoring.assessment,
          autoDecided: true,
          aiMetadata: null,
          agentVersion: scoring.scoringPolicyVersion,
          assessorName: null,
          underwritingRef: null,
          decisionDocuments: [],
          assessorCid,
          policyCid,
        },
      });
      break;
    }
    case "RejectUnderwriting": {
      const assessorCid = await fetchAuthorizedAssessorCid(cantonTools);
      if (!assessorCid) throw new Error("assessor is not a registered AuthorizedAssessor");
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_FINANCING,
        contractId,
        choice: "RejectUnderwriting",
        party: ["assessor", "vetify"],
        argument: {
          reason: scoring.decision.reason,
          autoDecided: true,
          reviewerParty: null,
          reviewedBy: null,
          // scoring.decision.action is only ever "RejectUnderwriting" for a
          // High-risk composite or a fraud hard override, so the assessment
          // is always riskCategory: "High" here — required by the Daml
          // choice's auto-decided guard.
          assessment: scoring.assessment,
          assessorCid,
        },
      });
      break;
    }
    case "FlagUnderwritingForManualReview":
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_FINANCING,
        contractId,
        choice: "FlagUnderwritingForManualReview",
        party: "vetify",
        argument: {
          riskScore: scoring.assessment.score,
          riskLevel: scoring.assessment.riskCategory,
          agentVersion: scoring.scoringPolicyVersion,
          note: scoring.decision.note,
          policyCid,
        },
      });
      break;
  }

  await cantonMcp.close();
}
