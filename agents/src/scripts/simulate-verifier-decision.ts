/**
 * Dev-only utility: drives a BusinessOnboarding through Stage 2 (Verification)
 * and Stage 3 (Compliance) using the REAL deterministic scoring engines
 * (../scoring/verification.ts, ../scoring/compliance.ts) against hand-built
 * evidence objects — no mono.co/Youverify API keys and no LLM needed at all.
 * Mirrors agents/src/agents/verifier.ts's exact choice-argument shapes
 * (including the post-Approve ComplianceReview auto-creation) so the ledger
 * ends up in the same state a real Verifier Agent run would leave it in.
 *
 * `scoreCompliance` never returns ApproveCompliance by design (a human must
 * make that qualitative CDD call — see compliance.ts's doc comment), so
 * `--compliance approve` bypasses the scorer entirely and exercises
 * ApproveCompliance directly with fabricated-clean arguments, standing in
 * for that manual sign-off rather than simulating the (nonexistent)
 * auto-approve path.
 *
 * Usage:
 *   npx tsx src/scripts/simulate-verifier-decision.ts \
 *     [--onboarding <contractId>] [--risk low|medium|high] \
 *     [--compliance flag|reject|approve] [--skip-compliance]
 *
 * Omit --onboarding to auto-pick the first BusinessOnboarding with
 * status=UnderReview found on the ledger.
 */
import "dotenv/config";
import {
  queryActiveContracts,
  exerciseLedgerChoice,
  createLedgerContract,
  partyId,
} from "../mcp/canton-client.js";
import { scoreVerification } from "../scoring/verification.js";
import { scoreCompliance } from "../scoring/compliance.js";
import type {
  MashupResult, CacResult, TinResult,
  AmlEvidence, KybEvidence, CreditHistoryResult,
} from "../scoring/types.js";

const T_ONBOARDING = "Vetify.Onboarding:BusinessOnboarding";
const T_COMPLIANCE = "Vetify.Compliance:ComplianceReview";

// ─── CLI args ────────────────────────────────────────────────────────────────

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

const onboardingArg = argValue("--onboarding");
const riskPreset = (argValue("--risk") ?? "low") as "low" | "medium" | "high";
const complianceOutcome = (argValue("--compliance") ?? "flag") as "flag" | "reject" | "approve";
const skipCompliance = process.argv.includes("--skip-compliance");

// ─── Canned Stage 2 evidence, one per Model-C risk band ────────────────────

const VERIFICATION_PRESETS: Record<string, { mashup: MashupResult; cac: CacResult; tin: TinResult }> = {
  low: {
    mashup: { kind: "ok", data: { ninVerified: true, bvnVerified: true, nameMatch: true } },
    cac: { kind: "ok", data: { found: true, status: "Active", nameMatch: "exact" } },
    tin: { kind: "verifiedMatchesCac" },
  },
  medium: {
    // Identity fully verified, CAC only Pending, TIN not found — 40 + 20 + 5 = 65,
    // lands in the Medium score band without tripping the eitherFailed hard-flag branch.
    mashup: { kind: "ok", data: { ninVerified: true, bvnVerified: true, nameMatch: true } },
    cac: { kind: "ok", data: { found: true, status: "Pending", nameMatch: "close" } },
    tin: { kind: "notFound" },
  },
  high: {
    mashup: { kind: "error", httpStatus: 404 },
    cac: { kind: "ok", data: { found: false, status: "Struck Off", nameMatch: "mismatch" } },
    tin: { kind: "notFound" },
  },
};

// ─── Canned Stage 3 evidence ────────────────────────────────────────────────

const COMPLIANCE_PRESETS: Record<string, { aml: AmlEvidence; kyb: KybEvidence; credit: CreditHistoryResult }> = {
  flag: {
    aml: { businessStatus: "clear", directorStatus: "clear" },
    kyb: { status: "active_full_match" },
    credit: "clean",
  },
  reject: {
    aml: { businessStatus: "not_cleared", directorStatus: "clear" },
    kyb: { status: "active_full_match" },
    credit: "clean",
  },
};

async function findUnderReviewOnboarding(): Promise<{ contractId: string; payload: Record<string, unknown> }> {
  const results = await queryActiveContracts(T_ONBOARDING, "vetify");
  const match = results.find((r) => (r.payload as Record<string, unknown>).status === "UnderReview");
  if (!match) {
    throw new Error(
      "No BusinessOnboarding with status=UnderReview found. Submit one via " +
      "POST /api/onboarding/:contractId/submit first, or pass --onboarding <contractId>.",
    );
  }
  return match as { contractId: string; payload: Record<string, unknown> };
}

