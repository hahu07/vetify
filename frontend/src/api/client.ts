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
  | 'UnderwritingManualReview'
  | 'Underwriting'
  | 'FinancingApproved'
  | 'FinancingRejected'
  | 'Withdrawn'
  | 'Expired'
  | 'Cancelled'

export type MurabahahStatus = 'Active' | 'Delinquent' | 'Completed' | 'Defaulted' | 'DelinquencyManualReview'

export type BusinessType = 'SoleProprietorship' | 'LimitedCompany'

export type RiskLevel = 'Low' | 'Medium' | 'High'

export type ShariahVerdict = 'COMPLIANT' | 'REQUIRES_REVIEW' | 'NON_COMPLIANT'

export type ProviderType =
  | 'CBNLicensedNIFI' | 'SECFundManager' | 'PenComPensionManager' | 'CooperativeSociety'
  | 'InvestmentClub' | 'WaqfFund' | 'ZakatFund' | 'Philanthropy'

export type RegulatoryBody = 'CBN' | 'SEC' | 'PenCom' | 'CAC' | 'StateCooperativeRegistry' | 'SelfGoverned' | 'Unregulated'

export type FinancingInstrument = 'Murabahah' | 'Ijarah' | 'QardHasan'

// Review gap G18 (docs/platform-review-2026-07.md): the Daml enum declares
// Ijarah and QardHasan for forward compatibility, but ONLY Murabahah has an
// implemented lifecycle (templates, agents, workflows). UI surfaces must not
// let a provider be approved for an instrument the platform can't actually
// execute — filter selections through this set until the others ship.
export const IMPLEMENTED_INSTRUMENTS: ReadonlySet<FinancingInstrument> = new Set(['Murabahah'])

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
  business: string
  vetify: string
  verifier: string
  profile: RawBusinessProfile
  kyc: RawBusinessKyc
  status: ReviewStatus
  agentScore: string | null
  agentRisk: RiskLevel | null
  submittedAt: string | null
  amendmentCount: string
  agentNote: string | null
  onboardingRef: string | null
  documents: RawDocumentRef[]
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
  business: string
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

interface RawApprovedBusiness {
  business: string
  vetify: string
  businessName: string
  cacRegNumber: string
  verificationRef: string
  complianceRef: string
  approvedAt: string
  status: 'BusinessActive' | 'BusinessSuspended' | 'BusinessExpired'
}

interface RawFinancingTerms {
  amount: string
  purpose: string
  tenureMonths: string
}

interface RawFinancingRequest {
  business: string
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
  business: string
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
  // G11: the advisor's (Shari'a Supervisory Board's) per-contract sign-off —
  // recorded once at AcceptProposal time, see docs/platform-review-2026-07.md §11.
  shariahCertificationRef: string
  shariahCertifiedBy: string
}

interface RawRepaymentRecord {
  business: string
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
  mimeType?: string | null
  malwareScanStatus?: string | null
  fileSize?: string | null
  checksumAlgorithm?: string | null
  malwareScanAt?: string | null
  digitalSignature?: string | null
}

