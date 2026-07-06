/**
 * Verifier Agent — merges the former Verification Agent (Stage 2) and
 * Compliance Agent (Stage 3) under one Canton party, `verifier`.
 *
 * Off-ledger determinism: the LLM here is restricted to *gathering evidence*
 * (calling mono.co/Youverify tools and reporting their raw results as JSON)
 * and, only for FlagForManualReview/FlagComplianceForManualReview, writing a
 * narrative note. It never decides a risk score, a risk level, or which
 * Canton choice to exercise, and it has no tool access to exercise_choice or
 * create_contract at all — a deterministic scorer (agents/src/scoring/) does
 * that, and this module calls the Canton MCP tools directly, in code, based
 * on the scorer's output. See agents/src/scoring/verification.ts and
 * compliance.ts for exactly which parts of the CBN/AAOIFI rubric can be
 * quantified from available data, and which cannot (and are always left for
 * a human, never guessed at).
 *
 * The Shariah pre-check (agents/src/scoring/shariah-policy.ts + shariah.ts)
 * is dispatched standalone by the Supervisor before the compliance stage
 * runs; this module only ever reads its already-recorded verdict.
 *
 * Two entry points, not one dispatcher — the two stages watch different
 * template IDs, use different MCP tool sets, and load different skill
 * content, so the Supervisor still branches on contract template+status.
 */
import "dotenv/config";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { MemorySaver } from "@langchain/langgraph";
import { scoreVerification } from "../scoring/verification.js";
import { scoreCompliance } from "../scoring/compliance.js";
import {
  DEFAULT_COMPLIANCE_POLICY_VERSION,
  DEFAULT_COMPLIANCE_WEIGHTS,
  DEFAULT_VERIFICATION_POLICY_VERSION,
  DEFAULT_VERIFICATION_WEIGHTS,
  numifyWeights,
} from "../scoring/types.js";
import type {
  AmlEvidence,
  CacResult,
  ComplianceScoringWeights,
  CreditHistoryResult,
  KybEvidence,
  KybStatus,
  MashupResult,
  TinResult,
  VerificationScoringWeights,
} from "../scoring/types.js";
import type { ShariahVerdict } from "../scoring/shariah-policy.js";

const T_ONBOARDING = "Vetify.Onboarding:BusinessOnboarding";
const T_COMPLIANCE = "Vetify.Compliance:ComplianceReview";
const T_VERIFICATION_POLICY = "Vetify.Onboarding:VerificationPolicy";
const T_COMPLIANCE_POLICY = "Vetify.Compliance:CompliancePolicy";

const VERIFIER_PERSONA = `
You are the Verifier Agent for Vetify, an AI-powered non-interest financing platform.
`.trim();

function buildModel() {
  return new ChatAnthropic({
    model: process.env.LLM_MODEL ?? "claude-sonnet-4-6",
    temperature: 0,
  });
}

/** Extracts the JSON object from an agent's final message text. */
function extractJson(content: unknown): Record<string, unknown> {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Expected a JSON evidence object in the agent's response.\nResponse: ${text}`);
  return JSON.parse(match[0]) as Record<string, unknown>;
}

interface McpTool { name: string; invoke: (input: Record<string, unknown>) => Promise<unknown> }

async function invokeTool(tools: McpTool[], name: string, input: Record<string, unknown>): Promise<unknown> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`MCP tool "${name}" not found among available tools`);
  return tool.invoke(input);
}

/** VerificationPolicy/CompliancePolicy have no observer clause — only vetify (their
 * signatory) can see them, so this always queries as party "vetify", regardless of which
 * party the caller otherwise acts as. Returns undefined if no policy is active — callers
 * fall back to the built-in DEFAULT_* weights/version, same as the Daml choices themselves
 * already fall back when lookupByKey finds nothing. */
async function fetchActivePolicyPayload(tools: McpTool[], templateId: string): Promise<Record<string, unknown> | undefined> {
  const raw = await invokeTool(tools, "get_active_contracts", { templateId, party: "vetify" });
  const parsed = extractJson(raw) as { result?: Array<{ contractId: string; payload: Record<string, unknown> }> };
  return parsed.result?.[0]?.payload;
}