async function main() {
  const onboarding = onboardingArg
    ? { contractId: onboardingArg, payload: (await queryActiveContracts(T_ONBOARDING, "vetify")).find((r) => r.contractId === onboardingArg)?.payload as Record<string, unknown> }
    : await findUnderReviewOnboarding();

  if (!onboarding.payload) throw new Error(`No BusinessOnboarding found with contractId ${onboardingArg}`);
  const { contractId, payload } = onboarding;
  console.log(`Stage 2: scoring BusinessOnboarding ${contractId} against the "${riskPreset}" preset...`);

  const preset = VERIFICATION_PRESETS[riskPreset];
  const scoring = scoreVerification(preset.mashup, preset.cac, preset.tin);
  console.log(`  → riskScore=${scoring.riskScore} riskLevel=${scoring.riskLevel} action=${scoring.decision.action}`);

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
      await exerciseLedgerChoice(T_ONBOARDING, contractId, "FlagForManualReview", {
        riskScore: scoring.riskScore, riskLevel: scoring.riskLevel,
        agentVersion: scoring.scoringPolicyVersion, note: scoring.decision.note,
      }, "verifier");
      console.log("  → FlagForManualReview exercised. Stop here — a human must approve/reject from ManualReview.");
      return;
    case "Reject":
      await exerciseLedgerChoice(T_ONBOARDING, contractId, "Reject", {
        ...commonArgs, autoDecided: true, reason: scoring.decision.reason,
      }, ["verifier", "vetify"]);
      console.log("  → Reject exercised. No ComplianceReview is created on rejection.");
      return;
    case "Approve": {
      await exerciseLedgerChoice(T_ONBOARDING, contractId, "Approve", {
        ...commonArgs, autoDecided: true,
      }, ["verifier", "vetify"]);
      console.log("  → Approve exercised.");

      const profile = payload.profile as Record<string, unknown>;
      const kyc = payload.kyc as Record<string, unknown>;
      const complianceRef = `COM-${verificationRef.slice(4)}`;
      const { contractId: complianceId } = await createLedgerContract(T_COMPLIANCE, {
        business: payload.business,
        vetify: payload.vetify,
        verifier: payload.verifier,
        businessName: profile.name ?? "",
        cacRegNumber: kyc.cacRegNumber ?? "",
        businessSector: profile.businessSector ?? "",
        businessActivity: profile.businessActivity ?? "",
        incorporationDate: profile.incorporationDate,
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
        createdBy: "simulate-verifier-decision.ts (dev script, not the real agent)",
        shariahVerdict: null,
        advisor: partyId("advisor"),
      }, "vetify");
      console.log(`  → ComplianceReview created: ${complianceId}`);

      if (skipCompliance) return;
      await runStage3(complianceId);
    }
  }
}

async function runStage3(pendingContractId: string) {
  console.log(`\nStage 3: scoring ComplianceReview ${pendingContractId} (compliance outcome: ${complianceOutcome})...`);

  // StartReview is a CONSUMING choice (archives Pending, recreates as
  // UnderReview with the same key but a NEW contract ID — same pattern as
  // Onboarding.daml's SubmitForReview) — every choice after this one must
  // target the ID this call returns, not the Pending one passed in.
  const { contractId } = await exerciseLedgerChoice(T_COMPLIANCE, pendingContractId, "StartReview", {}, "vetify");
  if (!contractId) throw new Error("StartReview did not return a new contract ID");

  if (complianceOutcome === "approve") {
    // scoreCompliance can never return this action (see compliance.ts) — this
    // stands in for the human sign-off the real system always requires here.
    await exerciseLedgerChoice(T_COMPLIANCE, contractId, "ApproveCompliance", {
      completedChecks: { shariahCompliant: true, amlCleared: true, kycValidated: true, cddCompleted: true },
      riskScore: 95,
      riskLevel: "Low",
      autoDecided: false,
      // Human decisions require a non-null reviewerParty (Compliance.daml's
      // ApproveCompliance assertion) — the verifier party stands in for
      // "a human officer approved this", same as reviewedBy below.
      reviewerParty: partyId("verifier"),
      reviewedBy: "simulate-verifier-decision.ts (manual sign-off stand-in)",
      agentVersion: null,
      aiMetadata: null,
      overrideJustification: null,
      reviewNotes: "Approved by dev script standing in for a human compliance officer.",
      overrideType: null,
      complianceDocuments: [],
      shariahAssessment: null,
      amlEvidence: null,
      eddCaseCid: null,
    }, "verifier");
    console.log("  → ApproveCompliance exercised (manual-approval stand-in) — ApprovedBusiness created.");
    return;
  }

  const preset = COMPLIANCE_PRESETS[complianceOutcome];
  const scoring = scoreCompliance("COMPLIANT", preset.aml, preset.kyb, preset.credit);
  console.log(`  → quantifiableScore=${scoring.quantifiableScore} action=${scoring.decision.action}`);

  const commonArgs = {
    completedChecks: scoring.checks,
    reviewerParty: null,
    reviewedBy: null,
    agentVersion: scoring.scoringPolicyVersion,
    aiMetadata: null,
    overrideJustification: null,
    reviewNotes: null,
    overrideType: null,
    amlEvidence: null,
    complianceDocuments: [],
    shariahAssessment: null,
  };

  switch (scoring.decision.action) {
    case "FlagComplianceForManualReview":
      await exerciseLedgerChoice(T_COMPLIANCE, contractId, "FlagComplianceForManualReview", {
        riskScore: scoring.quantifiableScore, riskLevel: "Medium",
        agentVersion: scoring.scoringPolicyVersion, note: scoring.decision.note,
      }, "vetify");
      console.log("  → FlagComplianceForManualReview exercised. Re-run with --compliance approve to simulate the human sign-off.");
      break;
    case "RejectCompliance":
      await exerciseLedgerChoice(T_COMPLIANCE, contractId, "RejectCompliance", {
        ...commonArgs, autoDecided: true, reason: scoring.decision.reason,
        riskScore: scoring.quantifiableScore, riskLevel: "High",
      }, "verifier");
      console.log("  → RejectCompliance exercised.");
      break;
    case "ApproveCompliance":
      throw new Error("scoreCompliance returned ApproveCompliance — this should never happen (see its doc comment)");
  }
}

main().catch((err) => {
  console.error("simulate-verifier-decision failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
