/**
 * Repository layer — business-logic queries over PQS (PostgreSQL).
 *
 * All READ operations go through here. Write operations (choice exercises,
 * contract creation) remain in canton.ts via the HTTP JSON API.
 *
 * Template IDs match the namespaced Daml module: "Vetify.<Module>:<TemplateName>"
 */
import { active, activePaged, contractById, contractByIdWithRetry, latestArchived, query, type Page } from "./pqs.js";

const T = {
  ONBOARDING:         "Vetify.Onboarding:BusinessOnboarding",
  VERIFICATION:       "Vetify.Onboarding:VerificationResult",
  COMPLIANCE:         "Vetify.Compliance:ComplianceReview",
  COMPLIANCE_RESULT:  "Vetify.Compliance:ComplianceResult",
  APPROVED:           "Vetify.Compliance:ApprovedBusiness",
  EDD_CASE:           "Vetify.Compliance:EDDCase",
  FINANCING:          "Vetify.Financing:FinancingRequest",
  UNDERWRITING:       "Vetify.Financing:UnderwritingResult",
  UNDERWRITING_REJECTION: "Vetify.Financing:UnderwritingRejection",
  FINANCING_DECISION: "Vetify.Financing:FinancingDecision",
  WAD:                "Vetify.Murabahah:MurabahahWad",
  WAKALA:             "Vetify.Murabahah:MurabahahWakala",
  PURCHASE:           "Vetify.Murabahah:AssetPurchaseRecord",
  PROPOSAL:           "Vetify.Murabahah:MurabahahProposal",
  SHARIAH_CERT:        "Vetify.Murabahah:ShariahContractCertification",
  MURABAHAH:          "Vetify.Murabahah:MurabahahContract",
  REPAYMENT:          "Vetify.Murabahah:RepaymentRecord",
  IBRA:               "Vetify.Murabahah:IbraRequest",
  CHARITY:            "Vetify.Murabahah:LatePaymentCharity",
  RAHN:               "Vetify.Murabahah:RahnAgreement",
  REPORT:             "Vetify.Reporting:PortfolioReport",
  PROVIDER_ONBOARDING: "Vetify.FinancingProvider:FinancingProviderOnboarding",
  APPROVED_PROVIDER:   "Vetify.FinancingProvider:ApprovedProvider",
  AUTHORIZED_OFFICER:  "Vetify.Governance:AuthorizedOfficer",
  UNDERWRITING_POLICY: "Vetify.Financing:UnderwritingPolicy",
} as const;

// ── Stage 1–2: Onboarding & Verification ─────────────────────────────────────

export const listOnboardingApplications = () => active(T.ONBOARDING);

export const getOnboardingById = (contractId: string) =>
  contractById(T.ONBOARDING, contractId);

export const listOnboardingByStatus = (status: string) =>
  active(T.ONBOARDING, `payload->>'status' = $2`, status);

// Self-serve signup tenant scoping (routes/onboarding.ts's GET / for
// "business" sessions). Unlike the downstream `*ByBusiness` family below,
// BusinessOnboarding's cacRegNumber sits under the nested `kyc` record
// (Onboarding.daml: `kyc : BusinessKyc`, key `(business, kyc.cacRegNumber)`),
// not flattened onto the payload root — hence the different JSONB path.
export const listOnboardingByBusinessCac = (cacRegNumber: string) =>
  active(T.ONBOARDING, `payload->'kyc'->>'cacRegNumber' = $2`, cacRegNumber);

// Staff document lookup (routes/onboarding.ts's GET /documents/:cacRegNumber)
// — tries the live BusinessOnboarding first (still mid-pipeline), and only
// falls back to the most recent archived generation once Approve/Reject has
// archived it without recreating it (same gap as listApprovedBusinessByCac
// above, but for the documents themselves rather than the approval record).
export async function getOnboardingDocumentsByCac(cacRegNumber: string) {
  const live = await listOnboardingByBusinessCac(cacRegNumber);
  if (live.length > 0) {
    const payload = live[0].payload as { documents?: unknown[]; onboardingRef?: string };
    return { source: "live" as const, documents: payload.documents ?? [], onboardingRef: payload.onboardingRef ?? null };
  }
  const archived = await latestArchived(
    T.ONBOARDING,
    `payload->'kyc'->>'cacRegNumber' = $2`,
    cacRegNumber,
  );
  if (!archived) return null;
  const payload = archived.payload as { documents?: unknown[]; onboardingRef?: string };
  return { source: "archived" as const, documents: payload.documents ?? [], onboardingRef: payload.onboardingRef ?? null };
}

