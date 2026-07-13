/**
 * Ported from agents/src/scoring/verification.ts — see scoring/types.ts's
 * doc comment for why this copy exists (dev-only Stage 2/3 simulation route,
 * routes/dev.ts). Logic is identical to the agents-package original.
 */
import type {
  CacResult,
  MashupResult,
  TinResult,
  VerificationCheckScores,
  VerificationChecks,
  VerificationDecision,
  VerificationScoringResult,
  VerificationScoringWeights,
} from "./types.js";
import { DEFAULT_VERIFICATION_POLICY_VERSION, DEFAULT_VERIFICATION_WEIGHTS, classifyRisk } from "./types.js";

interface IdentityOutcome { points: number; identityVerified: boolean; seriousNameMismatch: boolean; apiError: boolean }
interface CacOutcome { points: number; cacRegistered: boolean; seriousNameMismatch: boolean; apiError: boolean }
interface TinOutcome { points: number; dataConsistent: boolean; apiError: boolean }

function scoreIdentity(mashup: MashupResult, w: VerificationScoringWeights): IdentityOutcome {
  if (mashup.kind === "error") return { points: 0, identityVerified: false, seriousNameMismatch: false, apiError: true };
  const { ninVerified, bvnVerified, nameMatch } = mashup.data;
  if (!ninVerified) return { points: w.identityNinNotFound, identityVerified: false, seriousNameMismatch: false, apiError: false };
  if (!bvnVerified) return { points: w.identityBvnNotFound, identityVerified: false, seriousNameMismatch: false, apiError: false };
  if (!nameMatch) return { points: w.identityNameMismatch, identityVerified: true, seriousNameMismatch: true, apiError: false };
  return { points: w.identityVerified, identityVerified: true, seriousNameMismatch: false, apiError: false };
}

function scoreCac(cac: CacResult, w: VerificationScoringWeights): CacOutcome {
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

function scoreTin(tin: TinResult, w: VerificationScoringWeights): TinOutcome {
  switch (tin.kind) {
    case "verifiedMatchesCac":      return { points: w.tinVerifiedMatchesCac, dataConsistent: true, apiError: false };
    case "verifiedDifferentEntity": return { points: w.tinVerifiedDifferentEntity, dataConsistent: true, apiError: false };
    case "notFound":                return { points: w.tinNotFound, dataConsistent: false, apiError: false };
    case "error":                   return { points: w.tinApiError, dataConsistent: true, apiError: true };
  }
}

export function scoreVerification(
  mashup: MashupResult,
  cac: CacResult,
  tin: TinResult,
  weights: VerificationScoringWeights = DEFAULT_VERIFICATION_WEIGHTS,
  policyVersion: string = DEFAULT_VERIFICATION_POLICY_VERSION,
): VerificationScoringResult {
  const identity = scoreIdentity(mashup, weights);
  const cacOutcome = scoreCac(cac, weights);
  const tinOutcome = scoreTin(tin, weights);

  const riskScore = identity.points + cacOutcome.points + tinOutcome.points;
  const riskLevel = classifyRisk(riskScore);

  const checks: VerificationChecks = {
    identityVerified: identity.identityVerified,
    cacRegistered: cacOutcome.cacRegistered,
    documentsValid: !identity.apiError && !cacOutcome.apiError && !tinOutcome.apiError,
    dataConsistent: tinOutcome.dataConsistent,
  };
  const checkScores: VerificationCheckScores = {
    identityScore: identity.points,
    cacScore: cacOutcome.points,
    documentScore: 0,
    consistencyScore: tinOutcome.points,
  };

  const anyApiError = identity.apiError || cacOutcome.apiError || tinOutcome.apiError;
  const bothFailed = !checks.identityVerified && !checks.cacRegistered;
  const eitherFailed = !checks.identityVerified || !checks.cacRegistered;

  let decision: VerificationDecision;
  if (anyApiError) {
    decision = { action: "FlagForManualReview", note: "mono.co API error during identity/CAC/TIN verification — requires manual review." };
  } else if (bothFailed) {
    decision = { action: "Reject", autoDecided: true, reason: "Identity verification and CAC registration both failed." };
  } else if (eitherFailed) {
    decision = { action: "FlagForManualReview", note: "One of identity verification or CAC registration failed — requires manual review." };
  } else if (cacOutcome.seriousNameMismatch) {
    decision = { action: "FlagForManualReview", note: "CAC-registered legal name does not match the submitted business profile name." };
  } else if (identity.seriousNameMismatch) {
    decision = { action: "FlagForManualReview", note: "NIN-verified name does not match BVN-verified name — possible identity fraud." };
  } else if (riskLevel === "Low") {
    decision = { action: "Approve", autoDecided: true };
  } else if (riskLevel === "Medium") {
    decision = { action: "FlagForManualReview", note: `Risk score ${riskScore} falls in the Medium band.` };
  } else {
    decision = { action: "Reject", autoDecided: true, reason: `Risk score ${riskScore} falls in the High-risk band.` };
  }

  return { checks, checkScores, riskScore, riskLevel, decision, scoringPolicyVersion: policyVersion };
}