interface RawProviderOnboarding {
  financialInstitution: string
  vetify: string
  providerName: string
  address: string
  cacRegNumber: string
  providerType: ProviderType
  regulatoryBody: RegulatoryBody | null
  licenseNumber: string | null
  governingDocRef: RawDocumentRef
  declaredInstruments: FinancingInstrument[]
  status: ReviewStatus
  submittedAt: string | null
  amendmentCount: string
  agentScore: string | null
  agentRisk: RiskLevel | null
  agentNote: string | null
  agentVersion: string | null
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

export interface DocumentRef {
  docType: string
  contentHash: string
  storageRef: string
  mimeType?: string
  fileSize?: number
  checksumAlgorithm?: string
}

export interface Onboarding {
  id: string
  business: string
  profile: BusinessProfile
  kyc: BusinessKyc
  status: ReviewStatus
  agentScore?: number
  agentRisk?: RiskLevel
  agentNote?: string
  submittedAt?: string
  onboardingRef?: string
  documents: DocumentRef[]
}

export interface ComplianceCheck {
  shariahCompliant: boolean
  amlCleared: boolean
  kycValidated: boolean
  cddCompleted: boolean
}

export interface VerificationChecks {
  identityVerified: boolean
  cacRegistered: boolean
  documentsValid: boolean
  dataConsistent: boolean
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

export type EddCaseStatus = 'EddOpen' | 'EddClosed'

interface RawEddChecklist {
  sourceOfWealthVerified: boolean
  sourceOfWealthNote: string | null
  enhancedMediaSearchDone: boolean
  seniorManagementSignoff: string | null
  monitoringFrequency: string | null
}

interface RawEddCase {
  vetify: string
  verifier: string
  business: string
  businessName: string
  cacRegNumber: string
  triggerReason: string
  checklist: RawEddChecklist
  status: EddCaseStatus
  openedAt: string
  closedAt: string | null
  closedBy: string | null
}

export interface EddChecklist {
  sourceOfWealthVerified: boolean
  sourceOfWealthNote?: string
  enhancedMediaSearchDone: boolean
  seniorManagementSignoff?: string
  monitoringFrequency?: string
}

export interface EddCase {
  id: string
  businessName: string
  cacNumber: string
  triggerReason: string
  checklist: EddChecklist
  status: EddCaseStatus
  openedAt: string
  closedAt?: string
  closedBy?: string
}

function adaptEddCase({ contractId, payload }: RawContract<RawEddCase>): EddCase {
  return {
    id: contractId,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    triggerReason: payload.triggerReason,
    checklist: {
      sourceOfWealthVerified: payload.checklist.sourceOfWealthVerified,
      sourceOfWealthNote: payload.checklist.sourceOfWealthNote ?? undefined,
      enhancedMediaSearchDone: payload.checklist.enhancedMediaSearchDone,
      seniorManagementSignoff: payload.checklist.seniorManagementSignoff ?? undefined,
      monitoringFrequency: payload.checklist.monitoringFrequency ?? undefined,
    },
    status: payload.status,
    openedAt: payload.openedAt,
    closedAt: payload.closedAt ?? undefined,
    closedBy: payload.closedBy ?? undefined,
  }
}

export interface ApprovedBusiness {
  id: string
  business: string
  businessName: string
  cacRegNumber: string
  approvedAt: string
  status: 'BusinessActive' | 'BusinessSuspended' | 'BusinessExpired'
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
  business: string
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
  facilityRef: string
  business: string
  businessName: string
  cacNumber: string
  terms: MurabahahTerms
  outstandingBalance: number
  installmentsPaid: number
  status: MurabahahStatus
  shariahCertificationRef: string
  shariahCertifiedBy: string
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
  cacRegNumber: string
  providerType: ProviderType
  regulatoryBody?: RegulatoryBody
  licenseNumber?: string
  declaredInstruments: FinancingInstrument[]
  status: ReviewStatus
  submittedAt?: string
  amendmentCount: number
  agentScore?: number
  agentRisk?: RiskLevel
  agentNote?: string
  agentVersion?: string
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
  business: string
  vetify: string
  verifier: string
  profile: BusinessProfile
  kyc: BusinessKyc
  documents: DocumentRef[]
}

export interface CreateFinancingPayload {
  approvedBusinessContractId: string
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
    business: payload.business,
    profile: {
      name: payload.profile.name,
      address: payload.profile.address,
      state: payload.profile.state,
      phoneNumber: payload.profile.phoneNumber,
      email: payload.profile.email,
      website: payload.profile.website ?? undefined,
      businessType: payload.profile.businessType,
      incorporationDate: payload.profile.incorporationDate,
      directors: payload.profile.directors,
      businessActivity: payload.profile.businessActivity,
      businessSector: payload.profile.businessSector,
    },
    kyc: payload.kyc,
    status: payload.status,
    agentScore: optNum(payload.agentScore),
    agentRisk: payload.agentRisk ?? undefined,
    agentNote: payload.agentNote ?? undefined,
    submittedAt: payload.submittedAt ?? undefined,
    onboardingRef: payload.onboardingRef ?? undefined,
    documents: (payload.documents ?? []).map((d) => ({
      docType: d.docType,
      contentHash: d.contentHash,
      storageRef: d.storageRef,
      mimeType: d.mimeType ?? undefined,
      fileSize: d.fileSize ? Number(d.fileSize) : undefined,
      checksumAlgorithm: d.checksumAlgorithm ?? undefined,
    })),
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

function adaptApprovedBusiness({ contractId, payload }: RawContract<RawApprovedBusiness>): ApprovedBusiness {
  return {
    id: contractId,
    business: payload.business,
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
    business: payload.business,
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
    facilityRef: payload.facilityRef,
    business: payload.business,
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
    shariahCertificationRef: payload.shariahCertificationRef,
    shariahCertifiedBy: payload.shariahCertifiedBy,
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

export type IbraSettlementType = 'FullIbra' | 'PartialIbra'

interface RawIbraRequest {
  business: string
  financialInstitution: string
  facilityRef: string
  businessName: string
  cacRegNumber: string
  outstandingBalance: string
  requestedSettlementDate: string
  settlementType: IbraSettlementType
  requestedAmount: string | null
}

export interface IbraRequest {
  id: string
  facilityRef: string
  businessName: string
  cacNumber: string
  outstandingBalance: number
  requestedSettlementDate: string
  settlementType: IbraSettlementType
  requestedAmount?: number
}

function adaptIbraRequest({ contractId, payload }: RawContract<RawIbraRequest>): IbraRequest {
  return {
    id: contractId,
    facilityRef: payload.facilityRef,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    outstandingBalance: num(payload.outstandingBalance),
    requestedSettlementDate: payload.requestedSettlementDate,
    settlementType: payload.settlementType,
    requestedAmount: payload.requestedAmount != null ? num(payload.requestedAmount) : undefined,
  }
}

interface RawLatePaymentCharity {
  business: string
  financialInstitution: string
  businessName: string
  cacRegNumber: string
  installmentNo: string
  dueDate: string
  paymentDate: string
  charityAmount: string | null
  settled: boolean
}

export interface LatePaymentCharity {
  id: string
  businessName: string
  cacNumber: string
  installmentNo: number
  dueDate: string
  paymentDate: string
  charityAmount?: number
  settled: boolean
}

function adaptLatePaymentCharity({ contractId, payload }: RawContract<RawLatePaymentCharity>): LatePaymentCharity {
  return {
    id: contractId,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    installmentNo: num(payload.installmentNo),
    dueDate: payload.dueDate,
    paymentDate: payload.paymentDate,
    charityAmount: payload.charityAmount != null ? num(payload.charityAmount) : undefined,
    settled: payload.settled,
  }
}

export type CollateralStatus = 'CollateralActive' | 'CollateralReleased' | 'CollateralEnforced'

interface RawRahnAgreement {
  business: string
  financialInstitution: string
  facilityRef: string
  businessName: string
  cacRegNumber: string
  collateralDescription: string
  collateralValue: string
  collateralStatus: CollateralStatus
  releaseEvidence: string | null
}

export interface RahnAgreement {
  id: string
  facilityRef: string
  businessName: string
  cacNumber: string
  collateralDescription: string
  collateralValue: number
  collateralStatus: CollateralStatus
  releaseEvidence?: string
}

function adaptRahnAgreement({ contractId, payload }: RawContract<RawRahnAgreement>): RahnAgreement {
  return {
    id: contractId,
    facilityRef: payload.facilityRef,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    collateralDescription: payload.collateralDescription,
    collateralValue: num(payload.collateralValue),
    collateralStatus: payload.collateralStatus,
    releaseEvidence: payload.releaseEvidence ?? undefined,
  }
}

function adaptProviderOnboarding({ contractId, payload }: RawContract<RawProviderOnboarding>): ProviderOnboarding {
  return {
    id: contractId,
    financialInstitution: payload.financialInstitution,
    providerName: payload.providerName,
    address: payload.address,
    cacRegNumber: payload.cacRegNumber,
    providerType: payload.providerType,
    regulatoryBody: payload.regulatoryBody ?? undefined,
    licenseNumber: payload.licenseNumber ?? undefined,
    declaredInstruments: payload.declaredInstruments,
    status: payload.status,
    submittedAt: payload.submittedAt ?? undefined,
    amendmentCount: num(payload.amendmentCount),
    agentScore: optNum(payload.agentScore),
    agentRisk: payload.agentRisk ?? undefined,
    agentNote: payload.agentNote ?? undefined,
    agentVersion: payload.agentVersion ?? undefined,
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

// ─── Murabahah Acquisition Chain (Wa'd → Wakala/Direct → AssetPurchaseRecord → Proposal) ──
// AAOIFI Std No. 8/23 — see CLAUDE.md's "Murabahah acquisition chain" note.

interface RawAssetDetails {
  description: string
  supplier: string
  supplierRef: string
  estimatedCost: string
}

export interface AssetDetails {
  description: string
  supplier: string
  supplierRef: string
  estimatedCost: number
}

function adaptAssetDetails(a: RawAssetDetails): AssetDetails {
  return {
    description: a.description,
    supplier: a.supplier,
    supplierRef: a.supplierRef,
    estimatedCost: num(a.estimatedCost),
  }
}

interface RawMurabahahWad {
  business: string
  vetify: string
  financialInstitution: string
  businessName: string
  cacRegNumber: string
  terms: RawFinancingTerms
  assetDetails: RawAssetDetails
  financingRef: string | null
  offerExpiresAt: string | null
}

export interface MurabahahWad {
  id: string
  business: string
  financialInstitution: string
  businessName: string
  cacNumber: string
  terms: FinancingTerms
  assetDetails: AssetDetails
  financingRef?: string
  offerExpiresAt?: string
}

function adaptWad({ contractId, payload }: RawContract<RawMurabahahWad>): MurabahahWad {
  return {
    id: contractId,
    business: payload.business,
    financialInstitution: payload.financialInstitution,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    terms: adaptTerms(payload.terms),
    assetDetails: adaptAssetDetails(payload.assetDetails),
    financingRef: payload.financingRef ?? undefined,
    offerExpiresAt: payload.offerExpiresAt ?? undefined,
  }
}

interface RawMurabahahWakala {
  business: string
  vetify: string
  financialInstitution: string
  businessName: string
  cacRegNumber: string
  terms: RawFinancingTerms
  assetDetails: RawAssetDetails
  agencyFee: string | null
}

export interface MurabahahWakala {
  id: string
  business: string
  financialInstitution: string
  businessName: string
  cacNumber: string
  terms: FinancingTerms
  assetDetails: AssetDetails
  agencyFee?: number
}

function adaptWakala({ contractId, payload }: RawContract<RawMurabahahWakala>): MurabahahWakala {
  return {
    id: contractId,
    business: payload.business,
    financialInstitution: payload.financialInstitution,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    terms: adaptTerms(payload.terms),
    assetDetails: adaptAssetDetails(payload.assetDetails),
    agencyFee: optNum(payload.agencyFee),
  }
}

interface RawAssetPurchaseRecord {
  business: string
  vetify: string
  financialInstitution: string
  businessName: string
  cacRegNumber: string
  terms: RawFinancingTerms
  assetDetails: RawAssetDetails
  actualCost: string
  purchaseDate: string
  invoiceRef: string
  totalAcquisitionCost: string
  purchasedViaWakala: boolean
  deliveryAcknowledged: boolean
}

export interface AssetPurchaseRecord {
  id: string
  business: string
  financialInstitution: string
  businessName: string
  cacNumber: string
  assetDetails: AssetDetails
  actualCost: number
  purchaseDate: string
  invoiceRef: string
  totalAcquisitionCost: number
  purchasedViaWakala: boolean
  deliveryAcknowledged: boolean
}

function adaptPurchaseRecord({ contractId, payload }: RawContract<RawAssetPurchaseRecord>): AssetPurchaseRecord {
  return {
    id: contractId,
    business: payload.business,
    financialInstitution: payload.financialInstitution,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    assetDetails: adaptAssetDetails(payload.assetDetails),
    actualCost: num(payload.actualCost),
    purchaseDate: payload.purchaseDate,
    invoiceRef: payload.invoiceRef,
    totalAcquisitionCost: num(payload.totalAcquisitionCost),
    purchasedViaWakala: payload.purchasedViaWakala,
    deliveryAcknowledged: payload.deliveryAcknowledged,
  }
}

interface RawMurabahahProposal {
  business: string
  vetify: string
  financialInstitution: string
  advisor: string
  facilityRef: string
  businessName: string
  cacRegNumber: string
  actualCost: string
  murabahahTerms: RawMurabahahTerms
  startDate: string
  acceptanceExpiresAt: string | null
}

export interface MurabahahProposal {
  id: string
  business: string
  financialInstitution: string
  advisor: string
  facilityRef: string
  businessName: string
  cacNumber: string
  actualCost: number
  murabahahTerms: MurabahahTerms
  startDate: string
  acceptanceExpiresAt?: string
}

function adaptProposal({ contractId, payload }: RawContract<RawMurabahahProposal>): MurabahahProposal {
  return {
    id: contractId,
    business: payload.business,
    financialInstitution: payload.financialInstitution,
    advisor: payload.advisor,
    facilityRef: payload.facilityRef,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    actualCost: num(payload.actualCost),
    murabahahTerms: {
      assetCost: num(payload.murabahahTerms.assetCost),
      profit: num(payload.murabahahTerms.profitAmount),
      salePrice: num(payload.murabahahTerms.salePrice),
      installmentAmount: num(payload.murabahahTerms.installmentAmount),
      tenureMonths: num(payload.murabahahTerms.tenureMonths),
      startDate: payload.startDate,
    },
    startDate: payload.startDate,
    acceptanceExpiresAt: payload.acceptanceExpiresAt ?? undefined,
  }
}

// G11 — Shari'a Supervisory Board's per-contract sign-off on a proposal's terms.
interface RawShariahContractCertification {
  advisor: string
  business: string
  financialInstitution: string
  facilityRef: string
  businessName: string
  cacRegNumber: string
  certifiedSalePrice: string
  certifiedAssetCost: string
  certifiedProfitAmount: string
  certifiedTenureMonths: string
  certificationRef: string
  verdict: string
  aaoifiStandards: string[]
  rationale: string
  certifiedBy: string
  certifiedAt: string
}

export interface ShariahContractCertification {
  id: string
  advisor: string
  facilityRef: string
  businessName: string
  cacNumber: string
  certifiedSalePrice: number
  certifiedAssetCost: number
  certifiedProfitAmount: number
  certifiedTenureMonths: number
  certificationRef: string
  verdict: string
  aaoifiStandards: string[]
  rationale: string
  certifiedBy: string
  certifiedAt: string
}

function adaptCertification({ contractId, payload }: RawContract<RawShariahContractCertification>): ShariahContractCertification {
  return {
    id: contractId,
    advisor: payload.advisor,
    facilityRef: payload.facilityRef,
    businessName: payload.businessName,
    cacNumber: payload.cacRegNumber,
    certifiedSalePrice: num(payload.certifiedSalePrice),
    certifiedAssetCost: num(payload.certifiedAssetCost),
    certifiedProfitAmount: num(payload.certifiedProfitAmount),
    certifiedTenureMonths: num(payload.certifiedTenureMonths),
    certificationRef: payload.certificationRef,
    verdict: payload.verdict,
    aaoifiStandards: payload.aaoifiStandards,
    rationale: payload.rationale,
    certifiedBy: payload.certifiedBy,
    certifiedAt: payload.certifiedAt,
  }
}

// ─── Axios Instance ───────────────────────────────────────────────────────────

// Relative '/api' only resolves when something in front of this app proxies it to the
// backend — true for Vite's local dev server (see vite.config.ts), but not for a static
// build deployed on its own domain (e.g. Vercel), which has nothing to proxy to. Overridable
// via VITE_API_BASE_URL (e.g. an ngrok URL + "/api") for that case.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// G1 (docs/platform-review-2026-07.md): every /api route now requires a real
// backend session — attach the JWT issued by /api/auth/login (stored by
// auth/AuthContext.tsx under 'vetify_token').
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('vetify_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // Idempotency-Key (surfaced by comparing this backend against Canton's own
  // app-dev guidance, 8 Jul 2026 — see backend/src/idempotency.ts): generated
  // once per distinct mutating call and only if this exact request config
  // doesn't already carry one, so a genuine retry of the same call (a
  // future axios-retry addition, or an infra-level proxy replaying a
  // timed-out request) reuses the same key — which the backend threads
  // through to the Canton ledger command ID, letting Canton's own
  // deduplication recognize the repeat instead of double-executing it. A
  // fresh user-initiated action always gets a fresh config object, so it
  // correctly gets a fresh key, not deduped away.
  const method = (config.method ?? 'get').toLowerCase()
  if (method !== 'get' && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = crypto.randomUUID()
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => {
    // Self-serve signup tenant scoping: a business's first onboarding
    // submission (POST /api/onboarding) links their account to a CAC
    // registration number, which the *existing* stored session token doesn't
    // carry yet — the backend mints a fresh one reflecting it and returns it
    // as `refreshedToken` so every subsequent request scopes correctly
    // without forcing a fresh login. Response-shape-based (not call-site
    // based), so any future route that adds this field is covered for free.
    const refreshedToken = (response.data as { refreshedToken?: string } | undefined)?.refreshedToken
    if (refreshedToken) localStorage.setItem('vetify_token', refreshedToken)
    return response
  },
  (error) => {
    // Expired/invalid session → clear local state and return to login rather
    // than letting every query fail quietly in the background.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem('vetify_token')
      localStorage.removeItem('vetify_user')
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    console.error('API Error:', error.response?.data ?? error.message)
    return Promise.reject(error)
  }
)

// ─── Query Hooks ──────────────────────────────────────────────────────────────

// Dev Tools (Stage 2/3 simulation, backend/src/routes/dev.ts — dev-only,
// backend refuses to mount this router at all when NODE_ENV=production).
export function useDevOnboardings() {
  return useQuery({
    queryKey: ['dev', 'onboardings'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawOnboarding>[]>('/dev/onboardings')
      return data
    },
  })
}

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

export interface OnboardingDocuments {
  source: 'live' | 'archived' | null
  onboardingRef: string | null
  documents: DocumentRef[]
}

function adaptDocumentRefs(raw: RawDocumentRef[]): DocumentRef[] {
  return raw.map((d) => ({
    docType: d.docType,
    contentHash: d.contentHash,
    storageRef: d.storageRef,
    mimeType: d.mimeType ?? undefined,
    fileSize: d.fileSize ? Number(d.fileSize) : undefined,
    checksumAlgorithm: d.checksumAlgorithm ?? undefined,
  }))
}

// Staff-only (vetify/verifier) — routes/onboarding.ts's GET /documents/:cacRegNumber
// keyed by CAC rather than contract ID, since a business's documents live on
// BusinessOnboarding only while it's still mid-pipeline; Approve/Reject archives
// that contract without recreating it, so a stale contract ID stops resolving
// the moment a decision is made (see DocumentsModal.tsx, used from the
// Onboarding Pipeline / Approved Businesses / Verification & Compliance Results
// sections in VetifyOnboarding.tsx).
export function useOnboardingDocuments(cacRegNumber: string, enabled = true) {
  return useQuery({
    queryKey: ['onboarding-documents', cacRegNumber],
    queryFn: async () => {
      const { data } = await apiClient.get<{ source: 'live' | 'archived' | null; onboardingRef: string | null; documents: RawDocumentRef[] }>(
        `/onboarding/documents/${cacRegNumber}`,
      )
      return { source: data.source, onboardingRef: data.onboardingRef, documents: adaptDocumentRefs(data.documents) }
    },
    enabled: enabled && !!cacRegNumber,
  })
}

// Opens a KYC document in a new tab via a blob fetch (carries the session's
// Authorization header through apiClient's interceptor) rather than a plain
// <a href> — the backend endpoint requires staff auth, which a direct
// navigation can't send.
export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (doc: DocumentRef) => {
      const filename = doc.storageRef.split('/').pop() ?? 'document'
      const response = await apiClient.get('/documents/download', {
        params: { ref: doc.storageRef, mimeType: doc.mimeType, filename },
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: doc.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
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

export function useApprovedBusinesses() {
  return useQuery({
    queryKey: ['approved-businesses'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawApprovedBusiness>[]>('/onboarding/approved')
      return data.map(adaptApprovedBusiness)
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

interface RawUnderwritingRejection {
  businessName: string
  cacRegNumber: string
  financingRef: string
  reason: string
  decidedAt: string
}

export interface UnderwritingRejectionItem {
  id: string
  businessName: string
  cacRegNumber: string
  financingRef: string
  reason: string
  decidedAt: string
}

// RejectUnderwriting archives FinancingRequest without recreating it — business-scoped
// so a rejected business's dashboard can read the outcome (see BusinessDashboard.tsx).
export function useUnderwritingRejections() {
  return useQuery({
    queryKey: ['underwriting-rejections'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawUnderwritingRejection>[]>('/financing/underwriting-rejections')
      return data.map(({ contractId, payload }): UnderwritingRejectionItem => ({
        id: contractId,
        businessName: payload.businessName,
        cacRegNumber: payload.cacRegNumber,
        financingRef: payload.financingRef,
        reason: payload.reason,
        decidedAt: payload.decidedAt,
      }))
    },
  })
}

// Stage 6: requests still awaiting the assessor's BeginUnderwriting/RejectUnderwriting/
// FlagUnderwritingForManualReview decision — distinct from useUnderwritingQueue above,
// which shows requests *already* underwritten (status Underwriting) and awaiting the FI's
// Stage 7 ApproveFunding/RejectFunding instead.
export function useAssessorQueue() {
  return useQuery({
    queryKey: ['assessor-queue'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawFinancingRequest>[]>('/financing')
      return data
        .map(adaptFinancingRequest)
        .filter((req) => req.status === 'Submitted' || req.status === 'UnderwritingManualReview')
    },
  })
}

export interface BeginUnderwritingPayload {
  assessment: {
    score: number
    riskCategory: RiskLevel
    recommendedLimit: number
    recommendation: string
  }
  assessorName?: string
}

export function useBeginUnderwriting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assessment, assessorName }: { id: string } & BeginUnderwritingPayload) =>
      apiClient.post(`/financing/${id}/begin-underwriting`,
        { assessment, autoDecided: false, assessorName }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assessor-queue'] })
      qc.invalidateQueries({ queryKey: ['underwriting-queue'] })
    },
  })
}

export function useRejectUnderwriting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/financing/${id}/reject-underwriting`, { reason, autoDecided: false }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessor-queue'] }),
  })
}

export function useFlagUnderwritingForManualReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, riskScore, riskLevel, note }: { id: string; riskScore: number; riskLevel: RiskLevel; note: string }) =>
      apiClient.post(`/financing/${id}/flag-underwriting`,
        { riskScore, riskLevel, agentVersion: 'manual-review', note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessor-queue'] }),
  })
}

// ── UnderwritingPolicy (per-institution Stage 6 scoring policy) ─────────────

interface RawUnderwritingPolicy {
  vetify: string
  financialInstitution: string
  policyVersion: string
  autoApproveMin: string
  autoRejectMax: string
  minDscrRatio: string | null
  minLoanAmount: string | null
  maxLoanAmount: string | null
  indicativeProfitMarginPct: string | null
  requestSlaHours: string
  offerValidityDays: string
  effectiveFrom: string
  effectiveTo: string | null
  scoringWeights: Record<string, string | number>
}

export interface UnderwritingPolicy {
  id: string
  financialInstitution: string
  policyVersion: string
  autoApproveMin: number
  autoRejectMax: number
  minDscrRatio?: number
  minLoanAmount?: number
  maxLoanAmount?: number
  indicativeProfitMarginPct?: number
  requestSlaHours: number
  offerValidityDays: number
  effectiveFrom: string
  effectiveTo?: string
}

function adaptUnderwritingPolicy({ contractId, payload }: RawContract<RawUnderwritingPolicy>): UnderwritingPolicy {
  return {
    id: contractId,
    financialInstitution: payload.financialInstitution,
    policyVersion: payload.policyVersion,
    autoApproveMin: num(payload.autoApproveMin),
    autoRejectMax: num(payload.autoRejectMax),
    minDscrRatio: payload.minDscrRatio != null ? num(payload.minDscrRatio) : undefined,
    minLoanAmount: payload.minLoanAmount != null ? num(payload.minLoanAmount) : undefined,
    maxLoanAmount: payload.maxLoanAmount != null ? num(payload.maxLoanAmount) : undefined,
    indicativeProfitMarginPct: payload.indicativeProfitMarginPct != null ? num(payload.indicativeProfitMarginPct) : undefined,
    requestSlaHours: num(payload.requestSlaHours),
    offerValidityDays: num(payload.offerValidityDays),
    effectiveFrom: payload.effectiveFrom,
    effectiveTo: payload.effectiveTo ?? undefined,
  }
}

export function useUnderwritingPolicies() {
  return useQuery({
    queryKey: ['underwriting-policy'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawUnderwritingPolicy>[]>('/financing/underwriting-policy')
      return (Array.isArray(data) ? data : [data]).map(adaptUnderwritingPolicy)
    },
  })
}

// Business-side lookup (FinancingForm.tsx's Stage 5 "Estimated Terms") — scoped
// to a single FI via the same GET route's ?financialInstitution= filter, rather
// than fetching every institution's policy the way the vetify-staff list above
// does. Returns null (not an error) when the FI hasn't configured one yet, so
// callers fall back to platform defaults.
export function useUnderwritingPolicyForFi(financialInstitution: string) {
  return useQuery({
    queryKey: ['underwriting-policy', financialInstitution],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawUnderwritingPolicy>[]>('/financing/underwriting-policy', {
        params: { financialInstitution },
      })
      const list = Array.isArray(data) ? data : [data]
      return list.length > 0 ? adaptUnderwritingPolicy(list[0]) : null
    },
    enabled: !!financialInstitution,
  })
}

export interface CreateUnderwritingPolicyPayload {
  vetify: string
  financialInstitution: string
  policyVersion: string
  autoApproveMin: number
  autoRejectMax: number
  minDscrRatio?: number
  minLoanAmount?: number
  maxLoanAmount?: number
  indicativeProfitMarginPct?: number
  requestSlaHours: number
  offerValidityDays: number
  effectiveFrom: string
  scoringWeights: Record<string, number>
}

export function useCreateUnderwritingPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUnderwritingPolicyPayload) =>
      apiClient.post('/financing/underwriting-policy', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['underwriting-policy'] }),
  })
}

export interface UpdateUnderwritingPolicyPayload {
  newPolicyVersion: string
  newAutoApproveMin: number
  newAutoRejectMax: number
  newMinDscrRatio?: number
  newMinLoanAmount?: number
  newMaxLoanAmount?: number
  newIndicativeProfitMarginPct?: number
  newRequestSlaHours: number
  newOfferValidityDays: number
  newEffectiveFrom: string
  newScoringWeights: Record<string, number>
}

export function useUpdateUnderwritingPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateUnderwritingPolicyPayload) =>
      apiClient.post(`/financing/underwriting-policy/${id}/update`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['underwriting-policy'] }),
  })
}

// ── ProviderVerificationPolicy (Stage 0 scoring policy) ─────────────────────

export interface ProviderVerificationScoringWeights {
  cacActiveExactMatch: number
  cacActiveCloseMatch: number
  cacActiveNameMismatch: number
  cacPending: number
  cacInactiveOrStruckOff: number
  cacNotFound: number
  regulatedWithLicense: number
  regulatedMissingLicense: number
  unregulatedDeclared: number
}

interface RawProviderVerificationPolicy {
  vetify: string
  policyVersion: string
  autoRejectMax: string
  effectiveFrom: string
  scoringWeights: Record<string, string | number>
}

export interface ProviderVerificationPolicy {
  id: string
  policyVersion: string
  autoRejectMax: number
  effectiveFrom: string
  scoringWeights: ProviderVerificationScoringWeights
}

function adaptProviderVerificationPolicy({ contractId, payload }: RawContract<RawProviderVerificationPolicy>): ProviderVerificationPolicy {
  return {
    id: contractId,
    policyVersion: payload.policyVersion,
    autoRejectMax: num(payload.autoRejectMax),
    effectiveFrom: payload.effectiveFrom,
    scoringWeights: Object.fromEntries(
      Object.entries(payload.scoringWeights).map(([k, v]) => [k, num(v)])
    ) as unknown as ProviderVerificationScoringWeights,
  }
}

export function useProviderVerificationPolicies() {
  return useQuery({
    queryKey: ['provider-verification-policy'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawProviderVerificationPolicy>[]>('/providers/policy')
      return (Array.isArray(data) ? data : [data]).map(adaptProviderVerificationPolicy)
    },
  })
}

export interface CreateProviderVerificationPolicyPayload {
  policyVersion: string
  autoRejectMax: number
  effectiveFrom: string
  scoringWeights: ProviderVerificationScoringWeights
}

export function useCreateProviderVerificationPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProviderVerificationPolicyPayload) =>
      apiClient.post('/providers/policy', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provider-verification-policy'] }),
  })
}

export interface UpdateProviderVerificationPolicyPayload {
  newPolicyVersion: string
  newAutoRejectMax: number
  newEffectiveFrom: string
  newScoringWeights: ProviderVerificationScoringWeights
}

export function useUpdateProviderVerificationPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateProviderVerificationPolicyPayload) =>
      apiClient.post(`/providers/policy/${id}/update`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provider-verification-policy'] }),
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

interface RawPortfolioReport {
  vetify: string
  financialInstitution: string
  regulator: string | null
  reportDate: string
  totalActiveContracts: string
  totalDisbursed: string
  totalOutstanding: string
  delinquentCount: string
  completedCount: string
  defaultedCount: string
  summary: string
}

export interface PortfolioReport {
  id: string
  financialInstitution: string
  reportDate: string
  totalActiveContracts: number
  totalDisbursed: number
  totalOutstanding: number
  delinquentCount: number
  completedCount: number
  defaultedCount: number
  summary: string
}

function adaptPortfolioReport({ contractId, payload }: RawContract<RawPortfolioReport>): PortfolioReport {
  return {
    id: contractId,
    financialInstitution: payload.financialInstitution,
    reportDate: payload.reportDate,
    totalActiveContracts: num(payload.totalActiveContracts),
    totalDisbursed: num(payload.totalDisbursed),
    totalOutstanding: num(payload.totalOutstanding),
    delinquentCount: num(payload.delinquentCount),
    completedCount: num(payload.completedCount),
    defaultedCount: num(payload.defaultedCount),
    summary: payload.summary,
  }
}

export function usePortfolioReports() {
  return useQuery({
    queryKey: ['portfolio-reports'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawPortfolioReport>[]>('/contracts/reports')
      return data.map(adaptPortfolioReport).sort((a, b) => b.reportDate.localeCompare(a.reportDate))
    },
  })
}

export function useIbraRequests() {
  return useQuery({
    queryKey: ['contracts', 'ibra'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawIbraRequest>[]>('/contracts/ibra')
      return data.map(adaptIbraRequest)
    },
  })
}

export function useLatePaymentCharities() {
  return useQuery({
    queryKey: ['contracts', 'charity'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawLatePaymentCharity>[]>('/contracts/charity')
      return data.map(adaptLatePaymentCharity)
    },
  })
}

export function useRahnAgreements() {
  return useQuery({
    queryKey: ['contracts', 'rahn'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawRahnAgreement>[]>('/contracts/rahn')
      return data.map(adaptRahnAgreement)
    },
  })
}

// ─── Mutation Hooks ──────────────────────────────────────────────────────────

export interface UploadDocumentPayload {
  filename: string
  mimeType: string
  docType: string
  base64Content: string
}

// Uploads a KYC/onboarding document to the backend's local-disk storage
// (routes/documents.ts) — returns a real DocumentRef (server-computed SHA-256
// over the received bytes) to attach to a BusinessOnboarding create/amend
// call. Not tied to the 'onboarding' query key since it doesn't mutate any
// on-ledger contract by itself.
export function useUploadDocument() {
  return useMutation({
    mutationFn: (payload: UploadDocumentPayload) =>
      apiClient.post<DocumentRef>('/documents/upload', payload).then((r) => r.data),
  })
}

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

// Compensating rollback for a Draft whose immediately-following submit
// failed — see OnboardingForm.tsx's handleSubmit.
export function useWithdrawOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/onboarding/${id}/withdraw`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}

// Vetify returns the application to the business with a correction request.
export function useRequestAmendment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/onboarding/${id}/request-amendment`, { note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}

// ── ApprovedBusiness lifecycle (Suspend/Reinstate/Revoke/ExpireBusiness/RequestRecertification) ──

export function useSuspendBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/onboarding/approved/${id}/suspend`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approved-businesses'] }),
  })
}

export function useReinstateBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/onboarding/approved/${id}/reinstate`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approved-businesses'] }),
  })
}

export function useExpireBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/onboarding/approved/${id}/expire`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approved-businesses'] }),
  })
}

export function useRevokeBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, revokedBy }: { id: string; reason: string; revokedBy: string }) =>
      apiClient.post(`/onboarding/approved/${id}/revoke`, { reason, revokedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approved-businesses'] }),
  })
}

