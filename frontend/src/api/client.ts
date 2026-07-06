import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Enums (match Daml exactly) ─────────────────────────────────────────────

export type ReviewStatus =
  | 'Draft'
  | 'Pending'
  | 'UnderReview'
  | 'ManualReview'
  | 'PendingAmendment'
  | 'Approved'
  | 'Rejected'

export type FinancingStatus =
  | 'Submitted'
  | 'Underwriting'
  | 'FinancingApproved'
  | 'FinancingRejected'
  | 'Withdrawn'
  | 'Expired'
  | 'Cancelled'

export type MurabahahStatus = 'Active' | 'Delinquent' | 'Completed' | 'Defaulted'

export type BusinessType = 'SoleProprietorship' | 'LimitedCompany'

export type RiskLevel = 'Low' | 'Medium' | 'High'

export type ShariahVerdict = 'COMPLIANT' | 'REQUIRES_REVIEW' | 'NON_COMPLIANT'

export type ProviderType =
  | 'CBNLicensedNIFI' | 'SECFundManager' | 'PenComPensionManager' | 'CooperativeSociety'
  | 'InvestmentClub' | 'WaqfFund' | 'ZakatFund' | 'Philanthropy'

export type RegulatoryBody = 'CBN' | 'SEC' | 'PenCom' | 'CAC' | 'StateCooperativeRegistry' | 'SelfGoverned' | 'Unregulated'

export type FinancingInstrument = 'Murabahah' | 'Ijarah' | 'QardHasan'

export type OfficerRole = 'CreditOfficer' | 'RiskOfficer' | 'RecoveryOfficer' | 'OperationsOfficer' | 'UnderwritingOfficer'

// ─── Raw ledger payload shapes ──────────────────────────────────────────────
// The backend returns Canton contracts verbatim: { contractId, payload }, with
// payload matching the Daml record exactly — including Int/Decimal fields
// encoded as JSON strings (confirmed live against a real sandbox; Daml's JSON
// Ledger API always encodes Int/Decimal as strings, both on write and on read
// via PQS). The view-model types + adapters below convert these into
// plain-number, UI-friendly shapes so page components don't deal with the
// raw ledger encoding directly.

interface RawContract<T> {
  contractId: string
  payload: T
}

interface RawBusinessDirector {
  name: string
  address: string
  phoneNumber: string
  ninNumber: string
  bvn: string
  email: string
}

interface RawBusinessProfile {
  name: string
  address: string
  state: string
  phoneNumber: string
  email: string
  website: string | null
  businessType: BusinessType
  incorporationDate: string
  directors: RawBusinessDirector[]
  businessActivity: string
  businessSector: string
}

interface RawBusinessKyc {
  cacRegNumber: string
  taxId: string
}

interface RawOnboarding {
  borrower: string
  vetify: string
  verifier: string
  business: RawBusinessProfile
  kyc: RawBusinessKyc
  status: ReviewStatus
  agentScore: string | null
  agentRisk: RiskLevel | null
  submittedAt: string | null
  amendmentCount: string
  agentNote: string | null
  onboardingRef: string | null
}

interface RawShariahAssessment {
  verdict: ShariahVerdict
  rationale: string
  activitiesScreened: string[]
  prohibitedRevenuePct: string | null
  aaoifiStandards: string[]
}

interface RawComplianceCheck {
  shariahCompliant: boolean
  amlCleared: boolean
  kycValidated: boolean
  cddCompleted: boolean
}

interface RawComplianceReview {
  borrower: string
  vetify: string
  verifier: string
  businessName: string
  cacRegNumber: string
  verificationRef: string
  complianceRef: string
  status: ReviewStatus
  checks: RawComplianceCheck | null
  agentScore: string | null
  agentRisk: RiskLevel | null
  agentNote: string | null
  createdAt: string | null
  shariahVerdict: RawShariahAssessment | null
}

interface RawApprovedBorrower {
  borrower: string
  vetify: string
  businessName: string
  cacRegNumber: string
  verificationRef: string
  complianceRef: string
  approvedAt: string
  status: 'BorrowerActive' | 'BorrowerSuspended' | 'BorrowerExpired'
}

interface RawFinancingTerms {
  amount: string
  purpose: string
  tenureMonths: string
}

interface RawFinancingRequest {
  borrower: string
  vetify: string
  financialInstitution: string
  businessName: string
  cacRegNumber: string
  terms: RawFinancingTerms
  status: FinancingStatus
  financingRef: string
  submittedAt: string | null
  businessSector: string
}

