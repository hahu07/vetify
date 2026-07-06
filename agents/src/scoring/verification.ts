/**
 * Deterministic Stage 2 (identity/KYC) scoring — item 1 of the off-ledger
 * determinism work. Implements the point table in
 * agents/skills/verifier/references/risk-scoring-guide.md by default, but the
 * point values themselves are data (VerificationScoringWeights), not
 * constants — callers should pass the active on-ledger VerificationPolicy's
 * scoringWeights when one exists (DEFAULT_VERIFICATION_WEIGHTS otherwise), so
 * risk/compliance ops can retune the rubric via a new policy version without
 * a code deploy. No LLM involved either way: given the same evidence and the
 * same weights, this always produces the same checks/score/decision.
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
import { DEFAULT_VERIFICATION_POLICY_VERSION, DEFAULT_VERIFICATION_WEIGHTS } from "./types.js";
import { classifyRisk } from "../types/index.js";

interface IdentityOutcome { points: number; identityVerified: boolean; apiError: boolean }
interface CacOutcome { points: number; cacRegistered: boolean; seriousNameMismatch: boolean; apiError: boolean }
interface TinOutcome { points: number; dataConsistent: boolean; apiError: boolean }

function scoreIdentity(mashup: MashupResult, w: VerificationScoringWeights): IdentityOutcome {
  if (mashup.kind === "error") return { points: 0, identityVerified: false, apiError: true };
  const { ninVerified, bvnVerified, dobProvided, dobMatch } = mashup.data;
  if (!ninVerified) return { points: w.identityNinNotFound, identityVerified: false, apiError: false };
  if (!bvnVerified) return { points: w.identityBvnNotFound, identityVerified: false, apiError: false };
  if (!dobProvided) return { points: w.identityDobMissing, identityVerified: true, apiError: false };
  return dobMatch
    ? { points: w.identityPerfect, identityVerified: true, apiError: false }
    : { points: w.identityDobMismatch, identityVerified: true, apiError: false };
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
  // Inactive / Struck Off / any other found-but-not-active status
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

/**
 * Pure function: same evidence + same weights in, same checks/score/decision
 * out. Mirrors the override rules in risk-scoring-guide.md, applied in this
 * priority order (highest first): a mono.co API error can never lead to an
 * auto-Reject; failing both identity and CAC is an auto-Reject; failing
 * either alone (but not both) or a serious CAC name mismatch always escalates
 * to a human; only then do the plain Model C score bands apply.
 */
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
    // Per the skill's original rule: documents are only considered valid if
    // every mono.co check completed without an API error.
    documentsValid: !identity.apiError && !cacOutcome.apiError && !tinOutcome.apiError,
    dataConsistent: tinOutcome.dataConsistent,
  };
  const checkScores: VerificationCheckScores = {
    identityScore: identity.points,
    cacScore: cacOutcome.points,
    tinScore: tinOutcome.points,
  };

  // Includes the TIN check: risk-scoring-guide.md's general override row
  // ("Any mono.co call returns HTTP 5xx → Flag — do not penalise score")
  // covers all three calls, not just identity/CAC. Excluding TIN here would
  // let a TIN-only API error slip through to Approve while documentsValid
  // (which does account for a TIN error) is false — a decision the ledger's
  // own "documents not valid" assertion would then refuse at submit time.
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
  } else if (riskLevel === "Low") {
    decision = { action: "Approve", autoDecided: true };
  } else if (riskLevel === "Medium") {
    decision = { action: "FlagForManualReview", note: `Risk score ${riskScore} falls in the Medium band.` };
  } else {
    decision = { action: "Reject", autoDecided: true, reason: `Risk score ${riskScore} falls in the High-risk band.` };
  }

  return { checks, checkScores, riskScore, riskLevel, decision, scoringPolicyVersion: policyVersion };
}
