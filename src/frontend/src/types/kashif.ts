import type { RiskLevel } from "@/backend";
import type { Principal } from "@icp-sdk/core/principal";

/** Mirror of backend DealReport type */
export interface DealReport {
  executiveSummary: string;
  financialHighlights: string;
  riskBreakdown: string;
  shariahComplianceStatus: string;
  creditReadiness: string;
  financingRecommendation: string;
  compatibilityScore: bigint;
  generatedAt: bigint;
  mizanVersion: bigint;
  tawthiqVersion: bigint;
}

/** Mirror of backend CompatibilityResult type */
export interface CompatibilityResult {
  businessId: Principal;
  displayName: string;
  compatibilityScore: bigint;
  riskLevel: RiskLevel;
  halalComplianceScore: bigint;
  businessCategory: string;
  financingTypes: string[];
}

/** Mirror of backend ShortlistEntry type */
export interface ShortlistEntry {
  businessId: Principal;
  addedAt: bigint;
}

/** Mirror of backend KashifReportLog type */
export interface KashifReportLog {
  businessId: Principal;
  generatedAt: bigint;
  viewCount: bigint;
  lastViewedAt?: bigint;
}

/** Pagination result for matched borrowers */
export interface MatchedBorrowersPage {
  total: bigint;
  items: CompatibilityResult[];
}

/** Result wrapper for operations that can fail */
export type KashifResult<T> =
  | { __kind__: "ok"; ok: T }
  | { __kind__: "err"; err: string };