interface RawRiskAssessment {
  score: string
  riskCategory: RiskLevel
  recommendedLimit: string
  recommendation: string
}

interface RawUnderwritingResult {
  financialInstitution: string
  businessName: string
  cacRegNumber: string
  financingRef: string
  terms: RawFinancingTerms
  assessment: RawRiskAssessment
  autoDecided: boolean
}

interface RawMurabahahTerms {
  assetCost: string
  profitAmount: string
  salePrice: string
  installmentAmount: string
  tenureMonths: string
}

interface RawMurabahahContract {
  borrower: string
  financialInstitution: string
  facilityRef: string
  businessName: string
  cacRegNumber: string
  terms: RawFinancingTerms
  murabahahTerms: RawMurabahahTerms
  startDate: string
  outstandingBalance: string
  installmentsPaid: string
  status: MurabahahStatus
}

interface RawRepaymentRecord {
  borrower: string
  financialInstitution: string
  facilityRef: string
  businessName: string
  cacRegNumber: string
  installmentNo: string
  dueDate: string
  paymentDate: string
  amountPaid: string
  remainingBalance: string
  wasLate: boolean
}

interface RawPortfolioSummary {
  totalActive: number
  totalDisbursed: number
  totalOutstanding: number
  delinquentCount: number
  completedCount: number
  defaultedCount: number
}

interface RawDocumentRef {
  docType: string
  contentHash: string
  storageRef: string
}

interface RawProviderOnboarding {
  financialInstitution: string
  vetify: string
  providerName: string
  address: string
  providerType: ProviderType
  regulatoryBody: RegulatoryBody | null
  licenseNumber: string | null
  governingDocRef: RawDocumentRef
  declaredInstruments: FinancingInstrument[]
  status: ReviewStatus
  submittedAt: string | null
  amendmentCount: string
}

interface RawApprovedProvider {
  financialInstitution: string
  vetify: string
  providerName: string
  providerType: ProviderType
  regulatoryBody: RegulatoryBody | null
  licenseNumber: string | null
  approvedInstruments: FinancingInstrument[]
  approvedAt: string
  regulator: string | null
}

interface RawAuthorizedOfficer {
  financialInstitution: string
  vetify: string
  officerId: string
  officerName: string
  roles: OfficerRole[]
  authorizedBy: string
  authorizedAt: string
  active: boolean
  approvalLimit: string | null
  validUntil: string | null
}

// ─── View models (UI-friendly, numbers as numbers) ──────────────────────────

export interface BusinessDirector {
  name: string
  address: string
  phoneNumber: string
  ninNumber: string
  bvn: string
  email: string
}

export interface BusinessProfile {
  name: string
  address: string
  state: string
  phoneNumber: string
  email: string
  website?: string
  businessType: BusinessType
  incorporationDate: string
  directors: BusinessDirector[]
  businessActivity: string
  businessSector: string
}

export interface BusinessKyc {
  cacRegNumber: string
  taxId: string
}

export interface Onboarding {
  id: string
  borrower: string
  profile: BusinessProfile
  kyc: BusinessKyc
  status: ReviewStatus
  agentScore?: number
  agentRisk?: RiskLevel
  agentNote?: string
  submittedAt?: string
  onboardingRef?: string
}

export interface ComplianceCheck {
  shariahCompliant: boolean
  amlCleared: boolean
  kycValidated: boolean
  cddCompleted: boolean
}

export interface ComplianceReviewItem {
  id: string
  businessName: string
  cacNumber: string
  verificationRef: string
  submittedAt?: string
  status: ReviewStatus
  checks?: ComplianceCheck
  agentScore?: number
  agentRisk?: RiskLevel
  shariahVerdict?: ShariahVerdict
  shariahReason?: string
}

export interface ApprovedBorrower {
  id: string
  borrower: string
  businessName: string
  cacRegNumber: string
  approvedAt: string
  status: 'BorrowerActive' | 'BorrowerSuspended' | 'BorrowerExpired'
}

export interface FinancingTerms {
  amount: number
  purpose: string
  tenureMonths: number
}

export interface RiskAssessment {
  score: number
  riskCategory: RiskLevel
  recommendedLimit: number
  recommendation: string
}

export interface FinancingRequest {
  id: string
  borrower: string
  businessName: string
  cacNumber: string
  terms: FinancingTerms
  status: FinancingStatus
  financingRef: string
  submittedAt?: string
  riskAssessment?: RiskAssessment
}

export interface MurabahahTerms {
  assetCost: number
  profit: number
  salePrice: number
  installmentAmount: number
  tenureMonths: number
  startDate: string
}

