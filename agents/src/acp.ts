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

const [verifierTools, underwritingTools, monitoringTools, reportingTools] = await Promise.all([
  verifierMcp.getTools(),
  underwritingMcp.getTools(),
  monitoringMcp.getTools(),
  reportingMcp.getTools(),
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
        "Perform AI underwriting on a Vetify FinancingRequest contract. " +
        "Retrieves 6-month bank statements and enriched transactions via mono.co Connect, " +
        "assesses creditworthiness using mono.co DSCR scoring, analyses cash flow, " +
        "scores risk 0-100, calculates a recommended financing limit, and exercises " +
        "BeginUnderwriting on the Canton ledger to create an UnderwritingResult " +
        "visible to the financial institution.",
      model,
      tools: underwritingTools,
      backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
      skills: ["skills/underwriting"],
      checkpointer: new MemorySaver(),
    },
    {
      name: "vetify-monitoring",
      description:
        "Monitor a Vetify MurabahahContract for missed installment payments and delinquency. " +
        "Calculates expected vs actual installments paid, verifies with mono.co transaction " +
        "data if needed, and exercises FlagDelinquent on the Canton ledger when a borrower " +
        "has missed more than one payment cycle. Used by financial institution staff to " +
        "review delinquency flags before escalation.",
      model,
      tools: monitoringTools,
      backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
      skills: ["skills/monitoring"],
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