export function useRequestRecertification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, verifier, advisor, newComplianceRef, reason }: {
      id: string; verifier: string; advisor: string; newComplianceRef: string; reason: string
    }) =>
      apiClient.post(`/onboarding/approved/${id}/recertify`,
        { verifier, advisor, newComplianceRef, reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approved-businesses'] }),
  })
}

// Vetify escalates an application whose SLA window has expired (UnderReview → ManualReview).
export function useEscalateOverdue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, slaHours }: { id: string; slaHours: number }) =>
      apiClient.post(`/onboarding/${id}/escalate-overdue`, { slaHours }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}

// Business resubmits corrected info after RequestAmendment — CAC number is immutable.
export function useAmendOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updatedProfile, updatedKyc, updatedDocuments }: {
      id: string
      updatedProfile: BusinessProfile
      updatedKyc: BusinessKyc
      updatedDocuments?: DocumentRef[]
    }) =>
      apiClient.post(`/onboarding/${id}/amend`,
        { updatedProfile, updatedKyc, updatedDocuments: updatedDocuments ?? [] }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}

export function useApproveOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, checks, riskScore, riskLevel, verificationRef, overrideJustification, reviewNotes }: {
      id: string
      checks: VerificationChecks
      riskScore: number
      riskLevel: RiskLevel
      verificationRef: string
      overrideJustification?: string
      reviewNotes?: string
    }) =>
      apiClient.post(`/onboarding/${id}/approve`, {
        checks, riskScore, riskLevel, autoDecided: false, verificationRef,
        overrideJustification: overrideJustification || null,
        overrideType: overrideJustification ? 'OverrodeApproval' : null,
        reviewNotes: reviewNotes || null,
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}

export function useRejectOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, checks, riskScore, riskLevel, verificationRef, reason, overrideJustification, reviewNotes }: {
      id: string
      checks: VerificationChecks
      riskScore: number
      riskLevel: RiskLevel
      verificationRef: string
      reason: string
      overrideJustification?: string
      reviewNotes?: string
    }) =>
      apiClient.post(`/onboarding/${id}/reject`, {
        checks, riskScore, riskLevel, autoDecided: false, verificationRef, reason,
        overrideJustification: overrideJustification || null,
        overrideType: overrideJustification ? 'OverrodeRejection' : null,
        reviewNotes: reviewNotes || null,
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}

export function useFlagOnboardingForManualReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, riskScore, riskLevel, note }: {
      id: string
      riskScore: number
      riskLevel: RiskLevel
      note: string
    }) =>
      apiClient.post(`/onboarding/${id}/flag-manual`, {
        riskScore, riskLevel, agentVersion: 'manual-review', note,
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  })
}

