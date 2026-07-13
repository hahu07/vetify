/**
 * Raw evidence shapes for deterministic scoring — mirrors the mono.co and
 * Youverify response fields documented in agents/skills/verifier/references/
 * and agents/skills/shariah/references/. These are the *only* inputs the
 * scoring functions in this directory accept; they never see an LLM's own
 * risk assessment, only the underlying tool call results.
 */
import type { RiskLevel } from "../types/index.js";

export type ApiOutcome<T> = { kind: "ok"; data: T } | { kind: "error"; httpStatus: number };

// ─── Stage 2: mono.co Lookup ────────────────────────────────────────────────

export interface MashupEvidence {
  ninVerified: boolean;
  bvnVerified: boolean;
  /** mono.co's data.match.name — whether the name on the NIN record and the
   * name on the BVN record are consistent (a real identity cross-check,
   * only meaningful once both are independently verified). */
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
  /** Business incorporation date, ISO 8601. */
  incorporationDate: string;
  /** "now" for production; injectable for deterministic testing. */
  asOf?: string;
}

// ─── Verification (Stage 2) output ─────────────────────────────────────────

export interface VerificationChecks {
  identityVerified: boolean;
  cacRegistered: boolean;
  documentsValid: boolean;
  dataConsistent: boolean;
}

// Mirrors Vetify.Types.VerificationCheckScores (Daml) field-for-field — this
// record is sent verbatim to Onboarding.daml's Approve/Reject choices, so its
// shape must match exactly (a prior version had {identityScore, cacScore,
// tinScore}, which the ledger rejected outright with "Missing non-optional
// fields: Set(documentScore, consistencyScore)" — found via live testing,
// 2026-07-08). consistencyScore is the TIN-matches-CAC cross-source check
// (Daml's "cross-source data consistency score" is exactly what that check
// verifies). documentScore has no real evidence source in this system (no
// OCR/document-authenticity tool exists) — see verification.ts's doc comment
// on why it's always 0, same never-fabricate-a-factor principle used
// elsewhere (Stage 6's PD/LGD/EAD, Stage 3's CDD purpose-coherence gap).
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
  /** policyVersion of whichever VerificationPolicy's scoringWeights were actually used
   * (or the built-in default's version string if no policy was active). */
  scoringPolicyVersion: string;
}

/** Mirrors Vetify.Types.VerificationScoringWeights (Daml) field-for-field — this is the
 * per-check point table for Stage 2, now carried on the on-ledger VerificationPolicy so
 * risk/compliance ops can retune it via a new policy version, without a code deploy. */
export interface VerificationScoringWeights {
  /** NIN + BVN both verified AND mono.co's cross-check confirms the name on
   * each record is consistent. No DOB is collected anywhere in onboarding to
   * additionally cross-check against, so this is the best achievable
   * identity-check outcome. */
  identityVerified: number;
  /** NIN + BVN both verified but the names don't match — a real identity-fraud
   * signal (someone else's BVN/NIN); always flags regardless of score, same
   * treatment as cacActiveNameMismatch. */
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

/** Fallback used only when no VerificationPolicy is active on the ledger — matches the
 * point table in risk-scoring-guide.md exactly. */
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
  /**
   * Quantifiable evidence alone (AML + KYB + business age + credit history)
   * cannot cover the CDD framework's "purpose & profile coherence" bucket —
   * there is no structured data source for financing-purpose-vs-activity
   * match, amount proportionality, or director-industry fit, so that bucket
   * is never guessed at. Consequence: `decision` can never resolve to
   * `ApproveCompliance` on its own — the deterministic scorer can only
   * auto-reject (clear hard-rule violations) or flag for a human, who alone
   * can affirmatively close out the qualitative CDD judgment and approve.
   */
  decision: ComplianceDecision;
  /** policyVersion of whichever CompliancePolicy's scoringWeights were actually used
   * (or the built-in default's version string if no policy was active). */
  scoringPolicyVersion: string;
}

/** Mirrors Vetify.Types.ComplianceScoringWeights (Daml) field-for-field. */
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

/** Fallback used only when no CompliancePolicy is active on the ledger — matches
 * cdd-framework.md's quantifiable point values exactly. */
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

