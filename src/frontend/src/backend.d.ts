import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export type Result_2 = {
    __kind__: "ok";
    ok: bigint;
} | {
    __kind__: "err";
    err: string;
};
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface BusinessPage {
    total: bigint;
    page: bigint;
    pageSize: bigint;
    items: Array<BusinessProfile>;
}
export interface AuditEntry {
    id: string;
    action: string;
    oldValue?: string;
    changedBy: string;
    newValue?: string;
    entityId: string;
    timestamp: Timestamp;
    entityType: string;
    reason?: string;
}
export type Result_5 = {
    __kind__: "ok";
    ok: IndividualProfile;
} | {
    __kind__: "err";
    err: string;
};
export interface KashifReportLog {
    businessId: Principal;
    generatedAt: bigint;
    viewCount: bigint;
    lastViewedAt?: bigint;
}
export interface AdminAnalytics {
    averageMizanScore: bigint;
    closedDealsCount: bigint;
    financingReadyCount: bigint;
    tawthiqPassCount: bigint;
    pendingReviewCount: bigint;
    totalFinanciers: bigint;
    totalIndividuals: bigint;
    tawthiqConditionalCount: bigint;
    tawthiqFailCount: bigint;
    activeFinancierCount: bigint;
    totalBusinesses: bigint;
}
export interface InstitutionDetails {
    riskAppetite: string;
    licenseNumber: string;
    preferredInstruments: Array<PreferredInstrument>;
    ticketSizeMax: bigint;
    ticketSizeMin: bigint;
}
export type Result_4 = {
    __kind__: "ok";
    ok: {
        total: bigint;
        items: Array<NotificationRecord>;
    };
} | {
    __kind__: "err";
    err: string;
};
export interface NotificationRecord {
    statusChange: string;
    recipientPhone: string;
    sentAt: Timestamp;
    message: string;
    success: boolean;
}
export interface Page {
    total: bigint;
    page: bigint;
    pageSize: bigint;
    items: Array<ApplicantSummary>;
}
export interface ProprietorRecord {
    bvn: string;
    nin: string;
    proprietorName: string;
}
export interface InconsistencyFlag {
    field: string;
    verifiedValue: string;
    declaredValue: string;
}
export interface IndividualMizanRecord {
    completedAt?: Timestamp;
    narrativeSummary: string;
    overallScore: bigint;
    incomeStabilityScore: bigint;
    debtBehaviorScore: bigint;
    stage: Variant_full_preliminary;
    borderlineFlag: boolean;
    repaymentCapacityScore: bigint;
    riskLevel: RiskLevel__1;
}
export type Result_7 = {
    __kind__: "ok";
    ok: {
        total: bigint;
        items: Array<AccountClosureRequest>;
    };
} | {
    __kind__: "err";
    err: string;
};
export interface TawthiqOverviewStats {
    pendingCount: bigint;
    conditionalCount: bigint;
    totalProcessed: bigint;
    notReadyCount: bigint;
    passedCount: bigint;
}
export interface KycCheckRecord {
    watchlistClean: boolean;
    cacVerified: boolean;
    watchlistParseError: boolean;
    kycStatus: KycStatus;
    creditScore: bigint;
    bvnVerified: boolean;
    ninVerified: boolean;
    tinVerified: boolean;
    verifiedAt?: Timestamp;
}
export interface IndividualTawthiqRecord {
    completedAt?: Timestamp;
    watchlistClean: boolean;
    narrativeSummary: string;
    creditReadiness: Variant_conditionalReady_notReady_ready;
    shariaComplianceScore: bigint;
    bvnVerified: boolean;
    ninVerified: boolean;
    shariaFlags: Array<string>;
    incomeAnalysis: string;
}
export type Result_6 = {
    __kind__: "ok";
    ok: AdminAnalytics;
} | {
    __kind__: "err";
    err: string;
};
export interface CredentialsSettings {
    monoSecretKey: string;
    twilioAuthToken: string;
    twilioAccountSid: string;
    openAiApiKey: string;
    twilioWhatsappFrom: string;
}
export interface ShariaFlag {
    indicator: string;
    category: string;
    severity: Variant_major_minor;
}
export interface TawthiqRecord {
    completedAt?: Timestamp;
    narrativeSummary: string;
    inconsistencyFlags: Array<InconsistencyFlag>;
    creditReadinessVerdict: CreditReadinessVerdict;
    shariaScreeningStatus: Variant_Failed_Passed_Pending;
    inconsistencyStatus: Variant_Flagged_Clean_Pending;
    shariaFlags: Array<ShariaFlag>;
    shariaScreeningNotes: string;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export type UserId = Principal;
export interface IndividualSummary {
    id: UserId;
    createdAt: Timestamp;
    fullName: string;
    amountSought: bigint;
    registrationStatus: RegistrationStatus;
    financingPurpose: FinancingPurpose;
    riskLevel: RiskLevel__1;
}
export type Result = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: string;
};
export interface FinancierPage {
    total: bigint;
    page: bigint;
    pageSize: bigint;
    items: Array<FinancierProfile>;
}
export interface DirectMessageThread {
    lastMessageAt: bigint;
    messages: Array<Message>;
    participantIds: Array<Principal>;
    threadId: string;
}
export interface CompatibilityResult {
    halalComplianceScore: bigint;
    applicantType: ApplicantType;
    compatibilityScore: bigint;
    businessCategory: string;
    displayName: string;
    businessId: Principal;
    financingTypes: Array<string>;
    riskLevel: RiskLevel;
}
export type Result_8 = {
    __kind__: "ok";
    ok: {
        total: bigint;
        items: Array<IndividualSummary>;
    };
} | {
    __kind__: "err";
    err: string;
};
export interface AuditPage {
    total: bigint;
    page: bigint;
    entries: Array<AuditEntry>;
}
export interface BusinessProfile {
    mizanRecord?: MizanRecord;
    cacNumber: string;
    proprietorDetails?: ProprietorRecord;
    businessTypeEnum?: BusinessTypeEnum;
    financingAmountSought?: bigint;
    purposeOfFinancing?: string;
    userId: UserId;
    tawthiqRecord?: TawthiqRecord;
    createdAt: Timestamp;
    scoringRecord: ScoringRecord;
    halalComplianceStatus: HalalComplianceStatus;
    contactPerson: string;
    preliminaryMizanRecord?: MizanRecord;
    businessName: string;
    businessType: string;
    photoUrl?: string;
    financingReady: boolean;
    financingReadyScore: bigint;
    preferredInstrument?: string;
    kycRecord: KycCheckRecord;
    yearOfIncorporation?: string;
    address: string;
    phoneNumber: string;
    businessDescription?: string;
    registrationStatus: RegistrationStatus;
    bankLinkRecord: BankLinkRecord;
    mizanDivergenceAlert: boolean;
    riskLevel: RiskLevel__1;
    annualRevenue: bigint;
    directorsList?: Array<DirectorRecord>;
}
export interface MaskedCredentials {
    monoSecretKey: string;
    twilioAuthToken: string;
    twilioAccountSid: string;
    openAiApiKey: string;
    twilioWhatsappFrom: string;
}
export interface ApplicantSummary {
    displayName: string;
    userId: UserId;
    role: UserRole;
    halalComplianceStatus: HalalComplianceStatus;
    financingReady: boolean;
    financingReadyScore: bigint;
    riskLevel: RiskLevel__1;
}
export type Timestamp = bigint;
export interface DocumentRecord {
    uploadStatus: UploadStatus;
    userId: UserId;
    storageRef?: ExternalBlob;
    docType: DocumentType;
    uploadedAt?: Timestamp;
}
export interface TransactionSummary {
    totalDebits: bigint;
    income: bigint;
    totalCredits: bigint;
    months: bigint;
}
export interface IndividualDetails {
    bvn: string;
    nin: string;
    occupation: string;
    investmentCapacity: bigint;
    fullName: string;
    riskAppetite: string;
    preferredInstruments: Array<PreferredInstrument>;
}
export type Result_1 = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface DealReport {
    applicantType: ApplicantType;
    creditReadiness: string;
    compatibilityScore: bigint;
    financingRecommendation: string;
    riskBreakdown: string;
    generatedAt: bigint;
    mizanVersion: bigint;
    executiveSummary: string;
    tawthiqVersion: bigint;
    financialHighlights: string;
    suggestedFinancingStructure: string;
    shariahComplianceStatus: string;
}
export interface FinancierProfile {
    financierType?: FinancierType;
    institutionDetails?: InstitutionDetails;
    groupDetails?: GroupDetails;
    institutionName: string;
    individualDetails?: IndividualDetails;
    userId: UserId;
    createdAt: Timestamp;
    contactPerson: string;
    areasOfFinancing: Array<string>;
    photoUrl?: string;
    email: string;
    financierStatus: FinancierStatus;
    licenseNumber: string;
    phone: string;
    registrationStatus: RegistrationStatus;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface TawthiqAppeal {
    id: string;
    status: AppealStatus;
    documentName?: string;
    documentUrl?: string;
    adminPrincipal?: Principal;
    businessId: UserId;
    flagId: string;
    submittedAt: Timestamp;
    reviewedAt?: Timestamp;
    adminNote?: string;
    appealText: string;
}
export interface IndividualProfile {
    id: UserId;
    bvn: string;
    nin: string;
    mizanRecord?: IndividualMizanRecord;
    occupation: string;
    termsAcceptedAt?: Timestamp;
    financingPurposeOther?: string;
    dateOfBirth: string;
    tawthiqRecord?: IndividualTawthiqRecord;
    createdAt: Timestamp;
    incomeSource: IncomeSource;
    fullName: string;
    accountClosureRequestedAt?: Timestamp;
    photoUrl?: string;
    amountSought: bigint;
    preferredInstrument: PreferredInstrument;
    kycRecord?: KycCheckRecord;
    updatedAt: Timestamp;
    employerName?: string;
    address: string;
    employmentStatus: EmploymentStatus;
    registrationStatus: RegistrationStatus;
    bankLinkStatus: BankLinkStatus;
    financingPurpose: FinancingPurpose;
    accountClosureRequested: boolean;
    monthlyIncome: bigint;
}
export interface ShortlistEntry {
    businessId: Principal;
    addedAt: bigint;
}
export interface MizanRecord {
    halalComplianceScore: bigint;
    narrativeSummary: string;
    computedAt: Timestamp;
    incomeStabilityScore: bigint;
    riskClassification: RiskLevel;
    overallReadinessScore: bigint;
    debtBehaviorScore: bigint;
    stage: MizanStage;
    repaymentPatternScore: bigint;
    revenueTrendScore: bigint;
    isBorderline: boolean;
    borderlineReasons: Array<string>;
}
export interface BankLinkRecord {
    status: BankLinkStatus;
    linkedAt?: Timestamp;
    transactionSummary?: TransactionSummary;
    balance?: bigint;
    accountId?: string;
    institutionName?: string;
    currency?: string;
}
export interface ProfilePrivacySettings {
    applicantId: string;
    showFinancingAmount: boolean;
    showMizanScore: boolean;
    showDirectorNames: boolean;
    showIncome: boolean;
}
export interface InviteLinkRecord {
    status: string;
    expiresAt: bigint;
    code: string;
    createdAt: bigint;
}
export interface KashifScoringConfig {
    riskKeywords: Array<[string, bigint]>;
    instrumentWeights: Array<[string, bigint]>;
    defaultScore: bigint;
}
export interface ScoringRecord {
    halalComplianceScore: bigint;
    scoredAt: Timestamp;
    scoringNotes: string;
    financingReadinessScore: bigint;
    riskLevel: RiskLevel;
}
export type Result_3 = {
    __kind__: "ok";
    ok: {
        status: RegistrationStatus;
        tawthiqDone: boolean;
        mizanDone: boolean;
    };
} | {
    __kind__: "err";
    err: string;
};
export interface BusinessProfileUpdate {
    contactPerson?: string;
    businessName?: string;
    address?: string;
    phone?: string;
}
export interface PublicApplicantProfile {
    applicantId: string;
    fullName: string;
    amountSought?: bigint;
    mizanScore?: bigint;
    preferredInstrument: string;
    registrationStatus: string;
    financingPurpose: string;
    monthlyIncome?: bigint;
}
export interface Message {
    applicantId: string;
    messageId: bigint;
    isRead: boolean;
    messageText: string;
    timestamp: bigint;
    financierId: string;
    recipientId: Principal;
    senderId: Principal;
}
export interface AccountClosureRequest {
    status: Variant_pending_approved_rejected;
    applicantType: Variant_business_financier_individual;
    requestId: string;
    processedAt?: Timestamp;
    adminNote?: string;
    principalId: UserId;
    requestedAt: Timestamp;
}
export type BankLinkStatus = {
    __kind__: "NotLinked";
    NotLinked: null;
} | {
    __kind__: "Linked";
    Linked: null;
} | {
    __kind__: "LinkFailed";
    LinkFailed: string;
};
export interface DirectorRecord {
    bvn: string;
    nin: string;
    nationality: string;
    directorName: string;
    ownershipPercentage: number;
}
export interface GroupDetails {
    numberOfMembers: bigint;
    leadContactBvn: string;
    leadContactNin: string;
    combinedInvestmentCapacity: bigint;
    legalBasis: string;
    riskAppetite: string;
    preferredInstruments: Array<PreferredInstrument>;
    leadContactName: string;
    groupName: string;
}
export enum AppealStatus {
    pending = "pending",
    rejected = "rejected",
    accepted = "accepted"
}
export enum ApplicantType {
    business = "business",
    individual = "individual"
}
export enum BusinessTypeEnum {
    llc = "llc",
    businessName = "businessName"
}
export enum DocumentType {
    cacCertificate = "cacCertificate",
    bankStatement = "bankStatement",
    governmentId = "governmentId"
}
export enum EmploymentStatus {
    unemployed = "unemployed",
    employed = "employed",
    student = "student",
    selfEmployed = "selfEmployed"
}
export enum FinancierStatus {
    Inactive = "Inactive",
    Active = "Active",
    PendingReview = "PendingReview"
}
export enum FinancierType {
    institution = "institution",
    group = "group",
    individual = "individual"
}
export enum FinancingPurpose {
    other = "other",
    education = "education",
    startupCapital = "startupCapital",
    homePurchase = "homePurchase",
    vehicle = "vehicle",
    medical = "medical"
}
export enum HalalComplianceStatus {
    pending = "pending",
    compliant = "compliant",
    flagged = "flagged"
}
export enum IncomeSource {
    other = "other",
    employment = "employment",
    selfEmployment = "selfEmployment",
    business = "business"
}
export enum KycStatus {
    Failed = "Failed",
    InProgress = "InProgress",
    Verified = "Verified",
    Pending = "Pending"
}
export enum PipelineStage {
    dueDiligence = "dueDiligence",
    closed = "closed",
    offerSent = "offerSent",
    reviewing = "reviewing"
}
export enum PreferredInstrument {
    murabaha = "murabaha",
    istisna = "istisna",
    other = "other",
    ijarah = "ijarah",
    salam = "salam",
    musharakah = "musharakah",
    mudarabah = "mudarabah"
}
export enum RegistrationStatus {
    pending = "pending",
    underReview = "underReview",
    financingReady = "financingReady",
    approved = "approved",
    rejected = "rejected",
    kycInProgress = "kycInProgress"
}
export enum RiskLevel {
    Low = "Low",
    High = "High",
    Medium = "Medium"
}
export enum RiskLevel__1 {
    low = "low",
    pending = "pending",
    high = "high",
    medium = "medium"
}
export enum UploadStatus {
    uploaded = "uploaded",
    notUploaded = "notUploaded"
}
export enum UserRole {
    admin = "admin",
    financier = "financier",
    businessApplicant = "businessApplicant"
}
export enum UserRole__1 {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Variant_Failed_Passed_Pending {
    Failed = "Failed",
    Passed = "Passed",
    Pending = "Pending"
}
export enum Variant_Flagged_Clean_Pending {
    Flagged = "Flagged",
    Clean = "Clean",
    Pending = "Pending"
}
export enum Variant_business_financier_individual {
    business = "business",
    financier = "financier",
    individual = "individual"
}
export enum Variant_conditionalReady_notReady_ready {
    conditionalReady = "conditionalReady",
    notReady = "notReady",
    ready = "ready"
}
export enum Variant_full_preliminary {
    full = "full",
    preliminary = "preliminary"
}
export enum Variant_major_minor {
    major = "major",
    minor = "minor"
}
export enum Variant_pending_approved_rejected {
    pending = "pending",
    approved = "approved",
    rejected = "rejected"
}
export interface backendInterface {
    adminChangeIndividualStatus(id: UserId, status: RegistrationStatus): Promise<Result>;
    adminGetBusiness(userId: Principal): Promise<BusinessProfile | null>;
    adminGetDocumentsForUser(userId: Principal): Promise<Array<DocumentRecord>>;
    adminGetIndividual(id: UserId): Promise<Result_5>;
    adminGetKashifLogs(page: bigint, pageSize: bigint): Promise<{
        total: bigint;
        items: Array<KashifReportLog>;
    }>;
    adminListBusinesses(page: bigint, pageSize: bigint): Promise<BusinessPage>;
    adminListFinanciers(page: bigint, pageSize: bigint): Promise<FinancierPage>;
    adminListIndividuals(page: bigint, pageSize: bigint): Promise<Result_8>;
    adminProcessAccountClosure(requestId: string, approve: boolean, note: string): Promise<Result>;
    adminSetFinancingReady(userId: Principal, value: boolean): Promise<boolean>;
    adminSetIndividualFinancingReady(id: UserId): Promise<Result>;
    adminTriggerReportRegeneration(businessId: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    assignCallerUserRole(user: Principal, role: UserRole__1): Promise<void>;
    bootstrapAdmin(p: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    generateAdminInviteLink(): Promise<Result_1>;
    getAccountClosureRequests(page: bigint, pageSize: bigint): Promise<Result_7>;
    getAdminAnalytics(): Promise<Result_6>;
    getAdminCount(): Promise<bigint>;
    getAuditLog(page: bigint, pageSize: bigint): Promise<AuditPage>;
    getAuditLogForEntity(entityId: string, page: bigint, pageSize: bigint): Promise<AuditPage>;
    getBootstrapAdmin(): Promise<Principal | null>;
    getCallerUserRole(): Promise<UserRole__1>;
    getComparisonData(businessIds: Array<Principal>): Promise<{
        __kind__: "ok";
        ok: Array<CompatibilityResult>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getCredentials(): Promise<MaskedCredentials>;
    getCycleBalance(): Promise<bigint>;
    getDealReport(businessId: Principal): Promise<{
        __kind__: "ok";
        ok: DealReport;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getDocumentsForUser(userId: Principal): Promise<Array<DocumentRecord>>;
    getFinancingReadyBusiness(userId: Principal): Promise<BusinessProfile | null>;
    getKashifScoringConfig(): Promise<KashifScoringConfig>;
    getMatchedBorrowers(page: bigint, pageSize: bigint): Promise<{
        total: bigint;
        items: Array<CompatibilityResult>;
    }>;
    getMizanResult(businessId: Principal): Promise<{
        __kind__: "ok";
        ok: MizanRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMockCycleBalance(): Promise<bigint>;
    getMyBusinessProfile(): Promise<BusinessProfile | null>;
    getMyDocument(docType: DocumentType): Promise<DocumentRecord | null>;
    getMyFinancierProfile(): Promise<FinancierProfile | null>;
    getMyIndividualProfile(): Promise<Result_5>;
    getMyNotifications(page: bigint, pageSize: bigint): Promise<Result_4>;
    getMyTawthiqAppeals(): Promise<Array<TawthiqAppeal>>;
    getPipeline(): Promise<Array<[Principal, PipelineStage]>>;
    getPreliminaryMizanByBusiness(businessId: UserId): Promise<MizanRecord | null>;
    getPreliminaryMizanResult(): Promise<MizanRecord | null>;
    getProfilePhoto(userId: Principal): Promise<string | null>;
    getShortlist(): Promise<Array<ShortlistEntry>>;
    getStableStateVersion(): Promise<bigint>;
    getTawthiqAdminNote(businessUserId: UserId): Promise<string | null>;
    getTawthiqAppeals(businessId: UserId): Promise<Array<TawthiqAppeal>>;
    getTawthiqCompletedAssessments(page: bigint, pageSize: bigint, verdictFilter: string | null, searchQuery: string | null): Promise<{
        page: bigint;
        totalCount: bigint;
        pageSize: bigint;
        items: Array<BusinessProfile>;
    }>;
    getTawthiqOverviewStats(): Promise<TawthiqOverviewStats>;
    getTawthiqPendingReviews(page: bigint, pageSize: bigint): Promise<{
        page: bigint;
        totalCount: bigint;
        pageSize: bigint;
        items: Array<BusinessProfile>;
    }>;
    getTawthiqRecord(userId: UserId): Promise<TawthiqRecord | null>;
    getUnreadNotificationCount(): Promise<Result_2>;
    get_my_threads(): Promise<Array<DirectMessageThread>>;
    get_privacy_settings(applicantId: string): Promise<ProfilePrivacySettings>;
    get_public_profile(applicantId: string): Promise<PublicApplicantProfile | null>;
    get_thread_messages(applicantId: string, financierId: string): Promise<Array<Message>>;
    get_unread_count(): Promise<bigint>;
    isAdminBootstrapped(): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    linkBankAccount(accountId: string): Promise<BusinessProfile>;
    listAdminInviteLinks(): Promise<Array<InviteLinkRecord>>;
    listBorderlineBusinesses(page: bigint): Promise<{
        total: bigint;
        items: Array<ApplicantSummary>;
    }>;
    listFinancingReadyApplicants(page: bigint, pageSize: bigint): Promise<Page>;
    listMyDocuments(): Promise<Array<DocumentRecord>>;
    markNotificationsRead(): Promise<Result>;
    mark_messages_read(applicantId: string, financierId: string): Promise<Result>;
    mockTopUp(amount: bigint): Promise<bigint>;
    pollIndividualStatus(): Promise<Result_3>;
    redeemAdminInviteLink(code: string): Promise<Result>;
    registerAsFinancier(institutionName: string, licenseNumber: string, contactPerson: string, email: string, phone: string, areasOfFinancing: Array<string>, financierType: FinancierType, institutionDetails: InstitutionDetails | null, individualDetails: IndividualDetails | null, groupDetails: GroupDetails | null): Promise<FinancierProfile>;
    removeFromShortlist(businessId: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    removePipelineEntry(applicantId: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    requestAccountClosure(): Promise<Result>;
    requestIndividualBankLink(): Promise<Result_1>;
    reviewTawthiqAppeal(businessId: UserId, appealId: string, decision: AppealStatus, adminNote: string): Promise<{
        __kind__: "ok";
        ok: TawthiqAppeal;
    } | {
        __kind__: "err";
        err: string;
    }>;
    revokeAdminInviteLink(code: string): Promise<Result>;
    runAndStorePreliminaryMizan(businessId: Principal): Promise<void>;
    saveTawthiqAdminNote(businessUserId: UserId, note: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    send_message(applicantId: string, financierId: string, recipientId: Principal, messageText: string): Promise<Result_2>;
    setCredentials(newCreds: CredentialsSettings): Promise<void>;
    setFinancierStatus(financierId: Principal, status: FinancierStatus, reason: string | null): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setPipelineStage(applicantId: Principal, stage: PipelineStage): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setProfilePhoto(photoUrl: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    shortlistBorrower(businessId: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    submitBusinessRegistrationWithKyc(businessName: string, cacNumber: string, businessType: string, annualRevenue: bigint, contactPerson: string, address: string, phoneNumber: string, bvn: string, nin: string, tinNumber: string, businessDescription: string, yearOfIncorporation: string, financingAmountSought: bigint, purposeOfFinancing: string, preferredInstrument: string, directorsList: Array<DirectorRecord>, proprietorDetails: ProprietorRecord | null): Promise<BusinessProfile>;
    submitIndividualRegistration(fullName: string, bvn: string, nin: string, dateOfBirth: string, address: string, occupation: string, employmentStatus: EmploymentStatus, employerName: string | null, monthlyIncome: bigint, incomeSource: IncomeSource, financingPurpose: FinancingPurpose, financingPurposeOther: string | null, amountSought: bigint, preferredInstrument: PreferredInstrument, termsAcceptedAt: Timestamp | null): Promise<Result_1>;
    submitTawthiqAppeal(flagId: string, appealText: string, documentUrl: string | null, documentName: string | null): Promise<{
        __kind__: "ok";
        ok: TawthiqAppeal;
    } | {
        __kind__: "err";
        err: string;
    }>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    triggerMizanAnalysis(businessId: Principal): Promise<{
        __kind__: "ok";
        ok: MizanRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateBusinessProfile(userId: Principal, updates: BusinessProfileUpdate): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateBusinessStatus(userId: Principal, status: RegistrationStatus, reason: string | null): Promise<boolean>;
    updateIndividualProfile(address: string | null, occupation: string | null, employerName: string | null, monthlyIncome: bigint | null, incomeSource: IncomeSource | null): Promise<Result>;
    updateKashifScoringConfig(newConfig: KashifScoringConfig): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateMyProfile(updates: BusinessProfileUpdate): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    update_privacy_settings(applicantId: string, settings: ProfilePrivacySettings): Promise<Result>;
    uploadDocument(docType: DocumentType, storageRef: ExternalBlob): Promise<DocumentRecord>;
    validateAdminInviteLink(code: string): Promise<boolean>;
}
