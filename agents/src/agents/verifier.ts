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
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { MemorySaver } from "@langchain/langgraph";
import { type McpTool, invokeTool, buildModel, extractJsonObject, parseEvidence, fenceUntrusted, UNTRUSTED_DATA_GUIDANCE, withLlmResilience, withPolicyCache, checkpointConfig } from "./util.js";
import { VerificationEvidenceSchema, ComplianceEvidenceSchema, ProviderEvidenceSchema } from "./evidence-schemas.js";
import { scoreVerification } from "../scoring/verification.js";
import { scoreCompliance } from "../scoring/compliance.js";
import { scoreProviderVerification } from "../scoring/provider-verification.js";
import {
  DEFAULT_COMPLIANCE_POLICY_VERSION,
  DEFAULT_COMPLIANCE_WEIGHTS,
  DEFAULT_VERIFICATION_POLICY_VERSION,
  DEFAULT_VERIFICATION_WEIGHTS,
  DEFAULT_PROVIDER_VERIFICATION_POLICY_VERSION,
  DEFAULT_PROVIDER_VERIFICATION_WEIGHTS,
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
  ProviderType,
  ProviderVerificationScoringWeights,
  TinResult,
  VerificationScoringWeights,
} from "../scoring/types.js";
import type { ShariahVerdict } from "../scoring/shariah-policy.js";
import { validateAgentsConfig } from "../config.js";

const T_ONBOARDING = "Vetify.Onboarding:BusinessOnboarding";
const T_COMPLIANCE = "Vetify.Compliance:ComplianceReview";
const T_VERIFICATION_POLICY = "Vetify.Onboarding:VerificationPolicy";
const T_COMPLIANCE_POLICY = "Vetify.Compliance:CompliancePolicy";
const T_PROVIDER_ONBOARDING = "Vetify.FinancingProvider:FinancingProviderOnboarding";
const T_PROVIDER_VERIFICATION_POLICY = "Vetify.FinancingProvider:ProviderVerificationPolicy";
// ComplianceReview needs advisor for observer visibility (so the independent
// Shariah advisor party can see and later act on this contract), but unlike
// business/vetify/verifier there's no upstream contract field to copy it from
// (BusinessOnboarding has no advisor field) — sourced from the validated
// config module (G7): the previous `?? ""` fallback created a ComplianceReview
// with an empty-string party and only failed deep inside the ledger call.
const ADVISOR_PARTY_ID = validateAgentsConfig().advisorPartyId;

const VERIFIER_PERSONA = `
You are the Verifier Agent for Vetify, an AI-powered non-interest financing platform.
`.trim();





/** VerificationPolicy/CompliancePolicy have no observer clause — only vetify (their
 * signatory) can see them, so this always queries as party "vetify", regardless of which
 * party the caller otherwise acts as. Returns undefined if no policy is active — callers
 * fall back to the built-in DEFAULT_* weights/version, same as the Daml choices themselves
 * already fall back when the caller supplies `policyCid = null`.
 *
 * Returns the ContractId alongside the payload (not just the payload) because SDK 3.4.11 /
 * Daml-LF 2.1/2.2 has no contract keys — StartReview/EscalateOverdue/Approve/Reject/
 * FlagComplianceForManualReview/RecordProviderScore/RejectProvider can no longer resolve
 * their active policy via lookupByKey and now take its ContractId as an explicit argument. */
async function fetchActivePolicy(tools: McpTool[], templateId: string): Promise<{ contractId: string; payload: Record<string, unknown> } | undefined> {
  return withPolicyCache(templateId, async () => {
    const raw = await invokeTool(tools, "get_active_contracts", { templateId, party: "vetify" });
    const parsed = extractJsonObject(raw) as { result?: Array<{ contractId: string; payload: Record<string, unknown> }> };
    return parsed.result?.[0];
  });
}

/** Resolves the AuthorizedReviewer ContractId for `(vetify, verifierParty)` — no contract
 * keys on SDK 3.4.11 / Daml-LF 2.1/2.2, so ApproveCompliance/RejectCompliance can no longer
 * resolve it themselves via lookupByKey. Not cached (unlike fetchActivePolicy): registry
 * membership changes are rarer still than policy changes, but the read is cheap and this
 * avoids a second cache-key namespace for a lookup this infrequent. */
