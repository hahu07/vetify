import Common "common";
import MonoKyc "MonoKyc";
import MonoBankLink "MonoBankLink";
import BizExt "BusinessExtended";

module {
  // Employment status of an individual applicant
  public type EmploymentStatus = {
    #employed;
    #selfEmployed;
    #unemployed;
    #student;
  };

  // Source of income for an individual applicant
  public type IncomeSource = {
    #employment;
    #selfEmployment;
    #business;
    #other;
  };

  // Purpose of financing sought by an individual applicant
  public type FinancingPurpose = {
    #homePurchase;
    #vehicle;
    #education;
    #medical;
    #startupCapital;
    #other;
  };

  // Tawthiq (التوثيق) agent result for an individual applicant.
  // Covers BVN/NIN identity checks, watchlist screening, income analysis,
  // and Shariah compliance — no CAC/TIN as individuals are not business entities.
  public type IndividualTawthiqRecord = {
    bvnVerified : Bool;
    ninVerified : Bool;
    watchlistClean : Bool;
    incomeAnalysis : Text;                // narrative income assessment
    shariaComplianceScore : Nat;          // 0–100
    shariaFlags : [Text];                 // specific non-compliance flags
    creditReadiness : {
      #ready;
      #conditionalReady;
      #notReady;
    };
    narrativeSummary : Text;              // plain-language Tawthiq verdict explanation
    completedAt : ?Common.Timestamp;
  };

  // Mizan (الميزان) agent result for an individual applicant.
  // Uses income stability, repayment capacity, and debt behaviour.
  // Two stages: #preliminary (from declared data) and #full (from linked bank data).
  public type IndividualMizanRecord = {
    incomeStabilityScore : Nat;           // 0–100
    debtBehaviorScore : Nat;              // 0–100
    repaymentCapacityScore : Nat;         // 0–100
    overallScore : Nat;                   // 0–100 composite
    riskLevel : Common.RiskLevel;
    borderlineFlag : Bool;                // true when score falls in 40–60 range
    narrativeSummary : Text;
    stage : { #preliminary; #full };
    completedAt : ?Common.Timestamp;
  };

  // Full individual applicant profile
  public type IndividualProfile = {
    id : Common.UserId;
    fullName : Text;
    bvn : Text;
    nin : Text;
    dateOfBirth : Text;
    address : Text;
    occupation : Text;
    employmentStatus : EmploymentStatus;
    employerName : ?Text;
    monthlyIncome : Nat;
    incomeSource : IncomeSource;
    financingPurpose : FinancingPurpose;
    financingPurposeOther : ?Text;        // filled when financingPurpose = #other
    amountSought : Nat;
    preferredInstrument : BizExt.PreferredInstrument;
    registrationStatus : Common.RegistrationStatus;
    kycRecord : ?MonoKyc.KycCheckRecord;
    tawthiqRecord : ?IndividualTawthiqRecord;
    mizanRecord : ?IndividualMizanRecord;
    bankLinkStatus : MonoBankLink.BankLinkStatus;
    createdAt : Common.Timestamp;
    updatedAt : Common.Timestamp;
    termsAcceptedAt : ?Common.Timestamp;
    accountClosureRequested : Bool;
    accountClosureRequestedAt : ?Common.Timestamp;
  };

  // Lightweight summary for admin list views
  public type IndividualSummary = {
    id : Common.UserId;
    fullName : Text;
    registrationStatus : Common.RegistrationStatus;
    riskLevel : Common.RiskLevel;
    financingPurpose : FinancingPurpose;
    amountSought : Nat;
    createdAt : Common.Timestamp;
  };
};
