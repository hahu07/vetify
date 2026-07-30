"use client";

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Trimmed port of frontend/src/api/client.ts's hooks -- same names/shapes
// where the underlying choice exists in this slice's backend, so the ported
// page components need minimal changes. No Raw*/adapt* layer: this API
// already returns camelCase JSON with real numbers (see lib/serialize.ts on
// the server side), so there's nothing to unwrap or convert.
//
// Deliberately NOT ported (no backend support in this Phase 1 slice): amend/
// withdraw/request-amendment, escalate-overdue, suspend/reinstate/expire/
// revoke/recertify business actions, Supersede (verification + compliance
// results), EDD case management, document upload with server-side storage.

const apiClient = axios.create({ baseURL: "/api" });

// ─── Types (mirrors frontend/src/api/client.ts's shapes) ───────────────────

export type ReviewStatus = "Draft" | "UnderReview" | "ManualReview" | "Pending" | "Approved" | "Rejected";
export type RiskLevel = "Low" | "Medium" | "High";
export type BusinessType = "SoleProprietorship" | "LimitedCompany";

export interface BusinessDirector {
  name: string;
  address: string;
  phoneNumber: string;
  ninNumber: string;
  bvn: string;
  email: string;
}

export interface BusinessProfile {
  name: string;
  address: string;
  state: string;
  phoneNumber: string;
  email: string;
  website?: string;
  businessType: BusinessType;
  incorporationDate: string;
  directors: BusinessDirector[];
  businessActivity: string;
  businessSector: string;
}

export interface BusinessKyc {
  cacRegNumber: string;
  taxId: string;
}

export interface DocumentRef {
  docType: string;
  contentHash: string;
  storageRef: string;
  fileSize?: number;
}

export interface Onboarding {
  id: string;
  profile: BusinessProfile;
  kyc: BusinessKyc;
  status: ReviewStatus;
  agentScore?: number;
  agentRisk?: RiskLevel;
  agentNote?: string;
  submittedAt?: string;
  onboardingRef?: string;
  documents: DocumentRef[];
}

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

export interface ComplianceReviewItem {
  id: string;
  businessName: string;
  cacNumber: string;
  businessSector: string;
  businessActivity: string;
  verificationRef: string;
  complianceRef: string;
  submittedAt?: string;
  status: ReviewStatus;
  checks?: ComplianceCheck;
  agentScore?: number;
  agentRisk?: RiskLevel;
}

export interface VerificationResultItem {
  id: string;
  businessName: string;
  cacRegNumber: string;
  outcome: "Approved" | "Rejected";
  riskScore: number;
  riskLevel: RiskLevel;
  autoDecided: boolean;
  verificationRef: string;
  decidedAt: string;
  note?: string;
}

export interface ComplianceResultItem {
  id: string;
  businessName: string;
  cacRegNumber: string;
  outcome: "Approved" | "Rejected";
  riskScore: number;
  riskLevel: RiskLevel;
  decidedAt: string;
  verificationRef: string;
  complianceRef: string;
  reason?: string;
}

export interface ApprovedBusiness {
  id: string;
  businessName: string;
  cacRegNumber: string;
  status: string;
  approvedAt: string;
}

// ─── Onboarding (Stage 1-2) ─────────────────────────────────────────────────

export function useOnboardingList() {
  return useQuery({
    queryKey: ["onboarding"],
    queryFn: async () => (await apiClient.get<Onboarding[]>("/onboarding")).data,
  });
}

export interface CreateOnboardingPayload {
  profile: BusinessProfile;
  kyc: BusinessKyc;
  documents: DocumentRef[];
  onboardingRef: string;
}

export function useCreateOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOnboardingPayload) => apiClient.post("/onboarding", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useSubmitOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/onboarding/${id}/submit`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useApproveOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      checks,
      riskScore,
      riskLevel,
      verificationRef,
    }: {
      id: string;
      checks: VerificationChecks;
      riskScore: number;
      riskLevel: RiskLevel;
      verificationRef: string;
    }) =>
      apiClient
        .post(`/onboarding/${id}/approve`, { checks, riskScore, riskLevel, autoDecided: false, verificationRef })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      qc.invalidateQueries({ queryKey: ["verification-results"] });
    },
  });
}

export function useRejectOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      checks,
      riskScore,
      riskLevel,
      verificationRef,
      reason,
    }: {
      id: string;
      checks: VerificationChecks;
      riskScore: number;
      riskLevel: RiskLevel;
      verificationRef: string;
      reason: string;
    }) =>
      apiClient
        .post(`/onboarding/${id}/reject`, { checks, riskScore, riskLevel, autoDecided: false, verificationRef, reason })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      qc.invalidateQueries({ queryKey: ["verification-results"] });
    },
  });
}

export function useFlagOnboardingForManualReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, riskScore, riskLevel, note }: { id: string; riskScore: number; riskLevel: RiskLevel; note: string }) =>
      apiClient
        .post(`/onboarding/${id}/flag`, { riskScore, riskLevel, agentVersion: "manual-review", note })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useVerificationResults() {
  return useQuery({
    queryKey: ["verification-results"],
    queryFn: async () => (await apiClient.get<VerificationResultItem[]>("/verification-results")).data,
  });
}

export function useApprovedBusinesses() {
  return useQuery({
    queryKey: ["approved-businesses"],
    queryFn: async () => (await apiClient.get<ApprovedBusiness[]>("/approved-businesses")).data,
  });
}

// ─── Compliance (Stage 3-4) ─────────────────────────────────────────────────

export function useComplianceQueue() {
  return useQuery({
    queryKey: ["compliance-queue"],
    queryFn: async () => (await apiClient.get<ComplianceReviewItem[]>("/compliance")).data,
  });
}

/** Not in the real frontend/'s hook set -- this slice has no autonomous
 * Verifier Agent to auto-create a ComplianceReview after an approved
 * VerificationResult, so it's a manual button here instead. */
export function useOpenComplianceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (verificationResultId: string) =>
      apiClient.post("/compliance", { verificationResultId: Number(verificationResultId) }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance-queue"] }),
  });
}

export function useStartReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/compliance/${id}/start`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance-queue"] }),
  });
}

export function useApproveCompliance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      completedChecks,
      riskScore,
      riskLevel,
      reviewerAuthId,
      eddCaseId,
    }: {
      id: string;
      completedChecks: ComplianceCheck;
      riskScore: number;
      riskLevel: RiskLevel;
      reviewerAuthId: number;
      eddCaseId?: number | null;
    }) =>
      apiClient
        .post(`/compliance/${id}/approve`, { completedChecks, riskScore, riskLevel, autoDecided: false, reviewerAuthId, eddCaseId: eddCaseId ?? null })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-queue"] });
      qc.invalidateQueries({ queryKey: ["approved-businesses"] });
    },
  });
}

export function useRejectCompliance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      completedChecks,
      riskScore,
      riskLevel,
      reason,
      reviewerAuthId,
    }: {
      id: string;
      completedChecks: ComplianceCheck;
      riskScore: number;
      riskLevel: RiskLevel;
      reason: string;
      reviewerAuthId: number;
    }) =>
      apiClient
        .post(`/compliance/${id}/reject`, { completedChecks, riskScore, riskLevel, autoDecided: false, reason, reviewerAuthId })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compliance-queue"] });
      qc.invalidateQueries({ queryKey: ["compliance-results"] });
    },
  });
}

// ─── Phase 2, Twentieth Slice: EDDCase (G14) checklist UI ──────────────────
// Raw row shape matches lib/domain/compliance.ts's SELECT * -- snake_case,
// same pre-existing convention every other registry/case row already has.

export interface EddCaseEntry {
  id: number;
  compliance_review_id: number;
  business_name: string;
  cac_reg_number: string;
  trigger_reason: string;
  source_of_wealth_verified: boolean;
  source_of_wealth_note: string | null;
  enhanced_media_search_done: boolean;
  senior_management_signoff: string | null;
  monitoring_frequency: string | null;
  status: "EddOpen" | "EddClosed";
  opened_at: string;
  closed_at: string | null;
  closed_by: string | null;
}

export function useEddCases() {
  return useQuery({ queryKey: ["edd-cases"], queryFn: async () => (await apiClient.get<EddCaseEntry[]>("/edd-cases")).data });
}
export function useOpenEddCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, triggerReason }: { reviewId: string; triggerReason: string }) =>
      apiClient.post(`/compliance/${reviewId}/open-edd-case`, { triggerReason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["edd-cases"] }),
  });
}
export function useUpdateEddChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...fields
    }: {
      id: number;
      sourceOfWealthVerified?: boolean | null;
      sourceOfWealthNote?: string | null;
      enhancedMediaSearchDone?: boolean | null;
      seniorManagementSignoff?: string | null;
      monitoringFrequency?: string | null;
    }) => apiClient.post(`/edd-cases/${id}/update-checklist`, fields).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["edd-cases"] }),
  });
}
export function useCloseEddCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, closedBy }: { id: number; closedBy: string }) =>
      apiClient.post(`/edd-cases/${id}/close`, { closedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["edd-cases"] }),
  });
}

