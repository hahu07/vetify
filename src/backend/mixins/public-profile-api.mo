import Result "mo:core/Result";
import IndividualTypes "../types/IndividualProfile";
import PublicProfile "../types/PublicProfile";
import PublicProfileLib "../lib/public-profile";
import Map "mo:core/Map";

mixin (
  publicProfileState : PublicProfileLib.PublicProfileState,
  individualsProfiles : Map.Map<Principal, IndividualTypes.IndividualProfile>,
) {

  // ── Get privacy settings for an applicant ─────────────────────────────────────
  // Anyone may retrieve settings (they are non-sensitive control knobs).
  public query func get_privacy_settings(
    applicantId : Text,
  ) : async PublicProfile.ProfilePrivacySettings {
    PublicProfileLib.getPrivacySettings(publicProfileState, applicantId);
  };

  // ── Update privacy settings ───────────────────────────────────────────────────
  // Only the applicant whose principal matches applicantId may update.
  public shared ({ caller }) func update_privacy_settings(
    applicantId : Text,
    settings : PublicProfile.ProfilePrivacySettings,
  ) : async Result.Result<(), Text> {
    PublicProfileLib.updatePrivacySettings(publicProfileState, applicantId, settings, caller);
  };

  // ── Get the filtered public profile for an applicant ──────────────────────────
  // Returns null if the applicant does not exist or is not financing-ready.
  public query func get_public_profile(
    applicantId : Text,
  ) : async ?PublicProfile.PublicApplicantProfile {
    PublicProfileLib.getPublicProfile(publicProfileState, individualsProfiles, applicantId);
  };
};
