/**
 * Repository layer — business-logic queries over PQS (PostgreSQL).
 *
 * All READ operations go through here. Write operations (choice exercises,
 * contract creation) remain in canton.ts via the HTTP JSON API.
 *
 * Template IDs match the namespaced Daml module: "Vetify.<Module>:<TemplateName>"
 */
import { active, contractById, query } from "./pqs.js";

const T = {
  ONBOARDING:         "Vetify.Onboarding:BusinessOnboarding",
  VERIFICATION:       "Vetify.Onboarding:VerificationResult",
  COMPLIANCE:         "Vetify.Compliance:ComplianceReview",
  COMPLIANCE_RESULT:  "Vetify.Compliance:ComplianceResult",
  APPROVED:           "Vetify.Compliance:ApprovedBorrower",
  FINANCING:          "Vetify.Financing:FinancingRequest",
  UNDERWRITING:       "Vetify.Financing:UnderwritingResult",
  FINANCING_DECISION: "Vetify.Financing:FinancingDecision",
  WAD:                "Vetify.Murabahah:MurabahahWad",
  WAKALA:             "Vetify.Murabahah:MurabahahWakala",
  PURCHASE:           "Vetify.Murabahah:AssetPurchaseRecord",
  PROPOSAL:           "Vetify.Murabahah:MurabahahProposal",
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

export const listVerificationResults = () => active(T.VERIFICATION);

// ── Stage 3: Compliance ───────────────────────────────────────────────────────

export const listComplianceReviews = () => active(T.COMPLIANCE);

export const listComplianceByStatus = (status: string) =>
  active(T.COMPLIANCE, `payload->>'status' = $2`, status);

// ── Stage 4: Approved Borrowers ───────────────────────────────────────────────

export const listApprovedBorrowers = () => active(T.APPROVED);

// ── Stage 5–6: Financing & Underwriting ──────────────────────────────────────

export const listFinancingRequests = () => active(T.FINANCING);

export const listFinancingByStatus = (status: string) =>
  active(T.FINANCING, `payload->>'status' = $2`, status);

export const listUnderwritingResults = () => active(T.UNDERWRITING);

export const listUnderwritingPolicies = () => active(T.UNDERWRITING_POLICY);

export const getUnderwritingPolicyByFi = (financialInstitution: string) =>
  active(T.UNDERWRITING_POLICY, `payload->>'financialInstitution' = $2`, financialInstitution);

// ── Stage 7 outputs: FI funding decisions (audit) & pending Murabahah proposals ──

export const listFinancingDecisions = () => active(T.FINANCING_DECISION);

export const listProposals = () => active(T.PROPOSAL);

export const getProposalById = (contractId: string) =>
  contractById(T.PROPOSAL, contractId);

export const listProposalsByBorrower = (cacRegNumber: string) =>
  active(T.PROPOSAL, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Stage 7→8: Wa'd / Wakala / Asset Purchase pipeline ───────────────────────

export const listWads = () => active(T.WAD);

export const listWadsByBorrower = (cacRegNumber: string) =>
  active(T.WAD, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const listWakalas = () => active(T.WAKALA);

export const listPurchaseRecords = () => active(T.PURCHASE);

export const listPurchaseRecordsByBorrower = (cacRegNumber: string) =>
  active(T.PURCHASE, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Stage 3 output: compliance decision records (audit) ──────────────────────

export const listComplianceResults = () => active(T.COMPLIANCE_RESULT);

// ── Stage 8: Murabahah Contracts ─────────────────────────────────────────────

export const listContracts = () => active(T.MURABAHAH);

export const listContractsByStatus = (status: string) =>
  active(T.MURABAHAH, `payload->>'status' = $2`, status);

export const getContractById = (contractId: string) =>
  contractById(T.MURABAHAH, contractId);

// ── Stage 9: Repayments ───────────────────────────────────────────────────────

export const listRepayments = () => active(T.REPAYMENT);

export const listRepaymentsByBorrower = (cacRegNumber: string) =>
  active(T.REPAYMENT, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Ibra' (Early Settlement Requests) ────────────────────────────────────────

export const listIbraRequests = () => active(T.IBRA);

export const listIbraByBorrower = (cacRegNumber: string) =>
  active(T.IBRA, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Late Payment Charity (Sadaqah obligations) ────────────────────────────────

export const listLatePaymentCharities = () => active(T.CHARITY);

export const listUnsettledCharities = () =>
  active(T.CHARITY, `payload->>'settled' = $2`, "false");

export const listCharitiesByBorrower = (cacRegNumber: string) =>
  active(T.CHARITY, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Rahn (Collateral Agreements) ─────────────────────────────────────────────

export const listRahnAgreements = () => active(T.RAHN);

export const listRahnByBorrower = (cacRegNumber: string) =>
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

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
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
    GROUP BY payload->>'status'
  `, [T.MURABAHAH]);

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

// ── Portfolio Reports (Regulator view) ───────────────────────────────────────

export const listPortfolioReports = () => active(T.REPORT);

export const listPortfolioReportsByDate = (reportDate: string) =>
  active(T.REPORT, `payload->>'reportDate' = $2`, reportDate);

// ── Borrower dashboard (single borrower's view) ───────────────────────────────

export const getBorrowerContracts = (cacRegNumber: string) =>
  active(T.MURABAHAH, `payload->>'cacRegNumber' = $2`, cacRegNumber);

export const getBorrowerRepayments = (cacRegNumber: string) =>
  listRepaymentsByBorrower(cacRegNumber);

export const getBorrowerFinancingRequests = (cacRegNumber: string) =>
  active(T.FINANCING, `payload->>'cacRegNumber' = $2`, cacRegNumber);

// ── Stage 0: Financing Provider onboarding & AuthorizedOfficer registry ──────

export const listProviderOnboardings = () => active(T.PROVIDER_ONBOARDING);

export const getProviderOnboardingById = (contractId: string) =>
  contractById(T.PROVIDER_ONBOARDING, contractId);

export const listApprovedProviders = () => active(T.APPROVED_PROVIDER);

export const listAuthorizedOfficers = () => active(T.AUTHORIZED_OFFICER);
