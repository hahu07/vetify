/**
 * Local stand-in for the real Anthropic API, for demo/offline runs where you don't want to
 * spend real tokens/time or depend on network access at all. Point ChatAnthropic at this via
 * ANTHROPIC_BASE_URL (see agents/.env.example and util.ts's buildModel()) — every agent shares
 * that one construction, so this mocks all of them at once.
 *
 * It doesn't "reason" — it runs a fixed, per-stage script: call the expected evidence tools in
 * order (ignoring their actual response content), then emit a hardcoded evidence JSON matching
 * exactly what a real Claude following the real system prompt would produce for the current
 * MOCK_SCENARIO. This still exercises the real MCP tool-call plumbing end-to-end (visible in
 * the terminal), and the real deterministic scoring engines still make the real decision from
 * whatever evidence JSON lands here — only the "LLM judgment" step is scripted.
 *
 * Stage is detected from the `system` prompt text (each agent's system prompt is distinct and
 * far more reliable to match on than `tools`, since Stage 2 and Stage 6 both bind the *same*
 * full mono.co tool list — the prompt is what tells a real LLM which subset to call).
 *
 * Run with: npm run mock:llm
 * Scenario: MOCK_SCENARIO=clean (default) | flag | reject — same switch mock-provider-server.ts
 * uses, so both stay in sync.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_LLM_PORT ?? 4200);
const SCENARIO = (process.env.MOCK_SCENARIO ?? "clean") as "clean" | "flag" | "reject";
const DEBUG = process.env.MOCK_LLM_DEBUG === "1";

type ContentBlock = Record<string, unknown>;
interface AnthropicMessage { role: string; content: string | ContentBlock[] }

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => resolve(raw));
  });
}

function systemText(system: unknown): string {
  if (typeof system === "string") return system;
  if (Array.isArray(system)) return system.map((b: ContentBlock) => String(b.text ?? "")).join("\n");
  return "";
}

// ── Per-stage scripted plans ─────────────────────────────────────────────────

interface Plan {
  match: (system: string, userText: string) => boolean;
  tools: string[];
  args: (name: string) => Record<string, unknown>;
  finalAnswer: () => Record<string, unknown>;
}

const VERIFICATION_ANSWERS: Record<string, Record<string, unknown>> = {
  clean: { mashup: { ninVerified: true, bvnVerified: true, nameMatch: true }, cac: { found: true, status: "Active", nameMatch: "exact" }, tin: { outcome: "verifiedMatchesCac" } },
  flag: { mashup: { ninVerified: true, bvnVerified: true, nameMatch: true }, cac: { found: true, status: "Pending", nameMatch: "close" }, tin: { outcome: "notFound" } },
  reject: { mashup: { error: true, httpStatus: 404 }, cac: { found: false, status: "Struck Off", nameMatch: "mismatch" }, tin: { outcome: "notFound" } },
};

const COMPLIANCE_ANSWERS: Record<string, Record<string, unknown>> = {
  clean: { amlBusinessStatus: "clear", amlDirectorStatus: "clear", amlScreeningRef: "mock-aml-biz-1", sanctionsCheckRef: null, pepCheckRef: null, adverseMediaRef: null, pepHit: false, adverseMediaSummary: "No adverse media found", creditHistory: "clean", kybStatus: "active_full_match" },
  flag: { amlBusinessStatus: "clear", amlDirectorStatus: "review_required", amlScreeningRef: "mock-aml-biz-2", sanctionsCheckRef: null, pepCheckRef: "mock-pep-1", adverseMediaRef: null, pepHit: true, adverseMediaSummary: "No adverse media found", creditHistory: "minor_resolved", kybStatus: "active_minor_discrepancy" },
  reject: { amlBusinessStatus: "not_cleared", amlDirectorStatus: "clear", amlScreeningRef: "mock-aml-biz-3", sanctionsCheckRef: "mock-sanc-1", pepCheckRef: null, adverseMediaRef: "mock-adv-1", pepHit: false, adverseMediaSummary: "Business owner charged with fraud (2024)", creditHistory: "delinquent_or_default", kybStatus: "inactive_or_mismatch" },
};

function underwritingTransactions() {
  const base = Date.parse("2026-01-05");
  const day = 86_400_000;
  const rows = [
    { desc: "POS Sales Settlement", cp: null, dir: "credit", amt: 420_000 },
    { desc: "Supplier Payment", cp: "Textiles Ltd", dir: "debit", amt: 180_000 },
    { desc: "POS Sales Settlement", cp: null, dir: "credit", amt: 395_000 },
    { desc: "Staff Salary", cp: null, dir: "debit", amt: 150_000 },
    { desc: "POS Sales Settlement", cp: null, dir: "credit", amt: 460_000 },
    { desc: "Electricity - EKEDC", cp: "EKEDC", dir: "debit", amt: 32_000 },
    { desc: "POS Sales Settlement", cp: null, dir: "credit", amt: 410_000 },
    { desc: "Supplier Payment", cp: "Textiles Ltd", dir: "debit", amt: 175_000 },
    { desc: "POS Sales Settlement", cp: null, dir: "credit", amt: 505_000 },
    { desc: "Shop Rent", cp: "Lagos Properties Ltd", dir: "debit", amt: 200_000 },
    { desc: "POS Sales Settlement", cp: null, dir: "credit", amt: 480_000 },
    { desc: "Staff Salary", cp: null, dir: "debit", amt: 155_000 },
  ];
  let balance = 650_000;
  return rows.map((r, i) => {
    balance += r.dir === "credit" ? r.amt : -r.amt;
    return {
      date: new Date(base + i * 5 * day).toISOString().slice(0, 10),
      amount: r.amt,
      direction: r.dir,
      description: r.desc,
      counterparty: r.cp,
      balanceAfter: balance,
    };
  });
}

// Matched against the TASK text (the first user message), not the system prompt.
// Both verifier.ts stages share one skill (skills/verifier), whose own SKILL.md
// frontmatter description mentions "Stage 2 identity/KYC evidence" AND "Stage 3
// AML/KYB/credit-history evidence" together (it documents the whole merged
// agent) — that description gets injected into the system prompt for BOTH
// stages, so matching against `system` made every Stage 3 call's system prompt
// satisfy Stage 2's substring check too, and PLANS.find() (first-match-wins)
// always picked Stage 2's plan for Stage 3 calls. Confirmed live: every
// ComplianceReview evidence pass silently ran the Stage 2 tool sequence and
// returned VERIFICATION_ANSWERS' shape, which then failed ComplianceEvidenceSchema
// validation with every field "Required". Each task string below (verifier.ts's/
// underwriting.ts's own `task` template literals) is constructed fresh per call
// and is mutually exclusive by construction — a reliable disambiguator the
// shared skill description can't contaminate.
const PLANS: Plan[] = [
  {
    match: (_s, userText) => userText.includes("Gather Stage 2 verification evidence"),
    tools: ["lookup_mashup", "lookup_cac", "lookup_tin"],
    args: (name) => ({
      lookup_mashup: { nin: "12345678901", bvn: "22334455667" },
      lookup_cac: { search: "RC7654321" },
      lookup_tin: { number: "RC7654321", channel: "cac" },
    }[name] ?? {}),
    finalAnswer: () => VERIFICATION_ANSWERS[SCENARIO],
  },
  {
    match: (_s, userText) => userText.includes("Gather Stage 3 compliance evidence"),
    tools: ["aml_screen_business", "aml_screen_individual", "adverse_media_screen", "lookup_credit_history", "kyb_verify_business"],
    args: (name) => ({
      aml_screen_business: { query: "Ahmadu Trading Ventures", type: "business", isSubjectConsent: true },
      aml_screen_individual: { query: "Fatima Bello", type: "individual", isSubjectConsent: true },
      adverse_media_screen: { query: "Ahmadu Trading Ventures", type: "all", isSubjectConsent: true },
      lookup_credit_history: { bvn: "22334455667", phoneNumber: "08012345678" },
      kyb_verify_business: { registrationNumber: "RC7654321", registrationName: "Ahmadu Trading Ventures", countryCode: "NG", premium: false, isConsent: true },
    }[name] ?? {}),
    finalAnswer: () => COMPLIANCE_ANSWERS[SCENARIO],
  },
  {
    match: (_s, userText) => userText.includes("Gather Stage 6 underwriting evidence"),
    tools: ["get_account_statement", "get_account_transactions", "assess_creditworthiness"],
    args: (name) => ({
      get_account_statement: { accountId: "mock-acct-1", period: "last6months" },
      get_account_transactions: { accountId: "mock-acct-1", page: 1 },
      assess_creditworthiness: { accountId: "mock-acct-1", bvn: "22334455667", principalKobo: 500_000_00, interestRate: 10, termMonths: 12, runCreditCheck: true },
    }[name] ?? {}),
    finalAnswer: () => ({ transactions: underwritingTransactions(), creditworthinessReference: "mock-cw-1", dscr: 1.85, creditScore: 730 }),
  },
];

function firstUserText(messages: AnthropicMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "";
  if (typeof first.content === "string") return first.content;
  return first.content.map((b) => String(b.text ?? "")).join("\n");
}

function detectPlan(system: string, userText: string): Plan | undefined {
  return PLANS.find((p) => p.match(system, userText));
}

function completedToolNames(messages: AnthropicMessage[]): Set<string> {
  const idToName = new Map<string, string>();
  const completed = new Set<string>();
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const block of m.content) {
      if (m.role === "assistant" && block.type === "tool_use") {
        idToName.set(String(block.id), String(block.name));
      }
      if (m.role === "user" && block.type === "tool_result") {
        const name = idToName.get(String(block.tool_use_id));
        if (name) completed.add(name);
      }
    }
  }
  return completed;
}

function textBlock(text: string) {
  return { type: "text", text };
}
function toolUseBlock(name: string, input: Record<string, unknown>) {
  return { type: "tool_use", id: `toolu_${randomUUID().replace(/-/g, "")}`, name, input };
}

function buildMessage(model: string, content: ContentBlock[], stopReason: string) {
  return {
    id: `msg_${randomUUID().replace(/-/g, "")}`,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

// ── Streaming (SSE) helpers — used when the request sets stream:true ────────

function sseEvent(res: import("node:http").ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function streamMessage(res: import("node:http").ServerResponse, model: string, content: ContentBlock[], stopReason: string) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const msgId = `msg_${randomUUID().replace(/-/g, "")}`;
  sseEvent(res, "message_start", { type: "message_start", message: { id: msgId, type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
  content.forEach((block, index) => {
    if (block.type === "text") {
      sseEvent(res, "content_block_start", { type: "content_block_start", index, content_block: { type: "text", text: "" } });
      sseEvent(res, "content_block_delta", { type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } });
      sseEvent(res, "content_block_stop", { type: "content_block_stop", index });
    } else {
      sseEvent(res, "content_block_start", { type: "content_block_start", index, content_block: { type: "tool_use", id: block.id, name: block.name, input: {} } });
      sseEvent(res, "content_block_delta", { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
      sseEvent(res, "content_block_stop", { type: "content_block_stop", index });
    }
  });
  sseEvent(res, "message_delta", { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 1 } });
  sseEvent(res, "message_stop", { type: "message_stop" });
  res.end();
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "not mocked" }));
  }
  const raw = await readBody(req);
  const body = raw ? JSON.parse(raw) : {};
  const model = String(body.model ?? "mock-model");
  const system = systemText(body.system);
  const messages: AnthropicMessage[] = body.messages ?? [];
  const userText = firstUserText(messages);
  const stream = body.stream === true;

  if (DEBUG) console.log(`[mock-llm] len=${system.length} hasStage2Task=${userText.includes("Gather Stage 2 verification evidence")} hasStage3Task=${userText.includes("Gather Stage 3 compliance evidence")} hasStage6Task=${userText.includes("Gather Stage 6 underwriting evidence")} messages=${messages.length} stream=${stream}`);

  // detectPlan alone isn't reliable across a whole tool-calling conversation —
  // confirmed live: deepagents/langgraph doesn't necessarily resend the identical first
  // user message on every turn of a multi-tool-call loop, so a later turn's `messages`
  // can fail the task-text match even though the first turn's matched fine. When that
  // happens, infer the in-progress plan from which of its tools already appear in this
  // conversation's tool-call history instead of giving up to the generic "{}" stub
  // (which previously made Stage 3's 5-tool sequence — the longest of the three — fail
  // schema validation partway through).
  const plan = detectPlan(system, userText) ?? (() => {
    const done = completedToolNames(messages);
    if (done.size === 0) return undefined;
    return PLANS.find((p) => p.tools.some((t) => done.has(t)));
  })();
  let content: ContentBlock[];
  let stopReason: string;

  if (!plan) {
    // No scripted plan for this call (e.g. Shariah/Reporting narrative writers) — best-effort
    // generic reply so the caller doesn't hang; not exercised by the main demo path.
    content = [textBlock("{}")];
    stopReason = "end_turn";
  } else {
    const done = completedToolNames(messages);
    const next = plan.tools.find((t) => !done.has(t));
    if (next) {
      content = [toolUseBlock(next, plan.args(next))];
      stopReason = "tool_use";
    } else {
      content = [textBlock(JSON.stringify(plan.finalAnswer()))];
      stopReason = "end_turn";
    }
  }

  if (stream) return streamMessage(res, model, content, stopReason);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(buildMessage(model, content, stopReason)));
});

server.listen(PORT, () => {
  console.log(`[mock-llm-server] listening on :${PORT}, scenario="${SCENARIO}"${DEBUG ? " (debug)" : ""}`);
});
