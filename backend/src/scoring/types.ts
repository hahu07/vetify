/**
 * Ported subset of agents/src/scoring/types.ts + agents/src/types/index.ts's
 * RiskLevel/classifyRisk, for the dev-only Stage 2/3 simulation route
 * (routes/dev.ts — see its own doc comment for why this exists and why it's
 * hard-gated to non-production). Not used by any real request-handling path;
 * backend has no other reason to run scoring logic, since the real Verifier
 * Agent runs in the separate `agents` package.
 *
 * agents/ and backend/ are two fully independent Node projects (no shared
 * workspace), so this is a deliberate copy, not an import — keep it in sync
 * by hand if agents/src/scoring/verification.ts or compliance.ts change.
 * The full Stage 6/9 types in the agents package aren't ported here since
 * this route only ever simulates Stage 2/3.
 */

export type RiskLevel = "Low" | "Medium" | "High";

const RISK_THRESHOLD_AUTO_APPROVE = parseInt(process.env.RISK_THRESHOLD_AUTO_APPROVE ?? "80", 10);
const RISK_THRESHOLD_AUTO_REJECT = parseInt(process.env.RISK_THRESHOLD_AUTO_REJECT ?? "50", 10);

export function classifyRisk(score: number): RiskLevel {
  if (score >= RISK_THRESHOLD_AUTO_APPROVE) return "Low";
  if (score >= RISK_THRESHOLD_AUTO_REJECT) return "Medium";
  return "High";
}

// ─── Stage 2: mono.co Lookup ────────────────────────────────────────────────

export type ApiOutcome<T> = { kind: "ok"; data: T } | { kind: "error"; httpStatus: number };

export interface MashupEvidence {
  ninVerified: boolean;
  bvnVerified: boolean;
  nameMatch: boolean;
}
export type MashupResult = ApiOutcome<MashupEvidence>;

export interface CacEvidence {
  found: boolean;
  status: "Active" | "Inactive" | "Struck Off" | "Pending" | string;
  nameMatch: "exact" | "close" | "mismatch";
}
export type CacResult = ApiOutcome<CacEvidence>;

export type TinResult =
  | { kind: "verifiedMatchesCac" }
  | { kind: "verifiedDifferentEntity" }
  | { kind: "notFound" }
  | { kind: "error"; httpStatus: number };

// ─── Stage 3: Youverify AML/KYB + mono.co credit history ───────────────────

export type AmlStatus = "clear" | "review_required" | "not_cleared";
export interface AmlEvidence {
  businessStatus: AmlStatus;
  directorStatus: AmlStatus;
}

export type KybStatus =
  | "active_full_match"
  | "active_minor_discrepancy"
  | "inactive_or_mismatch"
  | "not_found"
  | "struck_off_or_dissolved";
export interface KybEvidence {
  status: KybStatus;
}

export type CreditHistoryResult = "clean" | "minor_resolved" | "delinquent_or_default";

export interface QuantifiableCddEvidence {
  incorporationDate: string;
  asOf?: string;
}

// ─── Verification (Stage 2) output ─────────────────────────────────────────

export interface VerificationChecks {
  identityVerified: boolean;
  cacRegistered: boolean;
  documentsValid: boolean;
  dataConsistent: boolean;
}

// Mirrors Vetify.Types.VerificationCheckScores (Daml) field-for-field — a
// prior version of the agents-package original had {identityScore, cacScore,
// tinScore}, which the ledger rejected with "Missing non-optional fields:
// Set(documentScore, consistencyScore)" (found via live testing, 2026-07-08,
// fixed in agents/src/scoring/types.ts — ported here already fixed).
export interface VerificationCheckScores {
  identityScore: number;
  cacScore: number;
  documentScore: number;
  consistencyScore: number;
}

export type VerificationDecision =
  | { action: "Approve"; autoDecided: true }
  | { action: "Reject"; autoDecided: true; reason: string }
  | { action: "FlagForManualReview"; note: string };

