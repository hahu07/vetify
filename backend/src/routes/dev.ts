/**
 * Dev-only Stage 2/3/6 simulation — drives a BusinessOnboarding through
 * Approve/Reject/FlagForManualReview and (optionally) its follow-on
 * ComplianceReview through StartReview + Approve/Reject/
 * FlagComplianceForManualReview, and separately drives a FinancingRequest
 * through BeginUnderwriting/RejectUnderwriting/FlagUnderwritingForManualReview,
 * using the real deterministic scoring engines (../scoring/verification.ts,
 * ../scoring/compliance.ts, ../scoring/underwriting.ts) against hand-built
 * evidence presets — no mono.co/Youverify/LLM keys needed. Mirrors
 * agents/src/agents/verifier.ts's and underwriting.ts's exact choice-argument
 * shapes. CLI-only sibling this was ported from:
 * agents/src/scripts/simulate-verifier-decision.ts (has the fuller writeup
 * of the VerificationCheckScores shape-mismatch bug this uncovered and fixed
 * — ported here already fixed).
 *
 * HARD GATED to non-production: app.ts only mounts this router when
 * NODE_ENV !== "production". This bypasses real evidence-gathering entirely
 * — reachable in a real deployment, it would let any vetify session
 * rubber-stamp KYC/AML/underwriting clearance for a real business. Never
 * relax this gate.
 */
import { Router } from "express";
import { exerciseChoice, createContract, queryContracts, partyId } from "../canton.js";
import { requireAuth } from "../auth.js";
import { getOnboardingById, listOnboardingByStatus, getFinancingRequestById, listFinancingByStatus } from "../repository.js";
import { scoreVerification } from "../scoring/verification.js";
import { scoreCompliance } from "../scoring/compliance.js";
import { scoreUnderwriting } from "../scoring/underwriting.js";
import type { MashupResult, CacResult, TinResult, AmlEvidence, KybEvidence, CreditHistoryResult, NormalizedTransaction } from "../scoring/types.js";

const router = Router();
const T_ONBOARDING = "Vetify.Onboarding:BusinessOnboarding";
const T_COMPLIANCE = "Vetify.Compliance:ComplianceReview";
const T_FINANCING = "Vetify.Financing:FinancingRequest";
const T_AUTHORIZED_REVIEWER = "Vetify.Compliance:AuthorizedReviewer";
const T_AUTHORIZED_ASSESSOR = "Vetify.Governance:AuthorizedAssessor";

// SDK 3.4.11 / Daml-LF 2.1/2.2 has no contract keys — see the identical
// helpers/comment in routes/onboarding.ts and routes/financing.ts. Dev-only
// simulation never creates a VerificationPolicy/CompliancePolicy/
// UnderwritingPolicy of its own, so those choices always pass `policyCid:
// null` below (the fallback-threshold path); the registries below genuinely
// need to be looked up.
async function getAuthorizedReviewerCid(verifierParty: string): Promise<string | null> {
  const reviewers = await queryContracts(T_AUTHORIZED_REVIEWER);
  return (reviewers.find((r: any) => r.payload.verifier === verifierParty))?.contractId ?? null;
}

async function getAuthorizedAssessorCid(assessorParty: string): Promise<string | null> {
  const entries = await queryContracts(T_AUTHORIZED_ASSESSOR);
  return (entries.find((e: any) => e.payload.assessor === assessorParty))?.contractId ?? null;
}

type RiskPreset = "low" | "medium" | "high";
type CompliancePreset = "flag" | "reject" | "approve";