export function useFlagComplianceForManualReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, riskScore, riskLevel, note }: { id: string; riskScore: number; riskLevel: RiskLevel; note: string }) =>
      apiClient
        .post(`/compliance/${id}/flag`, { riskScore, riskLevel, agentVersion: "manual-review", note })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance-queue"] }),
  });
}

export function useComplianceResults() {
  return useQuery({
    queryKey: ["compliance-results"],
    queryFn: async () => (await apiClient.get<ComplianceResultItem[]>("/compliance-results")).data,
  });
}

// ─── Financing (Stage 5-7) ──────────────────────────────────────────────────

export type FinancingStatus = "Submitted" | "Underwriting" | "UnderwritingManualReview" | "FinancingApproved" | "FinancingRejected";

export interface FinancingTerms {
  amount: number;
  purpose: string;
  tenureMonths: number;
}

export interface FinancingRequest {
  id: string;
  cacRegNumber: string;
  businessName: string;
  terms: FinancingTerms;
  status: FinancingStatus;
  financingRef: string;
  submittedAt?: string;
  businessSector: string;
  agentScore?: number;
  agentRisk?: RiskLevel;
  agentNote?: string;
}

export interface RiskAssessment {
  score: number;
  riskCategory: RiskLevel;
  recommendedLimit: number;
  recommendation: string;
}

export interface AssetDetails {
  description: string;
  supplier: string;
  supplierRef: string;
  estimatedCost: number;
}

export interface FinancingDecisionItem {
  id: string;
  cacRegNumber: string;
  businessName: string;
  financingRef: string;
  outcome: "FinancingApproved" | "FinancingRejected";
  reason?: string;
  decidedAt: string;
}

/**
 * approveFunding/rejectFunding both archive the financing_request row
 * (archived_at set, mirroring Daml's archive-on-decision semantics) --
 * useFinancingList's /api/financing filters WHERE archived_at IS NULL
 * server-side, so a decided request never reappears there. Recent
 * decisions must be read from financing_decision instead (confirmed live:
 * a request approved via the FI page vanished from /api/financing
 * entirely, not just changed status).
 */
export function useFinancingDecisions() {
  return useQuery({
    queryKey: ["financing-decisions"],
    queryFn: async () => (await apiClient.get<FinancingDecisionItem[]>("/financing-decisions")).data,
  });
}

export function useFinancingList() {
  return useQuery({
    queryKey: ["financing-list"],
    queryFn: async () => (await apiClient.get<FinancingRequest[]>("/financing")).data,
  });
}

export function useCreateFinancing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { terms: FinancingTerms; financingRef: string; businessSector: string }) =>
      apiClient.post("/financing", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financing-list"] }),
  });
}

export function useBeginUnderwriting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assessment }: { id: string; assessment: RiskAssessment }) =>
      apiClient.post(`/financing/${id}/begin-underwriting`, { assessment, autoDecided: false }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financing-list"] }),
  });
}

export function useRejectUnderwriting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient
        .post(`/financing/${id}/reject-underwriting`, { reason, autoDecided: false, reviewerParty: "assessor" })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financing-list"] }),
  });
}

export function useFlagUnderwritingForManualReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, riskScore, riskLevel, note }: { id: string; riskScore: number; riskLevel: RiskLevel; note: string }) =>
      apiClient
        .post(`/financing/${id}/flag`, { riskScore, riskLevel, agentVersion: "manual-review", note })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financing-list"] }),
  });
}

export function useApproveFunding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, assetDetails, approvedProviderId, approvingOfficerId, approvedByName,
    }: { id: string; assetDetails: AssetDetails; approvedProviderId: string; approvingOfficerId: string; approvedByName: string }) =>
      apiClient.post(`/financing/${id}/approve`, { assetDetails, approvedProviderId: Number(approvedProviderId), approvingOfficerId, approvedByName }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financing-list"] });
      qc.invalidateQueries({ queryKey: ["financing-decisions"] });
    },
  });
}

export function useRejectFunding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/financing/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financing-list"] });
      qc.invalidateQueries({ queryKey: ["financing-decisions"] });
    },
  });
}

// ─── Murabahah acquisition chain (Stage 8) ─────────────────────────────────

export interface MurabahahWad {
  id: string;
  cacRegNumber: string;
  businessName: string;
  terms: FinancingTerms;
  assetDetails: { description: string; supplier: string; supplierRef: string; estimatedCost: number };
  financingRef?: string;
}

export interface AssetPurchaseRecord {
  id: string;
  cacRegNumber: string;
  businessName: string;
  terms: FinancingTerms;
  assetDescription: string;
  actualCost: number;
  purchaseDate: string;
  invoiceRef: string;
  totalAcquisitionCost: number;
  deliveryAcknowledged: boolean;
}

export interface PaymentScheduleEntry {
  installmentNo: number;
  dueDate: string;
  dueAmount: number;
}

export interface MurabahahTerms {
  assetCost: number;
  profitAmount: number;
  salePrice: number;
  installmentAmount: number;
  tenureMonths: number;
}

export interface MurabahahProposal {
  id: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  murabahahTerms: MurabahahTerms;
  paymentSchedule: PaymentScheduleEntry[];
  startDate: string;
  acceptanceExpiresAt?: string | null;
}

export interface ShariahContractCertification {
  id: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  certificationRef: string;
  verdict: string;
  certifiedBy: string;
}

export interface MurabahahContract {
  id: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  murabahahTerms: MurabahahTerms;
  startDate: string;
  outstandingBalance: number;
  installmentsPaid: number;
  pendingInstallmentPaid: number;
  status: "Active" | "Delinquent" | "Completed" | "Defaulted" | "DelinquencyManualReview";
  shariahCertificationRef: string;
  shariahCertifiedBy: string;
  activeMoratorium?: string;
}

export interface RepaymentRecord {
  id: string;
  murabahahContractId: string;
  installmentNo: number;
  dueDate: string;
  paymentDate: string;
  amountPaid: number;
  remainingBalance: number;
  wasLate: boolean;
}

export function useMurabahahWads() {
  return useQuery({ queryKey: ["murabahah-wads"], queryFn: async () => (await apiClient.get<MurabahahWad[]>("/murabahah-wads")).data });
}

export function useProceedDirectly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      actualCost,
      purchaseDate,
      invoiceRef,
    }: {
      id: string;
      actualCost: number;
      purchaseDate: string;
      invoiceRef: string;
    }) => apiClient.post(`/murabahah-wads/${id}/proceed-directly`, { actualCost, purchaseDate, invoiceRef }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["murabahah-wads"] });
      qc.invalidateQueries({ queryKey: ["asset-purchase-records"] });
    },
  });
}

export function useAssetPurchaseRecords() {
  return useQuery({
    queryKey: ["asset-purchase-records"],
    queryFn: async () => (await apiClient.get<AssetPurchaseRecord[]>("/asset-purchase-records")).data,
  });
}

