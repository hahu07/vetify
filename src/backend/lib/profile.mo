import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import ProfileTypes "../types/profile";
import MonoKyc "../types/MonoKyc";
import MonoBankLink "../types/MonoBankLink";
import AiScoring "../types/AiScoring";
import List "mo:core/List";
import Result "mo:core/Result";
import BizExt "../types/BusinessExtended";
import FinExt "../types/FinancierExtended";

module {
  // Register a business applicant profile (base registration without KYC)
  public func registerBusiness(
    profiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
    caller : Principal,
    businessName : Text,
    cacNumber : Text,
    businessType : Text,
    annualRevenue : Nat,
    contactPerson : Text,
    address : Text,
    phoneNumber : Text,
  ) : ProfileTypes.BusinessProfile {
    let profile : ProfileTypes.BusinessProfile = {
      userId = caller;
      businessName;
      cacNumber;
      businessType;
      annualRevenue;
      contactPerson;
      address;
      phoneNumber;
      registrationStatus = #pending;
      financingReadyScore = 0;
      riskLevel = #pending;
      halalComplianceStatus = #pending;
      financingReady = false;
      createdAt = Time.now();
      kycRecord = MonoKyc.defaultKycRecord();
      bankLinkRecord = MonoBankLink.defaultBankLinkRecord();
      scoringRecord = AiScoring.defaultScoringRecord();
      tawthiqRecord = null;
      mizanRecord = null;
      preliminaryMizanRecord = null;
      mizanDivergenceAlert = false;
      businessTypeEnum = null;
      businessDescription = null;
      yearOfIncorporation = null;
      financingAmountSought = null;
      purposeOfFinancing = null;
      preferredInstrument = null;
      directorsList = null;
      proprietorDetails = null;
      photoUrl = null;
    };
    profiles.add(caller, profile);
    profile;
  };

  // Register a financier profile
  public func registerFinancier(
    profiles : Map.Map<Principal, ProfileTypes.FinancierProfile>,
    caller : Principal,
    institutionName : Text,
    licenseNumber : Text,
    contactPerson : Text,
    email : Text,
    phone : Text,
    areasOfFinancing : [Text],
    financierType : FinExt.FinancierType,
    institutionDetails : ?FinExt.InstitutionDetails,
    individualDetails : ?FinExt.IndividualDetails,
    groupDetails : ?FinExt.GroupDetails,
  ) : ProfileTypes.FinancierProfile {
    let profile : ProfileTypes.FinancierProfile = {
      userId = caller;
      institutionName;
      licenseNumber;
      contactPerson;
      email;
      phone;
      areasOfFinancing;
      registrationStatus = #pending;
      financierStatus = #PendingReview;
      createdAt = Time.now();
      financierType = ?financierType;
      institutionDetails;
      individualDetails;
      groupDetails;
      photoUrl = null;
    };
    profiles.add(caller, profile);
    profile;
  };

  // Update mutable fields on a business profile (admin or self-update)
  public func updateBusinessProfile(
    profiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
    userId : Principal,
    updates : ProfileTypes.BusinessProfileUpdate,
  ) : { #ok : (); #err : Text } {
    switch (profiles.get(userId)) {
      case (null) { #err("Business profile not found") };
      case (?p) {
        let updated : ProfileTypes.BusinessProfile = {
          p with
          businessName   = switch (updates.businessName)   { case (?v) v; case null p.businessName };
          phoneNumber    = switch (updates.phone)          { case (?v) v; case null p.phoneNumber };
          address        = switch (updates.address)        { case (?v) v; case null p.address };
          contactPerson  = switch (updates.contactPerson)  { case (?v) v; case null p.contactPerson };
        };
        profiles.add(userId, updated);
        #ok(());
      };
    };
  };

  // Get business profile by principal
  public func getBusinessProfile(
    profiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
    userId : Principal,
  ) : ?ProfileTypes.BusinessProfile {
    profiles.get(userId);
  };

  // Get financier profile by principal
  public func getFinancierProfile(
    profiles : Map.Map<Principal, ProfileTypes.FinancierProfile>,
    userId : Principal,
  ) : ?ProfileTypes.FinancierProfile {
    profiles.get(userId);
  };

  // List all financing-ready business applicants for financier view
  public func listFinancingReadyApplicants(
    businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  ) : [ProfileTypes.ApplicantSummary] {
    let summaries = List.empty<ProfileTypes.ApplicantSummary>();
    for ((_, p) in businessProfiles.entries()) {
      if (p.financingReady) {
        summaries.add({
          userId = p.userId;
          role = #businessApplicant;
          displayName = p.businessName;
          financingReadyScore = p.financingReadyScore;
          riskLevel = p.riskLevel;
          halalComplianceStatus = p.halalComplianceStatus;
          financingReady = p.financingReady;
        });
      };
    };
    summaries.toArray();
  };

  // Set financing-ready flag (admin action)
  public func setFinancingReady(
    businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
    targetId : Principal,
    value : Bool,
  ) : Bool {
    switch (businessProfiles.get(targetId)) {
      case (?p) {
        businessProfiles.add(targetId, { p with financingReady = value });
        return true;
      };
      case null {};
    };
    false;
  };
};