const VERIFICATION_PRESETS: Record<RiskPreset, { mashup: MashupResult; cac: CacResult; tin: TinResult }> = {
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

const COMPLIANCE_PRESETS: Record<Exclude<CompliancePreset, "approve">, { aml: AmlEvidence; kyb: KybEvidence; credit: CreditHistoryResult }> = {
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

// Onboardings currently eligible for simulation (status=UnderReview) — powers
// the Dev Tools page's picker.
router.get("/onboardings", requireAuth("vetify"), async (_req, res, next) => {
  try {
    res.json(await listOnboardingByStatus("UnderReview"));
  } catch (e) { next(e); }
});

router.post("/simulate", requireAuth("vetify"), async (req, res, next) => {
  const log: string[] = [];
  try {
    const { onboardingContractId, risk, compliance, skipCompliance } = req.body as {
      onboardingContractId: string;
      risk: RiskPreset;
      compliance?: CompliancePreset;
      skipCompliance?: boolean;
    };
    if (!onboardingContractId || !VERIFICATION_PRESETS[risk]) {
      return res.status(400).json({ error: "onboardingContractId and risk ('low'|'medium'|'high') are required" });
    }

    const onboarding = await getOnboardingById(onboardingContractId);
    if (!onboarding) return res.status(404).json({ error: "Onboarding not found" });
    const payload = onboarding.payload as Record<string, unknown>;

    const preset = VERIFICATION_PRESETS[risk];
    const scoring = scoreVerification(preset.mashup, preset.cac, preset.tin);
    log.push(`Stage 2: riskScore=${scoring.riskScore} riskLevel=${scoring.riskLevel} action=${scoring.decision.action}`);

    const verificationRef = `VER-${new Date().getUTCFullYear()}-${onboardingContractId.replace(/[^a-zA-Z0-9]/g, "").slice(-6)}`;
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
      policyCid: null,
    };

    if (scoring.decision.action === "FlagForManualReview") {
      await exerciseChoice(T_ONBOARDING, onboardingContractId, "FlagForManualReview", {
        riskScore: scoring.riskScore, riskLevel: scoring.riskLevel,
        agentVersion: scoring.scoringPolicyVersion, note: scoring.decision.note,
      }, "verifier");
      log.push("FlagForManualReview exercised. Stop here — a human must approve/reject from ManualReview.");
      return res.json({ log });
    }

    if (scoring.decision.action === "Reject") {
      await exerciseChoice(T_ONBOARDING, onboardingContractId, "Reject", {
        ...commonArgs, autoDecided: true, reason: scoring.decision.reason,
      }, ["verifier", "vetify"]);
      log.push("Reject exercised. No ComplianceReview is created on rejection.");
      return res.json({ log });
    }

    // Approve requires at least one supporting document on-ledger (Onboarding.daml
    // Gap 5) — real business submissions normally have these from the upload step,
    // but a hand-built onboarding used only for this dev simulation typically
    // doesn't. Rather than fail here, attach one synthetic DocumentRef via the
    // RequestAmendment -> Amend -> SubmitForReview cycle (the only path that can
    // set `documents`, since Approve's own arguments can't) before approving.
    let approveTargetId = onboardingContractId;
    const existingDocuments = (payload.documents as unknown[] | undefined) ?? [];
    if (existingDocuments.length === 0) {
      // RequestAmendment is a consuming choice (Onboarding.daml: `create this with status =
      // PendingAmendment`) — it archives approveTargetId and returns a new contract ID. Found
      // live: discarding that return value and exercising Amend against the now-archived
      // original left the onboarding stuck in PendingAmendment with every subsequent call
      // 404ing against a dead contract ID.
      const { contractId: pendingAmendmentId } = await exerciseChoice(T_ONBOARDING, approveTargetId, "RequestAmendment",
        { note: "Dev Tools simulation: attaching a synthetic document before Approve" }, "vetify");
      if (!pendingAmendmentId) throw new Error("RequestAmendment did not return a new contract ID");
      const { contractId: draftId } = await exerciseChoice(T_ONBOARDING, pendingAmendmentId, "Amend", {
        updatedProfile: payload.profile,
        updatedKyc: payload.kyc,
        updatedDocuments: [{
          docType: "CAC_CERTIFICATE",
          contentHash: "0".repeat(64),
          storageRef: "dev-tools-simulation-placeholder",
          mimeType: null,
          malwareScanStatus: null,
          fileSize: null,
          checksumAlgorithm: null,
          malwareScanAt: null,
          digitalSignature: null,
        }],
        policyMaxAmendments: null,
      }, "business");
      if (!draftId) throw new Error("Amend did not return a new contract ID");
      const { contractId: resubmittedId } = await exerciseChoice(T_ONBOARDING, draftId, "SubmitForReview", {}, "business");
      if (!resubmittedId) throw new Error("SubmitForReview did not return a new contract ID");
      approveTargetId = resubmittedId;
      log.push(`Attached a synthetic document (this onboarding had none) via RequestAmendment/Amend/SubmitForReview: ${approveTargetId}`);
    }

    await exerciseChoice(T_ONBOARDING, approveTargetId, "Approve", {
      ...commonArgs, autoDecided: true,
    }, ["verifier", "vetify"]);
    log.push("Approve exercised.");

    const profile = payload.profile as Record<string, unknown>;
    const kyc = payload.kyc as Record<string, unknown>;
    const complianceRef = `COM-${verificationRef.slice(4)}`;
    const { contractId: pendingComplianceId } = await createContract(T_COMPLIANCE, {
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
      createdBy: "Dev Tools simulation (routes/dev.ts, not the real agent)",
      shariahVerdict: null,
      advisor: partyId("advisor"),
    }, "vetify");
    log.push(`ComplianceReview created: ${pendingComplianceId}`);

    if (skipCompliance || !compliance) return res.json({ log });

    // StartReview is a CONSUMING choice (archives Pending, recreates as
    // UnderReview with the same key but a new contract ID) — every choice
    // after this one must target the ID this call returns.
    const { contractId: complianceId } = await exerciseChoice(T_COMPLIANCE, pendingComplianceId, "StartReview", {}, "vetify");
    if (!complianceId) throw new Error("StartReview did not return a new contract ID");
    log.push(`Stage 3: ComplianceReview ${complianceId} started (compliance outcome: ${compliance})`);

    if (compliance === "approve") {
      const reviewerAuthCid = await getAuthorizedReviewerCid(partyId("verifier"));
      if (!reviewerAuthCid) {
        log.push("Failed: verifier is not in the authorized reviewer registry (register one first).");
        return res.json({ log });
      }
      // scoreCompliance can never return this action by design (see its doc
      // comment) — this stands in for the human sign-off the real system
      // always requires here.
      await exerciseChoice(T_COMPLIANCE, complianceId, "ApproveCompliance", {
        completedChecks: { shariahCompliant: true, amlCleared: true, kycValidated: true, cddCompleted: true },
        riskScore: 95,
        riskLevel: "Low",
        autoDecided: false,
        reviewerParty: partyId("verifier"),
        reviewedBy: "Dev Tools simulation (manual sign-off stand-in)",
        agentVersion: null,
        aiMetadata: null,
        overrideJustification: null,
        reviewNotes: "Approved via Dev Tools, standing in for a human compliance officer.",
        overrideType: null,
        complianceDocuments: [],
        shariahAssessment: null,
        amlEvidence: null,
        eddCaseCid: null,
        reviewerAuthCid,
      }, "verifier");
      log.push("ApproveCompliance exercised (manual-approval stand-in) — ApprovedBusiness created.");
      return res.json({ log });
    }

    const cPreset = COMPLIANCE_PRESETS[compliance];
    const cScoring = scoreCompliance("COMPLIANT", cPreset.aml, cPreset.kyb, cPreset.credit);
    log.push(`quantifiableScore=${cScoring.quantifiableScore} action=${cScoring.decision.action}`);

    if (cScoring.decision.action === "FlagComplianceForManualReview") {
      await exerciseChoice(T_COMPLIANCE, complianceId, "FlagComplianceForManualReview", {
        riskScore: cScoring.quantifiableScore, riskLevel: "Medium",
        agentVersion: cScoring.scoringPolicyVersion, note: cScoring.decision.note,
        policyCid: null,
      }, "vetify");
      log.push("FlagComplianceForManualReview exercised. Re-run with compliance=approve to simulate the human sign-off.");
    } else if (cScoring.decision.action === "RejectCompliance") {
      const reviewerAuthCid = await getAuthorizedReviewerCid(partyId("verifier"));
      if (!reviewerAuthCid) {
        log.push("Failed: verifier is not in the authorized reviewer registry (register one first).");
        return res.json({ log });
      }
      await exerciseChoice(T_COMPLIANCE, complianceId, "RejectCompliance", {
        completedChecks: cScoring.checks,
        reviewerParty: null,
        reviewedBy: null,
        agentVersion: cScoring.scoringPolicyVersion,
        aiMetadata: null,
        overrideJustification: null,
        reviewNotes: null,
        overrideType: null,
        amlEvidence: null,
        complianceDocuments: [],
        shariahAssessment: null,
        autoDecided: true,
        reason: cScoring.decision.reason,
        riskScore: cScoring.quantifiableScore,
        riskLevel: "High",
        reviewerAuthCid,
      }, "verifier");
      log.push("RejectCompliance exercised.");
    }

    res.json({ log });
  } catch (e) {
    if (e instanceof Error) log.push(`Failed: ${e.message}`);
    next(e);
  }
});

// ─── Stage 6: Underwriting simulation ───────────────────────────────────────
// Drives a Submitted FinancingRequest through BeginUnderwriting/RejectUnderwriting/
// FlagUnderwritingForManualReview using the real five-engine scoreUnderwriting()
// against a hand-built 6-month transaction history + creditworthiness evidence.
// Financial parameters (revenue, expenses, balance, business age, DSCR, credit
// score) are entirely synthetic per preset — deterministic regardless of which
// real FinancingRequest is selected. requestedAmount/tenureMonths are the only
// figures pulled from the real request, since that's literally what's being
// underwritten (feeds the stress-test installment estimate).

const DAYS_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.44;

function isoDaysAgo(asOfMs: number, days: number): string {
  return new Date(asOfMs - days * DAYS_MS).toISOString();
}

/** Same shape as NormalizedTransaction but dated by day-offset-from-now rather than
 * an absolute ISO date, since presets are defined statically (asOfMs is only known
 * at request time). */
type ExtraTxSpec = Omit<NormalizedTransaction, "date"> & { daysAgo: number };

interface StatementParams {
  asOfMs: number;
  monthlyInflow: number;
  /** Total monthly outflow, inclusive of recurringDebtMonthly if set. */
  monthlyOutflow: number;
  /** Fraction jitter applied to each month's inflow, alternating sign — controls
   * revenue variance (0.05 = consistent, 0.30+ = moderate, 0.6+ = volatile). */
  inflowJitterFraction: number;
  /** Attached to the most recent month's transaction only — latestBalance() picks
   * the transaction with the max date, mirroring how a real statement's running
   * balance would only be current as of the latest row. */
  balance: number;
  recurringDebtMonthly?: number;
  extra?: ExtraTxSpec[];
}

function buildStatement(p: StatementParams): NormalizedTransaction[] {
  const txs: NormalizedTransaction[] = [];
  for (let m = 0; m < 6; m++) {
    const base = m * DAYS_PER_MONTH;
    const jitterSign = m % 2 === 0 ? 1 : -1;
    const inflowAmt = Math.round(p.monthlyInflow * (1 + p.inflowJitterFraction * jitterSign));
    txs.push({
      date: isoDaysAgo(p.asOfMs, base + 10),
      amount: inflowAmt,
      direction: "credit",
      counterparty: "Customer Sales",
      description: "Monthly sales receipts",
    });
    const debtAmt = p.recurringDebtMonthly ?? 0;
    if (debtAmt > 0) {
      txs.push({
        date: isoDaysAgo(p.asOfMs, base + 8),
        amount: debtAmt,
        direction: "debit",
        counterparty: "Loan Repayment Co",
        description: "Loan repayment",
      });
    }
    const generalOutflow = Math.max(0, p.monthlyOutflow - debtAmt);
    if (generalOutflow > 0) {
      txs.push({
        date: isoDaysAgo(p.asOfMs, base + 5),
        amount: generalOutflow,
        direction: "debit",
        description: "Operating expenses",
        ...(m === 0 ? { balanceAfter: p.balance } : {}),
      });
    }
  }
  if (p.extra) {
    for (const { daysAgo, ...tx } of p.extra) {
      txs.push({ ...tx, date: isoDaysAgo(p.asOfMs, daysAgo) });
    }
  }
  return txs;
}

type UnderwritingPreset = "low" | "medium" | "high" | "highFraud";

interface UnderwritingPresetConfig {
  statement: Omit<StatementParams, "asOfMs">;
  businessAgeMonths: number;
  dscr: number;
  creditScore: number;
}

const UNDERWRITING_PRESETS: Record<UnderwritingPreset, UnderwritingPresetConfig> = {
  low: {
    statement: { monthlyInflow: 3_000_000, monthlyOutflow: 1_500_000, inflowJitterFraction: 0.05, balance: 6_000_000 },
    businessAgeMonths: 48,
    dscr: 2.0,
    creditScore: 780,
  },
  medium: {
    statement: { monthlyInflow: 1_800_000, monthlyOutflow: 1_400_000, inflowJitterFraction: 0.30, balance: 1_400_000, recurringDebtMonthly: 100_000 },
    businessAgeMonths: 15,
    dscr: 1.2,
    creditScore: 600,
  },
  high: {
    statement: { monthlyInflow: 800_000, monthlyOutflow: 900_000, inflowJitterFraction: 0.6, balance: 100_000, recurringDebtMonthly: 200_000 },
    businessAgeMonths: 3,
    dscr: 0.5,
    creditScore: 350,
  },
  // Same clean financials as "low" — isolates the Fraud Detection hard override
  // (a score below fraudReviewThreshold forces High regardless of the otherwise
  // Low-band composite): structuring (3 transactions just under ₦500k within a
  // 7-day window) + round-tripping (matching in/out with the same counterparty
  // within 5 days) + a pre-application income spike, penalty 40+30+20=90 lands
  // the Fraud Detection score at 10 — well below the default threshold of 30.
  highFraud: {
    statement: {
      monthlyInflow: 3_000_000, monthlyOutflow: 1_500_000, inflowJitterFraction: 0.05, balance: 6_000_000,
      extra: [
        { daysAgo: 3, amount: 480_000, direction: "debit", description: "Structuring test 1" },
        { daysAgo: 5, amount: 480_000, direction: "debit", description: "Structuring test 2" },
        { daysAgo: 7, amount: 480_000, direction: "debit", description: "Structuring test 3" },
        { daysAgo: 2, amount: 900_000, direction: "debit", counterparty: "Fraud Test Partner", description: "Round-trip out" },
        { daysAgo: 4, amount: 900_000, direction: "credit", counterparty: "Fraud Test Partner", description: "Round-trip in" },
        { daysAgo: 15, amount: 9_000_000, direction: "credit", description: "Pre-application income spike" },
      ],
    },
    businessAgeMonths: 48,
    dscr: 2.0,
    creditScore: 780,
  },
};

// Financing requests currently eligible for simulation (status=Submitted) —
// powers the Dev Tools page's picker. Mirrors GET /onboardings above.
router.get("/financing-requests", requireAuth("vetify"), async (_req, res, next) => {
  try {
    res.json(await listFinancingByStatus("Submitted"));
  } catch (e) { next(e); }
});

router.post("/simulate-underwriting", requireAuth("vetify"), async (req, res, next) => {
  const log: string[] = [];
  try {
    const { financingRequestContractId, preset } = req.body as {
      financingRequestContractId: string;
      preset: UnderwritingPreset;
    };
    if (!financingRequestContractId || !UNDERWRITING_PRESETS[preset]) {
      return res.status(400).json({ error: "financingRequestContractId and preset ('low'|'medium'|'high'|'highFraud') are required" });
    }

    const request = await getFinancingRequestById(financingRequestContractId);
    if (!request) return res.status(404).json({ error: "Financing request not found" });
    const payload = request.payload as { terms: { amount: number | string; tenureMonths: number | string } };
    const requestedAmount = Number(payload.terms.amount);
    const tenureMonths = Number(payload.terms.tenureMonths);

    const asOfMs = Date.now();
    const cfg = UNDERWRITING_PRESETS[preset];
    const transactions = buildStatement({ ...cfg.statement, asOfMs });
    const businessIncorporationDate = isoDaysAgo(asOfMs, cfg.businessAgeMonths * DAYS_PER_MONTH);

    const scoring = scoreUnderwriting(
      { transactions, asOf: new Date(asOfMs).toISOString() },
      { dscr: cfg.dscr, creditScore: cfg.creditScore },
      { requestedAmount, tenureMonths, businessIncorporationDate, asOf: new Date(asOfMs).toISOString() },
    );
    log.push(
      `Stage 6: score=${scoring.assessment.score} category=${scoring.assessment.riskCategory} ` +
      `behavioural=${scoring.assessment.behaviouralScore} cashflow=${scoring.assessment.cashflowRiskScore} ` +
      `credit=${scoring.assessment.creditworthinessScore} fraud=${scoring.assessment.fraudScore} ` +
      `action=${scoring.decision.action}`
    );

    const assessorCid = await getAuthorizedAssessorCid(partyId("assessor"));

    switch (scoring.decision.action) {
      case "BeginUnderwriting":
        if (!assessorCid) {
          log.push("Failed: assessor is not a registered AuthorizedAssessor (register one first).");
          break;
        }
        await exerciseChoice(T_FINANCING, financingRequestContractId, "BeginUnderwriting", {
          assessment: scoring.assessment,
          autoDecided: true,
          aiMetadata: null,
          agentVersion: scoring.scoringPolicyVersion,
          assessorName: null,
          underwritingRef: null,
          decisionDocuments: [],
          assessorCid,
          policyCid: null,
        }, ["assessor", "vetify"]);
        log.push("BeginUnderwriting exercised — UnderwritingResult created.");
        break;
      case "RejectUnderwriting":
        if (!assessorCid) {
          log.push("Failed: assessor is not a registered AuthorizedAssessor (register one first).");
          break;
        }
        await exerciseChoice(T_FINANCING, financingRequestContractId, "RejectUnderwriting", {
          reason: scoring.decision.reason,
          autoDecided: true,
          reviewerParty: null,
          reviewedBy: null,
          assessment: scoring.assessment,
          assessorCid,
        }, ["assessor", "vetify"]);
        log.push("RejectUnderwriting exercised. The business never reaches the FI for this request.");
        break;
      case "FlagUnderwritingForManualReview":
        await exerciseChoice(T_FINANCING, financingRequestContractId, "FlagUnderwritingForManualReview", {
          riskScore: scoring.assessment.score,
          riskLevel: scoring.assessment.riskCategory,
          agentVersion: scoring.scoringPolicyVersion,
          note: scoring.decision.note,
          policyCid: null,
        }, "vetify");
        log.push("FlagUnderwritingForManualReview exercised. A human assessor resolves it from the Underwriting Queue.");
        break;
    }

    res.json({ log });
  } catch (e) {
    if (e instanceof Error) log.push(`Failed: ${e.message}`);
    next(e);
  }
});

export default router;
