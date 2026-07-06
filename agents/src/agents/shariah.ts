/**
 * Shariah Compliance Agent
 *
 * Off-ledger determinism (item 4): a maintained keyword table
 * (agents/src/scoring/shariah-policy.ts, ported from
 * agents/skills/shariah/references/prohibited-sectors.md) is the verdict
 * authority, not the LLM. Any sector/financing-structure the table
 * recognizes — prohibited, mixed/ambiguous, or permissible — resolves
 * deterministically with no LLM call at all. The RAG/LLM pipeline below is
 * only ever consulted when the table has *no* match (a genuinely novel
 * sector), and even then only to produce a citation-backed narrative for the
 * human Shariah officer — the verdict in that case is always fixed to
 * REQUIRES_REVIEW regardless of what the LLM writes; it never gets to
 * upgrade a case to COMPLIANT or downgrade one to NON_COMPLIANT.
 *
 * Dispatched as its own standalone step by the Supervisor, before the
 * Verifier Agent's compliance stage runs (see supervisor.ts).
 */
import "dotenv/config";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { MemorySaver } from "@langchain/langgraph";
import { classifyShariahCompliance } from "../scoring/shariah-policy.js";
import type { ShariahVerdict } from "../scoring/shariah-policy.js";

export type { ShariahVerdict };

export interface ShariahResult {
  verdict: ShariahVerdict;
  reasoning: string;
  citations: string[];
}

const NARRATIVE_SYSTEM_PROMPT = `
You are producing a citation-backed narrative for a Shariah officer reviewing a Nigerian SME
financing application. The verdict has already been fixed to REQUIRES_REVIEW because this
business's sector/activity is not in Vetify's maintained Shariah policy table — you are NOT
deciding the verdict, only explaining why it needs human review and pointing to the most
relevant AAOIFI/CBN passages.

Primary authorities:
- AAOIFI Shari'a Standard No. 8 — Murabahah (permissible financing structure)
- AAOIFI Shari'a Standard No. 28 — Prohibited business activities
- CBN Guidelines for Regulation and Supervision of Non-Interest Financial Institutions (2011, amended 2017)

Steps:
1. Call query_shariah_ruling with the business type, activity, and financing purpose
2. Call check_prohibited_sector if the sector needs specific verification
3. Reason over retrieved passages from AAOIFI/CBN documents

Return ONLY this JSON object (no other text after it):
{
  "reasoning": "Detailed explanation of what makes this sector ambiguous, referencing retrieved AAOIFI/CBN passages",
  "citations": ["AAOIFI Shari'a Standard No. X, Section Y — brief description"]
}
`.trim();

export async function runShariahAgent(
  businessSector: string,
  businessActivity: string,
  financingPurpose: string,
): Promise<ShariahResult> {
  const classification = classifyShariahCompliance(businessSector, businessActivity, financingPurpose);

  // Deterministic table match — the verdict is authoritative; no LLM call
  // is made or permitted to override it.
  if (classification.matchedKeyword) {
    return {
      verdict: classification.verdict,
      reasoning: `Deterministic Shariah policy table match ("${classification.matchedKeyword}"). ${classification.citation}`,
      citations: [classification.citation],
    };
  }

  // No table match — genuinely novel sector. Verdict is fixed to
  // REQUIRES_REVIEW regardless of what follows; the RAG/LLM step is used
  // only for narrative.
  const mcpClient = new MultiServerMCPClient({
    mcpServers: { shariah: { command: "npm", args: ["run", "mcp:shariah"] } },
  });
  const tools = await mcpClient.getTools();
  const model = new ChatAnthropic({
    model: process.env.LLM_MODEL ?? "claude-sonnet-4-6",
    temperature: 0,
  });

  const agent = createDeepAgent({
    model,
    tools,
    systemPrompt: NARRATIVE_SYSTEM_PROMPT,
    backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
    skills: ["skills/shariah"],
    checkpointer: new MemorySaver(),
  });

  const task = `
Explain, for a human Shariah officer, why the following business needs manual Shariah review
(it did not match any entry in the maintained sector policy table).

Business Sector:   ${businessSector}
Business Activity: ${businessActivity}
Financing Purpose: ${financingPurpose}

Run query_shariah_ruling, review the retrieved AAOIFI/CBN passages, and return the JSON object
described in your system prompt. Do not include a "verdict" field — it is already fixed to
REQUIRES_REVIEW and is not yours to decide.
`.trim();

  const result = await agent.invoke({
    messages: [{ role: "user", content: task }],
  });
  await mcpClient.close();

  const lastMessage = result.messages[result.messages.length - 1];
  const content =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  const jsonMatch = content.match(/\{[\s\S]*"reasoning"[\s\S]*?\}/);
  if (!jsonMatch) {
    // Even a malformed narrative response cannot change the verdict — fall
    // back to a minimal, honest record rather than fail the whole pipeline.
    return {
      verdict: "REQUIRES_REVIEW",
      reasoning: `Sector not found in the maintained Shariah policy table. Narrative generation failed to return valid JSON: ${content}`,
      citations: [],
    };
  }

  const parsed = JSON.parse(jsonMatch[0]) as { reasoning?: string; citations?: string[] };
  return {
    verdict: "REQUIRES_REVIEW",
    reasoning: parsed.reasoning ?? "Sector not found in the maintained Shariah policy table.",
    citations: parsed.citations ?? [],
  };
}