/** quantifiableScore's 80-point ceiling is a different scale from the full 100-point CDD
 * framework, but Compliance.daml's choices still require a self-consistent (riskScore,
 * riskLevel) pair — this reuses the same band thresholds purely to satisfy that assertion. */
function quantifiableRiskLevel(score: number): "Low" | "Medium" | "High" {
  if (score >= 80) return "Low";
  if (score >= 50) return "Medium";
  return "High";
}

// ─── Stage 2: Verification — evidence gathering only ───────────────────────

const VERIFICATION_EVIDENCE_PROMPT = `
${VERIFIER_PERSONA}

You are gathering Stage 2 identity/KYC evidence for a BusinessOnboarding application. You do
NOT decide whether to approve, reject, or flag it, and you have no tool access to do so — a
deterministic scoring engine makes that decision from the evidence you report.

Call, in order:
1. lookup_mashup — the director's NIN, BVN, and date of birth if provided
2. lookup_cac — the CAC registration number
3. lookup_tin — the tax ID, with channel "cac"

Then reply with ONLY this JSON object (no text before or after it):
{
  "mashup": { "ninVerified": boolean, "bvnVerified": boolean, "dobProvided": boolean, "dobMatch": boolean } | { "error": true, "httpStatus": number },
  "cac": { "found": boolean, "status": "Active" | "Inactive" | "Struck Off" | "Pending", "nameMatch": "exact" | "close" | "mismatch" } | { "error": true, "httpStatus": number },
  "tin": { "outcome": "verifiedMatchesCac" | "verifiedDifferentEntity" | "notFound" } | { "error": true, "httpStatus": number }
}
Report exactly what each tool returned — do not soften, round, or reinterpret any field.
`.trim();

function toMashupResult(raw: unknown): MashupResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.error) return { kind: "error", httpStatus: Number(r.httpStatus ?? 0) };
  return {
    kind: "ok",
    data: {
      ninVerified: !!r.ninVerified,
      bvnVerified: !!r.bvnVerified,
      dobProvided: !!r.dobProvided,
      dobMatch: !!r.dobMatch,
    },
  };
}

function toCacResult(raw: unknown): CacResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.error) return { kind: "error", httpStatus: Number(r.httpStatus ?? 0) };
  const nameMatch = r.nameMatch === "exact" || r.nameMatch === "close" ? r.nameMatch : "mismatch";
  return { kind: "ok", data: { found: !!r.found, status: String(r.status ?? "Inactive"), nameMatch } };
}

function toTinResult(raw: unknown): TinResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.error) return { kind: "error", httpStatus: Number(r.httpStatus ?? 0) };
  const outcome = r.outcome;
  if (outcome === "verifiedMatchesCac" || outcome === "verifiedDifferentEntity" || outcome === "notFound") {
    return { kind: outcome };
  }
  return { kind: "notFound" };
}

