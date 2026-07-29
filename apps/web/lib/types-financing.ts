// Mirrors the Daml records in daml/Vetify/Types.daml consumed by the
// Financing (Stage 5-7) slice. FinancingTerms.amount and RiskAssessment's
// Decimal fields are real NUMERIC columns (addendum A) -- these interfaces
// describe the request/response shape, not the DB row shape.

export type RiskLevel = "Low" | "Medium" | "High";

export interface FinancingTerms {
  amount: number;
  purpose: string;
  tenureMonths: number;
}

export interface RiskAssessment {
  score: number;
  riskCategory: RiskLevel;
  recommendedLimit: number;
  recommendation: string;
  probabilityOfDefault?: number | null;
  lossGivenDefault?: number | null;
  exposureAtDefault?: number | null;
  behaviouralScore?: number | null;
  cashflowRiskScore?: number | null;
  creditworthinessScore?: number | null;
  fraudScore?: number | null;
}
