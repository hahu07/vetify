/**
 * Canton MCP Server
 * Exposes Canton ledger operations (via the JSON Ledger API v2 — see
 * canton-client.ts) as MCP tools.
 * Run with: npm run mcp:canton
 * Requires: CANTON_LEDGER_URL, CANTON_USER_ID, CANTON_VETIFY_JWT,
 * CANTON_VERIFIER_JWT, CANTON_VETIFY_PARTY_ID, CANTON_VERIFIER_PARTY_ID
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { queryActiveContracts, exerciseLedgerChoice, createLedgerContract } from "./canton-client.js";

const server = new McpServer({
  name: "canton-ledger",
  version: "0.1.0",
});

// Query active contracts of a given template
server.registerTool(
  "get_active_contracts",
  {
    description: "Fetch all active contracts of a Daml template visible to a party",
    inputSchema: z.object({
      templateId: z.string().describe("Fully qualified template ID, e.g. Vetify.Onboarding:BusinessOnboarding"),
      party: z.enum(["vetify", "verifier"]),
    }),
  },
  async ({ templateId, party }) => {
    const result = await queryActiveContracts(templateId, party);
    return { content: [{ type: "text" as const, text: JSON.stringify({ result }) }] };
  }
);

// Exercise a choice on a contract
server.registerTool(
  "exercise_choice",
  {
    description: "Exercise a Daml choice on a contract",
    inputSchema: z.object({
      templateId: z.string(),
      contractId: z.string(),
      choice: z.string().describe("Choice name, e.g. Approve, Reject, FlagForManualReview"),
      argument: z.record(z.unknown()).describe("Choice argument fields as JSON object"),
      party: z.enum(["vetify", "verifier"]),
    }),
  },
  async ({ templateId, contractId, choice, argument, party }) => {
    const result = await exerciseLedgerChoice(templateId, contractId, choice, argument, party);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// Create a new contract as the vetify party
server.registerTool(
  "create_contract",
  {
    description: "Create a new Daml contract as the vetify party",
    inputSchema: z.object({
      templateId: z.string(),
      payload: z.record(z.unknown()),
    }),
  },
  async ({ templateId, payload }) => {
    const result = await createLedgerContract(templateId, payload, "vetify");
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