export interface VerificationScoringResult {
  checks: VerificationChecks;
  checkScores: VerificationCheckScores;
  riskScore: number;
  riskLevel: RiskLevel;
  decision: VerificationDecision;
  scoringPolicyVersion: string;
}

export interface VerificationScoringWeights {
  identityVerified: number;
  identityNameMismatch: number;
  identityBvnNotFound: number;
  identityNinNotFound: number;
  cacActiveExactMatch: number;
  cacActiveCloseMatch: number;
  cacActiveNameMismatch: number;
  cacPending: number;
  cacInactiveOrStruckOff: number;
  cacNotFound: number;
  tinVerifiedMatchesCac: number;
  tinVerifiedDifferentEntity: number;
  tinNotFound: number;
  tinApiError: number;
}

export const DEFAULT_VERIFICATION_WEIGHTS: VerificationScoringWeights = {
  identityVerified: 40,
  identityNameMismatch: 10,
  identityBvnNotFound: 15,
  identityNinNotFound: 0,
  cacActiveExactMatch: 35,
  cacActiveCloseMatch: 28,
  cacActiveNameMismatch: 10,
  cacPending: 20,
  cacInactiveOrStruckOff: 10,
  cacNotFound: 0,
  tinVerifiedMatchesCac: 25,
  tinVerifiedDifferentEntity: 10,
  tinNotFound: 5,
  tinApiError: 10,
};
export const DEFAULT_VERIFICATION_POLICY_VERSION = "scoring-engine-default-2026-v1";

// ─── Compliance (Stage 3) output ───────────────────────────────────────────

export interface ComplianceCheck {
  shariahCompliant: boolean;
  amlCleared: boolean;
  kycValidated: boolean;
  cddCompleted: boolean;
}

export type ComplianceDecision =
  | { action: "ApproveCompliance"; autoDecided: true }
  | { action: "RejectCompliance"; autoDecided: true; reason: string }
  | { action: "FlagComplianceForManualReview"; note: string };

export interface ComplianceScoringResult {
  checks: ComplianceCheck;
  quantifiableScore: number;
  decision: ComplianceDecision;
  scoringPolicyVersion: string;
}

export interface ComplianceScoringWeights {
  amlBothClear: number;
  amlOneReviewRequired: number;
  kybActiveFullMatch: number;
  kybActiveMinorDiscrepancy: number;
  kybInactiveOrMismatch: number;
  kybNotFound: number;
  creditClean: number;
  creditMinorResolved: number;
  creditDelinquentOrDefault: number;
  businessAgeEstablishedBonus: number;
  businessAgeNewlyRegisteredPenalty: number;
}

export const DEFAULT_COMPLIANCE_WEIGHTS: ComplianceScoringWeights = {
  amlBothClear: 35,
  amlOneReviewRequired: 15,
  kybActiveFullMatch: 30,
  kybActiveMinorDiscrepancy: 20,
  kybInactiveOrMismatch: 10,
  kybNotFound: 0,
  creditClean: 10,
  creditMinorResolved: 7,
  creditDelinquentOrDefault: 0,
  businessAgeEstablishedBonus: 5,
  businessAgeNewlyRegisteredPenalty: -5,
};
export const DEFAULT_COMPLIANCE_POLICY_VERSION = "scoring-engine-default-2026-v1";

// ─── Underwriting (Stage 6) ─────────────────────────────────────────────────
// Ported from agents/src/scoring/types.ts's Stage 6 section, for the dev-only
// Stage 6 simulation route (routes/dev.ts). Same "deliberate copy, not an
// import" rationale as the rest of this file.

