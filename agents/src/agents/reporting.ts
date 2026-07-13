/**
 * Reporting Agent (Ongoing)
 *
 * Generates periodic PortfolioReport contracts on the Canton ledger.
 *
 * Off-ledger determinism: mirrors the trust-boundary fix already applied to
 * Stage 6/9 — the LLM previously counted and summed across every
 * MurabahahContract itself, then wrote PortfolioReport directly to the
 * ledger. aggregatePortfolio (agents/src/scoring/reporting.ts) now computes
 * every number in code; the LLM's only remaining job is writing the 2-3
 * paragraph narrative from those pre-computed numbers, with no ledger-write
 * tool access at all — code creates the PortfolioReport directly afterward.
 *
 * Unlike Stage 2/3/6/9, there's no new party or registry here: aggregation
 * isn't a judgment call with a "who is accountable for this decision"
 * question to close, so vetify remains the signatory.
 *
 * Triggered by the Supervisor on a separate reporting schedule (e.g. monthly)
 * rather than on every poll cycle.
 */
import "dotenv/config";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { MemorySaver } from "@langchain/langgraph";
import { type McpTool, invokeTool, buildModel, extractJsonObject, capText, withLlmResilience } from "./util.js";
import { aggregatePortfolio } from "../scoring/reporting.js";
import type { MurabahahContractSnapshot, PortfolioMetrics } from "../scoring/reporting.js";
import { partyId } from "../mcp/canton-client.js";

const T_CONTRACT = "Vetify.Murabahah:MurabahahContract";
const T_REPORT = "Vetify.Reporting:PortfolioReport";




/** Narrative-only: no MCP tools at all, so the LLM has no way to write to the
 * ledger even if it wanted to — it only ever sees the already-computed
 * numbers and produces prose from them. */
const NARRATIVE_SYSTEM_PROMPT = `
You are the Reporting Agent for Vetify, an AI-powered non-interest financing platform.

You are writing the narrative summary for a regulatory PortfolioReport. All portfolio metrics
have already been computed deterministically in code and are given to you below — you do NOT
recompute them, and you have no tool access to write anything to the ledger. Your only job is to
turn these numbers into a clear 2-3 paragraph summary.

Structure:
1. Portfolio overview — total contracts created, currently active, total disbursed, total
   outstanding, total repaid to date.
2. Portfolio health — delinquency rate as a percentage, number of delinquent vs on-schedule
   contracts, completion rate.
3. Risk notes (only if the numbers suggest something notable — e.g. a non-trivial delinquency
   rate, defaults present). Do not invent concentration risk or trend claims the numbers don't
   support — if there's nothing notable, a short closing sentence is fine.

Respond with ONLY the summary text — no JSON, no headers, no preamble.
`.trim();

export async function runReportingAgent(
  financialInstitution: string,
  /** PortfolioReport.regulator is `Optional Party` on-ledger — null maps to None. */
  regulator: string | null,
): Promise<void> {
  const cantonMcp = new MultiServerMCPClient({
    mcpServers: { canton: { command: "npm", args: ["run", "mcp:canton"] } },
  });
  const cantonTools = (await cantonMcp.getTools()) as unknown as McpTool[];

  const raw = await invokeTool(cantonTools, "get_active_contracts", { templateId: T_CONTRACT, party: "vetify" });
  const parsed = extractJsonObject(raw) as { result?: Array<{ payload: Record<string, unknown> }> };
  const contracts: MurabahahContractSnapshot[] = (parsed.result ?? []).map(({ payload }) => {
    const murabahahTerms = payload.murabahahTerms as Record<string, unknown>;
    return {
      status: payload.status as MurabahahContractSnapshot["status"],
      salePrice: Number(murabahahTerms.salePrice),
      outstandingBalance: Number(payload.outstandingBalance),
    };
  });

  const metrics: PortfolioMetrics = aggregatePortfolio(contracts);
  const summary = await writeNarrative(metrics);

  const today = new Date().toISOString().split("T")[0];
  await invokeTool(cantonTools, "create_contract", {
    templateId: T_REPORT,
    payload: {
      // No source contract to copy vetify's real Party ID from here (unlike
      // verifier.ts, which copies business/vetify/verifier off an existing
      // BusinessOnboarding) — create_contract passes the payload straight
      // through with no party-name resolution of its own, so this must
      // already be a real Party ID string, not the role name "vetify".
      vetify: partyId("vetify"),
      financialInstitution,
      regulator,
      reportDate: today,
      totalActiveContracts: metrics.totalActiveContracts,
      totalDisbursed: metrics.totalDisbursed,
      totalOutstanding: metrics.totalOutstanding,
      delinquentCount: metrics.delinquentCount,
      completedCount: metrics.completedCount,
      defaultedCount: metrics.defaultedCount,
      summary,
    },
  });

  await cantonMcp.close();
}

/** Hard cap on the LLM-authored summary persisted on-ledger (G3) —
 * PortfolioReport.summary is unbounded Text on the template side. */
const MAX_SUMMARY_CHARS = 4000;

async function writeNarrative(metrics: PortfolioMetrics): Promise<string> {
  const agent = createDeepAgent({
    model: buildModel(),
    tools: [],
    systemPrompt: NARRATIVE_SYSTEM_PROMPT,
    backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
    skills: ["skills/reporting"],
    checkpointer: new MemorySaver(),
  });

  const task = `
Write the PortfolioReport narrative summary from these pre-computed metrics:

- Total contracts currently active (Active/Delinquent/DelinquencyManualReview): ${metrics.totalActiveContracts}
- Total disbursed (sum of salePrice across every contract ever created): ₦${metrics.totalDisbursed.toLocaleString("en-NG")}
- Total outstanding (sum across active contracts): ₦${metrics.totalOutstanding.toLocaleString("en-NG")}
- Total repaid to date (disbursed − outstanding): ₦${metrics.totalRepaid.toLocaleString("en-NG")}
- Delinquent contracts (confirmed): ${metrics.delinquentCount}
- Completed contracts: ${metrics.completedCount}
- Defaulted contracts: ${metrics.defaultedCount}
- Delinquency rate: ${metrics.delinquencyRatePct.toFixed(1)}%
- Completion rate: ${metrics.completionRatePct.toFixed(1)}%
  `.trim();

  const result = await withLlmResilience("Report narrative", () => agent.invoke({ messages: [{ role: "user", content: task }] }));
  const lastMessage = result.messages[result.messages.length - 1];
  const text = typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content);
  return capText(text, MAX_SUMMARY_CHARS);
}