export interface MurabahahContract {
  id: string
  borrower: string
  businessName: string
  cacNumber: string
  terms: MurabahahTerms
  outstandingBalance: number
  installmentsPaid: number
  status: MurabahahStatus
}

export interface RepaymentRecord {
  id: string
  facilityRef: string
  installmentNumber: number
  dueDate: string
  date: string
  amount: number
  remainingBalance: number
  status: 'Paid' | 'Late'
}

export interface PortfolioSummary {
  totalActive: number
  totalDisbursed: number
  totalOutstanding: number
  delinquentCount: number
  completedCount: number
  defaultedCount: number
}

export interface ProviderOnboarding {
  id: string
  financialInstitution: string
  providerName: string
  address: string
  providerType: ProviderType
  regulatoryBody?: RegulatoryBody
  licenseNumber?: string
  declaredInstruments: FinancingInstrument[]
  status: ReviewStatus
  submittedAt?: string
  amendmentCount: number
}

export interface ApprovedProvider {
  id: string
  financialInstitution: string
  providerName: string
  providerType: ProviderType
  approvedInstruments: FinancingInstrument[]
  approvedAt: string
}

export interface AuthorizedOfficer {
  id: string
  financialInstitution: string
  officerId: string
  officerName: string
  roles: OfficerRole[]
  active: boolean
  approvalLimit?: number
  validUntil?: string
}

export interface CreateOnboardingPayload {
  borrower: string
  vetify: string
  verifier: string
  business: BusinessProfile
  kyc: BusinessKyc
}

export interface CreateFinancingPayload {
  approvedBorrowerContractId: string
  financialInstitution: string
  terms: {
    amount: number
    purpose: string
    tenureMonths: number
  }
}

// ─── Adapters: raw ledger payload → view model ──────────────────────────────

const num = (v: string | number): number => (typeof v === 'string' ? parseFloat(v) : v)
const optNum = (v: string | number | null): number | undefined =>
  v === null ? undefined : num(v)

function adaptOnboarding({ contractId, payload }: RawContract<RawOnboarding>): Onboarding {
  return {
    id: contractId,
    borrower: payload.borrower,
    profile: {
      name: payload.business.name,
      address: payload.business.address,
      state: payload.business.state,
      phoneNumber: payload.business.phoneNumber,
      email: payload.business.email,
      website: payload.business.website ?? undefined,
      businessType: payload.business.businessType,
      incorporationDate: payload.business.incorporationDate,
      directors: payload.business.directors,
      businessActivity: payload.business.businessActivity,
      businessSector: payload.business.businessSector,
    },
    kyc: payload.kyc,
    status: payload.status,
    agentScore: optNum(payload.agentScore),
    agentRisk: payload.agentRisk ?? undefined,
    agentNote: payload.agentNote ?? undefined,
    submittedAt: payload.submittedAt ?? undefined,
    onboardingRef: payload.onboardingRef ?? undefined,
  }
}

function adaptComplianceReview({ contractId, payload }: RawContract<RawComplianceReview>): ComplianceReviewItem {
  return {
    id: contractId,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    verificationRef: payload.verificationRef,
    submittedAt: payload.createdAt ?? undefined,
    status: payload.status,
    checks: payload.checks ?? undefined,
    agentScore: optNum(payload.agentScore),
    agentRisk: payload.agentRisk ?? undefined,
    shariahVerdict: payload.shariahVerdict?.verdict,
    shariahReason: payload.shariahVerdict?.rationale,
  }
}

function adaptApprovedBorrower({ contractId, payload }: RawContract<RawApprovedBorrower>): ApprovedBorrower {
  return {
    id: contractId,
    borrower: payload.borrower,
    businessName: payload.businessName,
    cacRegNumber: payload.cacRegNumber,
    approvedAt: payload.approvedAt,
    status: payload.status,
  }
}

function adaptTerms(t: RawFinancingTerms): FinancingTerms {
  return { amount: num(t.amount), purpose: t.purpose, tenureMonths: num(t.tenureMonths) }
}

function adaptFinancingRequest({ contractId, payload }: RawContract<RawFinancingRequest>): FinancingRequest {
  return {
    id: contractId,
    borrower: payload.borrower,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    terms: adaptTerms(payload.terms),
    status: payload.status,
    financingRef: payload.financingRef,
    submittedAt: payload.submittedAt ?? undefined,
  }
}

function adaptUnderwritingResult({ payload }: RawContract<RawUnderwritingResult>): RiskAssessment {
  return {
    score: num(payload.assessment.score),
    riskCategory: payload.assessment.riskCategory,
    recommendedLimit: num(payload.assessment.recommendedLimit),
    recommendation: payload.assessment.recommendation,
  }
}