export const listVerificationResults = () => active(T.VERIFICATION);

// Business-scoped (routes/onboarding.ts's GET /verification-results) — VerificationResult.
// cacRegNumber sits flat on the payload root (unlike BusinessOnboarding's nested
// kyc.cacRegNumber), same shape as listApprovedBusinessByCac.
export const listVerificationResultByCac = (cacRegNumber: string) =>
  active(T.VERIFICATION, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Stage 3: Compliance ───────────────────────────────────────────────────────

export const listComplianceReviews = () => active(T.COMPLIANCE);

// Business-scoped (routes/onboarding.ts's GET /compliance-reviews) — closes the same
// interim-visibility gap as listVerificationResultByCac: BusinessOnboarding.Approve archives
// BusinessOnboarding immediately, but ApprovedBusiness doesn't exist until ComplianceReview is
// also approved, so a business dashboard needs this to render anything during that window.
export const listComplianceReviewByCac = (cacRegNumber: string) =>
  active(T.COMPLIANCE, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const listComplianceByStatus = (status: string) =>
  active(T.COMPLIANCE, `payload->>'status' = $2`, status);

// G14: EDD cases (PEP/EDD workflow) — scoped by the compliance review's own cacRegNumber
// field so a business session's dashboard can eventually surface its own case too.
export const listEddCases = () => active(T.EDD_CASE);

export const listEddCasesByStatus = (status: string) =>
  active(T.EDD_CASE, `payload->>'status' = $2`, status);

export const listEddCasesByBusiness = (cacRegNumber: string) =>
  active(T.EDD_CASE, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Stage 4: Approved Businesses ───────────────────────────────────────────────

export const listApprovedBusinesses = () => active(T.APPROVED);

// ApprovedBusiness.cacRegNumber sits flat on the payload root (unlike
// BusinessOnboarding's nested kyc.cacRegNumber above) — mirrors
// listOnboardingByBusinessCac so a business session's dashboard can find its
// own approval once its BusinessOnboarding has been archived by Approve
// (Onboarding.daml deliberately does not recreate BusinessOnboarding on
// approval — see routes/onboarding.ts's business-scoped GET /approved).
export const listApprovedBusinessByCac = (cacRegNumber: string) =>
  active(T.APPROVED, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const getApprovedBusinessById = (contractId: string) =>
  contractById(T.APPROVED, contractId);

// ── Stage 5–6: Financing & Underwriting ──────────────────────────────────────

export const listFinancingRequests = () => active(T.FINANCING);

export const listFinancingByStatus = (status: string) =>
  active(T.FINANCING, `payload->>'status' = $2`, status);

export const getFinancingRequestById = (contractId: string) =>
  contractById(T.FINANCING, contractId);

// Self-serve signup tenant scoping (Financer sessions) — mirrors the
// business-side `*ByBusiness` family, keyed on the FI's own dynamically-
// allocated Canton party ID instead of a CAC registration number.
export const listFinancingRequestsByFi = (financialInstitution: string) =>
  active(T.FINANCING, `payload->>'financialInstitution' = $2`, financialInstitution);

export const listUnderwritingResults = () => active(T.UNDERWRITING);

export const listUnderwritingResultsByCac = (cacRegNumber: string) =>
  active(T.UNDERWRITING, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const listUnderwritingRejections = () => active(T.UNDERWRITING_REJECTION);

// Business-scoped (routes/financing.ts's GET /underwriting-rejections) — RejectUnderwriting
// archives FinancingRequest without recreating it (same "archive on decision" pattern as
// BusinessOnboarding.Approve/Reject and ComplianceReview's Approve/RejectCompliance), so this
// is the only remaining record a rejected business's dashboard can read the outcome from.
export const listUnderwritingRejectionsByCac = (cacRegNumber: string) =>
  active(T.UNDERWRITING_REJECTION, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const listUnderwritingPolicies = () => active(T.UNDERWRITING_POLICY);

export const getUnderwritingPolicyByFi = (financialInstitution: string) =>
  active(T.UNDERWRITING_POLICY, `payload->>'financialInstitution' = $2`, financialInstitution);

// ── Stage 7 outputs: FI funding decisions (audit) & pending Murabahah proposals ──

export const listFinancingDecisions = () => active(T.FINANCING_DECISION);

export const listProposals = () => active(T.PROPOSAL);

// G12: retried lookup — a client following up on its own OfferMurabahah/
// CertifyShariahTerms write can race Scribe's ledger→PQS catch-up.
export const getProposalById = (contractId: string) =>
  contractByIdWithRetry(T.PROPOSAL, contractId);

export const listProposalsByBusiness = (cacRegNumber: string) =>
  active(T.PROPOSAL, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const listProposalsByFi = (financialInstitution: string) =>
  active(T.PROPOSAL, `payload->>'financialInstitution' = $2`, financialInstitution);

// ── Stage 7→8: Wa'd / Wakala / Asset Purchase pipeline ───────────────────────

export const listWads = () => active(T.WAD);

export const listWadsByBusiness = (cacRegNumber: string) =>
  active(T.WAD, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const listWadsByFi = (financialInstitution: string) =>
  active(T.WAD, `payload->>'financialInstitution' = $2`, financialInstitution);

export const listWakalas = () => active(T.WAKALA);

export const listWakalasByFi = (financialInstitution: string) =>
  active(T.WAKALA, `payload->>'financialInstitution' = $2`, financialInstitution);

export const listWakalasByBusiness = (cacRegNumber: string) =>
  active(T.WAKALA, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const listPurchaseRecords = () => active(T.PURCHASE);

export const listPurchaseRecordsByBusiness = (cacRegNumber: string) =>
  active(T.PURCHASE, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const listPurchaseRecordsByFi = (financialInstitution: string) =>
  active(T.PURCHASE, `payload->>'financialInstitution' = $2`, financialInstitution);

// G11: Shari'a certifications — active ones gate AcceptProposal; listed so the
// business UI can find the certificationCid for its proposal and the vetify UI
// can show/revoke outstanding certifications.
export const listShariahCertifications = () => active(T.SHARIAH_CERT);

export const listShariahCertificationsByFacility = (facilityRef: string) =>
  active(T.SHARIAH_CERT, `payload->>'facilityRef' = $2`, facilityRef);

export const listShariahCertificationsByBusiness = (cacRegNumber: string) =>
  active(T.SHARIAH_CERT, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Stage 3 output: compliance decision records (audit) ──────────────────────

export const listComplianceResults = () => active(T.COMPLIANCE_RESULT);

// Business-scoped (routes/onboarding.ts's GET /compliance-results) — same rationale as
// listVerificationResultByCac/listComplianceReviewByCac: a Stage 3 rejection archives
// ComplianceReview without an ApprovedBusiness, so this is the only remaining record of why.
export const listComplianceResultByCac = (cacRegNumber: string) =>
  active(T.COMPLIANCE_RESULT, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Stage 8: Murabahah Contracts ─────────────────────────────────────────────

export const listContracts = () => active(T.MURABAHAH);

export const listContractsByStatus = (status: string) =>
  active(T.MURABAHAH, `payload->>'status' = $2`, status);

export const listContractsByFi = (financialInstitution: string) =>
  active(T.MURABAHAH, `payload->>'financialInstitution' = $2`, financialInstitution);

// G12: paginated variants for the growable lists (the portfolio and the
// repayment ledger are the two that scale with book size).
export const listContractsPaged = (page: Page) =>
  activePaged(T.MURABAHAH, page);

export const listContractsByStatusPaged = (status: string, page: Page) =>
  activePaged(T.MURABAHAH, page, `payload->>'status' = $2`, status);

// G12: retried lookup — a client following up on its own AcceptProposal write
// (immediately viewing the just-executed MurabahahContract) can race Scribe's
// ledger→PQS catch-up; see contractByIdWithRetry's doc comment in pqs.ts.
export const getContractById = (contractId: string) =>
  contractByIdWithRetry(T.MURABAHAH, contractId);

// ── Stage 9: Repayments ───────────────────────────────────────────────────────

export const listRepayments = () => active(T.REPAYMENT);

export const listRepaymentsByBusiness = (cacRegNumber: string) =>
  active(T.REPAYMENT, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const listRepaymentsPaged = (page: Page) =>
  activePaged(T.REPAYMENT, page);

export const listRepaymentsByBusinessPaged = (cacRegNumber: string, page: Page) =>
  activePaged(T.REPAYMENT, page, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Ibra' (Early Settlement Requests) ────────────────────────────────────────

export const listIbraRequests = () => active(T.IBRA);

export const listIbraByBusiness = (cacRegNumber: string) =>
  active(T.IBRA, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Late Payment Charity (Sadaqah obligations) ────────────────────────────────

export const listLatePaymentCharities = () => active(T.CHARITY);

export const listUnsettledCharities = () =>
  active(T.CHARITY, `payload->>'settled' = $2`, "false");

export const listCharitiesByBusiness = (cacRegNumber: string) =>
  active(T.CHARITY, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Rahn (Collateral Agreements) ─────────────────────────────────────────────

export const listRahnAgreements = () => active(T.RAHN);

export const listRahnByBusiness = (cacRegNumber: string) =>
  active(T.RAHN, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Portfolio Dashboard (FI view) ─────────────────────────────────────────────

export interface PortfolioSummary {
  totalActive:      number;
  totalDisbursed:   number;
  totalOutstanding: number;
  delinquentCount:  number;
  completedCount:   number;
  defaultedCount:   number;
}

async function computePortfolioSummary(financialInstitution?: string): Promise<PortfolioSummary> {
  const where = financialInstitution ? `WHERE payload->>'financialInstitution' = $2` : "";
  const params = financialInstitution ? [T.MURABAHAH, financialInstitution] : [T.MURABAHAH];
  const rows = await query<{
    status:       string;
    count:        string;
    disbursed:    string;
    outstanding:  string;
  }>(`
    SELECT
      payload->>'status'                               AS status,
      COUNT(*)                                         AS count,
      SUM((payload->'murabahahTerms'->>'salePrice')::numeric) AS disbursed,
      SUM((payload->>'outstandingBalance')::numeric)   AS outstanding
    FROM active($1)
    ${where}
    GROUP BY payload->>'status'
  `, params);

  const summary: PortfolioSummary = {
    totalActive: 0, totalDisbursed: 0, totalOutstanding: 0,
    delinquentCount: 0, completedCount: 0, defaultedCount: 0,
  };

  for (const row of rows) {
    const count      = parseInt(row.count, 10);
    const disbursed  = parseFloat(row.disbursed  ?? "0");
    const outstanding = parseFloat(row.outstanding ?? "0");

    summary.totalDisbursed += disbursed;

    switch (row.status) {
      case "Active":
        summary.totalActive      += count;
        summary.totalOutstanding += outstanding;
        break;
      case "Delinquent":
        summary.totalActive      += count;
        summary.totalOutstanding += outstanding;
        summary.delinquentCount  += count;
        break;
      case "Completed":
        summary.completedCount += count;
        break;
      case "Defaulted":
        summary.defaultedCount += count;
        break;
    }
  }

  return summary;
}

export const getPortfolioSummary = () => computePortfolioSummary();

// Self-serve signup tenant scoping (Financer sessions).
export const getPortfolioSummaryByFi = (financialInstitution: string) =>
  computePortfolioSummary(financialInstitution);

// ── Portfolio Reports (Regulator view) ───────────────────────────────────────

export const listPortfolioReports = () => active(T.REPORT);

export const listPortfolioReportsByDate = (reportDate: string) =>
  active(T.REPORT, `payload->>'reportDate' = $2`, reportDate);

// ── Business dashboard (single business's view) ───────────────────────────────

export const getBusinessContracts = (cacRegNumber: string) =>
  active(T.MURABAHAH, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const getBusinessRepayments = (cacRegNumber: string) =>
  listRepaymentsByBusiness(cacRegNumber);

export const getBusinessFinancingRequests = (cacRegNumber: string) =>
  active(T.FINANCING, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Stage 0: Financing Provider onboarding & AuthorizedOfficer registry ──────

export const listProviderOnboardings = () => active(T.PROVIDER_ONBOARDING);

export const getProviderOnboardingById = (contractId: string) =>
  contractById(T.PROVIDER_ONBOARDING, contractId);

export const listApprovedProviders = () => active(T.APPROVED_PROVIDER);

export const listAuthorizedOfficers = () => active(T.AUTHORIZED_OFFICER);

// Self-serve signup tenant scoping (Financer sessions) — each signed-up FI
// gets its own dynamically-allocated Canton party (see canton.ts's
// allocateParty/registerDynamicParty and routes/auth.ts's POST /signup), so
// these mirror the business-side `*ByBusiness` family, keyed on that party ID.
export const listProviderOnboardingsByFi = (financialInstitution: string) =>
  active(T.PROVIDER_ONBOARDING, `payload->>'financialInstitution' = $2`, financialInstitution);

export const listApprovedProvidersByFi = (financialInstitution: string) =>
  active(T.APPROVED_PROVIDER, `payload->>'financialInstitution' = $2`, financialInstitution);

export const listAuthorizedOfficersByFi = (financialInstitution: string) =>
  active(T.AUTHORIZED_OFFICER, `payload->>'financialInstitution' = $2`, financialInstitution);