export function useApproveCompliance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, completedChecks, riskScore, riskLevel, eddCaseCid, overrideJustification }: {
      id: string
      completedChecks: ComplianceCheck
      riskScore: number
      riskLevel: RiskLevel
      // G14 hard gate: a PEP-driven case can only approve once its EDDCase is EddClosed —
      // see ComplianceReview.daml's ApproveCompliance assertion.
      eddCaseCid?: string
      // Required by the same assertion whenever a human approves a case the agent already
      // scored (autoDecided=false + agentScore is Some) — omitting it 422s every time, since
      // Stage 3 is designed to reach a human reviewer with a prior agent score nearly always.
      overrideJustification?: string
    }) =>
      apiClient.post(`/onboarding/compliance/${id}/approve`, {
        completedChecks, riskScore, riskLevel, autoDecided: false, eddCaseCid: eddCaseCid ?? null,
        overrideJustification: overrideJustification ?? null,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-queue'] })
      qc.invalidateQueries({ queryKey: ['approved-businesses'] })
    },
  })
}

export function useRejectCompliance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, completedChecks, riskScore, riskLevel, reason, overrideJustification }: {
      id: string
      completedChecks: ComplianceCheck
      riskScore: number
      riskLevel: RiskLevel
      reason: string
      // Same assertion as ApproveCompliance — required whenever a human decides a case the
      // agent already scored.
      overrideJustification?: string
    }) =>
      apiClient.post(`/onboarding/compliance/${id}/reject`, {
        completedChecks, riskScore, riskLevel, autoDecided: false, reason,
        overrideJustification: overrideJustification ?? null,
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

// ── G14: Enhanced Due Diligence (PEP hits) ───────────────────────────────────

export function useEddCases() {
  return useQuery({
    queryKey: ['edd-cases'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawEddCase>[]>('/onboarding/edd')
      return data.map(adaptEddCase)
    },
  })
}

export function useStartReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/onboarding/compliance/${id}/start`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-queue'] }),
  })
}

export function useAssignReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, newOfficer, assignedByName }: { id: string; newOfficer: string; assignedByName: string }) =>
      apiClient.post(`/onboarding/compliance/${id}/assign`, { newOfficer, assignedByName }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-queue'] }),
  })
}

export function useReassignReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, newOfficer, reason }: { id: string; newOfficer: string; reason: string }) =>
      apiClient.post(`/onboarding/compliance/${id}/reassign`, { newOfficer, reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-queue'] }),
  })
}

export interface ShariahAssessmentInput {
  verdict: 'COMPLIANT' | 'REQUIRES_REVIEW' | 'NON_COMPLIANT'
  activitiesScreened: string[]
  aaoifiStandards: string[]
  rationale: string
  prohibitedRevenuePct?: number
  scholarDecision?: string
}

export function useSupersedeShariahVerdict() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, correctionRef, newVerdict, reason, correctedBy }: {
      id: string; correctionRef: string; newVerdict: ShariahAssessmentInput; reason: string; correctedBy: string
    }) =>
      apiClient.post(`/onboarding/compliance-reviews/${id}/supersede-shariah-verdict`,
        { correctionRef, newVerdict, reason, correctedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-queue'] }),
  })
}

// Stage 2 audit trail: the raw VerificationResult list + its post-hoc correction choice.
interface RawVerificationResult {
  businessName: string
  cacRegNumber: string
  outcome: string
  riskScore: string
  riskLevel: string
  decidedAt: string
  verificationRef: string
  note: string | null
}

export interface VerificationResultItem {
  id: string
  businessName: string
  cacRegNumber: string
  outcome: string
  riskScore: number
  riskLevel: string
  decidedAt: string
  verificationRef: string
  note?: string
}

export function useVerificationResults() {
  return useQuery({
    queryKey: ['verification-results'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawVerificationResult>[]>('/onboarding/verification-results')
      return data.map(({ contractId, payload }): VerificationResultItem => ({
        id: contractId,
        businessName: payload.businessName,
        cacRegNumber: payload.cacRegNumber,
        outcome: payload.outcome,
        riskScore: num(payload.riskScore),
        riskLevel: payload.riskLevel,
        decidedAt: payload.decidedAt,
        verificationRef: payload.verificationRef,
        note: payload.note ?? undefined,
      }))
    },
  })
}

// correctedBy is intentionally not a client param — it's a Canton Party on the ledger side
// (VerificationCorrection.correctedBy : Party), not a name, and is derived server-side.
export function useSupersedeVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, correctionRef, correctedOutcome, reason }: {
      id: string; correctionRef: string; correctedOutcome: string; reason: string
    }) =>
      apiClient.post(`/onboarding/verification-results/${id}/supersede`,
        { correctionRef, correctedOutcome, reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verification-results'] }),
  })
}

// ComplianceResult: the Stage 3 audit record ApproveCompliance/RejectCompliance produce.
// Mirrors VerificationResultItem/useVerificationResults/useSupersedeVerification exactly.
interface RawComplianceResult {
  businessName: string
  cacRegNumber: string
  outcome: string
  riskScore: string
  riskLevel: string
  decidedAt: string
  verificationRef: string
  complianceRef: string
  reviewedBy: string | null
  reason: string | null
}

export interface ComplianceResultItem {
  id: string
  businessName: string
  cacRegNumber: string
  outcome: string
  riskScore: number
  riskLevel: string
  decidedAt: string
  verificationRef: string
  complianceRef: string
  reviewedBy?: string
  reason?: string
}

export function useComplianceResults() {
  return useQuery({
    queryKey: ['compliance-results'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawComplianceResult>[]>('/onboarding/compliance-results')
      return data.map(({ contractId, payload }): ComplianceResultItem => ({
        id: contractId,
        businessName: payload.businessName,
        cacRegNumber: payload.cacRegNumber,
        outcome: payload.outcome,
        riskScore: num(payload.riskScore),
        riskLevel: payload.riskLevel,
        decidedAt: payload.decidedAt,
        verificationRef: payload.verificationRef,
        complianceRef: payload.complianceRef,
        reviewedBy: payload.reviewedBy ?? undefined,
        reason: payload.reason ?? undefined,
      }))
    },
  })
}

// Unlike VerificationResult.Supersede, ComplianceResult.Supersede's correctedBy is a genuine
// Text name (the Daml maker-checker assertion compares it against the original reviewedBy
// string) — so this one is correctly a client-supplied free-text field, not server-derived.
export function useSupersedeComplianceResult() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, correctionRef, correctedOutcome, reason, correctedBy }: {
      id: string; correctionRef: string; correctedOutcome: string; reason: string; correctedBy: string
    }) =>
      apiClient.post(`/onboarding/compliance-results/${id}/supersede`,
        { correctionRef, correctedOutcome, reason, correctedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-results'] }),
  })
}

export function useEscalateComplianceOverdue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fallbackSlaHours }: { id: string; fallbackSlaHours: number }) =>
      apiClient.post(`/onboarding/compliance/${id}/escalate-overdue`, { fallbackSlaHours }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-queue'] }),
  })
}

export function useOpenEddCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, triggerReason }: { id: string; triggerReason: string }) =>
      apiClient.post(`/onboarding/compliance/${id}/edd/open`, { triggerReason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['edd-cases'] }),
  })
}

export function useUpdateEddChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...checklist }: {
      id: string
      sourceOfWealthVerified?: boolean
      sourceOfWealthNote?: string
      enhancedMediaSearchDone?: boolean
      seniorManagementSignoff?: string
      monitoringFrequency?: string
    }) =>
      apiClient.post(`/onboarding/edd/${id}/update`, checklist).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['edd-cases'] }),
  })
}

export function useCloseEddCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, closedBy }: { id: string; closedBy: string }) =>
      apiClient.post(`/onboarding/edd/${id}/close`, { closedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['edd-cases'] }),
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
    mutationFn: ({ id, reason, rejectedByName, reasonCode, decisionFactors }: {
      id: string
      reason: string
      rejectedByName?: string
      reasonCode?: string
      decisionFactors?: string[]
    }) =>
      apiClient.post(`/financing/${id}/reject`,
        { reason, rejectedByName, reasonCode, decisionFactors }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['underwriting-queue'] }),
  })
}

export interface ApproveFinancingPayload {
  assetDetails: { description: string; supplier: string; supplierRef: string; estimatedCost: number }
  approvedProviderCid: string
  approvingOfficerId: string
  approvedByName?: string
  assessorName?: string
  reasonCode?: string
  decisionFactors?: string[]
  offerExpiresAt?: string
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

export function useDefaultContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, defaultedBy }: { id: string; reason: string; defaultedBy: string }) =>
      apiClient.post(`/contracts/${id}/default`, { reason, defaultedBy }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['portfolio-summary'] })
    },
  })
}

// ── Ibra' (Early Settlement Rebate) ──────────────────────────────────────────

export function useGrantIbra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rebateAmount, proposedByOfficerId, confirmedByOfficerId }: {
      id: string; rebateAmount: number; proposedByOfficerId: string; confirmedByOfficerId: string
    }) =>
      apiClient.post(`/contracts/ibra/${id}/grant`,
        { rebateAmount, proposedByOfficerId, confirmedByOfficerId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', 'ibra'] }),
  })
}

export function useDeclineIbra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/contracts/ibra/${id}/decline`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', 'ibra'] }),
  })
}