function adaptMurabahahContract({ contractId, payload }: RawContract<RawMurabahahContract>): MurabahahContract {
  return {
    id: contractId,
    borrower: payload.borrower,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    terms: {
      assetCost: num(payload.murabahahTerms.assetCost),
      profit: num(payload.murabahahTerms.profitAmount),
      salePrice: num(payload.murabahahTerms.salePrice),
      installmentAmount: num(payload.murabahahTerms.installmentAmount),
      tenureMonths: num(payload.murabahahTerms.tenureMonths),
      startDate: payload.startDate,
    },
    outstandingBalance: num(payload.outstandingBalance),
    installmentsPaid: num(payload.installmentsPaid),
    status: payload.status,
  }
}

function adaptRepayment({ contractId, payload }: RawContract<RawRepaymentRecord>): RepaymentRecord {
  return {
    id: contractId,
    facilityRef: payload.facilityRef,
    installmentNumber: num(payload.installmentNo),
    dueDate: payload.dueDate,
    date: payload.paymentDate,
    amount: num(payload.amountPaid),
    remainingBalance: num(payload.remainingBalance),
    status: payload.wasLate ? 'Late' : 'Paid',
  }
}

function adaptProviderOnboarding({ contractId, payload }: RawContract<RawProviderOnboarding>): ProviderOnboarding {
  return {
    id: contractId,
    financialInstitution: payload.financialInstitution,
    providerName: payload.providerName,
    address: payload.address,
    providerType: payload.providerType,
    regulatoryBody: payload.regulatoryBody ?? undefined,
    licenseNumber: payload.licenseNumber ?? undefined,
    declaredInstruments: payload.declaredInstruments,
    status: payload.status,
    submittedAt: payload.submittedAt ?? undefined,
    amendmentCount: num(payload.amendmentCount),
  }
}

function adaptApprovedProvider({ contractId, payload }: RawContract<RawApprovedProvider>): ApprovedProvider {
  return {
    id: contractId,
    financialInstitution: payload.financialInstitution,
    providerName: payload.providerName,
    providerType: payload.providerType,
    approvedInstruments: payload.approvedInstruments,
    approvedAt: payload.approvedAt,
  }
}

function adaptAuthorizedOfficer({ contractId, payload }: RawContract<RawAuthorizedOfficer>): AuthorizedOfficer {
  return {
    id: contractId,
    financialInstitution: payload.financialInstitution,
    officerId: payload.officerId,
    officerName: payload.officerName,
    roles: payload.roles,
    active: payload.active,
    approvalLimit: optNum(payload.approvalLimit),
    validUntil: payload.validUntil ?? undefined,
  }
}

// ─── Axios Instance ───────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data ?? error.message)
    return Promise.reject(error)
  }
)

// ─── Query Hooks ──────────────────────────────────────────────────────────────

// Onboarding
export function useOnboardingList() {
  return useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawOnboarding>[]>('/onboarding')
      return data.map(adaptOnboarding)
    },
  })
}

export function useOnboarding(id: string) {
  return useQuery({
    queryKey: ['onboarding', id],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawOnboarding>>(`/onboarding/${id}`)
      return adaptOnboarding(data)
    },
    enabled: !!id,
  })
}

export function useComplianceQueue() {
  return useQuery({
    queryKey: ['compliance-queue'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawComplianceReview>[]>('/onboarding/compliance-reviews')
      return data.map(adaptComplianceReview)
    },
  })
}

export function useApprovedBorrowers() {
  return useQuery({
    queryKey: ['approved-borrowers'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawApprovedBorrower>[]>('/onboarding/approved')
      return data.map(adaptApprovedBorrower)
    },
  })
}

// Financing
export function useFinancingList() {
  return useQuery({
    queryKey: ['financing'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawFinancingRequest>[]>('/financing')
      return data.map(adaptFinancingRequest)
    },
  })
}

// Merges FinancingRequest (list) with UnderwritingResult (risk assessment), joined by financingRef
export function useUnderwritingQueue() {
  return useQuery({
    queryKey: ['underwriting-queue'],
    queryFn: async () => {
      const [requestsRes, resultsRes] = await Promise.all([
        apiClient.get<RawContract<RawFinancingRequest>[]>('/financing'),
        apiClient.get<RawContract<RawUnderwritingResult>[]>('/financing/underwriting-results'),
      ])
      const resultsByRef = new Map(
        resultsRes.data.map((r) => [r.payload.financingRef, adaptUnderwritingResult(r)])
      )
      return requestsRes.data
        .map(adaptFinancingRequest)
        .filter((req) => req.status === 'Underwriting')
        .map((req) => ({ ...req, riskAssessment: resultsByRef.get(req.financingRef) }))
    },
  })
}

