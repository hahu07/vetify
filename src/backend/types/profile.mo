import Common "common";
import MonoKyc "MonoKyc";
import MonoBankLink "MonoBankLink";
import AiScoring "AiScoring";
import Tawthiq "Tawthiq";
import BizExt "BusinessExtended";
import FinExt "FinancierExtended";

module {
  // Role assigned to each registered user
  public type UserRole = {
    #businessApplicant;
    #financier;
    #admin;
  };

  // Business applicant registration data
  public type BusinessProfile = {
    userId : Common.UserId;
    businessName : Text;
    cacNumber : Text;
    businessType : Text;
    annualRevenue : Nat;
    contactPerson : Text;
    address : Text;
    phoneNumber : Text;
    registrationStatus : Common.RegistrationStatus;
    financingReadyScore : Nat;  // 0–100, populated after AI scoring
    riskLevel : Common.RiskLevel;
    halalComplianceStatus : Common.HalalComplianceStatus;
    financingReady : Bool;
    createdAt : Common.Timestamp;
    kycRecord : MonoKyc.KycCheckRecord;
    bankLinkRecord : MonoBankLink.BankLinkRecord;
    scoringRecord : AiScoring.ScoringRecord;          // kept for backwards compatibility
    tawthiqRecord : ?Tawthiq.TawthiqRecord;
    mizanRecord : ?AiScoring.MizanRecord;             // Mizan (الميزان) agent result
    // ── Extended fields added in v2 ──────────────────────────────────
    businessTypeEnum : ?BizExt.BusinessTypeEnum;        // LLC or BusinessName
    businessDescription : ?Text;                        // nature of business / activities
    yearOfIncorporation : ?Text;
    financingAmountSought : ?Nat;
    purposeOfFinancing : ?Text;
    preferredInstrument : ?Text;                        // halal instrument preference
    directorsList : ?[BizExt.DirectorRecord];           // for LLC-type businesses
    proprietorDetails : ?BizExt.ProprietorRecord;       // for BusinessName registrations
    // ── Dual-stage Mizan support ─────────────────────────────────────
    // mizanRecord (existing) = full analysis run post-bank-link
    // preliminaryMizanRecord = analysis run at registration time using declared data
    preliminaryMizanRecord : ?AiScoring.MizanRecord;
    // ── Data integrity flags ──────────────────────────────────────────
    // Set to true when full Mizan score diverges >20 points from preliminary score
    mizanDivergenceAlert : Bool;
  };

  // Financier status (separate from registration flow)
  public type FinancierStatus = {
    #Active;
    #Inactive;
    #PendingReview;
  };

  // Financier registration data
  public type FinancierProfile = {
    userId : Common.UserId;
    institutionName : Text;
    licenseNumber : Text;
    contactPerson : Text;
    email : Text;
    phone : Text;
    areasOfFinancing : [Text];
    registrationStatus : Common.RegistrationStatus;
    financierStatus : FinancierStatus;
    createdAt : Common.Timestamp;
    // ── Extended fields added in v2 ──────────────────────────────────
    financierType : ?FinExt.FinancierType;              // institution | individual | group
    institutionDetails : ?FinExt.InstitutionDetails;
    individualDetails : ?FinExt.IndividualDetails;
    groupDetails : ?FinExt.GroupDetails;
  };

  // Fields that can be updated on a BusinessProfile by admin or the applicant
  public type BusinessProfileUpdate = {
    businessName : ?Text;
    phone : ?Text;
    address : ?Text;
    contactPerson : ?Text;
  };

  // Lightweight summary for financier dashboard (financing-ready applicants only)
  public type ApplicantSummary = {
    userId : Common.UserId;
    role : UserRole;
    displayName : Text;       // businessName
    financingReadyScore : Nat;
    riskLevel : Common.RiskLevel;
    halalComplianceStatus : Common.HalalComplianceStatus;
    financingReady : Bool;
  };
};