export function useAcknowledgeDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/asset-purchase-records/${id}/acknowledge-delivery`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset-purchase-records"] }),
  });
}

export function useOfferMurabahah() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      murabahahTerms,
      paymentSchedule,
      facilityRef,
      startDate,
    }: {
      id: string;
      murabahahTerms: MurabahahTerms;
      paymentSchedule: PaymentScheduleEntry[];
      facilityRef: string;
      startDate: string;
    }) => apiClient.post(`/asset-purchase-records/${id}/offer`, { murabahahTerms, paymentSchedule, facilityRef, startDate }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-purchase-records"] });
      qc.invalidateQueries({ queryKey: ["murabahah-proposals"] });
    },
  });
}

export function useMurabahahProposals() {
  return useQuery({
    queryKey: ["murabahah-proposals"],
    queryFn: async () => (await apiClient.get<MurabahahProposal[]>("/murabahah-proposals")).data,
  });
}

export function useShariahContractCertifications() {
  return useQuery({
    queryKey: ["shariah-certifications"],
    queryFn: async () => (await apiClient.get<ShariahContractCertification[]>("/shariah-contract-certifications")).data,
  });
}

export function useCertifyShariahTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      certificationRef,
      aaoifiStandards,
      rationale,
      certifiedBy,
    }: {
      id: string;
      certificationRef: string;
      aaoifiStandards: string[];
      rationale: string;
      certifiedBy: string;
    }) =>
      apiClient
        .post(`/murabahah-proposals/${id}/certify-shariah`, { certificationRef, aaoifiStandards, rationale, certifiedBy })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shariah-certifications"] }),
  });
}

export function useAcceptProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, certificationId }: { id: string; certificationId: number }) =>
      apiClient.post(`/murabahah-proposals/${id}/accept`, { certificationId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["murabahah-proposals"] });
      qc.invalidateQueries({ queryKey: ["murabahah-contracts"] });
    },
  });
}

// ─── Murabahah repayment lifecycle (Stage 9-10) ────────────────────────────

export function useMurabahahContracts() {
  return useQuery({
    queryKey: ["murabahah-contracts"],
    queryFn: async () => (await apiClient.get<MurabahahContract[]>("/murabahah-contracts")).data,
  });
}

export function useRepaymentRecords(murabahahContractId?: string) {
  return useQuery({
    queryKey: ["repayment-records", murabahahContractId],
    queryFn: async () =>
      (
        await apiClient.get<RepaymentRecord[]>("/repayment-records", {
          params: murabahahContractId ? { murabahahContractId } : undefined,
        })
      ).data,
    enabled: murabahahContractId !== undefined,
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      paymentDate,
      amountPaid,
      installmentNo,
    }: {
      id: string;
      paymentDate: string;
      amountPaid: number;
      installmentNo: number;
    }) => apiClient.post(`/murabahah-contracts/${id}/record-payment`, { paymentDate, amountPaid, installmentNo }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["murabahah-contracts"] });
      qc.invalidateQueries({ queryKey: ["repayment-records"] });
    },
  });
}

export function useCloseContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/murabahah-contracts/${id}/close-contract`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["murabahah-contracts"] }),
  });
}

// ─── Governance registries ──────────────────────────────────────────────────
// Raw row shapes from lib/domain/governance.ts's listRegistry -- unlike every
// other endpoint in this app, registry routes return DB rows directly with no
// camelCase serializer (a pre-existing inconsistency from the codegen pass,
// not something this UI pass introduced or needed to fix) -- field names
// below are snake_case to match exactly what the API actually returns.

export interface OfficerEntry {
  id: number;
  officer_id: string;
  officer_name: string;
  roles: string[];
  authorized_by: string;
  authorized_at: string;
  active: boolean;
  approval_limit: number | null;
}

export interface PolicyApproverEntry {
  id: number;
  approver_name: string;
  role: string;
  authorized_by: string;
  authorized_at: string;
  active: boolean;
}

export interface AssessorEntry {
  id: number;
  assessor: string;
  role: string;
  authorized_by: string;
  authorized_at: string;
  active: boolean;
}

export interface SentinelRegistryEntry {
  id: number;
  sentinel: string;
  role: string;
  authorized_by: string;
  authorized_at: string;
  active: boolean;
}

export interface AdvisorEntry {
  id: number;
  advisor: string;
  role: string;
  authorized_by: string;
  authorized_at: string;
  active: boolean;
}

interface DeactivateReactivateArgs {
  id: number;
  reason: string;
  performedBy: string;
}

export function useOfficers() {
  return useQuery({ queryKey: ["officers"], queryFn: async () => (await apiClient.get<OfficerEntry[]>("/governance/officers")).data });
}
export function useRegisterOfficer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { officerId: string; officerName: string; roles: string[]; authorizedBy: string; approvalLimit?: number | null }) =>
      apiClient.post("/governance/officers", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["officers"] }),
  });
}
export function useDeactivateOfficer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: DeactivateReactivateArgs) =>
      apiClient.post(`/governance/officers/${id}/deactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["officers"] }),
  });
}
export function useReactivateOfficer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: DeactivateReactivateArgs) =>
      apiClient.post(`/governance/officers/${id}/reactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["officers"] }),
  });
}

export function usePolicyApprovers() {
  return useQuery({
    queryKey: ["policy-approvers"],
    queryFn: async () => (await apiClient.get<PolicyApproverEntry[]>("/governance/policy-approvers")).data,
  });
}
export function useRegisterPolicyApprover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { approverName: string; role: string; authorizedBy: string }) =>
      apiClient.post("/governance/policy-approvers", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy-approvers"] }),
  });
}
export function useDeactivatePolicyApprover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: DeactivateReactivateArgs) =>
      apiClient.post(`/governance/policy-approvers/${id}/deactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy-approvers"] }),
  });
}
export function useReactivatePolicyApprover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: DeactivateReactivateArgs) =>
      apiClient.post(`/governance/policy-approvers/${id}/reactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy-approvers"] }),
  });
}

// ─── Phase 2, Nineteenth Slice: VerificationPolicy/CompliancePolicy governance UI ──
// Raw row shapes match lib/domain/policy.ts's SELECT * -- snake_case, same
// pre-existing inconsistency governance registry rows already have (no
// camelCase serializer exists for either).

export interface VerificationPolicyEntry {
  id: number;
  max_amendments: number;
  sla_hours: number;
  auto_approve_min: number;
  auto_reject_max: number;
  required_doc_types: string[];
  policy_version: string;
  scoring_weights: Record<string, number>;
  created_at: string;
  archived_at: string | null;
}

export interface PendingVerificationPolicyEntry extends VerificationPolicyEntry {
  proposed_by: string;
  reason: string;
  proposed_at: string;
  risk_committee_endorsed_by: string | null;
  risk_committee_endorsed_at: string | null;
}

export interface CompliancePolicyEntry {
  id: number;
  auto_approve_min: number;
  auto_reject_max: number;
  escalation_sla_hours: number;
  shariah_policy_version: string;
  policy_version: string;
  effective_from: string;
  effective_to: string | null;
  scoring_weights: Record<string, number>;
  created_at: string;
  archived_at: string | null;
}

export interface PendingCompliancePolicyEntry extends CompliancePolicyEntry {
  proposed_by: string;
  reason: string;
  proposed_at: string;
  risk_committee_endorsed_by: string | null;
  risk_committee_endorsed_at: string | null;
}

export interface ProposeVerificationPolicyPayload {
  maxAmendments: number;
  slaHours: number;
  autoApproveMin: number;
  autoRejectMax: number;
  requiredDocTypes: string[];
  policyVersion: string;
  scoringWeights: Record<string, number>;
  proposedBy: string;
  reason: string;
}

export interface ProposeCompliancePolicyPayload {
  autoApproveMin: number;
  autoRejectMax: number;
  escalationSlaHours: number;
  shariahPolicyVersion: string;
  policyVersion: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  scoringWeights: Record<string, number>;
  proposedBy: string;
  reason: string;
}

export function useVerificationPolicies() {
  return useQuery({ queryKey: ["verification-policies"], queryFn: async () => (await apiClient.get<VerificationPolicyEntry[]>("/policy/verification")).data });
}
export function usePendingVerificationPolicies() {
  return useQuery({ queryKey: ["pending-verification-policies"], queryFn: async () => (await apiClient.get<PendingVerificationPolicyEntry[]>("/policy/verification/pending")).data });
}
export function useProposeVerificationPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProposeVerificationPolicyPayload) => apiClient.post("/policy/verification", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-verification-policies"] }),
  });
}
export function useEndorseVerificationPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, endorsedBy }: { id: number; endorsedBy: string }) =>
      apiClient.post(`/policy/verification/${id}/endorse`, { endorsedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-verification-policies"] }),
  });
}
export function useApproveVerificationPolicyChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: number; approvedBy: string }) =>
      apiClient.post(`/policy/verification/${id}/approve`, { approvedBy }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-verification-policies"] });
      qc.invalidateQueries({ queryKey: ["verification-policies"] });
    },
  });
}
export function useRejectVerificationPolicyChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectedBy, rejectionReason }: { id: number; rejectedBy: string; rejectionReason: string }) =>
      apiClient.post(`/policy/verification/${id}/reject`, { rejectedBy, rejectionReason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-verification-policies"] }),
  });
}