export async function runVerifierVerificationStage(contractId: string, contractPayload: unknown): Promise<void> {
  const payload = contractPayload as Record<string, unknown>;

  // Evidence-gathering agent: mono.co tools only. It cannot reach the Canton
  // MCP server at all, so it is architecturally incapable of exercising any
  // choice, not merely instructed not to.
  const evidenceMcp = new MultiServerMCPClient({
    mcpServers: { mono: { command: "npm", args: ["run", "mcp:mono"] } },
  });
  const evidenceTools = await evidenceMcp.getTools();
  const evidenceAgent = createDeepAgent({
    model: buildModel(),
    tools: evidenceTools,
    systemPrompt: VERIFICATION_EVIDENCE_PROMPT,
    backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
    skills: ["skills/verifier"],
    checkpointer: new MemorySaver(),
  });

  const task = `
Gather Stage 2 verification evidence for the following BusinessOnboarding application.

Contract ID: ${contractId}
Payload: ${JSON.stringify(contractPayload, null, 2)}
  `.trim();

  const result = await evidenceAgent.invoke({ messages: [{ role: "user", content: task }] });
  await evidenceMcp.close();
  const lastMessage = result.messages[result.messages.length - 1];
  const evidence = extractJson(lastMessage.content);

  // Deterministic decision execution from here — no LLM involved. A single
  // canton client is reused for the policy fetch and the choice exercise.
  const cantonMcp = new MultiServerMCPClient({
    mcpServers: { canton: { command: "npm", args: ["run", "mcp:canton"] } },
  });
  const cantonTools = (await cantonMcp.getTools()) as unknown as McpTool[];

  // VerificationPolicy carries the scoring weights ops can retune without a
  // code deploy; fall back to the built-in defaults if none is active, same
  // as the Daml choices themselves already do for policyVersion/thresholds.
  const policyPayload = await fetchActivePolicyPayload(cantonTools, T_VERIFICATION_POLICY);
  // Daml Int fields arrive as JSON strings from the ledger — numifyWeights converts them to
  // real numbers before they're summed (see its doc comment in scoring/types.ts for the bug
  // this closes: string-concatenation instead of addition once a real policy is active).
  const weights = policyPayload?.scoringWeights
    ? numifyWeights<VerificationScoringWeights>(policyPayload.scoringWeights as Record<string, unknown>)
    : DEFAULT_VERIFICATION_WEIGHTS;
  const policyVersion = (policyPayload?.policyVersion as string | undefined) ?? DEFAULT_VERIFICATION_POLICY_VERSION;

  const scoring = scoreVerification(
    toMashupResult(evidence.mashup),
    toCacResult(evidence.cac),
    toTinResult(evidence.tin),
    weights,
    policyVersion,
  );

  const verificationRef = `VER-${new Date().getUTCFullYear()}-${contractId.replace(/[^a-zA-Z0-9]/g, "").slice(-6)}`;
  const commonArgs = {
    checks: scoring.checks,
    checkScores: scoring.checkScores,
    riskScore: scoring.riskScore,
    riskLevel: scoring.riskLevel,
    verificationRef,
    reviewerParty: null,
    reviewedBy: null,
    agentVersion: scoring.scoringPolicyVersion,
    aiMetadata: null,
    overrideJustification: null,
    policyVersion: scoring.scoringPolicyVersion,
    overrideType: null,
    reviewNotes: null,
  };

  switch (scoring.decision.action) {
    case "FlagForManualReview":
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_ONBOARDING, contractId, choice: "FlagForManualReview", party: "verifier",
        argument: {
          riskScore: scoring.riskScore, riskLevel: scoring.riskLevel,
          agentVersion: scoring.scoringPolicyVersion, note: scoring.decision.note,
        },
      });
      break;
    case "Reject":
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_ONBOARDING, contractId, choice: "Reject", party: "verifier",
        argument: { ...commonArgs, autoDecided: true, reason: scoring.decision.reason },
      });
      break;
    case "Approve": {
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_ONBOARDING, contractId, choice: "Approve", party: "verifier",
        argument: { ...commonArgs, autoDecided: true },
      });

      // Phase D: auto-create the initial ComplianceReview — deterministic,
      // not agent-decided. create_contract always submits as vetify, which
      // is ComplianceReview's signatory, so no further authorization is needed.
      const business = payload.business as Record<string, unknown> | undefined;
      const kyc = payload.kyc as Record<string, unknown> | undefined;
      const complianceRef = `COM-${verificationRef.slice(4)}`;
      await invokeTool(cantonTools, "create_contract", {
        templateId: T_COMPLIANCE,
        payload: {
          borrower: payload.borrower,
          vetify: payload.vetify,
          verifier: payload.verifier,
          businessName: business?.name ?? "",
          cacRegNumber: kyc?.cacRegNumber ?? "",
          businessSector: business?.businessSector ?? "",
          businessActivity: business?.businessActivity ?? "",
          // incorporationDate is non-optional on ComplianceReview; business is always defined
          // here since this runs immediately after Approve succeeded on this same contract's
          // payload (no null-safe fallback exists for a required Date field).
          incorporationDate: business!.incorporationDate,
          verificationRef,
          complianceRef,
          status: "Pending",
          checks: null,
          agentScore: null,
          agentRisk: null,
          agentNote: null,
          agentVersion: null,
          createdAt: new Date().toISOString(),
          reviewStartedAt: null,
          compliancePolicyVersion: null,
          policySnapshot: null,
          createdBy: "Verifier scoring engine (auto, post-Approve)",
          shariahVerdict: null,
        },
      });
      break;
    }
  }

  await cantonMcp.close();
}