async function fetchAuthorizedReviewerCid(tools: McpTool[], verifierParty: string): Promise<string | null> {
  const raw = await invokeTool(tools, "get_active_contracts", { templateId: "Vetify.Compliance:AuthorizedReviewer", party: "vetify" });
  const parsed = extractJsonObject(raw) as { result?: Array<{ contractId: string; payload: Record<string, unknown> }> };
  return parsed.result?.find((r) => r.payload.verifier === verifierParty)?.contractId ?? null;
}

/** quantifiableScore's 80-point ceiling is a different scale from the full 100-point CDD
 * framework, but Compliance.daml's choices still require a self-consistent (riskScore,
 * riskLevel) pair — this reuses the same band thresholds purely to satisfy that assertion. */
function quantifiableRiskLevel(score: number): "Low" | "Medium" | "High" {
  if (score >= 80) return "Low";
  if (score >= 50) return "Medium";
  return "High";
}

// ─── Stage 0: Financing Provider Registration — evidence gathering only ────
// Reuses this module's own mono `lookup_cac` tool + toCacResult converter —
// genuinely the same CAC check as Stage 2, just against a provider's own
// registration instead of a business director's. Dispatched by the Supervisor
// when a FinancingProviderOnboarding reaches UnderReview; runs as this same
// evidence-only agent shape (no exercise_choice/create_contract tool access),
// but the resulting Daml choices (RecordProviderScore/FlagProviderForManualReview/
// RejectProvider) are all controller `vetify` alone — not `verifier`, since
// verifier has no authority over Stage 0 — so the Supervisor exercises them as
// vetify, independent of which agent module gathered the evidence.

const PROVIDER_EVIDENCE_PROMPT = `
${VERIFIER_PERSONA}

You are gathering Stage 0 registration evidence for a FinancingProviderOnboarding
application. You do NOT decide whether to approve, reject, or flag it, and you have no
tool access to do so — a deterministic scoring engine makes that decision from the
evidence you report.

Call:
1. lookup_cac — the provider's own CAC registration number

Then reply with ONLY this JSON object (no text before or after it):
{
  "cac": { "found": boolean, "status": "Active" | "Inactive" | "Struck Off" | "Pending", "nameMatch": "exact" | "close" | "mismatch" } | { "error": true, "httpStatus": number }
}
Report exactly what the tool returned — do not soften, round, or reinterpret any field.
`.trim() + "\n\n" + UNTRUSTED_DATA_GUIDANCE;