export function useCompliancePolicies() {
  return useQuery({ queryKey: ["compliance-policies"], queryFn: async () => (await apiClient.get<CompliancePolicyEntry[]>("/policy/compliance")).data });
}
export function usePendingCompliancePolicies() {
  return useQuery({ queryKey: ["pending-compliance-policies"], queryFn: async () => (await apiClient.get<PendingCompliancePolicyEntry[]>("/policy/compliance/pending")).data });
}
export function useProposeCompliancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProposeCompliancePolicyPayload) => apiClient.post("/policy/compliance", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-compliance-policies"] }),
  });
}
export function useEndorseCompliancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, endorsedBy }: { id: number; endorsedBy: string }) =>
      apiClient.post(`/policy/compliance/${id}/endorse`, { endorsedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-compliance-policies"] }),
  });
}
export function useApproveCompliancePolicyChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: number; approvedBy: string }) =>
      apiClient.post(`/policy/compliance/${id}/approve`, { approvedBy }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-compliance-policies"] });
      qc.invalidateQueries({ queryKey: ["compliance-policies"] });
    },
  });
}
export function useRejectCompliancePolicyChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectedBy, rejectionReason }: { id: number; rejectedBy: string; rejectionReason: string }) =>
      apiClient.post(`/policy/compliance/${id}/reject`, { rejectedBy, rejectionReason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-compliance-policies"] }),
  });
}

// ─── Phase 2, Thirty-Fifth Slice: UnderwritingPolicy (no maker-checker) ────
// Unlike VerificationPolicy/CompliancePolicy above, the real Daml has no
// PendingUnderwritingPolicy/riskCommittee endorsement layer at all -- a
// single vetify-controlled create + UpdatePolicy. Mirrors
// serializeUnderwritingPolicy's camelCase shape exactly.

export interface UnderwritingPolicyEntry {
  id: number;
  policyVersion: string;
  autoApproveMin: number;
  autoRejectMax: number;
  minDscrRatio: number | null;
  minLoanAmount: number | null;
  maxLoanAmount: number | null;
  indicativeProfitMarginPct: number | null;
  requestSlaHours: number;
  offerValidityDays: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  writeOffThresholdAmount: number | null;
  maxRestructuringsPerFacility: number | null;
  permittedSectors: string[] | null;
  requiredCollateralTypes: string[];
  maxSectorConcentrationPct: number | null;
  scoringWeights: Record<string, number>;
}

export interface UnderwritingPolicyPayload {
  policyVersion: string;
  autoApproveMin: number;
  autoRejectMax: number;
  minDscrRatio?: number | null;
  minLoanAmount?: number | null;
  maxLoanAmount?: number | null;
  indicativeProfitMarginPct?: number | null;
  requestSlaHours: number;
  offerValidityDays: number;
  effectiveFrom: string;
  writeOffThresholdAmount?: number | null;
  maxRestructuringsPerFacility?: number | null;
  permittedSectors?: string[] | null;
  requiredCollateralTypes?: string[];
  maxSectorConcentrationPct?: number | null;
  scoringWeights: Record<string, number>;
}

export function useUnderwritingPolicies() {
  return useQuery({
    queryKey: ["underwriting-policies"],
    queryFn: async () => (await apiClient.get<UnderwritingPolicyEntry[]>("/underwriting-policies")).data,
  });
}
export function useCreateUnderwritingPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UnderwritingPolicyPayload) => apiClient.post("/underwriting-policies", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["underwriting-policies"] }),
  });
}
export function useUpdateUnderwritingPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UnderwritingPolicyPayload & { id: number }) =>
      apiClient.post(`/underwriting-policies/${id}/update`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["underwriting-policies"] }),
  });
}

export function useAssessors() {
  return useQuery({ queryKey: ["assessors"], queryFn: async () => (await apiClient.get<AssessorEntry[]>("/governance/assessors")).data });
}
export function useRegisterAssessor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { assessor: string; role: string; authorizedBy: string }) =>
      apiClient.post("/governance/assessors", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessors"] }),
  });
}
export function useDeactivateAssessor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: DeactivateReactivateArgs) =>
      apiClient.post(`/governance/assessors/${id}/deactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessors"] }),
  });
}
export function useReactivateAssessor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: DeactivateReactivateArgs) =>
      apiClient.post(`/governance/assessors/${id}/reactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessors"] }),
  });
}

export function useActiveSentinels() {
  return useQuery({
    queryKey: ["sentinels"],
    queryFn: async () => (await apiClient.get<SentinelRegistryEntry[]>("/governance/sentinels")).data,
  });
}
export function useRegisterSentinel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { sentinel: string; role: string; authorizedBy: string }) =>
      apiClient.post("/governance/sentinels", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sentinels"] }),
  });
}
export function useDeactivateSentinel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: DeactivateReactivateArgs) =>
      apiClient.post(`/governance/sentinels/${id}/deactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sentinels"] }),
  });
}
export function useReactivateSentinel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: DeactivateReactivateArgs) =>
      apiClient.post(`/governance/sentinels/${id}/reactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sentinels"] }),
  });
}

export function useAdvisors() {
  return useQuery({ queryKey: ["advisors"], queryFn: async () => (await apiClient.get<AdvisorEntry[]>("/governance/advisors")).data });
}
export function useRegisterAdvisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { advisor: string; role: string; authorizedBy: string }) =>
      apiClient.post("/governance/advisors", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisors"] }),
  });
}
export function useDeactivateAdvisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: DeactivateReactivateArgs) =>
      apiClient.post(`/governance/advisors/${id}/deactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisors"] }),
  });
}
export function useReactivateAdvisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: DeactivateReactivateArgs) =>
      apiClient.post(`/governance/advisors/${id}/reactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advisors"] }),
  });
}

// Phase 2, Sixteenth Slice: AuthorizedReviewer -- unlike the four registries
// above, the real Daml template has only a one-way Deauthorize choice (no
// Reactivate), so this registry carries archived_at instead of an active
// boolean -- see migrations/019's header.
export interface ReviewerEntry {
  id: number;
  role: string;
  authorized_by: string;
  authorized_at: string;
  archived_at: string | null;
}

export function useReviewers() {
  return useQuery({ queryKey: ["reviewers"], queryFn: async () => (await apiClient.get<ReviewerEntry[]>("/governance/reviewers")).data });
}
export function useRegisterReviewer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { role: string; authorizedBy: string }) =>
      apiClient.post("/governance/reviewers", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviewers"] }),
  });
}
export function useDeauthorizeReviewer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiClient.post(`/governance/reviewers/${id}/deauthorize`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviewers"] }),
  });
}

export function useFlagDelinquent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, sentinelId }: { id: string; reason: string; sentinelId: number }) =>
      apiClient.post(`/murabahah-contracts/${id}/flag-delinquent`, { reason, sentinelId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["murabahah-contracts"] }),
  });
}

export function useResumeActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note, sentinelId }: { id: string; note: string; sentinelId: number }) =>
      apiClient.post(`/murabahah-contracts/${id}/resume-active`, { note, sentinelId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["murabahah-contracts"] }),
  });
}

// ─── Reporting ──────────────────────────────────────────────────────────────

export interface PortfolioReport {
  id: string;
  reportDate: string;
  totalActiveContracts: number;
  totalDisbursed: number;
  totalOutstanding: number;
  delinquentCount: number;
  completedCount: number;
  defaultedCount: number;
  summary: string;
  createdAt: string;
}

export function usePortfolioReports() {
  return useQuery({
    queryKey: ["portfolio-reports"],
    queryFn: async () => (await apiClient.get<PortfolioReport[]>("/portfolio-reports")).data,
  });
}

export function useGeneratePortfolioReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/portfolio-reports").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio-reports"] }),
  });
}

// ─── Phase 2, fifth slice: Ibra, LatePaymentCharity settlement, Default ────

export interface LatePaymentCharityItem {
  id: string;
  murabahahContractId: string;
  repaymentRecordId: string;
  cacRegNumber: string;
  businessName: string;
  installmentNo: number;
  dueDate: string;
  paymentDate: string;
  charityAmount: number | null;
  settled: boolean;
}

/** Gap found while building this slice: Stage 9-10's UI pass never added a
 * hook for late_payment_charity at all -- charity obligations were created
 * live (confirmed in that pass's own verification) but had no read path in
 * the frontend whatsoever. */
export function useLatePaymentCharities() {
  return useQuery({
    queryKey: ["late-payment-charities"],
    queryFn: async () => (await apiClient.get<LatePaymentCharityItem[]>("/late-payment-charities")).data,
  });
}

export function useSetCharityAmount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      apiClient.post(`/late-payment-charities/${id}/set-amount`, { amount }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["late-payment-charities"] }),
  });
}

export function useConfirmCharityPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charityRef, charityOrganization }: { id: string; charityRef: string; charityOrganization: string }) =>
      apiClient.post(`/late-payment-charities/${id}/confirm-payment`, { charityRef, charityOrganization }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["late-payment-charities"] }),
  });
}

