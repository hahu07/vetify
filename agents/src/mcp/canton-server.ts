/**
 * Canton MCP Server
 * Exposes Canton ledger operations (via the JSON Ledger API v2 — see
 * canton-client.ts) as MCP tools.
 * Run with: npm run mcp:canton
 * Requires: CANTON_LEDGER_URL, CANTON_USER_ID, CANTON_VETIFY_JWT,
 * CANTON_VERIFIER_JWT, CANTON_ASSESSOR_JWT, CANTON_VETIFY_PARTY_ID,
 * CANTON_VERIFIER_PARTY_ID, CANTON_ASSESSOR_PARTY_ID
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { queryActiveContracts, exerciseLedgerChoice, createLedgerContract } from "./canton-client.js";

const server = new McpServer({
  name: "canton-ledger",
  version: "0.1.0",
});

// Every static party ROLE name the agents legitimately act as. (sentinel/advisor
// were missing until the Phase 1 review pass — the Stage 9 dispatch's
// party: ["sentinel", "vetify"] would have failed THIS schema's validation
// before ever reaching the ledger; caught while fixing review gap G6.)
const PARTY_ROLE = z.enum(["vetify", "verifier", "assessor", "sentinel", "advisor", "financialInstitution"]);

// Self-serve signup gives each financial institution its own dynamically-
// allocated Canton party (backend/src/canton.ts's allocateParty) — a literal
// "Name::fingerprint" string, not one of the 9 fixed role names above. The
// Collections Agent (monitoring.ts) now derives the acting FI party from
// each specific contract's own financialInstitution field rather than the
// old fixed role literal, so this schema has to accept an arbitrary party-ID
// string alongside the well-known roles (canton-client.ts's jwt()/partyId()
// already pass a literal party ID straight through unchanged).
const PARTY = z.union([PARTY_ROLE, z.string()]);

// Query active contracts of a given template
server.registerTool(
  "get_active_contracts",
  {
    description: "Fetch all active contracts of a Daml template visible to a party",
    inputSchema: z.object({
      templateId: z.string().describe("Fully qualified template ID, e.g. Vetify.Onboarding:BusinessOnboarding"),
      party: PARTY,
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
      party: z.union([PARTY, z.array(PARTY)]).describe(
        "Single party, or an array of parties for a dual/multi-controller choice " +
        "(e.g. BeginUnderwriting/RejectUnderwriting needs [\"assessor\", \"vetify\"])"
      ),
    }),
  },
  async ({ templateId, contractId, choice, argument, party }) => {
    const result = await exerciseLedgerChoice(templateId, contractId, choice, argument, party);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// Create a new contract. Party defaults to vetify; financialInstitution is
// allowed because several Stage 9 collections templates
// (DirectDebitCollectionAttempt, GSMInvocation) are FI-signed — the previous
// hardcoded "vetify" made the Collections Agent's instructed writes fail
// authorization at the ledger (review gap G6).
server.registerTool(
  "create_contract",
  {
    description:
      "Create a new Daml contract. Acts as the vetify party unless the template's signatory " +
      "requires financialInstitution (e.g. DirectDebitCollectionAttempt, GSMInvocation).",
    inputSchema: z.object({
      templateId: z.string(),
      payload: z.record(z.unknown()),
      party: PARTY.default("vetify"),
    }),
  },
  async ({ templateId, payload, party }) => {
    const result = await createLedgerContract(templateId, payload, party);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