export async function runVerifierProviderStage(contractId: string, contractPayload: unknown): Promise<void> {
  const payload = contractPayload as Record<string, unknown>;

  // Each MultiServerMCPClient spawns real child processes (npm run mcp:* -> node),
  // so .close() must run even when the code between creation and the previous
  // sequential close() call throws — otherwise the process tree leaks. Confirmed
  // live: a single failing contract, redispatched every ~10s by the Supervisor
  // with no backoff, leaked 20+ orphaned process trees in under 15 minutes and
  // starved the whole poll loop of resources.
  const evidence = await (async () => {
    const evidenceMcp = new MultiServerMCPClient({
      mcpServers: { mono: { command: "npm", args: ["run", "mcp:mono"] } },
    });
    try {
      const evidenceTools = await evidenceMcp.getTools();
      const evidenceAgent = createDeepAgent({
        model: buildModel(),
        tools: evidenceTools,
        systemPrompt: PROVIDER_EVIDENCE_PROMPT,
        backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
        skills: ["skills/verifier"],
        checkpointer: new MemorySaver(),
      });

      const task = `
Gather Stage 0 registration evidence for the following FinancingProviderOnboarding.

Contract ID: ${contractId}
CAC registration number to look up: ${String(payload.cacRegNumber ?? "")}
${fenceUntrusted("canton-contract-payload", contractPayload)}
      `.trim();

      const result = await withLlmResilience("Verifier provider evidence", () => evidenceAgent.invoke({ messages: [{ role: "user", content: task }] }, checkpointConfig()));
      const lastMessage = result.messages[result.messages.length - 1];
      return parseEvidence(lastMessage.content, ProviderEvidenceSchema, "Verifier Agent (provider)");
    } finally {
      await evidenceMcp.close();
    }
  })();

  const cantonMcp = new MultiServerMCPClient({
    mcpServers: { canton: { command: "npm", args: ["run", "mcp:canton"] } },
  });
  try {
    const cantonTools = (await cantonMcp.getTools()) as unknown as McpTool[];

    const activePolicy = await fetchActivePolicy(cantonTools, T_PROVIDER_VERIFICATION_POLICY);
    const weights = activePolicy?.payload.scoringWeights
      ? numifyWeights<ProviderVerificationScoringWeights>(activePolicy.payload.scoringWeights as Record<string, unknown>)
      : DEFAULT_PROVIDER_VERIFICATION_WEIGHTS;
    const policyVersion = (activePolicy?.payload.policyVersion as string | undefined) ?? DEFAULT_PROVIDER_VERIFICATION_POLICY_VERSION;
    // No contract keys on SDK 3.4.11 / Daml-LF 2.1/2.2 — RecordProviderScore/RejectProvider
    // now take the active policy's ContractId explicitly instead of resolving it via lookupByKey.
    const policyCid = activePolicy?.contractId ?? null;

    const scoring = scoreProviderVerification(
      toCacResult(evidence.cac),
      payload.providerType as ProviderType,
      (payload.regulatoryBody as string | null) ?? null,
      (payload.licenseNumber as string | null) ?? null,
      weights,
      policyVersion,
    );

    switch (scoring.decision.action) {
      case "FlagForManualReview":
        await invokeTool(cantonTools, "exercise_choice", {
          templateId: T_PROVIDER_ONBOARDING, contractId, choice: "FlagProviderForManualReview", party: "vetify",
          argument: {
            score: scoring.riskScore, risk: scoring.riskLevel,
            note: scoring.decision.note, version: scoring.scoringPolicyVersion,
          },
        });
        break;
      case "Reject":
        await invokeTool(cantonTools, "exercise_choice", {
          templateId: T_PROVIDER_ONBOARDING, contractId, choice: "RejectProvider", party: "vetify",
          argument: {
            reason: scoring.decision.reason,
            agentScore: scoring.riskScore, agentRisk: scoring.riskLevel, agentVersion: scoring.scoringPolicyVersion,
            policyCid,
          },
        });
        break;
      case "RecordScore":
        await invokeTool(cantonTools, "exercise_choice", {
          templateId: T_PROVIDER_ONBOARDING, contractId, choice: "RecordProviderScore", party: "vetify",
          argument: {
            score: scoring.riskScore, risk: scoring.riskLevel,
            note: null, version: scoring.scoringPolicyVersion,
            policyCid,
          },
        });
        break;
    }
  } finally {
    await cantonMcp.close();
  }
}

// ─── Stage 2: Verification — evidence gathering only ───────────────────────

const VERIFICATION_EVIDENCE_PROMPT = `
${VERIFIER_PERSONA}

You are gathering Stage 2 identity/KYC evidence for a BusinessOnboarding application. You do
NOT decide whether to approve, reject, or flag it, and you have no tool access to do so — a
deterministic scoring engine makes that decision from the evidence you report.

Call, in order:
1. lookup_mashup — the director's NIN and BVN
2. lookup_cac — the CAC registration number
3. lookup_tin — the tax ID, with channel "cac"

Then reply with ONLY this JSON object (no text before or after it):
{
  "mashup": { "ninVerified": boolean, "bvnVerified": boolean, "nameMatch": boolean } | { "error": true, "httpStatus": number },
  "cac": { "found": boolean, "status": "Active" | "Inactive" | "Struck Off" | "Pending", "nameMatch": "exact" | "close" | "mismatch" } | { "error": true, "httpStatus": number },
  "tin": { "outcome": "verifiedMatchesCac" | "verifiedDifferentEntity" | "notFound" } | { "error": true, "httpStatus": number }
}
Report exactly what each tool returned — do not soften, round, or reinterpret any field.
`.trim() + "\n\n" + UNTRUSTED_DATA_GUIDANCE;

