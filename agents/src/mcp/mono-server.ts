/**
 * mono.co MCP Server
 *
 * Single MCP server covering all mono.co products used across the Vetify lifecycle:
 *
 *   LOOKUP (v3)       — NIN, BVN, CAC, TIN, Mashup, Credit History
 *   PROVE             — Tiered KYC with facial recognition (Tier 1/2/3)
 *   FINANCIAL DATA    — Connect account statements, Data Enrichment
 *   CREDITWORTHINESS  — DSCR-based credit assessment (Underwriting Agent, Stage 6)
 *
 * Run with: npm run mcp:mono
 * Requires: MONO_API_KEY
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.MONO_API_KEY ?? "";
const V1 = "https://api.withmono.com/v1";
const V2 = "https://api.withmono.com/v2";
const V3 = "https://api.withmono.com/v3";

const HEADERS = { "mono-sec-key": API_KEY, "Content-Type": "application/json" };

const FETCH_TIMEOUT_MS = 30_000; // G9: a hung provider call must not hang the tool/agent

async function monoGet(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`mono.co error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function monoPost(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, { method: "POST", headers: HEADERS, body: JSON.stringify(body), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`mono.co error: ${res.status} ${await res.text()}`);
  return res.json();
}

const server = new McpServer({ name: "mono-co", version: "0.2.0" });

// ── LOOKUP ────────────────────────────────────────────────────────────────────

server.registerTool(
  "lookup_nin",
  {
    description: "Verify a Nigerian National Identification Number (NIN) and retrieve identity details",
    inputSchema: z.object({
      nin: z.string().length(11).describe("11-digit NIN"),
    }),
  },
  async ({ nin }) => {
    const result = await monoPost(`${V3}/lookup/nin`, { nin });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "lookup_bvn",
  {
    description: "Verify a Bank Verification Number (BVN) via consent-based iGree flow",
    inputSchema: z.object({
      bvn: z.string().length(11).describe("11-digit BVN"),
      scope: z.string().optional().describe("Verification scope, e.g. 'identity'"),
    }),
  },
  async ({ bvn, scope }) => {
    const result = await monoPost(`${V3}/lookup/bvn/igree`, { bvn, scope: scope ?? "identity" });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "lookup_mashup",
  {
    description: "Verify NIN and BVN in a single call — fastest combined identity check",
    inputSchema: z.object({
      nin: z.string().length(11),
      bvn: z.string().length(11),
    }),
  },
  async ({ nin, bvn }) => {
    const result = await monoPost(`${V3}/lookup/mashup`, { nin, bvn });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "lookup_cac",
  {
    description: "Search and verify a Nigerian business registration with the Corporate Affairs Commission (CAC)",
    inputSchema: z.object({
      search: z.string().describe("Business name or RC/BN registration number"),
    }),
  },
  async ({ search }) => {
    const result = await monoGet(`${V3}/lookup/cac?search=${encodeURIComponent(search)}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "lookup_tin",
  {
    description: "Verify a Tax Identification Number (TIN) or derive TIN from a CAC RC number",
    inputSchema: z.object({
      number: z.string().describe("TIN or CAC RC number"),
      channel: z.enum(["tin", "cac"]).describe("'tin' to verify by TIN, 'cac' to derive TIN from RC number"),
    }),
  },
  async ({ number, channel }) => {
    const result = await monoPost(`${V3}/lookup/tin`, { number, channel });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "lookup_credit_history",
  {
    description: "Check credit bureau history (CRC & First Central) for a business — used by Compliance and Underwriting agents",
    inputSchema: z.object({
      bvn: z.string().length(11),
      phoneNumber: z.string().describe("Business phone number"),
    }),
  },
  async ({ bvn, phoneNumber }) => {
    const result = await monoPost(`${V3}/lookup/credit-history`, { bvn, phone_number: phoneNumber });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── PROVE (tiered KYC with facial recognition) ────────────────────────────────

server.registerTool(
  "prove_initiate",
  {
    description: "Initiate a Mono Prove KYC session — returns a URL the business completes for facial + document verification",
    inputSchema: z.object({
      tier: z.enum(["Tier_1", "Tier_2", "Tier_3"]).describe(
        "Tier_1: BVN+NIN+face | Tier_2: +govt ID | Tier_3: +address confirmation"
      ),
      customerName: z.string(),
      customerEmail: z.string().email(),
      redirectUrl: z.string().url().describe("URL to redirect business after completing Prove"),
    }),
  },
  async ({ tier, customerName, customerEmail, redirectUrl }) => {
    const result = await monoPost(`${V1}/prove/initiate`, {
      tier,
      customer: { name: customerName, email: customerEmail },
      redirect_url: redirectUrl,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── FINANCIAL DATA (Connect) ──────────────────────────────────────────────────

server.registerTool(
  "get_account_statement",
  {
    description: "Retrieve bank account statement for a Mono-linked account — used by Underwriting Agent",
    inputSchema: z.object({
      accountId: z.string().describe("Mono account ID from the Connect flow"),
      period: z.string().optional().describe("Statement period, e.g. 'last6months'"),
    }),
  },
  async ({ accountId, period }) => {
    const url = period
      ? `${V2}/accounts/${accountId}/statement?period=${period}`
      : `${V2}/accounts/${accountId}/statement`;
    const result = await monoGet(url);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "get_account_transactions",
  {
    description: "Retrieve enriched transaction data for a Mono-linked account",
    inputSchema: z.object({
      accountId: z.string(),
      page: z.number().optional().default(1),
    }),
  },
  async ({ accountId, page }) => {
    const result = await monoGet(`${V2}/accounts/${accountId}/transactions?paginate=true&page=${page}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── CREDITWORTHINESS ──────────────────────────────────────────────────────────

server.registerTool(
  "assess_creditworthiness",
  {
    description: "Run a DSCR-based creditworthiness assessment — used by Underwriting Agent (Stage 6). Result delivered via webhook.",
    inputSchema: z.object({
      accountId: z.string().describe("Mono Connect account ID"),
      bvn: z.string().length(11),
      principalKobo: z.number().describe("Financing amount in Kobo (NGN × 100)"),
      interestRate: z.number().describe("Profit rate as percentage, e.g. 10"),
      termMonths: z.number().describe("Financing tenure in months"),
      runCreditCheck: z.boolean().default(true),
    }),
  },
  async ({ accountId, bvn, principalKobo, interestRate, termMonths, runCreditCheck }) => {
    const result = await monoPost(`${V2}/accounts/${accountId}/creditworthiness`, {
      bvn,
      principal: principalKobo,
      interest_rate: interestRate,
      term: termMonths,
      run_credit_check: runCreditCheck,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── H-6: DIRECT DEBIT ────────────────────────────────────────────────────────

server.registerTool(
  "create_direct_debit_mandate",
  {
    description: "Create a Direct Debit mandate for automated installment collection via mono.co. Returns a monoMandateRef to store on DirectDebitMandate contract.",
    inputSchema: z.object({
      accountId: z.string().describe("mono.co account ID of the business's repayment account"),
      amount: z.number().describe("Maximum collection amount per installment in Kobo (NGN × 100)"),
      startDate: z.string().describe("Mandate start date in ISO 8601 format (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("Mandate end date in ISO 8601 format; omit for open-ended"),
      reference: z.string().describe("FI's internal reference (facilityRef) for reconciliation"),
      description: z.string().describe("Narration shown on business's bank statement"),
    }),
  },
  async ({ accountId, amount, startDate, endDate, reference, description }) => {
    const body: Record<string, unknown> = {
      account: accountId,
      amount,
      start_date: startDate,
      reference,
      description,
    };
    if (endDate) body.end_date = endDate;
    const result = await monoPost(`${V2}/payments/mandates`, body);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "initiate_collection",
  {
    description: "Initiate a Direct Debit collection against an active mandate for a specific installment. Returns a monoCollectionRef to store on DirectDebitCollectionAttempt.",
    inputSchema: z.object({
      mandateId: z.string().describe("mono.co mandate ID (monoMandateRef from DirectDebitMandate)"),
      amount: z.number().describe("Amount to collect in Kobo (NGN × 100)"),
      reference: z.string().describe("FI's unique reference for this collection attempt"),
      description: z.string().describe("Narration for this specific installment collection"),
    }),
  },
  async ({ mandateId, amount, reference, description }) => {
    const result = await monoPost(`${V2}/payments/mandates/${mandateId}/collections`, {
      amount,
      reference,
      description,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "get_collection_status",
  {
    description: "Retrieve the status of a Direct Debit collection attempt. Use to determine if a collection succeeded, failed, or is pending before creating a DirectDebitCollectionAttempt record.",
    inputSchema: z.object({
      mandateId: z.string().describe("mono.co mandate ID"),
      collectionId: z.string().describe("mono.co collection ID (monoCollectionRef)"),
    }),
  },
  async ({ mandateId, collectionId }) => {
    const result = await monoGet(`${V2}/payments/mandates/${mandateId}/collections/${collectionId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "cancel_mandate",
  {
    description: "Cancel a Direct Debit mandate with mono.co. Call this after exercising CancelMandate on the DirectDebitMandate contract to synchronise the mandate state off-ledger.",
    inputSchema: z.object({
      mandateId: z.string().describe("mono.co mandate ID (monoMandateRef from DirectDebitMandate)"),
      reason: z.string().describe("Reason for cancellation, used for mono.co audit log"),
    }),
  },
  async ({ mandateId, reason }) => {
    const result = await monoPost(`${V2}/payments/mandates/${mandateId}/cancel`, { reason });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

// ── H-6: GSM (Global Standing Mandate via NIBSS) ──────────────────────────────

server.registerTool(
  "initiate_gsm",
  {
    description: "Initiate a Global Standing Mandate (GSM) sweep via mono.co / CBN-NIBSS for cross-bank recovery on a defaulted contract. Returns a monoGsmRef to store on GSMInvocation contract. Requires business's BVN and outstanding amount.",
    inputSchema: z.object({
      bvn: z.string().describe("Business's Bank Verification Number (11 digits)"),
      amountKobo: z.number().describe("Outstanding balance to recover in Kobo (NGN × 100)"),
      reference: z.string().describe("FI's unique reference (facilityRef) for this GSM request"),
      narration: z.string().describe("Narration submitted to CBN/NIBSS describing the debt"),
    }),
  },
  async ({ bvn, amountKobo, reference, narration }) => {
    const result = await monoPost(`${V2}/payments/gsm`, {
      bvn,
      amount: amountKobo,
      reference,
      narration,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "get_gsm_status",
  {
    description: "Retrieve the status of a GSM invocation including any completed sweeps. Use to determine whether NIBSS has recovered funds before calling RecordGSMSweep on the GSMInvocation contract.",
    inputSchema: z.object({
      gsmRef: z.string().describe("mono.co / NIBSS GSM reference (monoGsmRef from GSMInvocation)"),
    }),
  },
  async ({ gsmRef }) => {
    const result = await monoGet(`${V2}/payments/gsm/${gsmRef}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