// ── Late Payment Charity (Sadaqah obligations) ───────────────────────────────

export function useSetCharityAmount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      apiClient.post(`/contracts/charity/${id}/set-amount`, { amount }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', 'charity'] }),
  })
}

// ── Rahn (Collateral) ────────────────────────────────────────────────────────

export interface CreateRahnPayload {
  business: string
  facilityRef: string
  businessName: string
  cacRegNumber: string
  collateralDescription: string
  collateralValue: number
  collateralStatus: CollateralStatus
  releaseEvidence?: string
}

export function useCreateRahn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateRahnPayload) =>
      apiClient.post('/contracts/rahn', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', 'rahn'] }),
  })
}

export function useReleaseCollateral() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note, releaseDocumentRef, proposedByOfficerId, confirmedByOfficerId }: {
      id: string; note: string; releaseDocumentRef?: string; proposedByOfficerId: string; confirmedByOfficerId: string
    }) =>
      apiClient.post(`/contracts/rahn/${id}/release`,
        { note, releaseDocumentRef, proposedByOfficerId, confirmedByOfficerId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', 'rahn'] }),
  })
}

export function useEnforceCollateral() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, proposedByOfficerId, confirmedByOfficerId }: {
      id: string; reason: string; proposedByOfficerId: string; confirmedByOfficerId: string
    }) =>
      apiClient.post(`/contracts/rahn/${id}/enforce`,
        { reason, proposedByOfficerId, confirmedByOfficerId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', 'rahn'] }),
  })
}

