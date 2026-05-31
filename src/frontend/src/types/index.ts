import type { ExternalBlob } from "@/backend";
import type { Principal } from "@icp-sdk/core/principal";

export type UserId = Principal;

export enum UserRole {
  admin = "admin",
  financier = "financier",
  businessApplicant = "businessApplicant",
  individual = "individual",
}

export enum DocumentType {
  cacCertificate = "cacCertificate",
  bankStatement = "bankStatement",
  governmentId = "governmentId",
}

export enum HalalComplianceStatus {
  pending = "pending",
  compliant = "compliant",
  flagged = "flagged",
}

export enum RegistrationStatus {
  pending = "pending",
  underReview = "underReview",
  financingReady = "financingReady",
  approved = "approved",
  rejected = "rejected",
}

export enum RiskLevel {
  low = "low",
  pending = "pending",
  high = "high",
  medium = "medium",
}

export enum UploadStatus {
  uploaded = "uploaded",
  notUploaded = "notUploaded",
}

export enum BankLinkStatus {
  NotLinked = "NotLinked",
  Linked = "Linked",
}

export enum KycStatus {
  Failed = "Failed",
  InProgress = "InProgress",
  Verified = "Verified",
  Pending = "Pending",
}

export enum RiskLevel__1 {
  Low = "Low",
  High = "High",
  Medium = "Medium",
}

export interface TransactionSummary {
  totalDebits: bigint;
  income: bigint;
  totalCredits: bigint;
  months: bigint;
}

export interface KycCheckRecord {
  watchlistClean: boolean;
  cacVerified: boolean;
  kycStatus: KycStatus;
  creditScore: bigint;
  bvnVerified: boolean;
  ninVerified: boolean;
  tinVerified: boolean;
  verifiedAt?: bigint;
}

export interface BankLinkRecord {
  status: BankLinkStatus;
  linkedAt?: bigint;
  transactionSummary?: TransactionSummary;
  balance?: bigint;
  accountId?: string;
  institutionName?: string;
  currency?: string;
}

export interface ScoringRecord {
  halalComplianceScore: bigint;
  scoredAt: bigint;
  scoringNotes: string;
  financingReadinessScore: bigint;
  riskLevel: RiskLevel__1;
}

export interface BusinessProfile {
  cacNumber: string;
  userId: UserId;
  createdAt: bigint;
  scoringRecord: ScoringRecord;
  halalComplianceStatus: HalalComplianceStatus;
  contactPerson: string;
  businessName: string;
  businessType: string;
  financingReady: boolean;
  financingReadyScore: bigint;
  kycRecord: KycCheckRecord;
  address: string;
  phoneNumber: string;
  registrationStatus: RegistrationStatus;
  bankLinkRecord: BankLinkRecord;
  riskLevel: RiskLevel;
  annualRevenue: bigint;
  mizanRecord?: MizanRecord[];
}

export interface FinancierProfile {
  institutionName: string;
  userId: UserId;
  createdAt: bigint;
  contactPerson: string;
  areasOfFinancing: Array<string>;
  email: string;
  licenseNumber: string;
  phone: string;
  registrationStatus: RegistrationStatus;
}

export interface DocumentRecord {
  uploadStatus: UploadStatus;
  userId: UserId;
  storageRef?: ExternalBlob;
  docType: DocumentType;
  uploadedAt?: bigint;
}

export interface ApplicantSummary {
  displayName: string;
  userId: UserId;
  role: UserRole;
  halalComplianceStatus: HalalComplianceStatus;
  financingReady: boolean;
  financingReadyScore: bigint;
  riskLevel: RiskLevel;
  applicantType?: "business" | "individual";
}

// ── Mizan Agent Types ─────────────────────────────────────────────────────

export interface MizanRecord {
  incomeStabilityScore: bigint;
  debtBehaviorScore: bigint;
  repaymentPatternScore: bigint;
  revenueTrendScore: bigint;
  overallReadinessScore: bigint;
  halalComplianceScore: bigint;
  riskClassification: RiskLevel__1;
  isBorderline: boolean;
  borderlineReasons: string[];
  narrativeSummary: string;
  computedAt: bigint;
}

// ── Tawthiq Agent Types ────────────────────────────────────────────────────
// Re-export Candid enum values as friendly union strings for UI use.
// The actual runtime types live in @/backend; these are convenience aliases.

export interface ShariaFlag {
  category: string;
  indicator: string;
  severity: "minor" | "major";
}

export interface InconsistencyFlag {
  field: string;
  declaredValue: string;
  verifiedValue: string;
}