export interface IbraRequestItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  outstandingBalance: number;
  requestedSettlementDate: string;
  settlementType: "FullIbra" | "PartialIbra";
  requestedAmount: number | null;
}

export function useIbraRequests() {
  return useQuery({
    queryKey: ["ibra-requests"],
    queryFn: async () => (await apiClient.get<IbraRequestItem[]>("/ibra-requests")).data,
  });
}

export function useRequestIbra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      requestedSettlementDate,
      settlementType,
      requestedAmount,
    }: {
      id: string;
      requestedSettlementDate: string;
      settlementType: "FullIbra" | "PartialIbra";
      requestedAmount?: number | null;
    }) =>
      apiClient
        .post(`/murabahah-contracts/${id}/request-ibra`, { requestedSettlementDate, settlementType, requestedAmount })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ibra-requests"] }),
  });
}

export function useGrantIbra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      rebateAmount,
      proposedByOfficerId,
      confirmedByOfficerId,
    }: {
      id: string;
      rebateAmount: number;
      proposedByOfficerId: string;
      confirmedByOfficerId: string;
    }) => apiClient.post(`/ibra-requests/${id}/grant`, { rebateAmount, proposedByOfficerId, confirmedByOfficerId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ibra-requests"] });
      qc.invalidateQueries({ queryKey: ["murabahah-contracts"] });
    },
  });
}

export function useDeclineIbra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/ibra-requests/${id}/decline`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ibra-requests"] }),
  });
}

export function useDefaultContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, defaultedBy }: { id: string; reason: string; defaultedBy: string }) =>
      apiClient.post(`/murabahah-contracts/${id}/default`, { reason, defaultedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["murabahah-contracts"] }),
  });
}

export function useCloseDefaultedContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/murabahah-contracts/${id}/close-defaulted`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["murabahah-contracts"] }),
  });
}

// ─── Phase 2, sixth slice: RahnAgreement collateral ────────────────────────

export interface RahnAgreementItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  collateralDescription: string;
  collateralValue: number;
  collateralStatus: "CollateralActive" | "CollateralReleased" | "CollateralEnforced";
  releaseEvidence?: string;
}

export function useRahnAgreements() {
  return useQuery({
    queryKey: ["rahn-agreements"],
    queryFn: async () => (await apiClient.get<RahnAgreementItem[]>("/rahn-agreements")).data,
  });
}

export function usePledgeCollateral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, collateralDescription, collateralValue }: { id: string; collateralDescription: string; collateralValue: number }) =>
      apiClient.post(`/murabahah-contracts/${id}/pledge-collateral`, { collateralDescription, collateralValue }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rahn-agreements"] }),
  });
}

export function useReleaseCollateral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      note,
      proposedByOfficerId,
      confirmedByOfficerId,
    }: {
      id: string;
      note: string;
      proposedByOfficerId: string;
      confirmedByOfficerId: string;
    }) => apiClient.post(`/rahn-agreements/${id}/release`, { note, proposedByOfficerId, confirmedByOfficerId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rahn-agreements"] }),
  });
}

export function useEnforceCollateral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      proposedByOfficerId,
      confirmedByOfficerId,
    }: {
      id: string;
      reason: string;
      proposedByOfficerId: string;
      confirmedByOfficerId: string;
    }) => apiClient.post(`/rahn-agreements/${id}/enforce`, { reason, proposedByOfficerId, confirmedByOfficerId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rahn-agreements"] }),
  });
}

// ─── Phase 2, Thirty-Seventh Slice: Revalue/RecordInspection/enforcement maker-checker ──
// Closes out RahnAgreement's remaining UI (Revalue/RecordInspection were
// ported backend-side in the Twenty-Sixth Slice, ProposeEnforceCollateral/
// ConfirmEnforce/RejectEnforce in the Twenty-Eighth).

export interface CollateralValuationRecordItem {
  id: string;
  rahnAgreementId: string;
  cacRegNumber: string;
  businessName: string;
  previousValue: number;
  valuationAmount: number;
  valuationDate: string;
  valuatorRef: string;
  notes?: string;
}

export interface CollateralInspectionRecordItem {
  id: string;
  rahnAgreementId: string;
  cacRegNumber: string;
  businessName: string;
  inspectionDate: string;
  inspectedBy: string;
  condition: "Satisfactory" | "RequiresAttention" | "Impaired";
  inspectionNotes?: string;
  nextInspectionDate?: string;
  mandateStatus?: string;
  estimatedGsmRecoverable?: number;
}

export interface PendingCollateralEnforcementItem {
  id: string;
  rahnAgreementId: string;
  cacRegNumber: string;
  businessName: string;
  reason: string;
  gsmExhausted: boolean;
  gsmRef?: string;
  proposedByOfficerId: string;
  status: "Pending" | "Confirmed" | "Rejected";
  resolvedAt?: string;
}

export function useCollateralValuationRecords() {
  return useQuery({
    queryKey: ["collateral-valuation-records"],
    queryFn: async () => (await apiClient.get<CollateralValuationRecordItem[]>("/collateral-valuation-records")).data,
  });
}

export function useCollateralInspectionRecords() {
  return useQuery({
    queryKey: ["collateral-inspection-records"],
    queryFn: async () => (await apiClient.get<CollateralInspectionRecordItem[]>("/collateral-inspection-records")).data,
  });
}

export function useRevalue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, newValue, valuationDate, valuatorRef, notes,
    }: { id: string; newValue: number; valuationDate: string; valuatorRef: string; notes?: string | null }) =>
      apiClient.post(`/rahn-agreements/${id}/revalue`, { newValue, valuationDate, valuatorRef, notes }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rahn-agreements"] });
      qc.invalidateQueries({ queryKey: ["collateral-valuation-records"] });
    },
  });
}

export function useRecordInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, inspectionDate, inspectedBy, condition, inspectionNotes, nextInspectionDate,
    }: {
      id: string; inspectionDate: string; inspectedBy: string;
      condition: "Satisfactory" | "RequiresAttention" | "Impaired";
      inspectionNotes?: string | null; nextInspectionDate?: string | null;
    }) =>
      apiClient
        .post(`/rahn-agreements/${id}/record-inspection`, { inspectionDate, inspectedBy, condition, inspectionNotes, nextInspectionDate })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collateral-inspection-records"] }),
  });
}

export function usePendingCollateralEnforcements() {
  return useQuery({
    queryKey: ["pending-collateral-enforcements"],
    queryFn: async () => (await apiClient.get<PendingCollateralEnforcementItem[]>("/pending-collateral-enforcements")).data,
  });
}

export function useProposeEnforceCollateral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, reason, gsmExhausted, gsmRef, proposedByOfficerId,
    }: { id: string; reason: string; gsmExhausted: boolean; gsmRef?: string | null; proposedByOfficerId: string }) =>
      apiClient.post(`/rahn-agreements/${id}/propose-enforce`, { reason, gsmExhausted, gsmRef, proposedByOfficerId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-collateral-enforcements"] }),
  });
}

export function useConfirmEnforce() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmedByOfficerId }: { id: string; confirmedByOfficerId: string }) =>
      apiClient.post(`/pending-collateral-enforcements/${id}/confirm`, { confirmedByOfficerId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-collateral-enforcements"] });
      qc.invalidateQueries({ queryKey: ["rahn-agreements"] });
    },
  });
}

export function useRejectEnforce() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiClient.post(`/pending-collateral-enforcements/${id}/reject`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-collateral-enforcements"] }),
  });
}

// ─── Phase 2, seventh slice: collateral valuation document upload ─────────

export interface CollateralValuationDocumentItem {
  id: string;
  rahnAgreementId: string;
  cacRegNumber: string;
  businessName: string;
  valuatorRef: string;
  valuationAmount: number;
  valuationDate: string;
  notes?: string;
  docType: string;
  contentHash: string;
  storageRef: string;
  fileSize?: number;
  uploadedAt: string;
}

export function useCollateralValuationDocuments() {
  return useQuery({
    queryKey: ["collateral-valuation-documents"],
    queryFn: async () => (await apiClient.get<CollateralValuationDocumentItem[]>("/collateral-valuation-documents")).data,
  });
}

export function useSubmitCollateralValuation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      valuatorRef,
      valuationAmount,
      valuationDate,
      notes,
      docType,
      contentHash,
      storageRef,
      fileSize,
    }: {
      id: string;
      valuatorRef: string;
      valuationAmount: number;
      valuationDate: string;
      notes?: string;
      docType: string;
      contentHash: string;
      storageRef: string;
      fileSize?: number;
    }) =>
      apiClient
        .post(`/rahn-agreements/${id}/valuation-documents`, {
          valuatorRef,
          valuationAmount,
          valuationDate,
          notes,
          docType,
          contentHash,
          storageRef,
          fileSize,
        })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collateral-valuation-documents"] }),
  });
}

