export type RiskLevel = "Low" | "Medium" | "High";
export type ReviewStatus =
  | "Draft"
  | "Pending"
  | "UnderReview"
  | "ManualReview"
  | "PendingAmendment"
  | "Approved"
  | "Rejected";
export type FinancingStatus = "Submitted" | "Underwriting" | "FinancingApproved" | "FinancingRejected";
export type MurabahahStatus = "Active" | "Delinquent" | "Completed" | "Defaulted";

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

export interface RiskDecision {
  riskScore: number;         // 0–100
  riskLevel: RiskLevel;
  autoDecided: boolean;
  reason?: string;
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
