import Principal "mo:core/Principal";

module {
  public type UserId = Principal;
  public type Timestamp = Int;

  // Registration status
  public type RegistrationStatus = {
    #pending;
    #kycInProgress;  // KYC pipeline running — admin cannot act on this profile
    #underReview;
    #financingReady;
    #approved;
    #rejected;
  };

  // Legacy risk level and halal compliance (kept for BusinessProfile backward compatibility)
  public type RiskLevel = {
    #pending;
    #low;
    #medium;
    #high;
  };

  public type HalalComplianceStatus = {
    #pending;
    #compliant;
    #flagged;
  };
};
