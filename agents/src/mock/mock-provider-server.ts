/**
 * Local stand-in for mono.co + Youverify, for demo/offline runs where signing up for real
 * sandbox keys isn't worth the time. Point mono-server.ts/youverify-server.ts at this via
 * MONO_BASE_URL / YOUVERIFY_BASE_URL (see agents/.env.example) — everything upstream of these
 * two MCP servers (the LLM's tool calls, evidence parsing, deterministic scoring engines, and
 * every Canton choice they exercise) is completely real. Only the third-party identity/AML/bank
 * data is canned.
 *
 * No schema here is a verified copy of mono.co's or Youverify's real response shape — nothing in
 * this codebase has one (see agents/skills/underwriting/references/mono-underwriting-fields.md's
 * own "Honesty note on scope"). It's shaped closely enough that the agents' existing system
 * prompts (which already tell the LLM what fields to look for) parse it the same way they'd parse
 * the real thing.
 *
 * Run with: npm run mock:providers
 * Scenario: MOCK_SCENARIO=clean (default) | flag | reject — drives Stage 2/3 identity results.
 * Stage 6 (transactions/creditworthiness) is always a clean, auto-qualifying profile.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PROVIDER_PORT ?? 4100);
const SCENARIO = (process.env.MOCK_SCENARIO ?? "clean") as "clean" | "flag" | "reject";

const BUSINESS_NAME = "Ahmadu Trading Ventures";
const RC_NUMBER = "RC7654321";
const DIRECTOR_NAME = "Fatima Bello";

function readBody(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

function send(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// ── Mono responses ───────────────────────────────────────────────────────────

function mashupResponse() {
  if (SCENARIO === "reject") {
    return { status: "error", message: "NIN not found", httpStatus: 404 };
  }
  return {
    status: "successful",
    data: {
      nin: { verified: true, firstName: "Fatima", lastName: "Bello", middleName: "Amina" },
      bvn: { verified: true, firstName: "Fatima", lastName: "Bello" },
      match: { name: true },
    },
  };
}

function cacResponse() {
  if (SCENARIO === "reject") {
    return { status: "successful", data: { companyName: BUSINESS_NAME, rcNumber: RC_NUMBER, companyStatus: "Struck Off", companyType: "Business Name", dateOfRegistration: "2019-03-14", directors: [{ name: DIRECTOR_NAME, nin: "11122233344" }] } };
  }
  if (SCENARIO === "flag") {
    return { status: "successful", data: { companyName: BUSINESS_NAME, rcNumber: RC_NUMBER, companyStatus: "Pending", companyType: "Business Name", dateOfRegistration: "2024-11-02", directors: [{ name: DIRECTOR_NAME, nin: "11122233344" }] } };
  }
  return { status: "successful", data: { companyName: BUSINESS_NAME, rcNumber: RC_NUMBER, companyStatus: "Active", companyType: "Business Name", dateOfRegistration: "2019-03-14", directors: [{ name: DIRECTOR_NAME, nin: "11122233344" }] } };
}

function tinResponse() {
  if (SCENARIO === "reject") return { status: "error", message: "TIN not found", httpStatus: 404 };
  return { status: "successful", data: { tin: "TIN-88771122", taxpayerName: BUSINESS_NAME, taxOffice: "Lagos Mainland", channel: "cac" } };
}

function creditHistoryResponse() {
  if (SCENARIO === "reject") return { status: "successful", data: { score: "poor", delinquencies: 3, activeDefaults: 1, summary: "Multiple delinquencies, one active default" } };
  if (SCENARIO === "flag") return { status: "successful", data: { score: "fair", delinquencies: 1, activeDefaults: 0, summary: "One minor delinquency, resolved" } };
  return { status: "successful", data: { score: "good", delinquencies: 0, activeDefaults: 0, summary: "No adverse credit history" } };
}

function transactionsResponse() {
  const base = Date.parse("2026-01-05");
  const day = 86_400_000;
  const rows = [
    { desc: "POS Sales Settlement", dir: "credit", amt: 420_000 },
    { desc: "Supplier Payment - Textiles Ltd", dir: "debit", amt: 180_000 },
    { desc: "POS Sales Settlement", dir: "credit", amt: 395_000 },
    { desc: "Staff Salary", dir: "debit", amt: 150_000 },
    { desc: "POS Sales Settlement", dir: "credit", amt: 460_000 },
    { desc: "Electricity - EKEDC", dir: "debit", amt: 32_000 },
    { desc: "POS Sales Settlement", dir: "credit", amt: 410_000 },
    { desc: "Supplier Payment - Textiles Ltd", dir: "debit", amt: 175_000 },
    { desc: "POS Sales Settlement", dir: "credit", amt: 505_000 },
    { desc: "Shop Rent", dir: "debit", amt: 200_000 },
    { desc: "POS Sales Settlement", dir: "credit", amt: 480_000 },
    { desc: "Staff Salary", dir: "debit", amt: 155_000 },
  ];
  let balance = 650_000;
  const transactions = rows.map((r, i) => {
    balance += r.dir === "credit" ? r.amt : -r.amt;
    return {
      date: new Date(base + i * 5 * day).toISOString().slice(0, 10),
      amount: r.amt,
      narration: r.desc,
      type: r.dir,
      balance,
    };
  });
  return { status: "successful", data: { transactions } };
}

function creditworthinessResponse() {
  // Included synchronously (real mono.co delivers this via webhook) — see
  // underwriting.ts's own comment: if dscr/creditScore are already in this response, the agent
  // reports them directly and never needs to poll the webhook receiver at all.
  return {
    status: "successful",
    data: {
      reference: `mock-cw-${Date.now()}`,
      dscr: 1.85,
      creditScore: 730,
      recommendation: "eligible",
    },
  };
}

// ── Youverify responses ──────────────────────────────────────────────────────

function amlResponse(query: string) {
  if (SCENARIO === "reject") {
    return { data: { query, status: "not_cleared", sanctions: [{ list: "OFAC", matchScore: 0.94 }], pep: [], totalEntity: 1, categoryCount: { sanction: 1, pep: 0 }, verificationId: `aml-${Date.now()}` } };
  }
  if (SCENARIO === "flag") {
    return { data: { query, status: "review_required", sanctions: [], pep: [{ role: "Local government councillor (2015-2019)", country: "Nigeria" }], totalEntity: 1, categoryCount: { sanction: 0, pep: 1 }, verificationId: `aml-${Date.now()}` } };
  }
  return { data: { query, status: "clear", sanctions: [], pep: [], totalEntity: 0, categoryCount: { sanction: 0, pep: 0 }, verificationId: `aml-${Date.now()}` } };
}

function kybResponse() {
  if (SCENARIO === "reject") return { data: { registrationNumber: RC_NUMBER, companyName: BUSINESS_NAME, status: "inactive", matchType: "mismatch" } };
  if (SCENARIO === "flag") return { data: { registrationNumber: RC_NUMBER, companyName: BUSINESS_NAME, status: "active", matchType: "minor_discrepancy" } };
  return { data: { registrationNumber: RC_NUMBER, companyName: BUSINESS_NAME, status: "active", matchType: "full_match", directors: [{ name: DIRECTOR_NAME }] } };
}

function adverseMediaResponse(query: string) {
  if (SCENARIO === "reject") return { data: { query, status: "found", severity: "high", matches: [{ headline: "Business owner charged with fraud", source: "demo-news.ng", date: "2024-06-01" }] } };
  return { data: { query, status: "clear", severity: "none", matches: [] } };
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  const body = req.method === "POST" ? await readBody(req) : {};

  // mono.co — Lookup
  if (path === "/v3/lookup/mashup") return send(res, 200, mashupResponse());
  if (path === "/v3/lookup/cac") return send(res, 200, cacResponse());
  if (path === "/v3/lookup/tin") return send(res, 200, tinResponse());
  if (path === "/v3/lookup/credit-history") return send(res, 200, creditHistoryResponse());
  if (path === "/v3/lookup/nin") return send(res, 200, { status: "successful", data: { verified: true, firstName: "Fatima", lastName: "Bello" } });
  if (path === "/v3/lookup/bvn/igree") return send(res, 200, { status: "successful", data: { verified: true, firstName: "Fatima", lastName: "Bello" } });

  // mono.co — Connect / Creditworthiness
  if (/^\/v2\/accounts\/[^/]+\/statement$/.test(path)) return send(res, 200, { status: "successful", data: { account: { id: "mock-acct-1", currency: "NGN" }, ...transactionsResponse().data } });
  if (/^\/v2\/accounts\/[^/]+\/transactions$/.test(path)) return send(res, 200, transactionsResponse());
  if (/^\/v2\/accounts\/[^/]+\/creditworthiness$/.test(path)) return send(res, 200, creditworthinessResponse());

  // mono.co — Prove / Direct Debit / GSM (generic acks — not exercised by this demo path)
  if (path === "/v1/prove/initiate") return send(res, 200, { status: "successful", data: { redirect_url: "https://mock.mono.local/prove/session/abc" } });
  if (/^\/v2\/payments\/mandates$/.test(path)) return send(res, 200, { status: "successful", data: { id: `mand-${Date.now()}` } });
  if (/^\/v2\/payments\/mandates\/[^/]+\/collections$/.test(path)) return send(res, 200, { status: "successful", data: { id: `coll-${Date.now()}`, status: "successful" } });
  if (/^\/v2\/payments\/mandates\/[^/]+\/collections\/[^/]+$/.test(path)) return send(res, 200, { status: "successful", data: { status: "successful" } });
  if (/^\/v2\/payments\/mandates\/[^/]+\/cancel$/.test(path)) return send(res, 200, { status: "successful", data: { cancelled: true } });
  if (path === "/v2/payments/gsm") return send(res, 200, { status: "successful", data: { reference: `gsm-${Date.now()}` } });
  if (/^\/v2\/payments\/gsm\/[^/]+$/.test(path)) return send(res, 200, { status: "successful", data: { status: "pending", sweeps: [] } });

  // Youverify — AML/PEP + adverse media + KYB
  if (path === "/v2/api/verifications/advanced/identity/aml-checks") return send(res, 200, amlResponse(String(body.query ?? "")));
  if (/^\/v2\/api\/verifications\/aml-checks\/[^/]+$/.test(path)) return send(res, 200, amlResponse("stored-query"));
  if (path === "/v2/api/verifications/global/company-advance-check") return send(res, 200, kybResponse());
  if (path === "/v2/api/verifications/advanced/adverse-media/aml-checks") return send(res, 200, adverseMediaResponse(String(body.query ?? "")));

  send(res, 404, { error: "not mocked", path });
});

server.listen(PORT, () => {
  console.log(`[mock-provider-server] listening on :${PORT}, scenario="${SCENARIO}"`);
});
