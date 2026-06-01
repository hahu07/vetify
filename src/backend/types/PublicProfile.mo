import Debug "mo:core/Debug";

module {
  // Privacy controls for an individual applicant's public profile.
  // All fields default false — opt-in visibility.
  public type ProfilePrivacySettings = {
    applicantId : Text;
    showFinancingAmount : Bool;
    showIncome : Bool;
    showMizanScore : Bool;
    showDirectorNames : Bool;
  };

  // Public-facing applicant profile — fields filtered by ProfilePrivacySettings.
  public type PublicApplicantProfile = {
    applicantId : Text;
    fullName : Text;
    financingPurpose : Text;
    preferredInstrument : Text;
    amountSought : ?Nat;         // only present if showFinancingAmount = true
    monthlyIncome : ?Nat;        // only present if showIncome = true
    mizanScore : ?Nat;           // only present if showMizanScore = true
    registrationStatus : Text;
  };
};