// ─── Stage 0: Financing Provider Registration ──────────────────────────────
// Reuses mono.co lookup_cac (same tool/evidence shape as Stage 2's CacResult)
// against the provider's own cacRegNumber — genuinely the same check, just a
// different entity. See agents/src/scoring/provider-verification.ts.

export type ProviderType =
  | "CBNLicensedNIFI"
  | "SECFundManager"
  | "PenComPensionManager"
  | "CooperativeSociety"
  | "InvestmentClub"
  | "WaqfFund"
  | "ZakatFund"
  | "Philanthropy";

/** Mirrors Vetify.Types.ProviderVerificationScoringWeights (Daml) field-for-field. */
export interface ProviderVerificationScoringWeights {
  cacActiveExactMatch: number;
  cacActiveCloseMatch: number;
  cacActiveNameMismatch: number;
  cacPending: number;
  cacInactiveOrStruckOff: number;
  cacNotFound: number;
  regulatedWithLicense: number;
  regulatedMissingLicense: number;
  unregulatedDeclared: number;
}

/** Fallback used only when no ProviderVerificationPolicy is active on the ledger. */
export const DEFAULT_PROVIDER_VERIFICATION_WEIGHTS: ProviderVerificationScoringWeights = {
  cacActiveExactMatch: 60,
  cacActiveCloseMatch: 48,
  cacActiveNameMismatch: 20,
  cacPending: 35,
  cacInactiveOrStruckOff: 15,
  cacNotFound: 0,
  regulatedWithLicense: 40,
  regulatedMissingLicense: 10,
  unregulatedDeclared: 40,
};
export const DEFAULT_PROVIDER_VERIFICATION_POLICY_VERSION = "scoring-engine-default-2026-v1";

export type ProviderVerificationDecision =
  | { action: "Reject"; autoDecided: true; reason: string }
  | { action: "FlagForManualReview"; note: string }
  // Low risk, no serious flags — approvedInstruments is still a governing-document
  // judgment call no automated check can make, so this only records the score
  // (RecordProviderScore) rather than fully auto-approving.
  | { action: "RecordScore" };

export interface ProviderVerificationScoringResult {
  riskScore: number;
  riskLevel: RiskLevel;
  decision: ProviderVerificationDecision;
  scoringPolicyVersion: string;
}

// ─── Stage 6: mono.co Connect (transactions) + Creditworthiness (DSCR) ─────

/** A single bank transaction, normalized from whatever raw shape mono.co's
 * get_account_statement/get_account_transactions actually return. The Underwriting
 * Agent's LLM component only maps fields into this shape — a relay/normalization
 * task, not computation — so all aggregation (cash flow, recurring debt detection,
 * fraud pattern matching) happens deterministically in code from this list, closing
 * the arithmetic-trust-boundary gap the single-file scorer used to have (it
 * previously trusted the LLM to compute averageMonthlyNetInflow/revenueVarianceRatio/
 * existingMonthlyDebtObligations itself from "dozens of raw transaction records"). */
export interface NormalizedTransaction {
  /** ISO 8601 date. */
  date: string;
  /** Always positive, in NGN. */
  amount: number;
  direction: "credit" | "debit";
  description?: string;
  counterparty?: string;
  /** Running/closing account balance after this transaction, in NGN — only present
   * if mono.co's statement response actually includes balance data (unverified, see
   * mono-underwriting-fields.md's honesty note). The Financial Behaviour engine's
   * liquidity factor and the Cashflow Risk engine's cash reserve factor are
   * best-effort: they use this when present and degrade to a data-unavailable flag
   * (never a fabricated value) when it's absent from every transaction. */
  balanceAfter?: number;
}

/** Raw evidence the Underwriting Agent reports — the last 6 months of transactions
 * for the linked account. Every deterministic engine below derives its own metrics
 * from this same list rather than trusting pre-aggregated numbers. */
export interface TransactionEvidence {
  transactions: NormalizedTransaction[];
  /** "now" for production; injectable for deterministic testing. */
  asOf?: string;
}