// Business requests early full or partial settlement — nonconsuming on MurabahahContract.
export function useRequestIbra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, requestedSettlementDate, settlementType, requestedAmount }: {
      id: string; requestedSettlementDate: string; settlementType: IbraSettlementType; requestedAmount?: number
    }) =>
      apiClient.post(`/contracts/${id}/request-ibra`,
        { requestedSettlementDate, settlementType, requestedAmount }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', 'ibra'] }),
  })
}

// Business confirms the Sadaqah donation was made, with receipt reference + beneficiary.
export function useConfirmCharityPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, charityRef, charityOrganization }: { id: string; charityRef: string; charityOrganization: string }) =>
      apiClient.post(`/contracts/charity/${id}/confirm-payment`, { charityRef, charityOrganization }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', 'charity'] }),
  })
}

// ── Stage 9: Delinquency (sentinel, vetify dual-controller) ─────────────────

export function useFlagDelinquent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/contracts/${id}/flag-delinquent`, { reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['portfolio-summary'] })
    },
  })
}

export function useResumeActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/contracts/${id}/resume-active`, { note }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['portfolio-summary'] })
    },
  })
}

// Pure escalation (vetify alone, no sentinel decision made yet) — mirrors
// FlagUnderwritingForManualReview's single-controller pattern.
export function useFlagForDelinquencyReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/contracts/${id}/flag-for-review`, { note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

// ── AuthorizedSentinel registry — mirrors PolicyApprover's register/
// deactivate/reactivate shape, but `sentinel` is a real Canton Party (not a
// name string), since AuthorizedSentinel gates who may act as the `sentinel`
// party on FlagDelinquent/ResumeActive (requireActiveSentinel).

interface RawAuthorizedSentinel {
  vetify: string
  sentinel: string
  role: string
  authorizedBy: string
  authorizedAt: string
  active: boolean
}

export interface AuthorizedSentinel {
  id: string
  sentinel: string
  role: string
  authorizedBy: string
  authorizedAt: string
  active: boolean
}

function adaptAuthorizedSentinel({ contractId, payload }: RawContract<RawAuthorizedSentinel>): AuthorizedSentinel {
  return {
    id: contractId,
    sentinel: payload.sentinel,
    role: payload.role,
    authorizedBy: payload.authorizedBy,
    authorizedAt: payload.authorizedAt,
    active: payload.active,
  }
}

export function useAuthorizedSentinels() {
  return useQuery({
    queryKey: ['sentinels'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawAuthorizedSentinel>[]>('/contracts/sentinels')
      return data.map(adaptAuthorizedSentinel)
    },
  })
}

export interface RegisterSentinelPayload {
  vetify: string
  sentinel: string
  role: string
  authorizedBy: string
}

export function useRegisterSentinel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RegisterSentinelPayload) =>
      apiClient.post('/contracts/sentinels', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sentinels'] }),
  })
}

export function useDeactivateSentinel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: { id: string; reason: string; performedBy: string }) =>
      apiClient.post(`/contracts/sentinels/${id}/deactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sentinels'] }),
  })
}