// ─── Phase 2, eighth slice: restructuring + disputes/arbitration ─────────

export interface RestructuringRequestItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  outstandingBalance: number;
  proposedSchedule: PaymentScheduleEntry[];
  reason: string;
  requestDate: string;
}

export function useRestructuringRequests() {
  return useQuery({
    queryKey: ["restructuring-requests"],
    queryFn: async () => (await apiClient.get<RestructuringRequestItem[]>("/restructuring-requests")).data,
  });
}

export interface RestructuringRejectionRecordItem {
  id: string;
  restructuringRequestId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  reason: string;
  rejectedAt: string;
}

export function useRestructuringRejectionRecords() {
  return useQuery({
    queryKey: ["restructuring-rejections"],
    queryFn: async () => (await apiClient.get<RestructuringRejectionRecordItem[]>("/restructuring-rejections")).data,
  });
}

export function useRequestRestructuring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      proposedSchedule,
      reason,
      requestDate,
    }: {
      id: string;
      proposedSchedule: PaymentScheduleEntry[];
      reason: string;
      requestDate: string;
    }) => apiClient.post(`/murabahah-contracts/${id}/request-restructuring`, { proposedSchedule, reason, requestDate }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["restructuring-requests"] }),
  });
}

export function useApproveRestructuring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      approvedSchedule,
      maxRestructurings,
    }: {
      id: string;
      approvedSchedule: PaymentScheduleEntry[];
      maxRestructurings?: number;
    }) => apiClient.post(`/restructuring-requests/${id}/approve`, { approvedSchedule, maxRestructurings }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restructuring-requests"] });
      qc.invalidateQueries({ queryKey: ["murabahah-contracts"] });
    },
  });
}

export function useRejectRestructuring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/restructuring-requests/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restructuring-requests"] });
      qc.invalidateQueries({ queryKey: ["restructuring-rejections"] });
    },
  });
}

export interface DisputeRecordItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  disputeType: "PaymentDispute" | "ContractTermsDispute" | "AssetDefectDispute";
  description: string;
  evidenceRef?: string;
  raisedAt: string;
  archived: boolean;
}

export function useDisputeRecords() {
  return useQuery({
    queryKey: ["dispute-records"],
    queryFn: async () => (await apiClient.get<DisputeRecordItem[]>("/dispute-records")).data,
  });
}

export function useRaiseDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      disputeType,
      disputeDesc,
      evidenceRef,
    }: {
      id: string;
      disputeType: string;
      disputeDesc: string;
      evidenceRef?: string;
    }) => apiClient.post(`/murabahah-contracts/${id}/raise-dispute`, { disputeType, disputeDesc, evidenceRef }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispute-records"] }),
  });
}

export interface ArbitrationRequestItem {
  id: string;
  disputeRecordId: string;
  cacRegNumber: string;
  businessName: string;
  arbitrator: string;
  disputeDescription: string;
  escalatedAt: string;
  outcome?: "BusinessPrevails" | "FIPrevails" | "SettlementAgreed";
  resolution?: string;
}

export function useArbitrationRequests() {
  return useQuery({
    queryKey: ["arbitration-requests"],
    queryFn: async () => (await apiClient.get<ArbitrationRequestItem[]>("/arbitration-requests")).data,
  });
}

export function useEscalateToArbitration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arbitrator }: { id: string; arbitrator: string }) =>
      apiClient.post(`/dispute-records/${id}/escalate-to-arbitration`, { arbitrator }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispute-records"] });
      qc.invalidateQueries({ queryKey: ["arbitration-requests"] });
    },
  });
}

export function useRecordArbitrationOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arbOutcome, arbResolution }: { id: string; arbOutcome: string; arbResolution: string }) =>
      apiClient.post(`/arbitration-requests/${id}/record-outcome`, { arbOutcome, arbResolution }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["arbitration-requests"] }),
  });
}

// ─── Phase 2, ninth slice: Collections (Direct Debit + GSM) ───────────────

export interface DirectDebitMandateItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  monoMandateRef: string;
  accountRef: string;
  bankName: string;
  maxCollectionAmount: number;
  frequency: string;
  mandateStartDate: string;
  mandateEndDate?: string;
  gsmConsentGiven: boolean;
  gsmConsentDate?: string;
  status: "MandateActive" | "MandateSuspended" | "MandateCancelled";
}

export function useDirectDebitMandates() {
  return useQuery({
    queryKey: ["direct-debit-mandates"],
    queryFn: async () => (await apiClient.get<DirectDebitMandateItem[]>("/direct-debit-mandates")).data,
  });
}

export function useCreateDirectDebitMandate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      monoMandateRef,
      accountRef,
      bankName,
      maxCollectionAmount,
      frequency,
      mandateStartDate,
      mandateEndDate,
      gsmConsentGiven,
      gsmConsentDate,
    }: {
      id: string;
      monoMandateRef: string;
      accountRef: string;
      bankName: string;
      maxCollectionAmount: number;
      frequency?: string;
      mandateStartDate: string;
      mandateEndDate?: string;
      gsmConsentGiven: boolean;
      gsmConsentDate?: string;
    }) =>
      apiClient
        .post(`/murabahah-contracts/${id}/create-direct-debit-mandate`, {
          monoMandateRef,
          accountRef,
          bankName,
          maxCollectionAmount,
          frequency,
          mandateStartDate,
          mandateEndDate,
          gsmConsentGiven,
          gsmConsentDate,
        })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["direct-debit-mandates"] }),
  });
}

export function useSuspendMandate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/direct-debit-mandates/${id}/suspend`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["direct-debit-mandates"] }),
  });
}

export function useReinstateMandate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiClient.post(`/direct-debit-mandates/${id}/reinstate`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["direct-debit-mandates"] }),
  });
}

export function useCancelMandate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/direct-debit-mandates/${id}/cancel`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["direct-debit-mandates"] }),
  });
}

export interface DirectDebitCollectionAttemptItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  monoCollectionRef: string;
  installmentNo: number;
  attemptedAmount: number;
  attemptDate: string;
  succeeded: boolean;
  failureReason?: string;
  retryCount: number;
}

export function useDirectDebitCollectionAttempts() {
  return useQuery({
    queryKey: ["direct-debit-collection-attempts"],
    queryFn: async () => (await apiClient.get<DirectDebitCollectionAttemptItem[]>("/direct-debit-collection-attempts")).data,
  });
}

export function useRecordCollectionAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      monoCollectionRef,
      installmentNo,
      attemptedAmount,
      attemptDate,
      succeeded,
      failureReason,
      retryCount,
    }: {
      id: string;
      monoCollectionRef: string;
      installmentNo: number;
      attemptedAmount: number;
      attemptDate: string;
      succeeded: boolean;
      failureReason?: string;
      retryCount?: number;
    }) =>
      apiClient
        .post(`/murabahah-contracts/${id}/record-collection-attempt`, {
          monoCollectionRef,
          installmentNo,
          attemptedAmount,
          attemptDate,
          succeeded,
          failureReason,
          retryCount,
        })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["direct-debit-collection-attempts"] }),
  });
}

export interface RecoveryPaymentRecordItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  amountRecovered: number;
  recoveryDate: string;
  recoverySource: string;
  remainingBalance: number;
}

export function useRecoveryPaymentRecords() {
  return useQuery({
    queryKey: ["recovery-payment-records"],
    queryFn: async () => (await apiClient.get<RecoveryPaymentRecordItem[]>("/recovery-payment-records")).data,
  });
}

export function useRecordRecoveryPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      amountRecovered,
      recoveryDate,
      recoverySource,
    }: {
      id: string;
      amountRecovered: number;
      recoveryDate: string;
      recoverySource: string;
    }) => apiClient.post(`/murabahah-contracts/${id}/record-recovery-payment`, { amountRecovered, recoveryDate, recoverySource }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recovery-payment-records"] });
      qc.invalidateQueries({ queryKey: ["murabahah-contracts"] });
    },
  });
}

export interface GsmInvocationItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  businessBvn: string;
  invokedAmount: number;
  monoGsmRef: string;
  invokedAt: string;
  status: "GSMActive" | "GSMSettled" | "GSMCancelled";
  lastSweepRef?: string;
}

export function useGsmInvocations() {
  return useQuery({
    queryKey: ["gsm-invocations"],
    queryFn: async () => (await apiClient.get<GsmInvocationItem[]>("/gsm-invocations")).data,
  });
}

