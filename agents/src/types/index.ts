/**
 * Shared agent-side status/type unions.
 *
 * G15 (docs/platform-review-2026-07.md): these previously drifted from the
 * Daml enums (MurabahahStatus lacked DelinquencyManualReview; FinancingStatus
 * lacked four values) — now realigned with daml/Vetify/Types.daml. This file
 * is one of THREE hand-maintained copies of the Daml enums (the others:
 * frontend/src/api/client.ts, and the Daml source itself). `dpm codegen-js`
 * exists on this SDK and is the real fix — adopting generated bindings is
 * Phase 2 work; until then, any Daml enum change must be mirrored here and
 * in client.ts by hand.
 */
export type RiskLevel = "Low" | "Medium" | "High";
export type ReviewStatus =
  | "Draft"
  | "Pending"
  | "UnderReview"
  | "ManualReview"
  | "PendingAmendment"
  | "Approved"
  | "Rejected";
export type FinancingStatus =
  | "Submitted"
  | "Underwriting"
  | "UnderwritingManualReview"
  | "FinancingApproved"
  | "FinancingRejected"
  | "Withdrawn"
  | "Expired"
  | "Cancelled";
export type MurabahahStatus = "Active" | "Delinquent" | "Completed" | "Defaulted" | "DelinquencyManualReview";

export interface VerificationChecks {
  identityVerified: boolean;
  cacRegistered: boolean;
  documentsValid: boolean;
  dataConsistent: boolean;
}

export interface ComplianceCheck {
  shariahCompliant: boolean;
  amlCleared: boolean;
  kycValidated: boolean;
  cddCompleted: boolean;
}

export interface RiskAssessment {
  score: number;
  riskCategory: RiskLevel;
  recommendedLimit: number;
  recommendation: string;
}

// Thresholds read from env; defaults match .env.example
export const RISK_THRESHOLDS = {
  autoApprove: parseInt(process.env.RISK_THRESHOLD_AUTO_APPROVE ?? "80", 10),
  autoReject: parseInt(process.env.RISK_THRESHOLD_AUTO_REJECT ?? "50", 10),
};

export function classifyRisk(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.autoApprove) return "Low";
  if (score >= RISK_THRESHOLDS.autoReject) return "Medium";
  return "High";
}