export function useReactivateSentinel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: { id: string; reason: string; performedBy: string }) =>
      apiClient.post(`/contracts/sentinels/${id}/reactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sentinels'] }),
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
  // Derived server-side from the authenticated financer session (each
  // self-serve signup gets its own Canton party) — no longer read from the
  // request body, kept optional here only so older call sites don't need to
  // change their payload shape.
  financialInstitution?: string
  vetify: string
  providerName: string
  address: string
  cacRegNumber: string
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

export function useRequestProviderAmendment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/providers/${id}/request-amendment`, { note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export interface AmendProviderPayload {
  updatedProviderName: string
  updatedAddress: string
  updatedCacRegNumber: string
  updatedLicenseNumber?: string
  updatedGoverningDocRef: DocumentRef
  updatedDeclaredInstruments: FinancingInstrument[]
}

export function useAmendProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & AmendProviderPayload) =>
      apiClient.post(`/providers/${id}/amend`, payload).then((r) => r.data),
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
  // Derived server-side from the authenticated financer session — see
  // CreateProviderPayload's comment above.
  financialInstitution?: string
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
  identityVerified: number
  identityNameMismatch: number
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

// ── Governance registries: AuthorizedAdvisor / AuthorizedAssessor / AuthorizedReviewer ──
// AuthorizedAdvisor/AuthorizedAssessor mirror AuthorizedSentinel's register/deactivate/
// reactivate shape (see contracts.ts hooks above). AuthorizedReviewer is deactivate-only —
// its Daml template has no `active` field, just a single consuming Deauthorize choice.

interface RawAuthorizedAdvisor {
  vetify: string
  advisor: string
  role: string
  authorizedBy: string
  authorizedAt: string
  active: boolean
}

export interface AuthorizedAdvisor {
  id: string
  advisor: string
  role: string
  authorizedBy: string
  authorizedAt: string
  active: boolean
}

function adaptAuthorizedAdvisor({ contractId, payload }: RawContract<RawAuthorizedAdvisor>): AuthorizedAdvisor {
  return {
    id: contractId,
    advisor: payload.advisor,
    role: payload.role,
    authorizedBy: payload.authorizedBy,
    authorizedAt: payload.authorizedAt,
    active: payload.active,
  }
}

export function useAuthorizedAdvisors() {
  return useQuery({
    queryKey: ['advisors'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawAuthorizedAdvisor>[]>('/onboarding/advisors')
      return data.map(adaptAuthorizedAdvisor)
    },
  })
}

export interface RegisterAdvisorPayload {
  vetify: string
  advisor: string
  role: string
  authorizedBy: string
}

export function useRegisterAdvisor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RegisterAdvisorPayload) =>
      apiClient.post('/onboarding/advisors', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advisors'] }),
  })
}

export function useDeactivateAdvisor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: { id: string; reason: string; performedBy: string }) =>
      apiClient.post(`/onboarding/advisors/${id}/deactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advisors'] }),
  })
}

export function useReactivateAdvisor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: { id: string; reason: string; performedBy: string }) =>
      apiClient.post(`/onboarding/advisors/${id}/reactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['advisors'] }),
  })
}

interface RawAuthorizedAssessor {
  vetify: string
  assessor: string
  role: string
  authorizedBy: string
  authorizedAt: string
  active: boolean
}

export interface AuthorizedAssessor {
  id: string
  assessor: string
  role: string
  authorizedBy: string
  authorizedAt: string
  active: boolean
}

function adaptAuthorizedAssessor({ contractId, payload }: RawContract<RawAuthorizedAssessor>): AuthorizedAssessor {
  return {
    id: contractId,
    assessor: payload.assessor,
    role: payload.role,
    authorizedBy: payload.authorizedBy,
    authorizedAt: payload.authorizedAt,
    active: payload.active,
  }
}

export function useAuthorizedAssessors() {
  return useQuery({
    queryKey: ['assessors'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawAuthorizedAssessor>[]>('/financing/assessors')
      return data.map(adaptAuthorizedAssessor)
    },
  })
}

export interface RegisterAssessorPayload {
  vetify: string
  assessor: string
  role: string
  authorizedBy: string
}

export function useRegisterAssessor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RegisterAssessorPayload) =>
      apiClient.post('/financing/assessors', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessors'] }),
  })
}

