import Map "mo:core/Map";
import Principal "mo:core/Principal";

// ── New types imported from the current source ──────────────────────────
import ProfileTypes "types/profile";
import IndividualTypes "types/IndividualProfile";

module {
  // ─────────────────────────────────────────────────────────────────────
  // Old type definitions (inlined from .old/src/backend/ — do NOT import .old/)
  // ─────────────────────────────────────────────────────────────────────

  // Shared sub-types referenced by old profiles (identical structure to current)
  type OldKycCheckRecord = {
    bvnVerified : Bool;
    ninVerified : Bool;
    cacVerified : Bool;
    tinVerified : Bool;
    watchlistClean : Bool;
    watchlistParseError : Bool;
    creditScore : Nat;
    kycStatus : { #Pending; #InProgress; #Verified; #Failed };
    verifiedAt : ?Int;
  };

  type OldBankLinkStatus = {
    #NotLinked;
    #Linked;
    #LinkFailed : Text;
  };

  type OldTransactionSummary = {
    income : Nat;
    totalCredits : Nat;
    totalDebits : Nat;
    months : Nat;
  };

  type OldBankLinkRecord = {
    status : OldBankLinkStatus;
    accountId : ?Text;
    institutionName : ?Text;
    balance : ?Nat;
    currency : ?Text;
    linkedAt : ?Int;
    transactionSummary : ?OldTransactionSummary;
  };

  type OldRiskLevel = { #Low; #Medium; #High };
  type OldMizanStage = { #preliminary; #full };

  type OldScoringRecord = {
    financingReadinessScore : Nat;
    halalComplianceScore : Nat;
    riskLevel : OldRiskLevel;
    scoredAt : Int;
    scoringNotes : Text;
  };

  type OldMizanRecord = {
    incomeStabilityScore : Nat;
    debtBehaviorScore : Nat;
    repaymentPatternScore : Nat;
    revenueTrendScore : Nat;
    overallReadinessScore : Nat;
    halalComplianceScore : Nat;
    riskClassification : OldRiskLevel;
    isBorderline : Bool;
    borderlineReasons : [Text];
    narrativeSummary : Text;
    computedAt : Int;
    stage : OldMizanStage;
  };

  type OldShariaFlag = {
    category : Text;
    indicator : Text;
    severity : { #minor; #major };
  };

  type OldInconsistencyFlag = {
    field : Text;
    declaredValue : Text;
    verifiedValue : Text;
  };

  type OldTawthiqRecord = {
    shariaFlags : [OldShariaFlag];
    shariaScreeningNotes : Text;
    shariaScreeningStatus : { #Pending; #Passed; #Failed };
    inconsistencyFlags : [OldInconsistencyFlag];
    inconsistencyStatus : { #Pending; #Clean; #Flagged };
    creditReadinessVerdict : { #ready; #conditionalReady; #notReady };
    narrativeSummary : Text;
    completedAt : ?Int;
  };

  type OldBusinessTypeEnum = { #llc; #businessName };

  type OldDirectorRecord = {
    directorName : Text;
    bvn : Text;
    nin : Text;
    nationality : Text;
    ownershipPercentage : Float;
  };

  type OldProprietorRecord = {
    proprietorName : Text;
    bvn : Text;
    nin : Text;
  };

  type OldCommonRiskLevel = { #pending; #low; #medium; #high };
  type OldHalalComplianceStatus = { #pending; #compliant; #flagged };
  type OldRegistrationStatus = {
    #pending;
    #kycInProgress;
    #underReview;
    #financingReady;
    #approved;
    #rejected;
  };

  // ── Old BusinessProfile (without photoUrl) ───────────────────────────
  type OldBusinessProfile = {
    userId : Principal;
    businessName : Text;
    cacNumber : Text;
    businessType : Text;
    annualRevenue : Nat;
    contactPerson : Text;
    address : Text;
    phoneNumber : Text;
    registrationStatus : OldRegistrationStatus;
    financingReadyScore : Nat;
    riskLevel : OldCommonRiskLevel;
    halalComplianceStatus : OldHalalComplianceStatus;
    financingReady : Bool;
    createdAt : Int;
    kycRecord : OldKycCheckRecord;
    bankLinkRecord : OldBankLinkRecord;
    scoringRecord : OldScoringRecord;
    tawthiqRecord : ?OldTawthiqRecord;
    mizanRecord : ?OldMizanRecord;
    businessTypeEnum : ?OldBusinessTypeEnum;
    businessDescription : ?Text;
    yearOfIncorporation : ?Text;
    financingAmountSought : ?Nat;
    purposeOfFinancing : ?Text;
    preferredInstrument : ?Text;
    directorsList : ?[OldDirectorRecord];
    proprietorDetails : ?OldProprietorRecord;
    preliminaryMizanRecord : ?OldMizanRecord;
    mizanDivergenceAlert : Bool;
  };

  type OldFinancierType = { #institution; #individual; #group };

  type OldPreferredInstrument = {
    #murabaha; #musharakah; #mudarabah; #ijarah; #istisna; #salam; #other;
  };

  type OldInstitutionDetails = {
    licenseNumber : Text;
    riskAppetite : Text;
    ticketSizeMin : Nat;
    ticketSizeMax : Nat;
    preferredInstruments : [OldPreferredInstrument];
  };

  type OldIndividualDetails = {
    fullName : Text;
    bvn : Text;
    nin : Text;
    occupation : Text;
    investmentCapacity : Nat;
    preferredInstruments : [OldPreferredInstrument];
    riskAppetite : Text;
  };

  type OldGroupDetails = {
    groupName : Text;
    numberOfMembers : Nat;
    leadContactName : Text;
    leadContactBvn : Text;
    leadContactNin : Text;
    combinedInvestmentCapacity : Nat;
    legalBasis : Text;
    preferredInstruments : [OldPreferredInstrument];
    riskAppetite : Text;
  };

  // ── Old FinancierProfile (without photoUrl) ──────────────────────────
  type OldFinancierProfile = {
    userId : Principal;
    institutionName : Text;
    licenseNumber : Text;
    contactPerson : Text;
    email : Text;
    phone : Text;
    areasOfFinancing : [Text];
    registrationStatus : OldRegistrationStatus;
    financierStatus : { #Active; #Inactive; #PendingReview };
    createdAt : Int;
    financierType : ?OldFinancierType;
    institutionDetails : ?OldInstitutionDetails;
    individualDetails : ?OldIndividualDetails;
    groupDetails : ?OldGroupDetails;
  };

  type OldEmploymentStatus = { #employed; #selfEmployed; #unemployed; #student };
  type OldIncomeSource = { #employment; #selfEmployment; #business; #other };
  type OldFinancingPurpose = {
    #homePurchase; #vehicle; #education; #medical; #startupCapital; #other;
  };

  type OldIndividualTawthiqRecord = {
    bvnVerified : Bool;
    ninVerified : Bool;
    watchlistClean : Bool;
    incomeAnalysis : Text;
    shariaComplianceScore : Nat;
    shariaFlags : [Text];
    creditReadiness : { #ready; #conditionalReady; #notReady };
    narrativeSummary : Text;
    completedAt : ?Int;
  };

  type OldIndividualMizanRecord = {
    incomeStabilityScore : Nat;
    debtBehaviorScore : Nat;
    repaymentCapacityScore : Nat;
    overallScore : Nat;
    riskLevel : OldCommonRiskLevel;
    borderlineFlag : Bool;
    narrativeSummary : Text;
    stage : { #preliminary; #full };
    completedAt : ?Int;
  };

  type OldBankLinkStatusInd = {
    #NotLinked;
    #Linked;
    #LinkFailed : Text;
  };

  // ── Old IndividualProfile (without photoUrl) ─────────────────────────
  type OldIndividualProfile = {
    id : Principal;
    fullName : Text;
    bvn : Text;
    nin : Text;
    dateOfBirth : Text;
    address : Text;
    occupation : Text;
    employmentStatus : OldEmploymentStatus;
    employerName : ?Text;
    monthlyIncome : Nat;
    incomeSource : OldIncomeSource;
    financingPurpose : OldFinancingPurpose;
    financingPurposeOther : ?Text;
    amountSought : Nat;
    preferredInstrument : OldPreferredInstrument;
    registrationStatus : OldRegistrationStatus;
    kycRecord : ?OldKycCheckRecord;
    tawthiqRecord : ?OldIndividualTawthiqRecord;
    mizanRecord : ?OldIndividualMizanRecord;
    bankLinkStatus : OldBankLinkStatusInd;
    createdAt : Int;
    updatedAt : Int;
    termsAcceptedAt : ?Int;
    accountClosureRequested : Bool;
    accountClosureRequestedAt : ?Int;
  };

  // ─────────────────────────────────────────────────────────────────────
  // OldActor / NewActor — only the three stable profile maps
  // ─────────────────────────────────────────────────────────────────────

  public type OldActor = {
    businessProfiles   : Map.Map<Principal, OldBusinessProfile>;
    financierProfiles  : Map.Map<Principal, OldFinancierProfile>;
    individualsProfiles : Map.Map<Principal, OldIndividualProfile>;
  };

  public type NewActor = {
    businessProfiles   : Map.Map<Principal, ProfileTypes.BusinessProfile>;
    financierProfiles  : Map.Map<Principal, ProfileTypes.FinancierProfile>;
    individualsProfiles : Map.Map<Principal, IndividualTypes.IndividualProfile>;
  };

  // ─────────────────────────────────────────────────────────────────────
  // Migration function
  // ─────────────────────────────────────────────────────────────────────

  public func run(old : OldActor) : NewActor {
    let businessProfiles = old.businessProfiles.map<Principal, OldBusinessProfile, ProfileTypes.BusinessProfile>(
      func(_id, p) { { p with photoUrl = null } }
    );

    let financierProfiles = old.financierProfiles.map<Principal, OldFinancierProfile, ProfileTypes.FinancierProfile>(
      func(_id, p) { { p with photoUrl = null } }
    );

    let individualsProfiles = old.individualsProfiles.map<Principal, OldIndividualProfile, IndividualTypes.IndividualProfile>(
      func(_id, p) { { p with photoUrl = null } }
    );

    { businessProfiles; financierProfiles; individualsProfiles };
  };
};