// Contracts
export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawMurabahahContract>[]>('/contracts')
      return data.map(adaptMurabahahContract)
    },
  })
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ['contracts', id],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawMurabahahContract>>(`/contracts/${id}`)
      return adaptMurabahahContract(data)
    },
    enabled: !!id,
  })
}

export function useContractRepayments(cacRegNumber: string) {
  return useQuery({
    queryKey: ['contracts', 'repayments', cacRegNumber],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawRepaymentRecord>[]>(
        `/contracts/repayments?cacRegNumber=${encodeURIComponent(cacRegNumber)}`
      )
      return data.map(adaptRepayment)
    },
    enabled: !!cacRegNumber,
  })
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawPortfolioSummary>('/contracts/summary')
      return data as PortfolioSummary
    },
  })
}

// ─── Mutation Hooks ──────────────────────────────────────────────────────────

export function useCreateOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOnboardingPayload) =>
      apiClient.post('/onboarding', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}

export function useSubmitOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/onboarding/${id}/submit`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}

export function useApproveCompliance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, completedChecks, riskScore, riskLevel }: {
      id: string
      completedChecks: ComplianceCheck
      riskScore: number
      riskLevel: RiskLevel
    }) =>
      apiClient.post(`/onboarding/compliance/${id}/approve`, {
        completedChecks, riskScore, riskLevel, autoDecided: false,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-queue'] })
      qc.invalidateQueries({ queryKey: ['approved-borrowers'] })
    },
  })
}

export function useRejectCompliance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, completedChecks, riskScore, riskLevel, reason }: {
      id: string
      completedChecks: ComplianceCheck
      riskScore: number
      riskLevel: RiskLevel
      reason: string
    }) =>
      apiClient.post(`/onboarding/compliance/${id}/reject`, {
        completedChecks, riskScore, riskLevel, autoDecided: false, reason,
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-queue'] }),
  })
}

export function useFlagComplianceForManualReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, riskScore, riskLevel, note }: {
      id: string
      riskScore: number
      riskLevel: RiskLevel
      note: string
    }) =>
      apiClient.post(`/onboarding/compliance/${id}/flag-manual`, { riskScore, riskLevel, note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-queue'] }),
  })
}

export function useCreateFinancing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateFinancingPayload) =>
      apiClient.post('/financing', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financing'] }),
  })
}

export function useRejectFinancing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/financing/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['underwriting-queue'] }),
  })
}

export interface ApproveFinancingPayload {
  assetDetails: { description: string; supplier: string; supplierRef: string; estimatedCost: number }
  approvedProviderCid: string
  approvingOfficerId: string
}

export function useApproveFinancing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ApproveFinancingPayload }) =>
      apiClient.post(`/financing/${id}/approve`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['underwriting-queue'] })
      qc.invalidateQueries({ queryKey: ['financing'] })
    },
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: {
      id: string
      payload: { paymentDate: string; amountPaid: number; installmentNo: number }
    }) =>
      apiClient.post(`/contracts/${id}/record-payment`, payload).then((r) => r.data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['contracts', id] })
      qc.invalidateQueries({ queryKey: ['contracts', 'repayments'] })
      qc.invalidateQueries({ queryKey: ['portfolio-summary'] })
    },
  })
}

export function useCloseContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, closingDate }: { id: string; closingDate: string }) =>
      apiClient.post(`/contracts/${id}/close`, { closingDate }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['portfolio-summary'] })
    },
  })
}

// ── Stage 0: Financing Provider onboarding + AuthorizedOfficer registry ────

export function useProviderOnboardings() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawProviderOnboarding>[]>('/providers')
      return data.map(adaptProviderOnboarding)
    },
  })
}

export function useApprovedProviders() {
  return useQuery({
    queryKey: ['providers', 'approved'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawApprovedProvider>[]>('/providers/approved')
      return data.map(adaptApprovedProvider)
    },
  })
}

export function useAuthorizedOfficers() {
  return useQuery({
    queryKey: ['providers', 'officers'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawAuthorizedOfficer>[]>('/providers/officers')
      return data.map(adaptAuthorizedOfficer)
    },
  })
}

export interface CreateProviderPayload {
  financialInstitution: string
  vetify: string
  providerName: string
  address: string
  providerType: ProviderType
  regulatoryBody?: RegulatoryBody
  licenseNumber?: string
  governingDocRef: { docType: string; contentHash: string; storageRef: string }
  declaredInstruments: FinancingInstrument[]
}

export function useCreateProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProviderPayload) =>
      apiClient.post('/providers', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export function useSubmitProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/providers/${id}/submit`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export function useApproveProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approvedInstruments }: { id: string; approvedInstruments: FinancingInstrument[] }) =>
      apiClient.post(`/providers/${id}/approve`, { approvedInstruments, regulator: null }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers'] })
      qc.invalidateQueries({ queryKey: ['providers', 'approved'] })
    },
  })
}

