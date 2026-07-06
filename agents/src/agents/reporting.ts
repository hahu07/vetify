/**
 * Reporting Agent (Ongoing)
 *
 * Generates periodic PortfolioReport contracts on the Canton ledger.
 * Aggregates data across all MurabahahContract and RepaymentRecord contracts
 * visible to the vetify party, then creates a PortfolioReport readable by
 * the financial institution and regulator.
 *
 * Triggered by the Supervisor on a separate reporting schedule (e.g. monthly)
 * rather than on every poll cycle.
 */
import "dotenv/config";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { MemorySaver } from "@langchain/langgraph";

const SYSTEM_PROMPT = `
You are the Reporting Agent for Vetify, an AI-powered non-interest financing platform.

Your job is to produce a regulatory-grade PortfolioReport contract on the Canton ledger.
This report is visible to the financial institution and the regulator.

Tools available:
- Canton ledger tools (get_active_contracts, create_contract)

Steps to follow in order:

1. Query all MurabahahContract contracts from the ledger.
   Count and categorise by status: Active, Delinquent, Completed, Defaulted.

2. Query all RepaymentRecord contracts to get payment history data.

3. Calculate portfolio metrics:
   - totalActiveContracts: count of Active + Delinquent contracts
   - totalDisbursed: sum of murabahahTerms.salePrice across all contracts (ever created)
   - totalOutstanding: sum of outstandingBalance across Active + Delinquent contracts
   - delinquentCount: count of contracts with status = Delinquent
   - completedCount: count of contracts with status = Completed

4. Write a 2–3 paragraph summary covering:
   - Overall portfolio health (active count, disbursed vs outstanding)
   - Delinquency rate (delinquentCount / totalActiveContracts × 100)
   - Repayment performance (total repaid = totalDisbursed − totalOutstanding)
   - Any notable trends or risk concentrations

5. Create the PortfolioReport contract:
   {
     "templateId": "Vetify.Reporting:PortfolioReport",
     "payload": {
       "vetify": "<vetify party ID>",
       "financialInstitution": "<FI party ID>",
       "regulator": "<regulator party ID>",
       "reportDate": "<today's date YYYY-MM-DD>",
       "totalActiveContracts": <Int>,
       "totalDisbursed": <Decimal>,
       "totalOutstanding": <Decimal>,
       "delinquentCount": <Int>,
       "completedCount": <Int>,
       "defaultedCount": <Int>,
       "summary": "<portfolio summary>"
     }
   }

   Note: categorise contracts by status — Active, Delinquent, Completed, Defaulted.
   defaultedCount is the number of written-off (Defaulted) contracts.

Be precise with all numbers. Always state the delinquency rate as a percentage in the summary.
`.trim();

export async function runReportingAgent(
  financialInstitution: string,
  regulator: string,
) {
  const mcpClient = new MultiServerMCPClient({
    mcpServers: {
      canton: { command: "npm", args: ["run", "mcp:canton"] },
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
    skills: ["skills/reporting"],
    checkpointer: new MemorySaver(),
  });

  const today = new Date().toISOString().split("T")[0];

  const task = `
Generate a PortfolioReport for ${today}.

Financial Institution party: ${financialInstitution}
Regulator party: ${regulator}

Steps:
1. Query all Vetify.Murabahah:MurabahahContract contracts and categorise by status
2. Query all Vetify.Murabahah:RepaymentRecord contracts for payment history
3. Calculate the required portfolio metrics
4. Write a portfolio health summary (2–3 paragraphs)
5. Create the Vetify.Reporting:PortfolioReport contract on the Canton ledger as party "vetify"
  `.trim();

  await agent.invoke({ messages: [{ role: "user", content: task }] });
  await mcpClient.close();
}
