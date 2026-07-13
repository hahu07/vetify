/**
 * Deterministic Stage 0 (financing provider registration) scoring — closes the
 * "no off-ledger again" gap: FinancingProviderOnboarding previously carried zero
 * automated signal, just vetify's private off-ledger judgment. Mirrors Stage 2's
 * shape (agents/src/scoring/verification.ts) using the same CAC lookup evidence,
 * against the provider's own cacRegNumber instead of a business director's.
 *
 * Two independent signals, both required for a provider to qualify:
 *   1. A CAC registry lookup on the provider's own registration (reuses
 *      lookup_cac exactly — same tool, same evidence shape, different entity).
 *   2. Regulatory completeness, conditional on providerType — CBNLicensedNIFI/
 *      SECFundManager/PenComPensionManager genuinely require a regulatoryBody +
 *      licenseNumber; CooperativeSociety/InvestmentClub/WaqfFund/ZakatFund/
 *      Philanthropy are legitimately lighter-regulated or unregulated, so having
 *      neither is not itself a red flag for those types.
 *
 * approvedInstruments is always a governing-document judgment call no automated
 * check can make, so a Low-risk, no-flags outcome never fully auto-approves —
 * it only records the score (RecordScore) for vetify to review alongside the
 * governing documents, same principle as Stage 3's CDD purpose-coherence gap
 * (never fabricate a decision for a factor with no real automatable data).
 */
import type {
  CacResult,
  ProviderType,
  ProviderVerificationDecision,
  ProviderVerificationScoringResult,
  ProviderVerificationScoringWeights,
} from "./types.js";
import { DEFAULT_PROVIDER_VERIFICATION_POLICY_VERSION, DEFAULT_PROVIDER_VERIFICATION_WEIGHTS } from "./types.js";
import { classifyRisk } from "../types/index.js";

const REGULATED_TYPES = new Set<ProviderType>(["CBNLicensedNIFI", "SECFundManager", "PenComPensionManager"]);

interface CacOutcome { points: number; cacRegistered: boolean; seriousNameMismatch: boolean; apiError: boolean }
interface RegulatoryOutcome { points: number; seriousGap: boolean }

function scoreProviderCac(cac: CacResult, w: ProviderVerificationScoringWeights): CacOutcome {
  if (cac.kind === "error") return { points: 0, cacRegistered: false, seriousNameMismatch: false, apiError: true };
  const { found, status, nameMatch } = cac.data;
  if (!found) return { points: w.cacNotFound, cacRegistered: false, seriousNameMismatch: false, apiError: false };
  if (status === "Active") {
    if (nameMatch === "exact") return { points: w.cacActiveExactMatch, cacRegistered: true, seriousNameMismatch: false, apiError: false };
    if (nameMatch === "close") return { points: w.cacActiveCloseMatch, cacRegistered: true, seriousNameMismatch: false, apiError: false };
    return { points: w.cacActiveNameMismatch, cacRegistered: true, seriousNameMismatch: true, apiError: false }; // mismatch
  }
  if (status === "Pending") return { points: w.cacPending, cacRegistered: true, seriousNameMismatch: false, apiError: false };
  return { points: w.cacInactiveOrStruckOff, cacRegistered: true, seriousNameMismatch: false, apiError: false };
}

function scoreRegulatoryCompleteness(
  providerType: ProviderType,
  regulatoryBody: string | null,
  licenseNumber: string | null,
  w: ProviderVerificationScoringWeights,
): RegulatoryOutcome {
  if (!REGULATED_TYPES.has(providerType)) {
    // Legitimately lighter-regulated/unregulated category — absence of a
    // regulator/license is expected, not a red flag.
    return { points: w.unregulatedDeclared, seriousGap: false };
  }
  if (regulatoryBody && licenseNumber) {
    return { points: w.regulatedWithLicense, seriousGap: false };
  }
  // Claims a regulator-requiring provider type but is missing the proof —
  // a real gap, always flags regardless of score.
  return { points: w.regulatedMissingLicense, seriousGap: true };
}

/**
 * Pure function: same evidence + same weights in, same score/decision out.
 * Priority order (highest first): a mono.co API error can never lead to an
 * auto-Reject; CAC not found is an auto-Reject; a serious CAC name mismatch or
 * a regulated-type missing its license always escalates to a human; only then
 * do the plain Model C score bands apply — and even a Low-risk score never
 * fully auto-approves (see module doc comment).
 */
export function scoreProviderVerification(
  cac: CacResult,
  providerType: ProviderType,
  regulatoryBody: string | null,
  licenseNumber: string | null,
  weights: ProviderVerificationScoringWeights = DEFAULT_PROVIDER_VERIFICATION_WEIGHTS,
  policyVersion: string = DEFAULT_PROVIDER_VERIFICATION_POLICY_VERSION,
): ProviderVerificationScoringResult {
  const cacOutcome = scoreProviderCac(cac, weights);
  const regOutcome = scoreRegulatoryCompleteness(providerType, regulatoryBody, licenseNumber, weights);

  const riskScore = cacOutcome.points + regOutcome.points;
  const riskLevel = classifyRisk(riskScore);

  let decision: ProviderVerificationDecision;
  if (cacOutcome.apiError) {
    decision = { action: "FlagForManualReview", note: "mono.co API error during CAC verification — requires manual review." };
  } else if (!cacOutcome.cacRegistered) {
    decision = { action: "Reject", autoDecided: true, reason: "CAC registration number not found." };
  } else if (cacOutcome.seriousNameMismatch) {
    decision = { action: "FlagForManualReview", note: "CAC-registered legal name does not match the submitted provider name." };
  } else if (regOutcome.seriousGap) {
    decision = { action: "FlagForManualReview", note: "Provider type requires a regulatory body and license number, but one or both are missing." };
  } else if (riskLevel === "High") {
    decision = { action: "Reject", autoDecided: true, reason: `Risk score ${riskScore} falls in the High-risk band.` };
  } else if (riskLevel === "Medium") {
    decision = { action: "FlagForManualReview", note: `Risk score ${riskScore} falls in the Medium band.` };
  } else {
    decision = { action: "RecordScore" };
  }

  return { riskScore, riskLevel, decision, scoringPolicyVersion: policyVersion };
}