/** Metrics derived from TransactionEvidence by underwriting-transactions.ts's
 * deriveCashFlowMetrics() — shared by the Financial Behaviour and Cashflow Risk engines
 * so both read the same computed numbers instead of duplicating aggregation logic. */
export interface CashFlowEvidence {
  /** (total inflows − total outflows) / 6, in NGN. */
  averageMonthlyNetInflow: number;
  /** Coefficient of variation of monthly inflows (stddev / mean). Higher = more seasonal/unstable. */
  revenueVarianceRatio: number;
  /** Sum of recurring debt payments identified in the transaction history, in NGN/month. */
  existingMonthlyDebtObligations: number;
}

/** From assess_creditworthiness's response. */
export interface CreditworthinessEvidence {
  /** Optional: assess_creditworthiness's result is delivered via webhook, not
   * synchronously (mono-server.ts's own tool description) — the Underwriting
   * Agent polls for the webhook result with a bounded timeout (see
   * agents/src/agents/underwriting.ts) and reports undefined, not a fabricated
   * value, if nothing arrives in time. When undefined, the DSCR factor
   * contributes 0 and a DSCR_UNAVAILABLE flag is raised instead of the score
   * silently treating it as a confirmed High-risk DSCR < 1.0. */
  dscr?: number;
  /** Bureau-backed score — banded by the Creditworthiness engine (see
   * underwriting-creditworthiness.ts). Optional for the same reason dscr is:
   * not guaranteed to be present in every assess_creditworthiness response. */
  creditScore?: number;
}

export interface UnderwritingRequestContext {
  requestedAmount: number;
  /** Repayment tenure in months (from FinancingTerms) — used by the Cashflow Risk
   * engine's stress test to estimate a proposed installment as requestedAmount /
   * tenureMonths (principal-only approximation; the real Murabahah installment,
   * including profit margin, isn't set until Stage 8). Optional for test ergonomics;
   * the stress test skips (contributes 0, flags STRESS_TEST_UNAVAILABLE) if absent. */
  tenureMonths?: number;
  /** FinancingRequest.incorporationDate, carried over from ApprovedBusiness at
   * RequestFinancing time. Optional defensively — contracts created before this
   * field existed won't have it; the business-age factor contributes 0 and flags
   * BUSINESS_AGE_UNKNOWN rather than fabricating an age. */
  businessIncorporationDate?: string;
  /** "now" for production; injectable for deterministic testing. */
  asOf?: string;
}

// ─── Underwriting (Stage 6) output ──────────────────────────────────────────

/** Common return shape for each of the four independent scoring engines
 * (underwriting-financial-behaviour.ts, -cashflow-risk.ts, -creditworthiness.ts,
 * -fraud-detection.ts) — a 0-100 sub-score plus the specific flags that produced it. */
export interface EngineResult {
  score: number;
  flags: UnderwritingRiskFlag[];
}

export interface UnderwritingAssessment {
  score: number;
  riskCategory: RiskLevel;
  recommendedLimit: number;
  recommendation: string;
  /** Each populated by its own independent deterministic engine — see
   * underwriting-final-decision.ts for how they combine into `score` above.
   * probabilityOfDefault/lossGivenDefault/exposureAtDefault (Daml's Basel-style
   * PD/LGD/EAD fields on RiskAssessment) are deliberately never set here: no
   * calibrated model or historical loan-outcome data exists yet to responsibly
   * produce those figures — same reasoning as scoring/compliance.ts's CDD gap. */
  behaviouralScore?: number;      // Financial Behaviour engine
  cashflowRiskScore?: number;     // Cashflow Risk engine
  creditworthinessScore?: number; // Creditworthiness engine
  fraudScore?: number;            // Fraud Detection engine
}

export interface UnderwritingRiskFlag {
  code: string;
  description: string;
}

/** Mirrors VerificationDecision/ComplianceDecision exactly — Low risk auto-qualifies
 * (BeginUnderwriting), Medium risk escalates to a human assessor
 * (FlagUnderwritingForManualReview), High risk is a hard veto
 * (RejectUnderwriting) that never reaches the FI. The Fraud Detection hard
 * override (see underwriting-final-decision.ts) forces High regardless of the
 * weighted composite, which naturally routes here to RejectUnderwriting instead
 * of just a flag in the assessment text. */