export function useDeactivateAssessor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: { id: string; reason: string; performedBy: string }) =>
      apiClient.post(`/financing/assessors/${id}/deactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessors'] }),
  })
}

export function useReactivateAssessor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason, performedBy }: { id: string; reason: string; performedBy: string }) =>
      apiClient.post(`/financing/assessors/${id}/reactivate`, { reason, performedBy }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessors'] }),
  })
}

interface RawAuthorizedReviewer {
  vetify: string
  verifier: string
  authorizedBy: string
  authorizedAt: string
  role: string
}

export interface AuthorizedReviewer {
  id: string
  verifier: string
  authorizedBy: string
  authorizedAt: string
  role: string
}

function adaptAuthorizedReviewer({ contractId, payload }: RawContract<RawAuthorizedReviewer>): AuthorizedReviewer {
  return {
    id: contractId,
    verifier: payload.verifier,
    authorizedBy: payload.authorizedBy,
    authorizedAt: payload.authorizedAt,
    role: payload.role,
  }
}

export function useAuthorizedReviewers() {
  return useQuery({
    queryKey: ['reviewers'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawAuthorizedReviewer>[]>('/onboarding/compliance/authorized-reviewers')
      return data.map(adaptAuthorizedReviewer)
    },
  })
}

export interface RegisterReviewerPayload {
  vetify: string
  verifier: string
  role: string
  authorizedBy: string
}

export function useRegisterReviewer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RegisterReviewerPayload) =>
      apiClient.post('/onboarding/compliance/authorized-reviewers', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviewers'] }),
  })
}

export function useDeauthorizeReviewer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/onboarding/compliance/authorized-reviewers/${id}/deauthorize`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviewers'] }),
  })
}

// Dev Tools (Stage 2/3 simulation) — see useDevOnboardings above.
export interface SimulateVerifierDecisionPayload {
  onboardingContractId: string
  risk: 'low' | 'medium' | 'high'
  compliance?: 'flag' | 'reject' | 'approve'
  skipCompliance?: boolean
}

export function useSimulateVerifierDecision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SimulateVerifierDecisionPayload) =>
      apiClient.post<{ log: string[] }>('/dev/simulate', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dev', 'onboardings'] }),
  })
}

// Dev Tools (Stage 6 simulation) — mirrors useDevOnboardings/useSimulateVerifierDecision.
export function useDevFinancingRequests() {
  return useQuery({
    queryKey: ['dev', 'financing-requests'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawFinancingRequest>[]>('/dev/financing-requests')
      return data.map(adaptFinancingRequest)
    },
  })
}

export interface SimulateUnderwritingDecisionPayload {
  financingRequestContractId: string
  preset: 'low' | 'medium' | 'high' | 'highFraud'
}

export function useSimulateUnderwritingDecision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SimulateUnderwritingDecisionPayload) =>
      apiClient.post<{ log: string[] }>('/dev/simulate-underwriting', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dev', 'financing-requests'] }),
  })
}

// ─── Murabahah Acquisition Chain — list queries ───────────────────────────────

export function useWads() {
  return useQuery({
    queryKey: ['acquisition', 'wads'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawMurabahahWad>[]>('/financing/wads')
      return data.map(adaptWad)
    },
  })
}

export function useWakalas() {
  return useQuery({
    queryKey: ['acquisition', 'wakalas'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawMurabahahWakala>[]>('/financing/wakalas')
      return data.map(adaptWakala)
    },
  })
}

export function usePurchaseRecords() {
  return useQuery({
    queryKey: ['acquisition', 'purchase-records'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawAssetPurchaseRecord>[]>('/financing/purchase-records')
      return data.map(adaptPurchaseRecord)
    },
  })
}

export function useProposals() {
  return useQuery({
    queryKey: ['acquisition', 'proposals'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawMurabahahProposal>[]>('/financing/proposals')
      return data.map(adaptProposal)
    },
  })
}

// Optional facilityRef scopes to a single proposal's certification(s) — the
// business's Accept/Decline action needs exactly this to find its certificationCid.
export function useShariahCertifications(facilityRef?: string) {
  return useQuery({
    queryKey: ['acquisition', 'certifications', facilityRef ?? 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get<RawContract<RawShariahContractCertification>[]>(
        '/financing/certifications', { params: facilityRef ? { facilityRef } : undefined })
      return data.map(adaptCertification)
    },
  })
}

const invalidateAcquisitionChain = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['acquisition'] })
}

// ─── Wa'd choices (FI exercises on MurabahahWad) ──────────────────────────────

export function useProceedWithWakala() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/financing/wads/${id}/proceed-with-wakala`, {}).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

export interface ProceedDirectlyPayload {
  actualCost: number
  purchaseDate: string
  invoiceRef: string
  freightCost?: number
  customsDuty?: number
  insurancePremium?: number
  otherAcquisitionCosts?: number
}

export function useProceedDirectly() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & ProceedDirectlyPayload) =>
      apiClient.post(`/financing/wads/${id}/proceed-directly`, payload).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

export function useWithdrawWad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/financing/wads/${id}/withdraw`, { reason }).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

// ─── Wakala choices (business exercises as purchasing agent) ─────────────────

export function useRecordAssetPurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & ProceedDirectlyPayload) =>
      apiClient.post(`/financing/wakalas/${id}/record-purchase`, payload).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

export function useDeclineAgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/financing/wakalas/${id}/decline-agency`, { reason }).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

// ─── Asset Purchase Record choices ────────────────────────────────────────────

export function useAcknowledgeDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/financing/purchase-records/${id}/acknowledge-delivery`, {}).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

export interface OfferMurabahahPayload {
  murabahahTerms: { assetCost: number; profitAmount: number; salePrice: number; installmentAmount: number; tenureMonths: number }
  paymentSchedule: { installmentNo: number; dueDate: string; dueAmount: number }[]
  startDate: string
  acceptanceExpiresAt?: string
}

export function useOfferMurabahah() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & OfferMurabahahPayload) =>
      apiClient.post(`/financing/purchase-records/${id}/offer-murabahah`, payload).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

// ─── Murabahah Proposal choices ───────────────────────────────────────────────

// G11: advisor's per-contract Shari'a sign-off — exercised from the vetify session
// (no advisor portal exists; backend acts as [advisor, vetify]).
export function useCertifyShariahTerms() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, certificationRef, aaoifiStandards, rationale, certifiedBy }: {
      id: string; certificationRef: string; aaoifiStandards: string[]; rationale: string; certifiedBy: string
    }) =>
      apiClient.post(`/financing/proposals/${id}/certify-shariah`,
        { certificationRef, aaoifiStandards, rationale, certifiedBy }).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

export function useRevokeCertification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, revocationRef, reason, revokedBy }: {
      id: string; revocationRef: string; reason: string; revokedBy: string
    }) =>
      apiClient.post(`/financing/certifications/${id}/revoke`, { revocationRef, reason, revokedBy }).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

// certificationCid comes from useShariahCertifications(facilityRef) — the caller
// must resolve it before calling this (see G11 hard gate on AcceptProposal).
export function useAcceptProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, certificationCid }: { id: string; certificationCid: string }) =>
      apiClient.post(`/financing/proposals/${id}/accept`, { certificationCid }).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

export function useDeclineProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/financing/proposals/${id}/decline`, { reason }).then((r) => r.data),
    onSuccess: () => invalidateAcquisitionChain(qc),
  })
}

// ─── Notifications ───────────────────────────────────────────────────────────
// Poller-fed (backend/src/notifications.ts) — see its own doc comment for why
// it watches PQS rather than being written by the choice-exercise routes.

export interface AppNotification {
  id: number
  title: string
  body: string
  link?: string
  category: string
  readAt?: string
  createdAt: string
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get<AppNotification[]>('/notifications')
      return data
    },
    // Polls independently of the backend's own 15s notification-generation tick —
    // short enough that a qualified/rejected request feels close to real-time
    // without needing a websocket/SSE channel for a page that's rarely the focus
    // of active attention (the bell, not the main content).
    refetchInterval: 20_000,
  })
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count')
      return data.count
    },
    refetchInterval: 20_000,
  })
}

function invalidateNotifications(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['notifications'] })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient.post(`/notifications/${id}/read`).then((r) => r.data),
    onSuccess: () => invalidateNotifications(qc),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all').then((r) => r.data),
    onSuccess: () => invalidateNotifications(qc),
  })
}