// ─── Stage 3: Compliance — evidence gathering only ─────────────────────────

const COMPLIANCE_EVIDENCE_PROMPT = `
${VERIFIER_PERSONA}

You are gathering Stage 3 AML/KYB/credit-history evidence for a ComplianceReview. You do NOT
decide whether to approve, reject, or flag it, and you have no tool access to exercise any
Canton choice — a deterministic scoring engine makes that decision from the evidence you
report, and a human closes out the final CDD judgment regardless of what you find.

Screen both the business entity and every director listed under business.director. Call:
1. aml_screen_business — the business name
2. aml_screen_individual — each director's full name
3. adverse_media_screen — the business name, type "all"
4. lookup_credit_history — the director's BVN and phone number
5. kyb_verify_business — cacRegNumber, registrationName, countryCode "NG"

Then reply with ONLY this JSON object (no text before or after it):
{
  "amlBusinessStatus": "clear" | "review_required" | "not_cleared",
  "amlDirectorStatus": "clear" | "review_required" | "not_cleared",
  "amlScreeningRef": string | null,
  "adverseMediaSummary": string,
  "creditHistory": "clean" | "minor_resolved" | "delinquent_or_default",
  "kybStatus": "active_full_match" | "active_minor_discrepancy" | "inactive_or_mismatch" | "not_found" | "struck_off_or_dissolved"
}
Report exactly what each tool returned — do not soften, round, or reinterpret any field.
`.trim();

function toAmlStatus(raw: unknown): "clear" | "review_required" | "not_cleared" {
  return raw === "clear" || raw === "review_required" || raw === "not_cleared" ? raw : "review_required";
}

function toKybStatus(raw: unknown): KybStatus {
  const known: KybStatus[] = ["active_full_match", "active_minor_discrepancy", "inactive_or_mismatch", "not_found", "struck_off_or_dissolved"];
  return known.includes(raw as KybStatus) ? (raw as KybStatus) : "not_found";
}

function toCreditHistory(raw: unknown): CreditHistoryResult {
  return raw === "clean" || raw === "minor_resolved" || raw === "delinquent_or_default" ? raw : "delinquent_or_default";
}