export function useRejectProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/providers/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export interface CreateOfficerPayload {
  financialInstitution: string
  vetify: string
  officerId: string
  officerName: string
  roles: OfficerRole[]
  authorizedBy: string
  approvalLimit?: number
}

export function useCreateOfficer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOfficerPayload) =>
      apiClient.post('/providers/officers', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers', 'officers'] }),
  })
}

export function useDeactivateOfficer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: { id: string; reason: string; performedBy: string }) =>
      apiClient.post(`/providers/officers/${id}/deactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers', 'officers'] }),
  })
}

export function useReactivateOfficer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: { id: string; reason: string; performedBy: string }) =>
      apiClient.post(`/providers/officers/${id}/reactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers', 'officers'] }),
  })
}

// ── Policy Governance (VerificationPolicy / CompliancePolicy) ──────────────
// Maker-checker + Layer 2 Risk Committee endorsement — see CLAUDE.md's
// "Policy-Approval Security Roadmap" and docs/deferred-gaps.md.

export interface VerificationScoringWeights {
  identityPerfect: number
  identityDobMissing: number
  identityDobMismatch: number
  identityBvnNotFound: number
  identityNinNotFound: number
  cacActiveExactMatch: number
  cacActiveCloseMatch: number
  cacActiveNameMismatch: number
  cacPending: number
  cacInactiveOrStruckOff: number
  cacNotFound: number
  tinVerifiedMatchesCac: number
  tinVerifiedDifferentEntity: number
  tinNotFound: number
  tinApiError: number
}

export interface ComplianceScoringWeights {
  amlBothClear: number
  amlOneReviewRequired: number
  kybActiveFullMatch: number
  kybActiveMinorDiscrepancy: number
  kybInactiveOrMismatch: number
  kybNotFound: number
  creditClean: number
  creditMinorResolved: number
  creditDelinquentOrDefault: number
  businessAgeEstablishedBonus: number
  businessAgeNewlyRegisteredPenalty: number
}

interface RawVerificationPolicy {
  vetify: string
  maxAmendments: number
  slaHours: number
  autoApproveMin: number
  autoRejectMax: number
  requiredDocTypes: string[]
  policyVersion: string
  scoringWeights: Record<string, string | number>
}

interface RawPendingVerificationPolicy extends RawVerificationPolicy {
  riskCommittee: string
  proposedBy: string
  reason: string
  proposedAt: string
  riskCommitteeEndorsedBy: string | null
  riskCommitteeEndorsedAt: string | null
}

interface RawCompliancePolicy {
  vetify: string
  autoApproveMin: number
  autoRejectMax: number
  escalationSlaHours: number
  shariahPolicyVersion: string
  policyVersion: string
  effectiveFrom: string
  effectiveTo: string | null
  scoringWeights: Record<string, string | number>
}

interface RawPendingCompliancePolicy extends RawCompliancePolicy {
  riskCommittee: string
  proposedBy: string
  reason: string
  proposedAt: string
  riskCommitteeEndorsedBy: string | null
  riskCommitteeEndorsedAt: string | null
}

interface RawPolicyApprover {
  vetify: string
  approverName: string
  role: string
  authorizedBy: string
  authorizedAt: string
  active: boolean
}

export interface VerificationPolicy {
  id: string
  maxAmendments: number
  slaHours: number
  autoApproveMin: number
  autoRejectMax: number
  requiredDocTypes: string[]
  policyVersion: string
  scoringWeights: VerificationScoringWeights
}

export interface PendingVerificationPolicy extends VerificationPolicy {
  proposedBy: string
  reason: string
  proposedAt: string
  riskCommitteeEndorsedBy?: string
  riskCommitteeEndorsedAt?: string
}

export interface CompliancePolicy {
  id: string
  autoApproveMin: number
  autoRejectMax: number
  escalationSlaHours: number
  shariahPolicyVersion: string
  policyVersion: string
  effectiveFrom: string
  effectiveTo?: string
  scoringWeights: ComplianceScoringWeights
}