export interface NormalizedTransaction {
  /** ISO 8601 date. */
  date: string;
  /** Always positive, in NGN. */
  amount: number;
  direction: "credit" | "debit";
  description?: string;
  counterparty?: string;
  /** Running/closing account balance after this transaction, in NGN — only present
   * when the source statement includes balance data. Liquidity/cash-reserve factors
   * degrade to a data-unavailable flag (never a fabricated value) when absent. */
  balanceAfter?: number;
}

export interface TransactionEvidence {
  transactions: NormalizedTransaction[];
  /** "now" for production; injectable for deterministic testing. */
  asOf?: string;
}

export interface CashFlowEvidence {
  averageMonthlyNetInflow: number;
  revenueVarianceRatio: number;
  existingMonthlyDebtObligations: number;
}

export interface CreditworthinessEvidence {
  /** Optional — DSCR contributes 0 (not a fabricated sub-1.0) and raises
   * DSCR_UNAVAILABLE when absent. */
  dscr?: number;
  /** Bureau-backed score, banded by the Creditworthiness engine. */
  creditScore?: number;
}

export interface UnderwritingRequestContext {
  requestedAmount: number;
  /** Repayment tenure in months — used by the Cashflow Risk engine's stress test to
   * estimate a proposed installment (requestedAmount / tenureMonths, principal-only). */
  tenureMonths?: number;
  businessIncorporationDate?: string;
  asOf?: string;
}

/** Common return shape for each of the four independent scoring engines — a 0-100
 * sub-score plus the specific flags that produced it. */
export interface EngineResult {
  score: number;
  flags: UnderwritingRiskFlag[];
}

export interface UnderwritingAssessment {
  score: number;
  riskCategory: RiskLevel;
  recommendedLimit: number;
  recommendation: string;
  behaviouralScore?: number;
  cashflowRiskScore?: number;
  creditworthinessScore?: number;
  fraudScore?: number;
}

export interface UnderwritingRiskFlag {
  code: string;
  description: string;
}

/** Mirrors VerificationDecision/ComplianceDecision — Low auto-qualifies
 * (BeginUnderwriting), Medium escalates to a human assessor
 * (FlagUnderwritingForManualReview), High is a hard veto (RejectUnderwriting) that
 * never reaches the FI. The Fraud Detection hard override forces High regardless of
 * the weighted composite, routing here to RejectUnderwriting. */
export type UnderwritingDecision =
  | { action: "BeginUnderwriting"; autoDecided: true }
  | { action: "RejectUnderwriting"; autoDecided: true; reason: string }
  | { action: "FlagUnderwritingForManualReview"; note: string };

export interface UnderwritingScoringResult {
  assessment: UnderwritingAssessment;
  riskFlags: UnderwritingRiskFlag[];
  decision: UnderwritingDecision;
  scoringPolicyVersion: string;
}

/** Mirrors Vetify.Types.UnderwritingScoringWeights (Daml) field-for-field. Kept flat
 * so numifyWeights's shallow string-to-number conversion keeps working unchanged. */
