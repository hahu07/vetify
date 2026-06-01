import Map "mo:core/Map";
import PublicProfile "../types/PublicProfile";
import IndividualTypes "../types/IndividualProfile";
import Principal "mo:core/Principal";
import Result "mo:core/Result";

module {
  // State slice passed from main.mo via the mixin.
  public type PublicProfileState = {
    privacySettings : Map.Map<Text, PublicProfile.ProfilePrivacySettings>;
  };

  // Return the privacy settings for an applicant,
  // defaulting all-false if no record exists yet.
  public func getPrivacySettings(
    state : PublicProfileState,
    applicantId : Text,
  ) : PublicProfile.ProfilePrivacySettings {
    switch (state.privacySettings.get(applicantId)) {
      case (?settings) { settings };
      case null {
        {
          applicantId;
          showFinancingAmount = false;
          showIncome = false;
          showMizanScore = false;
          showDirectorNames = false;
        }
      };
    };
  };

  // Persist updated privacy settings; only the applicant may call this.
  public func updatePrivacySettings(
    state : PublicProfileState,
    applicantId : Text,
    settings : PublicProfile.ProfilePrivacySettings,
    caller : Principal,
  ) : Result.Result<(), Text> {
    if (caller.toText() != applicantId) {
      return #err "Unauthorized: only the applicant may update their privacy settings";
    };
    state.privacySettings.add(applicantId, settings);
    #ok ();
  };

  // Assemble the public-facing profile filtered by privacy settings.
  // Returns null if the applicant is not financing-ready or does not exist.
  public func getPublicProfile(
    state : PublicProfileState,
    individuals : Map.Map<Principal, IndividualTypes.IndividualProfile>,
    applicantId : Text,
  ) : ?PublicProfile.PublicApplicantProfile {
    // Look up individual by applicantId (which is the principal text)
    let principalOpt = do {
      var found : ?IndividualTypes.IndividualProfile = null;
      for ((_, profile) in individuals.entries()) {
        if (profile.id.toText() == applicantId) {
          found := ?profile;
        };
      };
      found
    };

    switch (principalOpt) {
      case null { null };
      case (?profile) {
        // Only expose financing-ready applicants
        switch (profile.registrationStatus) {
          case (#financingReady) {};
          case (_) { return null };
        };

        let privacy = getPrivacySettings(state, applicantId);

        let purposeText = switch (profile.financingPurpose) {
          case (#homePurchase) { "Home Purchase" };
          case (#vehicle) { "Vehicle" };
          case (#education) { "Education" };
          case (#medical) { "Medical" };
          case (#startupCapital) { "Startup Capital" };
          case (#other) {
            switch (profile.financingPurposeOther) {
              case (?t) { t };
              case null { "Other" };
            }
          };
        };

        let instrumentText = switch (profile.preferredInstrument) {
          case (#murabaha) { "Murabaha" };
          case (#musharakah) { "Musharakah" };
          case (#mudarabah) { "Mudarabah" };
          case (#ijarah) { "Ijarah" };
          case (#istisna) { "Istisna" };
          case (#salam) { "Salam" };
          case (#other) { "Other" };
        };

        let statusText = switch (profile.registrationStatus) {
          case (#pending) { "Pending" };
          case (#kycInProgress) { "KYC In Progress" };
          case (#underReview) { "Under Review" };
          case (#financingReady) { "Financing Ready" };
          case (#approved) { "Approved" };
          case (#rejected) { "Rejected" };
        };

        let mizanScore : ?Nat = if (privacy.showMizanScore) {
          switch (profile.mizanRecord) {
            case (?rec) { ?rec.overallScore };
            case null { null };
          }
        } else { null };

        ?{
          applicantId;
          fullName = profile.fullName;
          financingPurpose = purposeText;
          preferredInstrument = instrumentText;
          amountSought = if (privacy.showFinancingAmount) { ?profile.amountSought } else { null };
          monthlyIncome = if (privacy.showIncome) { ?profile.monthlyIncome } else { null };
          mizanScore;
          registrationStatus = statusText;
        };
      };
    };
  };
};