export interface PendingCompliancePolicy extends CompliancePolicy {
  proposedBy: string
  reason: string
  proposedAt: string
  riskCommitteeEndorsedBy?: string
  riskCommitteeEndorsedAt?: string
}

export interface PolicyApprover {
  id: string
  approverName: string
  role: string
  authorizedBy: string
  authorizedAt: string
  active: boolean
}

function adaptWeights<T>(raw: Record<string, string | number>): T {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, num(v)])) as T
}

function adaptVerificationPolicy({ contractId, payload }: RawContract<RawVerificationPolicy>): VerificationPolicy {
  return {
    id: contractId,
    maxAmendments: num(payload.maxAmendments),
    slaHours: num(payload.slaHours),
    autoApproveMin: num(payload.autoApproveMin),
    autoRejectMax: num(payload.autoRejectMax),
    requiredDocTypes: payload.requiredDocTypes,
    policyVersion: payload.policyVersion,
    scoringWeights: adaptWeights<VerificationScoringWeights>(payload.scoringWeights),
  }
}

function adaptPendingVerificationPolicy({ contractId, payload }: RawContract<RawPendingVerificationPolicy>): PendingVerificationPolicy {
  return {
    ...adaptVerificationPolicy({ contractId, payload }),
    proposedBy: payload.proposedBy,
    reason: payload.reason,
    proposedAt: payload.proposedAt,
    riskCommitteeEndorsedBy: payload.riskCommitteeEndorsedBy ?? undefined,
    riskCommitteeEndorsedAt: payload.riskCommitteeEndorsedAt ?? undefined,
  }
}

function adaptCompliancePolicy({ contractId, payload }: RawContract<RawCompliancePolicy>): CompliancePolicy {
  return {
    id: contractId,
    autoApproveMin: num(payload.autoApproveMin),
    autoRejectMax: num(payload.autoRejectMax),
    escalationSlaHours: num(payload.escalationSlaHours),
    shariahPolicyVersion: payload.shariahPolicyVersion,
    policyVersion: payload.policyVersion,
    effectiveFrom: payload.effectiveFrom,
    effectiveTo: payload.effectiveTo ?? undefined,
    scoringWeights: adaptWeights<ComplianceScoringWeights>(payload.scoringWeights),
  }
}

function adaptPendingCompliancePolicy({ contractId, payload }: RawContract<RawPendingCompliancePolicy>): PendingCompliancePolicy {
  return {
    ...adaptCompliancePolicy({ contractId, payload }),
    proposedBy: payload.proposedBy,
    reason: payload.reason,
    proposedAt: payload.proposedAt,
    riskCommitteeEndorsedBy: payload.riskCommitteeEndorsedBy ?? undefined,
    riskCommitteeEndorsedAt: payload.riskCommitteeEndorsedAt ?? undefined,
  }
}

function adaptPolicyApprover({ contractId, payload }: RawContract<RawPolicyApprover>): PolicyApprover {
  return {
    id: contractId,
    approverName: payload.approverName,
    role: payload.role,
    authorizedBy: payload.authorizedBy,
    authorizedAt: payload.authorizedAt,
    active: payload.active,
  }
}

export function useVerificationPolicy() {
  return useQuery({
    queryKey: ['policy', 'verification'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawVerificationPolicy>[]>('/policy/verification')
      return data.map(adaptVerificationPolicy)[0] ?? null
    },
  })
}

export function usePendingVerificationPolicies() {
  return useQuery({
    queryKey: ['policy', 'verification', 'pending'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawPendingVerificationPolicy>[]>('/policy/verification/pending')
      return data.map(adaptPendingVerificationPolicy)
    },
  })
}

export function useCompliancePolicy() {
  return useQuery({
    queryKey: ['policy', 'compliance'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawCompliancePolicy>[]>('/policy/compliance')
      return data.map(adaptCompliancePolicy)[0] ?? null
    },
  })
}

export function usePendingCompliancePolicies() {
  return useQuery({
    queryKey: ['policy', 'compliance', 'pending'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawPendingCompliancePolicy>[]>('/policy/compliance/pending')
      return data.map(adaptPendingCompliancePolicy)
    },
  })
}

export function usePolicyApprovers() {
  return useQuery({
    queryKey: ['policy', 'approvers'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawPolicyApprover>[]>('/policy/approvers')
      return data.map(adaptPolicyApprover)
    },
  })
}

export interface ProposeVerificationPolicyPayload {
  vetify: string
  riskCommittee: string
  maxAmendments: number
  slaHours: number
  autoApproveMin: number
  autoRejectMax: number
  requiredDocTypes: string[]
  policyVersion: string
  scoringWeights: VerificationScoringWeights
  proposedBy: string
  reason: string
}