export type UnderwritingDecision =
  | { action: "BeginUnderwriting"; autoDecided: true }
  | { action: "RejectUnderwriting"; autoDecided: true; reason: string }
  | { action: "FlagUnderwritingForManualReview"; note: string };

export interface UnderwritingScoringResult {
  assessment: UnderwritingAssessment;
  riskFlags: UnderwritingRiskFlag[];
  decision: UnderwritingDecision;
  /** policyVersion of whichever UnderwritingPolicy's scoringWeights were actually used
   * (or the built-in default's version string if no policy was active). */
  scoringPolicyVersion: string;
}

/** Mirrors Vetify.Types.UnderwritingScoringWeights (Daml) field-for-field. Grouped by
 * which of the four engines reads each field, plus the Final Decision engine's
 * combination weights across them (financialBehaviourEngineWeight + cashflowRiskEngineWeight
 * + creditworthinessEngineWeight + fraudDetectionEngineWeight must sum to 100). Kept flat
 * (not nested per-engine objects) so numifyWeights's shallow string-to-number conversion
 * keeps working unchanged, matching VerificationScoringWeights/ComplianceScoringWeights. */
export interface UnderwritingScoringWeights {
  // Cashflow Risk engine (own max 100)
  dscrHigh: number;      // DSCR >= 1.5
  dscrMedium: number;    // DSCR 1.0-1.5
  dscrLow: number;       // DSCR < 1.0
  debtObligationsLow: number;      // existing debt <= 15% of average monthly net inflow
  debtObligationsModerate: number; // 15-30%
  debtObligationsHigh: number;     // > 30%
  cashReserveStrong: number;    // cash reserve >= 2x avg monthly outflow
  cashReserveAdequate: number;  // 1-2x
  cashReserveWeak: number;      // < 1x, or unavailable
  stressTestPassAll: number;      // affordability holds under all 3 haircut scenarios
  stressTestPassPartial: number;  // holds under at least one
  stressTestFail: number;         // fails under every scenario
  /** Cashflow Risk band boundaries — the risk-tolerance cutoffs themselves, distinct
   * from the point values above. Configurable per FI (unlike Fraud Detection's
   * window/multiple constants, which stay hardcoded in underwriting-fraud-detection.ts
   * — those calibrate a pattern-matching rule's shape, not a business risk decision). */
  dscrHighThreshold: number;                // default 1.5
  dscrMediumThreshold: number;               // default 1.0
  debtObligationsLowThreshold: number;       // default 0.15
  debtObligationsModerateThreshold: number;  // default 0.30
  cashReserveStrongMonths: number;           // default 2.0
  cashReserveAdequateMonths: number;         // default 1.0
  stressTestHaircutMild: number;             // default 0.10
  stressTestHaircutModerate: number;         // default 0.25
  stressTestHaircutSevere: number;           // default 0.40
  // Financial Behaviour engine (own max 100)
  revenueConsistent: number;   // variance ratio < revenueConsistentThreshold
  revenueModerate: number;     // variance ratio < revenueModerateThreshold (above Consistent)
  revenueVolatile: number;     // variance ratio >= revenueModerateThreshold
  businessAgeEstablished: number;  // >= businessAgeEstablishedMonths
  businessAgeModerate: number;     // >= businessAgeModerateMonths (below Established)
  businessAgeNew: number;          // < businessAgeModerateMonths
  expenseDisciplineStrong: number;    // outflow/inflow burn rate <= expenseDisciplineStrongThreshold
  expenseDisciplineModerate: number;  // <= expenseDisciplineModerateThreshold (above Strong)
  expenseDisciplinePoor: number;      // > expenseDisciplineModerateThreshold
  liquidityStrong: number;    // balance-derived buffer >= liquidityStrongMonths
  liquidityAdequate: number;  // >= liquidityAdequateMonths (below Strong), or unavailable
  liquidityWeak: number;      // < liquidityAdequateMonths
  /** Financial Behaviour band boundaries — same rationale as above. */
  revenueConsistentThreshold: number;         // default 0.20
  revenueModerateThreshold: number;           // default 0.40
  businessAgeEstablishedMonths: number;       // default 24.0
  businessAgeModerateMonths: number;          // default 12.0
  expenseDisciplineStrongThreshold: number;   // default 0.70
  expenseDisciplineModerateThreshold: number; // default 0.90
  liquidityStrongMonths: number;              // default 2.0
  liquidityAdequateMonths: number;            // default 1.0
  // Creditworthiness engine (own max 100)
  creditScoreExcellent: number; // bureau score >= creditScoreExcellentThreshold
  creditScoreGood: number;      // >= creditScoreGoodThreshold (below Excellent)
  creditScoreFair: number;      // >= creditScoreFairThreshold (below Good)
  creditScorePoor: number;      // < creditScoreFairThreshold, or unavailable
  /** Creditworthiness band boundaries — same rationale as above. */
  creditScoreExcellentThreshold: number; // default 700
  creditScoreGoodThreshold: number;      // default 650
  creditScoreFairThreshold: number;      // default 550
  // Fraud Detection engine (deduction points from a 100 baseline, not band scores)
  fraudStructuringPenalty: number;
  fraudRoundTrippingPenalty: number;
  fraudIncomeSpikePenalty: number;
  fraudVelocityAnomalyPenalty: number;
  // Final Decision engine — must sum to 100
  financialBehaviourEngineWeight: number;
  cashflowRiskEngineWeight: number;
  creditworthinessEngineWeight: number;
  fraudDetectionEngineWeight: number;
  /** Fraud score below this (0-100) forces riskCategory to High regardless of the
   * weighted composite — per-institution, since risk tolerance for a rule-based
   * (non-ML) fraud signal is an FI-specific judgment call, not a universal constant. */
  fraudReviewThreshold: number;
}

