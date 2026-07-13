import "dotenv/config";
import { startServer } from "deepagents-acp";
import { FilesystemBackend } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";
import { MemorySaver } from "@langchain/langgraph";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const model = new ChatAnthropic({
  model: process.env.LLM_MODEL ?? "claude-sonnet-4-6",
  temperature: 0,
});

// deepagents-acp's DeepAgentConfig no longer accepts a raw `mcpServers` config
// per agent — tools must be resolved up front (same MultiServerMCPClient
// pattern used by the Supervisor-path agents) and passed as `tools`. These
// clients are kept open for the lifetime of the ACP server, unlike the
// Supervisor path which closes its client after each single invocation.
const verifierMcp = new MultiServerMCPClient({
  mcpServers: {
    canton:    { command: "npm", args: ["run", "mcp:canton"] },
    mono:      { command: "npm", args: ["run", "mcp:mono"] },
    youverify: { command: "npm", args: ["run", "mcp:youverify"] },
  },
});
const underwritingMcp = new MultiServerMCPClient({
  mcpServers: {
    canton: { command: "npm", args: ["run", "mcp:canton"] },
    mono:   { command: "npm", args: ["run", "mcp:mono"] },
  },
});
const monitoringMcp = new MultiServerMCPClient({
  mcpServers: {
    canton: { command: "npm", args: ["run", "mcp:canton"] },
    mono:   { command: "npm", args: ["run", "mcp:mono"] },
  },
});
const reportingMcp = new MultiServerMCPClient({
  mcpServers: {
    canton: { command: "npm", args: ["run", "mcp:canton"] },
  },
});
const shariahMcp = new MultiServerMCPClient({
  mcpServers: {
    canton:  { command: "npm", args: ["run", "mcp:canton"] },
    shariah: { command: "npm", args: ["run", "mcp:shariah"] },
  },
});

const [verifierTools, underwritingTools, monitoringTools, reportingTools, shariahTools] = await Promise.all([
  verifierMcp.getTools(),
  underwritingMcp.getTools(),
  monitoringMcp.getTools(),
  reportingMcp.getTools(),
  shariahMcp.getTools(),
]);

await startServer({
  agents: [
    {
      name: "vetify-verifier",
      description:
        "Assist a human verifier officer completing a BusinessOnboarding or ComplianceReview " +
        "contract already flagged for ManualReview — a human-supervised session, not " +
        "autonomous decisioning. Every case here already went through the deterministic " +
        "scoring engine (agents/src/scoring/) and could not be auto-resolved: a Medium-risk " +
        "score, a serious CAC name mismatch, a Shariah REQUIRES_REVIEW verdict, or (for " +
        "compliance) the CDD purpose/proportionality judgment the engine can never make on " +
        "its own. Gathers mono.co/Youverify evidence, reasons through what the fixed rubric " +
        "couldn't, and exercises Approve/Reject/ApproveCompliance/RejectCompliance only after " +
        "the officer confirms in conversation. (The unattended Supervisor loop uses a " +
        "separate, evidence-only skill with no exercise_choice/create_contract access at " +
        "all — see skills/verifier — precisely so autonomous decisions are never freelanced " +
        "by an LLM; this agent's broader tool access is safe specifically because a human is " +
        "present watching every tool call.)",
      model,
      tools: verifierTools,
      backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
      skills: ["skills/verifier-review"],
      checkpointer: new MemorySaver(),
    },
    {
      name: "vetify-underwriting",
      description:
        "Assist a human assessor completing a FinancingRequest contract already " +
        "flagged for UnderwritingManualReview — a human-supervised session, not " +
        "autonomous decisioning. Every case here already went through the five " +
        "deterministic scoring engines (agents/src/scoring/underwriting-*.ts) and scored " +
        "in the Medium risk band: not strong enough to auto-qualify, not weak enough for " +
        "the automatic hard veto. Reviews mono.co Connect/Creditworthiness evidence, " +
        "reasons through what the fixed rubric couldn't, and exercises " +
        "BeginUnderwriting/RejectUnderwriting only after the assessor confirms in " +
        "conversation. (The unattended Supervisor loop uses a separate, evidence-only " +
        "skill with no exercise_choice/create_contract access at all — see " +
        "skills/underwriting — precisely so autonomous decisions are never freelanced " +
        "by an LLM; this agent's broader tool access is safe specifically because a " +
        "human is present watching every tool call.)",
      model,
      tools: underwritingTools,
      backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
      skills: ["skills/underwriting-review"],
      checkpointer: new MemorySaver(),
    },
    {
      name: "vetify-monitoring",
      description:
        "Assist a human sentinel resolving a MurabahahContract already flagged for " +
        "DelinquencyManualReview — a human-supervised session, not autonomous decisioning. " +
        "Every case here already went through the deterministic scoring engine " +
        "(agents/src/scoring/monitoring.ts) and came back ambiguous: exactly one missed " +
        "installment, or two-or-more missed but a plausible unrecorded bank credit was found. " +
        "Reviews mono.co transaction data and RepaymentRecord history, reasons through what " +
        "the fixed rule couldn't, and exercises FlagDelinquent/ResumeActive only after the " +
        "sentinel confirms in conversation. (The unattended Supervisor loop uses a separate, " +
        "evidence-only skill with no exercise_choice access at all — see skills/monitoring — " +
        "precisely so autonomous decisions are never freelanced by an LLM; this agent's " +
        "broader tool access is safe specifically because a human is present watching every " +
        "tool call. Direct Debit retries and GSM escalation are a separate concern, handled " +
        "by runCollectionsAgent/skills/collections — out of scope for this agent.)",
      model,
      tools: monitoringTools,
      backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
      skills: ["skills/monitoring-review"],
      checkpointer: new MemorySaver(),
    },
    {
      name: "vetify-shariah",
      description:
        "Assist a human Shariah advisor reviewing a ComplianceReview's recorded Shariah " +
        "pre-check verdict, especially REQUIRES_REVIEW cases — a human-supervised session, " +
        "not autonomous decisioning. The standalone Shariah Agent (agents/src/agents/" +
        "shariah.ts) has no ledger-write access at all: classifyShariahCompliance() (a " +
        "maintained keyword table) is the verdict authority, and the RAG/LLM pipeline only " +
        "ever produces a narrative on a table miss, never a verdict. The Supervisor records " +
        "the result via RecordShariahPreCheck (dual-controller [advisor, vetify], gated " +
        "by the AuthorizedAdvisor registry). This agent reviews that recorded " +
        "verdict and exercises SupersedeShariahVerdict (controller vetify alone — the party " +
        "that made the original call cannot unilaterally correct its own past decision) only " +
        "after the advisor confirms in conversation.",
      model,
      tools: shariahTools,
      backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
      skills: ["skills/shariah-review"],
      checkpointer: new MemorySaver(),
    },
    {
      name: "vetify-reporting",
      description:
        "Generate a PortfolioReport contract on the Canton ledger for regulatory reporting. " +
        "Aggregates all MurabahahContract and RepaymentRecord data, calculates portfolio metrics " +
        "(active count, total disbursed, outstanding balance, delinquency rate, completion rate), " +
        "writes a regulatory-grade portfolio health summary, and creates a PortfolioReport " +
        "contract visible to the financial institution and CBN regulator.",
      model,
      tools: reportingTools,
      backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
      skills: ["skills/reporting"],
      checkpointer: new MemorySaver(),
    },
  ],
  workspaceRoot: process.cwd(),
});