export function useProposeVerificationPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ProposeVerificationPolicyPayload) =>
      apiClient.post('/policy/verification/propose', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'verification'] }),
  })
}

// Layer 3: endorsedBy/approvedBy/rejectedBy are no longer client-supplied —
// the backend derives them from the authenticated session behind `token`
// (see GovernanceAuthContext.tsx). `token` is a governance session JWT, not
// a Canton party JWT.
function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

export function useEndorseVerificationPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, token }: { id: string; token: string }) =>
      apiClient.post(`/policy/verification/${id}/endorse`, {}, authHeader(token)).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'verification', 'pending'] }),
  })
}

export function useApproveVerificationPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, token }: { id: string; token: string }) =>
      apiClient.post(`/policy/verification/${id}/approve`, {}, authHeader(token)).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'verification'] }),
  })
}

export function useRejectVerificationPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, token, rejectionReason }: { id: string; token: string; rejectionReason: string }) =>
      apiClient.post(`/policy/verification/${id}/reject`, { rejectionReason }, authHeader(token)).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'verification', 'pending'] }),
  })
}

export interface ProposeCompliancePolicyPayload {
  vetify: string
  riskCommittee: string
  autoApproveMin: number
  autoRejectMax: number
  escalationSlaHours: number
  shariahPolicyVersion: string
  policyVersion: string
  effectiveFrom: string
  effectiveTo?: string
  scoringWeights: ComplianceScoringWeights
  proposedBy: string
  reason: string
}

export function useProposeCompliancePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ProposeCompliancePolicyPayload) =>
      apiClient.post('/policy/compliance/propose', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'compliance'] }),
  })
}

export function useEndorseCompliancePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, token }: { id: string; token: string }) =>
      apiClient.post(`/policy/compliance/${id}/endorse`, {}, authHeader(token)).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'compliance', 'pending'] }),
  })
}

export function useApproveCompliancePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, token }: { id: string; token: string }) =>
      apiClient.post(`/policy/compliance/${id}/approve`, {}, authHeader(token)).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'compliance'] }),
  })
}

export function useRejectCompliancePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, token, rejectionReason }: { id: string; token: string; rejectionReason: string }) =>
      apiClient.post(`/policy/compliance/${id}/reject`, { rejectionReason }, authHeader(token)).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'compliance', 'pending'] }),
  })
}

export interface RegisterPolicyApproverPayload {
  vetify: string
  approverName: string
  role: string
  authorizedBy: string
}

export function useRegisterPolicyApprover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RegisterPolicyApproverPayload) =>
      apiClient.post('/policy/approvers', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'approvers'] }),
  })
}

export function useDeactivatePolicyApprover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: { id: string; reason: string; performedBy: string }) =>
      apiClient.post(`/policy/approvers/${id}/deactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'approvers'] }),
  })
}

export function useReactivatePolicyApprover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: { id: string; reason: string; performedBy: string }) =>
      apiClient.post(`/policy/approvers/${id}/reactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy', 'approvers'] }),
  })
}

// ── Layer 3 audit log (backend/src/appdb.ts) ────────────────────────────────

export interface AuditLogEntry {
  id: number
  username: string
  displayName: string
  partyRole: string
  action: string
  contractId?: string
  details: unknown
  occurredAt: string
}

export function useAuditLog(token?: string) {
  return useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data } = await apiClient.get<AuditLogEntry[]>('/auth/audit-log', token ? authHeader(token) : undefined)
      return data
    },
    enabled: !!token,
  })
}

// ── Layer 4: TOTP MFA enrollment (backend/src/auth.ts) ──────────────────────

export function useMfaEnrollInit() {
  return useMutation({
    mutationFn: (token: string) =>
      apiClient.post<{ secret: string; otpauthUri: string; qrCodeDataUrl: string }>(
        '/auth/mfa/enroll-init', {}, authHeader(token),
      ).then((r) => r.data),
  })
}

export function useMfaEnrollVerify() {
  return useMutation({
    mutationFn: ({ token, code }: { token: string; code: string }) =>
      apiClient.post<{ enabled: boolean }>('/auth/mfa/enroll-verify', { code }, authHeader(token)).then((r) => r.data),
  })
}

export function useMfaDisable() {
  return useMutation({
    mutationFn: (token: string) =>
      apiClient.post<{ enabled: boolean }>('/auth/mfa/disable', {}, authHeader(token)).then((r) => r.data),
  })
}