/** Fallback used only when no UnderwritingPolicy carries scoringWeights — matches
 * daml-tests/daml/Vetify/Tests/Fixtures.daml's sampleUnderwritingScoringWeights exactly. */
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

/**
 * Daml Int/Decimal fields are JSON-encoded as strings by the v2 Ledger API
 * (confirmed live — e.g. a real UnderwritingPolicy.scoringWeights fetch returns
 * `{"dscrHigh": "40", ...}`, not `{"dscrHigh": 40, ...}`). Casting that raw
 * payload straight to a *ScoringWeights interface with `as` (as every caller of
 * fetchActivePolicyPayload/fetchActiveUnderwritingPolicy does) type-checks fine
 * but is a lie at runtime — every field is actually still a string. Summing
 * those "numbers" with `+` (exactly what scoreVerification/scoreCompliance/
 * scoreUnderwriting do to total a score) silently string-concatenates instead
 * of adding once a real on-ledger policy is active, rather than the
 * DEFAULT_*_WEIGHTS constants (which are genuine JS numbers, so the bug never
 * surfaces against those). This converts every field to a real number —
 * callers should run any weights object sourced from a raw ledger payload
 * through this before passing it to a scoring function.
 */
export function numifyWeights<T>(raw: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)])) as T;
}

// ─── Stage 9: delinquency monitoring ────────────────────────────────────────

/** Snapshot of the fields scoreDelinquency needs from a MurabahahContract payload. */
export interface MonitoringContractSnapshot {
  status: "Active" | "Delinquent" | "DelinquencyManualReview" | "Completed" | "Defaulted";
  /** ISO 8601 date the facility started. */
  startDate: string;
  tenureMonths: number;
  installmentAmount: number;
  /** Installments recorded on-ledger via RecordPayment. */
  installmentsPaid: number;
}

/** Mirrors VerificationDecision/ComplianceDecision's discriminated-union shape.
 * Unlike those two, a "NoOp" case is real and common here — most poll cycles
 * find a current, already-handled, or out-of-scope (Completed/Defaulted)
 * contract and nothing should happen. */
export type MonitoringDecision =
  | { action: "NoOp" }
  | { action: "ResumeActive"; note: string }
  | { action: "FlagDelinquent"; reason: string }
  | { action: "FlagForDelinquencyReview"; note: string };

export interface MonitoringScoringResult {
  missedCount: number;
  decision: MonitoringDecision;
}