export function useCreateGsmInvocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      businessBvn,
      invokedAmount,
      monoGsmRef,
    }: {
      id: string;
      businessBvn: string;
      invokedAmount: number;
      monoGsmRef: string;
    }) => apiClient.post(`/murabahah-contracts/${id}/create-gsm-invocation`, { businessBvn, invokedAmount, monoGsmRef }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gsm-invocations"] }),
  });
}

export function useRecordGsmSweep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      sweepAmount,
      sweepDate,
      nibssSweepRef,
    }: {
      id: string;
      sweepAmount: number;
      sweepDate: string;
      nibssSweepRef: string;
    }) => apiClient.post(`/gsm-invocations/${id}/record-sweep`, { sweepAmount, sweepDate, nibssSweepRef }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gsm-invocations"] });
      qc.invalidateQueries({ queryKey: ["recovery-payment-records"] });
      qc.invalidateQueries({ queryKey: ["murabahah-contracts"] });
    },
  });
}

export function useCancelGsm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/gsm-invocations/${id}/cancel`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gsm-invocations"] }),
  });
}

// ─── Phase 2, tenth slice: Moratorium + HamishJiddiyyah ───────────────────

export interface MoratoriumRecordItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  moratoriumEnd: string;
  reason: string;
}

export function useMoratoriumRecords() {
  return useQuery({
    queryKey: ["moratorium-records"],
    queryFn: async () => (await apiClient.get<MoratoriumRecordItem[]>("/moratorium-records")).data,
  });
}

export function useGrantMoratorium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, moratoriumEnd, reason }: { id: string; moratoriumEnd: string; reason: string }) =>
      apiClient.post(`/murabahah-contracts/${id}/grant-moratorium`, { moratoriumEnd, reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moratorium-records"] });
      qc.invalidateQueries({ queryKey: ["murabahah-contracts"] });
    },
  });
}

export function useEndMoratorium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/murabahah-contracts/${id}/end-moratorium`, { note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["murabahah-contracts"] }),
  });
}

export interface HamishJiddiyyahItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  depositAmount: number;
  depositRef: string;
  depositDate: string;
  returnDeadline: string;
  actualLossDeducted?: number;
  status: "HamishHeld" | "HamishReturned" | "HamishForfeited";
}

export function useHamishJiddiyyah() {
  return useQuery({
    queryKey: ["hamish-jiddiyyah"],
    queryFn: async () => (await apiClient.get<HamishJiddiyyahItem[]>("/hamish-jiddiyyah")).data,
  });
}

export function useCreateHamishJiddiyyah() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      depositAmount,
      depositRef,
      depositDate,
      returnDeadline,
    }: {
      id: string;
      depositAmount: number;
      depositRef: string;
      depositDate: string;
      returnDeadline: string;
    }) =>
      apiClient
        .post(`/murabahah-contracts/${id}/create-hamish-jiddiyyah`, { depositAmount, depositRef, depositDate, returnDeadline })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hamish-jiddiyyah"] }),
  });
}

export function useReturnDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, transferRef }: { id: string; transferRef: string }) =>
      apiClient.post(`/hamish-jiddiyyah/${id}/return-deposit`, { transferRef }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hamish-jiddiyyah"] }),
  });
}

export function useForfeitDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualLoss, reason }: { id: string; actualLoss: number; reason: string }) =>
      apiClient.post(`/hamish-jiddiyyah/${id}/forfeit-deposit`, { actualLoss, reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hamish-jiddiyyah"] }),
  });
}
// ─── Phase 2, Eleventh/Twelfth Slice: Stage 0 (FinancingProviderOnboarding) ──

export type ProviderType =
  | "CBNLicensedNIFI" | "SECFundManager" | "PenComPensionManager" | "CooperativeSociety"
  | "InvestmentClub" | "WaqfFund" | "ZakatFund" | "Philanthropy";
export type FinancingInstrument = "Murabahah" | "Ijarah" | "QardHasan";

export interface ProviderOnboarding {
  id: string;
  providerName: string;
  address: string;
  cacRegNumber: string;
  providerType: ProviderType;
  regulatoryBody?: string;
  licenseNumber?: string;
  governingDocRef: DocumentRef;
  declaredInstruments: FinancingInstrument[];
  status: ReviewStatus | "PendingAmendment";
  submittedAt?: string;
  amendmentCount: number;
  agentScore?: number;
  agentRisk?: RiskLevel;
  agentNote?: string;
  agentVersion?: string;
}

export interface ApprovedProviderEntry {
  id: string;
  financingProviderOnboardingId: string;
  providerName: string;
  providerType: ProviderType;
  regulatoryBody?: string;
  licenseNumber?: string;
  approvedInstruments: FinancingInstrument[];
  approvedAt: string;
  regulator?: string;
}

export function useProviderOnboardings() {
  return useQuery({ queryKey: ["providers"], queryFn: async () => (await apiClient.get<ProviderOnboarding[]>("/providers")).data });
}

export function useApprovedProviders() {
  return useQuery({ queryKey: ["approved-providers"], queryFn: async () => (await apiClient.get<ApprovedProviderEntry[]>("/providers/approved")).data });
}

export interface CreateProviderPayload {
  providerName: string;
  address: string;
  cacRegNumber: string;
  providerType: ProviderType;
  regulatoryBody?: string | null;
  licenseNumber?: string | null;
  governingDocRef: DocumentRef;
  declaredInstruments: FinancingInstrument[];
}

export function useCreateProviderOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProviderPayload) => apiClient.post("/providers", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
  });
}

export function useSubmitProviderForReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/providers/${id}/submit`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
  });
}

export function useAmendProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, ...rest
    }: {
      id: string; updatedProviderName: string; updatedAddress: string; updatedCacRegNumber: string;
      updatedLicenseNumber?: string | null; updatedGoverningDocRef: DocumentRef; updatedDeclaredInstruments: FinancingInstrument[];
    }) => apiClient.post(`/providers/${id}/amend`, rest).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
  });
}

export function useRecordProviderScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, score, risk, note, version }: { id: string; score: number; risk: RiskLevel; note?: string; version: string }) =>
      apiClient.post(`/providers/${id}/score`, { score, risk, note, version }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
  });
}

export function useFlagProviderForManualReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, score, risk, note }: { id: string; score: number; risk: RiskLevel; note: string }) =>
      apiClient.post(`/providers/${id}/flag`, { score, risk, note, version: "manual-review" }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
  });
}

export function useRequestProviderAmendment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/providers/${id}/request-amendment`, { note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
  });
}

export function useApproveProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvedInstruments, regulator }: { id: string; approvedInstruments: FinancingInstrument[]; regulator?: string | null }) =>
      apiClient.post(`/providers/${id}/approve`, { approvedInstruments, regulator }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["approved-providers"] });
    },
  });
}

export function useRejectProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/providers/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
  });
}

// ─── Phase 2, Thirty-Eighth Slice: Collateral & Recovery, Pass 2 ──────────
// Write-off, demand notice / legal escalation, guarantee agreements, credit
// covenants -- all ported backend-side in the Thirty-First/Thirty-Third
// slices (Batch B/D) with no frontend hook coverage until now.

export interface WriteOffRecordItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  totalFinanced: number;
  totalRecovered: number;
  amountWrittenOff: number;
  writeOffDate: string;
  writeOffRef: string;
  writeOffApprovedBy: string;
}

export function useWriteOffRecords() {
  return useQuery({ queryKey: ["write-off-records"], queryFn: async () => (await apiClient.get<WriteOffRecordItem[]>("/write-off-records")).data });
}

export function useWriteOffContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, writeOffDate, writeOffRef, totalRecovered, writeOffApprovedBy, proposedByOfficerId, confirmedByOfficerId,
    }: {
      id: string; writeOffDate: string; writeOffRef: string; totalRecovered: number;
      writeOffApprovedBy: string; proposedByOfficerId: string; confirmedByOfficerId: string;
    }) =>
      apiClient
        .post(`/murabahah-contracts/${id}/write-off`, { writeOffDate, writeOffRef, totalRecovered, writeOffApprovedBy, proposedByOfficerId, confirmedByOfficerId })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["write-off-records"] });
      qc.invalidateQueries({ queryKey: ["murabahah-contracts"] });
    },
  });
}

export interface DemandNoticeItem {
  id: string;
  murabahahContractId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  demandDate: string;
  outstandingAmount: number;
  demandRef: string;
  responseDeadline: string;
  gsmEligible: boolean;
  archivedAt?: string | null;
  supersededByKind?: string | null;
}