function toMashupResult(raw: unknown): MashupResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.error) return { kind: "error", httpStatus: Number(r.httpStatus ?? 0) };
  return {
    kind: "ok",
    data: {
      ninVerified: !!r.ninVerified,
      bvnVerified: !!r.bvnVerified,
      // Fail closed on a missing/falsy value — an unclear cross-check reads as a
      // mismatch, not a pass, same principle as every other evidence coercion here.
      nameMatch: !!r.nameMatch,
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

  // Both MCP clients are tracked here and closed in the outer finally below —
  // each spawns real child processes (npm run mcp:* -> node), so .close() must
  // run even when the code in between throws, or the process tree leaks (see
  // runVerifierProviderStage's comment for the live-confirmed blast radius).
  let evidenceMcp: MultiServerMCPClient | undefined;
  let cantonMcp: MultiServerMCPClient | undefined;
  try {
  // Evidence-gathering agent: mono.co tools only. It cannot reach the Canton
  // MCP server at all, so it is architecturally incapable of exercising any
  // choice, not merely instructed not to.
  evidenceMcp = new MultiServerMCPClient({
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
${fenceUntrusted("canton-contract-payload", contractPayload)}
  `.trim();

  const result = await withLlmResilience("Verifier evidence", () => evidenceAgent.invoke({ messages: [{ role: "user", content: task }] }, checkpointConfig()));
  await evidenceMcp.close();
  evidenceMcp = undefined;
  const lastMessage = result.messages[result.messages.length - 1];
  // Schema-validated (G3/G13): malformed evidence throws here — fails closed,
  // no decision reaches the ledger on unvalidated shapes.
  const evidence = parseEvidence(lastMessage.content, VerificationEvidenceSchema, "Verifier Agent (verification)");

  // Deterministic decision execution from here — no LLM involved. A single
  // canton client is reused for the policy fetch and the choice exercise.
  cantonMcp = new MultiServerMCPClient({
    mcpServers: { canton: { command: "npm", args: ["run", "mcp:canton"] } },
  });
  const cantonTools = (await cantonMcp.getTools()) as unknown as McpTool[];

  // VerificationPolicy carries the scoring weights ops can retune without a
  // code deploy; fall back to the built-in defaults if none is active, same
  // as the Daml choices themselves already do for policyVersion/thresholds.
  const activePolicy = await fetchActivePolicy(cantonTools, T_VERIFICATION_POLICY);
  // Daml Int fields arrive as JSON strings from the ledger — numifyWeights converts them to
  // real numbers before they're summed (see its doc comment in scoring/types.ts for the bug
  // this closes: string-concatenation instead of addition once a real policy is active).
  const weights = activePolicy?.payload.scoringWeights
    ? numifyWeights<VerificationScoringWeights>(activePolicy.payload.scoringWeights as Record<string, unknown>)
    : DEFAULT_VERIFICATION_WEIGHTS;
  const policyVersion = (activePolicy?.payload.policyVersion as string | undefined) ?? DEFAULT_VERIFICATION_POLICY_VERSION;
  // No contract keys on SDK 3.4.11 / Daml-LF 2.1/2.2 — Approve/Reject now take the active
  // policy's ContractId explicitly instead of resolving it via lookupByKey.
  const policyCid = activePolicy?.contractId ?? null;

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
    policyCid,
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
      // Dual controller (verifier, vetify) — vetify's signature is required for
      // Approve/Reject's VerificationPolicy lookupByKey (see Onboarding.daml).
      // A single-party actAs here was a latent gap: it would fail against a
      // real, authorization-enforcing ledger regardless of JWT/auth mode.
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_ONBOARDING, contractId, choice: "Reject", party: ["verifier", "vetify"],
        argument: { ...commonArgs, autoDecided: true, reason: scoring.decision.reason },
      });
      break;
    case "Approve": {
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_ONBOARDING, contractId, choice: "Approve", party: ["verifier", "vetify"],
        argument: { ...commonArgs, autoDecided: true },
      });

      // Phase D: auto-create the initial ComplianceReview — deterministic,
      // not agent-decided. create_contract always submits as vetify, which
      // is ComplianceReview's signatory, so no further authorization is needed.
      const profile = payload.profile as Record<string, unknown> | undefined;
      const kyc = payload.kyc as Record<string, unknown> | undefined;
      const complianceRef = `COM-${verificationRef.slice(4)}`;
      await invokeTool(cantonTools, "create_contract", {
        templateId: T_COMPLIANCE,
        payload: {
          business: payload.business,
          vetify: payload.vetify,
          verifier: payload.verifier,
          businessName: profile?.name ?? "",
          cacRegNumber: kyc?.cacRegNumber ?? "",
          businessSector: profile?.businessSector ?? "",
          businessActivity: profile?.businessActivity ?? "",
          // incorporationDate is non-optional on ComplianceReview; profile is always defined
          // here since this runs immediately after Approve succeeded on this same contract's
          // payload (no null-safe fallback exists for a required Date field).
          incorporationDate: profile!.incorporationDate,
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
          advisor: ADVISOR_PARTY_ID,
        },
      });
      break;
    }
  }
  } finally {
    if (evidenceMcp) await (evidenceMcp as MultiServerMCPClient).close().catch(() => {});
    if (cantonMcp) await cantonMcp.close().catch(() => {});
  }
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
  "sanctionsCheckRef": string | null,
  "pepCheckRef": string | null,
  "adverseMediaRef": string | null,
  "pepHit": boolean,
  "adverseMediaSummary": string,
  "creditHistory": "clean" | "minor_resolved" | "delinquent_or_default",
  "kybStatus": "active_full_match" | "active_minor_discrepancy" | "inactive_or_mismatch" | "not_found" | "struck_off_or_dissolved"
}
Report exactly what each tool returned — do not soften, round, or reinterpret any field.
sanctionsCheckRef/pepCheckRef/adverseMediaRef are each tool response's own verification/reference
ID (e.g. a "verificationId" or "reference" field) — report null if the response doesn't include
one; never invent one. Set pepHit true only if either aml_screen_business or aml_screen_individual
returned status "review_required" AND its categoryCount shows a pep match with no sanctions match
(a PEP-only hit) — this is distinct from a sanctions hit, which should already lean toward reject.
`.trim() + "\n\n" + UNTRUSTED_DATA_GUIDANCE;

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

  // Both MCP clients are tracked here and closed in the outer finally below —
  // each spawns real child processes (npm run mcp:* -> node), so .close() must
  // run even when the code in between throws, or the process tree leaks (see
  // runVerifierProviderStage's comment for the live-confirmed blast radius).
  let cantonMcp: MultiServerMCPClient | undefined;
  let evidenceMcp: MultiServerMCPClient | undefined;
  try {
  cantonMcp = new MultiServerMCPClient({
    mcpServers: { canton: { command: "npm", args: ["run", "mcp:canton"] } },
  });
  const cantonTools = (await cantonMcp.getTools()) as unknown as McpTool[];

  // CompliancePolicy carries the scoring weights ops can retune without a
  // code deploy; fall back to the built-in defaults if none is active.
  // Fetched before StartReview (reordered from the SDK 3.5.1 version) since
  // StartReview itself now needs the ContractId — no contract keys on
  // SDK 3.4.11 / Daml-LF 2.1/2.2, so it can no longer resolve it via lookupByKey.
  const activePolicy = await fetchActivePolicy(cantonTools, T_COMPLIANCE_POLICY);
  // See numifyWeights's doc comment (scoring/types.ts) — Daml Int fields arrive as JSON
  // strings from the ledger; this converts them to real numbers before they're summed.
  const weights = activePolicy?.payload.scoringWeights
    ? numifyWeights<ComplianceScoringWeights>(activePolicy.payload.scoringWeights as Record<string, unknown>)
    : DEFAULT_COMPLIANCE_WEIGHTS;
  const policyVersion = (activePolicy?.payload.policyVersion as string | undefined) ?? DEFAULT_COMPLIANCE_POLICY_VERSION;
  const policyCid = activePolicy?.contractId ?? null;

  // StartReview only applies once (its own Daml guard asserts status == Pending) —
  // skip it on a retry dispatch, i.e. a contract already in UnderReview because a
  // prior attempt got this far but failed later (evidence-schema validation, LLM
  // timeout). Without this guard, retrying a partially-failed review would throw
  // "Can only start a Pending review" every time instead of ever reaching the
  // evidence-gathering step again (see supervisor.ts's dispatch condition for the
  // matching fix — a status this permanently stuck used to never get redispatched
  // at all).
  if (payload.status === "Pending") {
    await invokeTool(cantonTools, "exercise_choice", {
      templateId: T_COMPLIANCE, contractId, choice: "StartReview", party: "vetify", argument: { policyCid },
    });
  }

  // Evidence-gathering agent: mono.co + youverify tools only, no canton access.
  evidenceMcp = new MultiServerMCPClient({
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
${fenceUntrusted("canton-contract-payload", contractPayload)}
  `.trim();

  const result = await withLlmResilience("Verifier evidence", () => evidenceAgent.invoke({ messages: [{ role: "user", content: task }] }, checkpointConfig()));
  await evidenceMcp.close();
  evidenceMcp = undefined;
  const lastMessage = result.messages[result.messages.length - 1];
  // Schema-validated (G3/G13): malformed evidence throws here — fails closed,
  // no decision reaches the ledger on unvalidated shapes.
  const evidence = parseEvidence(lastMessage.content, ComplianceEvidenceSchema, "Verifier Agent (compliance)");

  const aml: AmlEvidence = {
    businessStatus: toAmlStatus(evidence.amlBusinessStatus),
    directorStatus: toAmlStatus(evidence.amlDirectorStatus),
  };
  const kyb: KybEvidence = { status: toKybStatus(evidence.kybStatus) };
  const creditHistory = toCreditHistory(evidence.creditHistory);

  const incorporationDate = (contractPayload as Record<string, unknown>)["incorporationDate"] as string | undefined;
  const age = incorporationDate ? { incorporationDate } : undefined;
  const scoring = scoreCompliance(shariahVerdict, aml, kyb, creditHistory, age, weights, policyVersion);

  // G14: sanctionsListVersion/sanctionsListDate previously always null (schema
  // existed, never populated — "Gap 10" in name only). Youverify's API doesn't
  // expose an incrementing "list version" (per the aml-decision-guide's
  // Database Coverage section — a fixed set of watchlists, not a versioned
  // snapshot), so rather than fabricate a fake version string, this records
  // the two things that ARE real: the fixed coverage the screening actually
  // ran against, and the actual date it ran — exactly what an examiner needs
  // to reconstruct "what was checked, and when".
  const screenedAt = new Date();
  const amlEvidence = {
    amlScreeningRef: evidence.amlScreeningRef ?? null,
    sanctionsCheckRef: evidence.sanctionsCheckRef ?? null,
    pepCheckRef: evidence.pepCheckRef ?? null,
    adverseMediaRef: evidence.adverseMediaRef ?? null,
    shariahScreeningRef: null,
    sanctionsListVersion: "Youverify AML/PEP/Sanctions — OFAC, UN, EU, HMT, NFIU, Interpol consolidated",
    sanctionsListDate: screenedAt.toISOString().slice(0, 10),
    // No structured data source exists for these yet (same principle as Stage
    // 6's PD/LGD/EAD and Stage 3's CDD purpose-coherence factor — never
    // fabricate a value for a factor with no real source).
    apiResponseHash: null,
    beneficialOwnershipRef: null,
    sourceOfFundsRef: null,
    amlRiskScore: null,
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
          policyCid,
        },
      });
      // G14: a PEP hit gets a structured EDD case, distinct from the generic
      // ManualReview queue every other ambiguous case lands in — CBN NIFI/
      // AAOIFI expect documented source-of-wealth verification and senior-
      // management sign-off for a PEP relationship, not just a review note.
      if (evidence.pepHit) {
        await invokeTool(cantonTools, "exercise_choice", {
          templateId: T_COMPLIANCE, contractId, choice: "OpenEddCase", party: "vetify",
          argument: { triggerReason: "PEP_HIT" },
        });
      }
      break;
    case "RejectCompliance": {
      // No contract keys on SDK 3.4.11 / Daml-LF 2.1/2.2 — RejectCompliance now takes the
      // AuthorizedReviewer's ContractId explicitly instead of resolving it via lookupByKey.
      const reviewerAuthCid = await fetchAuthorizedReviewerCid(cantonTools, payload.verifier as string);
      if (!reviewerAuthCid) {
        throw new Error(`verifier ${String(payload.verifier)} is not in the authorized reviewer registry`);
      }
      await invokeTool(cantonTools, "exercise_choice", {
        templateId: T_COMPLIANCE, contractId, choice: "RejectCompliance", party: "verifier",
        argument: {
          ...commonArgs, autoDecided: true, reason: scoring.decision.reason,
          riskScore: scoring.quantifiableScore, riskLevel: quantifiableRiskLevel(scoring.quantifiableScore),
          reviewerAuthCid,
        },
      });
      break;
    }
    case "ApproveCompliance":
      // Structurally unreachable: scoreCompliance never returns this action
      // (see its doc comment) — the qualitative CDD judgment always requires
      // a human. Guard against a future scorer regression silently approving.
      throw new Error("scoreCompliance returned ApproveCompliance — this should never happen without human sign-off");
  }
  } finally {
    if (cantonMcp) await (cantonMcp as MultiServerMCPClient).close().catch(() => {});
    if (evidenceMcp) await (evidenceMcp as MultiServerMCPClient).close().catch(() => {});
  }
}
