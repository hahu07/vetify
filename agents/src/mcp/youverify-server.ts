/**
 * Youverify MCP Server
 *
 * Nigerian-built compliance infrastructure covering:
 *   AML / PEP & Sanctions screening  — amlCleared check in ComplianceCheck
 *   Adverse Media Intelligence        — reputational risk screening
 *   KYB Business Verification         — cross-checks CAC data with richer detail
 *
 * Run with: npm run mcp:youverify
 * Requires: YOUVERIFY_API_KEY, YOUVERIFY_BASE_URL
 *
 * Docs: https://doc.youverify.co
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.YOUVERIFY_BASE_URL ?? "https://api.youverify.co";
const API_KEY = process.env.YOUVERIFY_API_KEY ?? "";

const HEADERS = { token: API_KEY, "Content-Type": "application/json" };

async function yvPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Youverify error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function yvGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Youverify error: ${res.status} ${await res.text()}`);
  return res.json();
}

const server = new McpServer({ name: "youverify", version: "0.1.0" });

// ── AML: PEP & Sanctions screening by identity ───────────────────────────────

server.registerTool(
  "aml_screen_individual",
  {
    description: "Screen an individual (business director) against international PEP and sanctions databases. Returns status: 'clear', 'review_required', or 'not_cleared'.",
    inputSchema: z.object({
      query: z.string().describe("NIN, BVN, phone number, or full name of the director"),
      type: z.enum(["individual", "all"]).default("individual"),
      isSubjectConsent: z.boolean().default(true),
    }),
  },
  async ({ query, type, isSubjectConsent }) => {
    const result = await yvPost("/v2/api/verifications/advanced/identity/aml-checks", {
      query,
      type,
      isSubjectConsent,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "aml_screen_business",
  {
    description: "Screen a business entity against international PEP, sanctions, and AML watchlists. Returns status and any matching records.",
    inputSchema: z.object({
      query: z.string().describe("Business name or CAC registration number"),
      type: z.enum(["business", "all"]).default("business"),
      isSubjectConsent: z.boolean().default(true),
    }),
  },
  async ({ query, type, isSubjectConsent }) => {
    const result = await yvPost("/v2/api/verifications/advanced/identity/aml-checks", {
      query,
      type,
      isSubjectConsent,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── AML: Retrieve a previous screening result ─────────────────────────────────

server.registerTool(
  "aml_get_result",
  {
    description: "Retrieve a previously submitted AML/PEP screening result by verification ID",
    inputSchema: z.object({
      verificationId: z.string(),
    }),
  },
  async ({ verificationId }) => {
    const result = await yvGet(`/v2/api/verifications/aml-checks/${verificationId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── KYB: Business verification (richer than mono.co CAC lookup) ──────────────

server.registerTool(
  "kyb_verify_business",
  {
    description: "Verify a Nigerian business registration with enhanced KYB checks including key personnel, ownership structure, and company status",
    inputSchema: z.object({
      registrationNumber: z.string().describe("CAC registration number with prefix, e.g. RC123456 or BN123456"),
      registrationName: z.string().optional().describe("Registered business name — helps refine search for older companies"),
      countryCode: z.string().default("NG").describe("ISO country code, default NG for Nigeria"),
      premium: z.boolean().default(false).describe("Enable premium checks for deeper ownership data"),
      isConsent: z.boolean().default(true),
    }),
  },
  async ({ registrationNumber, registrationName, countryCode, premium, isConsent }) => {
    const result = await yvPost("/v2/api/verifications/global/company-advance-check", {
      registrationNumber,
      ...(registrationName ? { registrationName } : {}),
      countryCode,
      premium,
      isConsent,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── Adverse Media Intelligence ────────────────────────────────────────────────

server.registerTool(
  "adverse_media_screen",
  {
    description: "Screen a business or individual for adverse media — negative news coverage related to fraud, financial crime, or regulatory violations",
    inputSchema: z.object({
      query: z.string().describe("Business name or individual's full name"),
      type: z.enum(["individual", "business", "all"]).default("all"),
      isSubjectConsent: z.boolean().default(true),
    }),
  },
  async ({ query, type, isSubjectConsent }) => {
    const result = await yvPost("/v2/api/verifications/advanced/adverse-media/aml-checks", {
      query,
      type,
      isSubjectConsent,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