export interface LegalEscalationItem {
  id: string;
  demandNoticeId: string;
  businessName: string;
  cacRegNumber: string;
  escalationDate: string;
  solicitorRef: string;
  legalAction: string;
  outstandingAmount: number;
  courtRef?: string | null;
  resolvedAt?: string | null;
}

export function useDemandNotices() {
  return useQuery({ queryKey: ["demand-notices"], queryFn: async () => (await apiClient.get<DemandNoticeItem[]>("/demand-notices")).data });
}

export function useIssueDemandNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, demandDate, demandRef, responseDeadline, gsmEligible,
    }: { id: string; demandDate: string; demandRef: string; responseDeadline: string; gsmEligible: boolean }) =>
      apiClient.post(`/murabahah-contracts/${id}/issue-demand-notice`, { demandDate, demandRef, responseDeadline, gsmEligible }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demand-notices"] }),
  });
}

export function useWithdrawDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => apiClient.post(`/demand-notices/${id}/withdraw`, { note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demand-notices"] }),
  });
}

export function useEscalateToLegal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, escalationDate, solicitorRef, legalAction,
    }: { id: string; escalationDate: string; solicitorRef: string; legalAction: string }) =>
      apiClient.post(`/demand-notices/${id}/escalate-to-legal`, { escalationDate, solicitorRef, legalAction }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demand-notices"] });
      qc.invalidateQueries({ queryKey: ["legal-escalations"] });
    },
  });
}

export function useLegalEscalations() {
  return useQuery({ queryKey: ["legal-escalations"], queryFn: async () => (await apiClient.get<LegalEscalationItem[]>("/legal-escalations")).data });
}

export function useRecordCourtOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, courtOrderRef }: { id: string; courtOrderRef: string }) =>
      apiClient.post(`/legal-escalations/${id}/record-court-order`, { courtOrderRef }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["legal-escalations"] }),
  });
}

export function useResolveLegal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => apiClient.post(`/legal-escalations/${id}/resolve`, { note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["legal-escalations"] }),
  });
}

export interface GuaranteeAgreementItem {
  id: string;
  murabahahContractId: string;
  cacRegNumber: string;
  businessName: string;
  facilityRef: string;
  guaranteeType: string;
  guaranteedAmount: number;
  guarantorName: string;
  guarantorId: string;
  effectiveDate: string;
  expiryDate?: string | null;
  guaranteeStatus: "GuaranteeActive" | "GuaranteeReleased" | "GuaranteeEnforced";
}

export function useGuaranteeAgreements() {
  return useQuery({ queryKey: ["guarantee-agreements"], queryFn: async () => (await apiClient.get<GuaranteeAgreementItem[]>("/guarantee-agreements")).data });
}

export function useCreateGuaranteeAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, guaranteeType, guaranteedAmount, guarantorName, guarantorId, effectiveDate, expiryDate,
    }: {
      id: string; guaranteeType: string; guaranteedAmount: number; guarantorName: string;
      guarantorId: string; effectiveDate: string; expiryDate?: string | null;
    }) =>
      apiClient
        .post(`/murabahah-contracts/${id}/create-guarantee`, { guaranteeType, guaranteedAmount, guarantorName, guarantorId, effectiveDate, expiryDate })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guarantee-agreements"] }),
  });
}

export function useEnforceGuarantee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/guarantee-agreements/${id}/enforce`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guarantee-agreements"] }),
  });
}

export function useReleaseGuarantee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/guarantee-agreements/${id}/release`, { note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guarantee-agreements"] }),
  });
}

export interface CreditCovenantItem {
  id: string;
  murabahahContractId: string;
  cacRegNumber: string;
  businessName: string;
  covenantType: string;
  threshold: number;
  measurementFrequency: string;
}

export interface CovenantMeasurementRecordItem {
  id: string;
  creditCovenantId: string;
  cacRegNumber: string;
  businessName: string;
  covenantType: string;
  threshold: number;
  measuredValue: number;
  measureDate: string;
  measuredBy: string;
  breached: boolean;
}

export function useCreditCovenants() {
  return useQuery({ queryKey: ["credit-covenants"], queryFn: async () => (await apiClient.get<CreditCovenantItem[]>("/credit-covenants")).data });
}

export function useCovenantMeasurementRecords() {
  return useQuery({
    queryKey: ["covenant-measurement-records"],
    queryFn: async () => (await apiClient.get<CovenantMeasurementRecordItem[]>("/covenant-measurement-records")).data,
  });
}

export function useCreateCreditCovenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, covenantType, threshold, measurementFrequency,
    }: { id: string; covenantType: string; threshold: number; measurementFrequency: string }) =>
      apiClient.post(`/murabahah-contracts/${id}/create-credit-covenant`, { covenantType, threshold, measurementFrequency }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit-covenants"] }),
  });
}

export function useRecordCovenantMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, measuredValue, measureDate, measuredBy,
    }: { id: string; measuredValue: number; measureDate: string; measuredBy: string }) =>
      apiClient.post(`/credit-covenants/${id}/record-measurement`, { measuredValue, measureDate, measuredBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["covenant-measurement-records"] }),
  });
}

// ─── Phase 2, Thirty-Ninth Slice: Murabahah acquisition alternates, Pass 1 ──
// Pre-Qabdh reject/replace/cancel on AssetPurchaseRecord (Twenty-Seventh
// Slice) and DeclineProposal/ExpireProposal/WithdrawProposal on
// MurabahahProposal (Second/Twenty-Fifth Slices) -- all ported backend-side
// with no frontend hook coverage until now.

export interface AssetRejectionRecordItem {
  id: string;
  assetPurchaseRecordId: string;
  cacRegNumber: string;
  businessName: string;
  reason: string;
  defectDescription: string;
  rejectedAt: string;
}

export interface AcquisitionCancellationRequestItem {
  id: string;
  assetPurchaseRecordId: string;
  cacRegNumber: string;
  businessName: string;
  reason: string;
  status: "Pending" | "Confirmed" | "Rejected";
  resolvedAt?: string | null;
}

export interface ProposalDeclineRecordItem {
  id: string;
  murabahahProposalId: string;
  facilityRef: string;
  cacRegNumber: string;
  businessName: string;
  reason: string;
}

export function useAssetRejectionRecords() {
  return useQuery({
    queryKey: ["asset-rejection-records"],
    queryFn: async () => (await apiClient.get<AssetRejectionRecordItem[]>("/asset-rejection-records")).data,
  });
}

export function useRejectDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, defectDescription }: { id: string; reason: string; defectDescription: string }) =>
      apiClient.post(`/asset-purchase-records/${id}/reject-delivery`, { reason, defectDescription }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-purchase-records"] });
      qc.invalidateQueries({ queryKey: ["asset-rejection-records"] });
    },
  });
}

export function useProceedWithReplacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, newActualCost, newPurchaseDate, newInvoiceRef, replacementNote,
    }: { id: string; newActualCost: number; newPurchaseDate: string; newInvoiceRef: string; replacementNote: string }) =>
      apiClient
        .post(`/asset-purchase-records/${id}/proceed-with-replacement`, { newActualCost, newPurchaseDate, newInvoiceRef, replacementNote })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset-purchase-records"] }),
  });
}

export function useAcquisitionCancellationRequests() {
  return useQuery({
    queryKey: ["acquisition-cancellation-requests"],
    queryFn: async () => (await apiClient.get<AcquisitionCancellationRequestItem[]>("/acquisition-cancellation-requests")).data,
  });
}

export function useRequestCancellation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/asset-purchase-records/${id}/request-cancellation`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acquisition-cancellation-requests"] }),
  });
}

export function useConfirmCancellation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, requestId }: { id: string; requestId: string }) =>
      apiClient.post(`/asset-purchase-records/${id}/confirm-cancellation`, { requestId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acquisition-cancellation-requests"] });
      qc.invalidateQueries({ queryKey: ["asset-purchase-records"] });
    },
  });
}

export function useRejectCancellation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiClient.post(`/acquisition-cancellation-requests/${id}/reject`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acquisition-cancellation-requests"] }),
  });
}

export function useDeclineProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/murabahah-proposals/${id}/decline`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["murabahah-proposals"] }),
  });
}

export function useWithdrawProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/murabahah-proposals/${id}/withdraw`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["murabahah-proposals"] }),
  });
}

export function useExpireProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/murabahah-proposals/${id}/expire`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["murabahah-proposals"] }),
  });
}

export function useProposalDeclineRecords() {
  return useQuery({
    queryKey: ["proposal-decline-records"],
    queryFn: async () => (await apiClient.get<ProposalDeclineRecordItem[]>("/proposal-decline-records")).data,
  });
}