export async function runVerifierComplianceStage(contractId: string, contractPayload: unknown): Promise<void> {
  const payload = contractPayload as Record<string, unknown>;
  const shariahVerdict = ((payload.shariahVerdict as Record<string, unknown> | null)?.verdict ?? "REQUIRES_REVIEW") as ShariahVerdict;

  const cantonMcp = new MultiServerMCPClient({
    mcpServers: { canton: { command: "npm", args: ["run", "mcp:canton"] } },
  });
  const cantonTools = (await cantonMcp.getTools()) as unknown as McpTool[];

  // StartReview always runs first, deterministically — Pending → UnderReview.
  await invokeTool(cantonTools, "exercise_choice", {
    templateId: T_COMPLIANCE, contractId, choice: "StartReview", party: "vetify", argument: {},
  });

  // CompliancePolicy carries the scoring weights ops can retune without a
  // code deploy; fall back to the built-in defaults if none is active.
  const policyPayload = await fetchActivePolicyPayload(cantonTools, T_COMPLIANCE_POLICY);
  // See numifyWeights's doc comment (scoring/types.ts) — Daml Int fields arrive as JSON
  // strings from the ledger; this converts them to real numbers before they're summed.
  const weights = policyPayload?.scoringWeights
    ? numifyWeights<ComplianceScoringWeights>(policyPayload.scoringWeights as Record<string, unknown>)
    : DEFAULT_COMPLIANCE_WEIGHTS;
  const policyVersion = (policyPayload?.policyVersion as string | undefined) ?? DEFAULT_COMPLIANCE_POLICY_VERSION;

  // Evidence-gathering agent: mono.co + youverify tools only, no canton access.
  const evidenceMcp = new MultiServerMCPClient({
    mcpServers: {
      mono:      { command: "npm", args: ["run", "mcp:mono"] },
      youverify: { command: "npm", args: ["run", "mcp:youverify"] },
    },
  });
  const evidenceTools = await evidenceMcp.getTools();
  const evidenceAgent = createDeepAgent({
    model: buildModel(),
    tools: evidenceTools,
    systemPrompt: COMPLIANCE_EVIDENCE_PROMPT,
    backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
    skills: ["skills/verifier"],
    checkpointer: new MemorySaver(),
  });

  const task = `
Gather Stage 3 compliance evidence for the following ComplianceReview contract.

Contract ID: ${contractId}
Payload: ${JSON.stringify(contractPayload, null, 2)}
  `.trim();

  const result = await evidenceAgent.invoke({ messages: [{ role: "user", content: task }] });
  await evidenceMcp.close();
  const lastMessage = result.messages[result.messages.length - 1];
  const evidence = extractJson(lastMessage.content);

  const aml: AmlEvidence = {
    businessStatus: toAmlStatus(evidence.amlBusinessStatus),
    directorStatus: toAmlStatus(evidence.amlDirectorStatus),
  };
  const kyb: KybEvidence = { status: toKybStatus(evidence.kybStatus) };
  const creditHistory = toCreditHistory(evidence.creditHistory);

  const incorporationDate = (contractPayload as Record<string, unknown>)["incorporationDate"] as string | undefined;
  const age = incorporationDate ? { incorporationDate } : undefined;
  const scoring = scoreCompliance(shariahVerdict, aml, kyb, creditHistory, age, weights, policyVersion);

  const amlEvidence = {
    amlScreeningRef: evidence.amlScreeningRef ?? null,
    sanctionsCheckRef: null,
    pepCheckRef: null,
    adverseMediaRef: null,
    shariahScreeningRef: null,
    sanctionsListVersion: null,
    sanctionsListDate: null,
  };
  const commonArgs = {
    completedChecks: scoring.checks,
    reviewerParty: null,
    reviewedBy: null,
    agentVersion: scoring.scoringPolicyVersion,
    aiMetadata: null,
    overrideJustification: null,
    reviewNotes: evidence.adverseMediaSummary ? `Adverse media: ${evidence.adverseMediaSummary}` : null,
    overrideType: null,
    amlEvidence,
    complianceDocuments: [],
    shariahAssessment: null,
  };

  switch (scoring.decision.action) {
    case "FlagComplianceForManualReview":
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_COMPLIANCE, contractId, choice: "FlagComplianceForManualReview", party: "vetify",
        argument: {
          riskScore: scoring.quantifiableScore, riskLevel: quantifiableRiskLevel(scoring.quantifiableScore),
          agentVersion: scoring.scoringPolicyVersion, note: scoring.decision.note,
        },
      });
      break;
    case "RejectCompliance":
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_COMPLIANCE, contractId, choice: "RejectCompliance", party: "verifier",
        argument: {
          ...commonArgs, autoDecided: true, reason: scoring.decision.reason,
          riskScore: scoring.quantifiableScore, riskLevel: quantifiableRiskLevel(scoring.quantifiableScore),
        },
      });
      break;
    case "ApproveCompliance":
      // Structurally unreachable: scoreCompliance never returns this action
      // (see its doc comment) — the qualitative CDD judgment always requires
      // a human. Guard against a future scorer regression silently approving.
      throw new Error("scoreCompliance returned ApproveCompliance — this should never happen without human sign-off");
  }

  await cantonMcp.close();
}