export interface TawthiqRecord {
  shariaFlags: ShariaFlag[];
  shariaScreeningNotes: string;
  shariaScreeningStatus: "Pending" | "Passed" | "Failed";
  inconsistencyFlags: InconsistencyFlag[];
  inconsistencyStatus: "Pending" | "Clean" | "Flagged";
  creditReadinessVerdict: "ready" | "conditionalReady" | "notReady";
  narrativeSummary: string;
  completedAt: bigint | null;
  appeals?: TawthiqAppeal[];
}

// Appeal types (mirrored from @/backend for convenience in UI code)
export { AppealStatus } from "@/backend";

export interface TawthiqAppeal {
  id: string;
  status: import("@/backend").AppealStatus;
  documentName?: string;
  documentUrl?: string;
  businessId: UserId;
  flagId: string;
  submittedAt: bigint;
  reviewedAt?: bigint;
  adminNote?: string;
  appealText: string;
}

export type AnyProfile = BusinessProfile | FinancierProfile | IndividualProfile;

// ── Individual Applicant Types ─────────────────────────────────────────────

export type EmploymentStatus =
  | "employed"
  | "selfEmployed"
  | "unemployed"
  | "student";

export type IncomeSource =
  | "employment"
  | "selfEmployment"
  | "business"
  | "other";

export type FinancingPurpose =
  | "homePurchase"
  | "vehicle"
  | "education"
  | "medical"
  | "startupCapital"
  | "other";

export interface IndividualProfile {
  userId: UserId;
  fullName: string;
  bvn: string;
  nin: string;
  dateOfBirth: string;
  address: string;
  occupation: string;
  employmentStatus: EmploymentStatus;
  incomeSource: IncomeSource;
  employerName?: string;
  monthlyIncome: bigint;
  financingPurpose: FinancingPurpose;
  financingAmountSought: bigint;
  preferredInstrument: string;
  registrationStatus: RegistrationStatus;
  kycRecord: KycCheckRecord;
  bankLinkRecord: BankLinkRecord;
  financingReady: boolean;
  createdAt: bigint;
  tawthiqRecord?: IndividualTawthiqRecord;
  mizanRecord?: IndividualMizanRecord;
}

export interface IndividualTawthiqRecord {
  shariaFlags: ShariaFlag[];
  shariaScreeningNotes: string;
  shariaScreeningStatus: "Pending" | "Passed" | "Failed";
  inconsistencyFlags: InconsistencyFlag[];
  inconsistencyStatus: "Pending" | "Clean" | "Flagged";
  creditReadinessVerdict: "ready" | "conditionalReady" | "notReady";
  narrativeSummary: string;
  completedAt: bigint | null;
  appeals?: TawthiqAppeal[];
}

export interface IndividualMizanRecord {
  incomeStabilityScore: bigint;
  debtBehaviorScore: bigint;
  repaymentPatternScore: bigint;
  overallReadinessScore: bigint;
  halalComplianceScore: bigint;
  riskClassification: RiskLevel__1;
  isBorderline: boolean;
  borderlineReasons: string[];
  narrativeSummary: string;
  computedAt: bigint;
}

export interface IndividualSummary {
  userId: UserId;
  fullName: string;
  financingPurpose: FinancingPurpose;
  financingAmountSought: bigint;
  preferredInstrument: string;
  registrationStatus: RegistrationStatus;
  kycStatus: KycStatus;
  financingReady: boolean;
  riskLevel: RiskLevel__1;
  halalComplianceStatus: HalalComplianceStatus;
}

// ── Admin Analytics Types ──────────────────────────────────────────────────

export interface AdminAnalytics {
  totalBusinesses: number;
  totalIndividuals: number;
  totalFinanciers: number;
  financingReadyCount: number;
  pendingKycCount: number;
  tawthiqPassRate: number;
  averageMizanScore: number;
  activeFinanciers: number;
}

// ── Account Closure Types ──────────────────────────────────────────────────

export interface AccountClosureRequest {
  userId: UserId;
  reason: string;
  requestedAt: bigint;
  status: "pending" | "approved" | "rejected";
}

// ── Deal Report (frontend convenience mirror) ─────────────────────────────

export interface DealReport {
  creditReadiness: string;
  compatibilityScore: bigint;
  financingRecommendation: string;
  riskBreakdown: string;
  generatedAt: bigint;
  mizanVersion: bigint;
  executiveSummary: string;
  tawthiqVersion: bigint;
  financialHighlights: string;
  shariahComplianceStatus: string;
  applicantType?: "business" | "individual";
  suggestedFinancingStructure?: string;
}

export type StatusVariant = "success" | "warning" | "pending" | "danger";

export interface NavItem {
  label: string;
  href: string;
}