export interface UnderwritingScoringWeights {
  dscrHigh: number;
  dscrMedium: number;
  dscrLow: number;
  debtObligationsLow: number;
  debtObligationsModerate: number;
  debtObligationsHigh: number;
  cashReserveStrong: number;
  cashReserveAdequate: number;
  cashReserveWeak: number;
  stressTestPassAll: number;
  stressTestPassPartial: number;
  stressTestFail: number;
  dscrHighThreshold: number;
  dscrMediumThreshold: number;
  debtObligationsLowThreshold: number;
  debtObligationsModerateThreshold: number;
  cashReserveStrongMonths: number;
  cashReserveAdequateMonths: number;
  stressTestHaircutMild: number;
  stressTestHaircutModerate: number;
  stressTestHaircutSevere: number;
  revenueConsistent: number;
  revenueModerate: number;
  revenueVolatile: number;
  businessAgeEstablished: number;
  businessAgeModerate: number;
  businessAgeNew: number;
  expenseDisciplineStrong: number;
  expenseDisciplineModerate: number;
  expenseDisciplinePoor: number;
  liquidityStrong: number;
  liquidityAdequate: number;
  liquidityWeak: number;
  revenueConsistentThreshold: number;
  revenueModerateThreshold: number;
  businessAgeEstablishedMonths: number;
  businessAgeModerateMonths: number;
  expenseDisciplineStrongThreshold: number;
  expenseDisciplineModerateThreshold: number;
  liquidityStrongMonths: number;
  liquidityAdequateMonths: number;
  creditScoreExcellent: number;
  creditScoreGood: number;
  creditScoreFair: number;
  creditScorePoor: number;
  creditScoreExcellentThreshold: number;
  creditScoreGoodThreshold: number;
  creditScoreFairThreshold: number;
  fraudStructuringPenalty: number;
  fraudRoundTrippingPenalty: number;
  fraudIncomeSpikePenalty: number;
  fraudVelocityAnomalyPenalty: number;
  financialBehaviourEngineWeight: number;
  cashflowRiskEngineWeight: number;
  creditworthinessEngineWeight: number;
  fraudDetectionEngineWeight: number;
  /** Fraud score below this (0-100) forces riskCategory to High regardless of the
   * weighted composite — per-institution risk tolerance for the rule-based signal. */
  fraudReviewThreshold: number;
}

export const DEFAULT_UNDERWRITING_WEIGHTS: UnderwritingScoringWeights = {
  dscrHigh: 40,
  dscrMedium: 22,
  dscrLow: 0,
  debtObligationsLow: 25,
  debtObligationsModerate: 12,
  debtObligationsHigh: 0,
  cashReserveStrong: 20,
  cashReserveAdequate: 10,
  cashReserveWeak: 0,
  stressTestPassAll: 15,
  stressTestPassPartial: 7,
  stressTestFail: 0,
  dscrHighThreshold: 1.5,
  dscrMediumThreshold: 1.0,
  debtObligationsLowThreshold: 0.15,
  debtObligationsModerateThreshold: 0.30,
  cashReserveStrongMonths: 2.0,
  cashReserveAdequateMonths: 1.0,
  stressTestHaircutMild: 0.10,
  stressTestHaircutModerate: 0.25,
  stressTestHaircutSevere: 0.40,
  revenueConsistent: 30,
  revenueModerate: 15,
  revenueVolatile: 0,
  businessAgeEstablished: 25,
  businessAgeModerate: 12,
  businessAgeNew: 0,
  expenseDisciplineStrong: 25,
  expenseDisciplineModerate: 12,
  expenseDisciplinePoor: 0,
  liquidityStrong: 20,
  liquidityAdequate: 10,
  liquidityWeak: 0,
  revenueConsistentThreshold: 0.20,
  revenueModerateThreshold: 0.40,
  businessAgeEstablishedMonths: 24.0,
  businessAgeModerateMonths: 12.0,
  expenseDisciplineStrongThreshold: 0.70,
  expenseDisciplineModerateThreshold: 0.90,
  liquidityStrongMonths: 2.0,
  liquidityAdequateMonths: 1.0,
  creditScoreExcellent: 100,
  creditScoreGood: 70,
  creditScoreFair: 40,
  creditScorePoor: 0,
  creditScoreExcellentThreshold: 700,
  creditScoreGoodThreshold: 650,
  creditScoreFairThreshold: 550,
  fraudStructuringPenalty: 40,
  fraudRoundTrippingPenalty: 30,
  fraudIncomeSpikePenalty: 20,
  fraudVelocityAnomalyPenalty: 20,
  financialBehaviourEngineWeight: 30,
  cashflowRiskEngineWeight: 35,
  creditworthinessEngineWeight: 20,
  fraudDetectionEngineWeight: 15,
  fraudReviewThreshold: 30,
};
export const DEFAULT_UNDERWRITING_POLICY_VERSION = "scoring-engine-default-2026-v1";
