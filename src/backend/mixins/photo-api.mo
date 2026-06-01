import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import ProfileTypes "../types/profile";
import IndividualTypes "../types/IndividualProfile";

/// photo-api mixin
/// Exposes setProfilePhoto and getProfilePhoto for all three profile types.
/// Actual file upload uses MixinObjectStorage; this mixin only stores the
/// resulting URL on the caller's profile record.
mixin (
  accessControlState : AccessControl.AccessControlState,
  businessProfiles   : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  financierProfiles  : Map.Map<Principal, ProfileTypes.FinancierProfile>,
  individualsProfiles : Map.Map<Principal, IndividualTypes.IndividualProfile>,
) {

  /// Set the profile photo URL for the calling user.
  /// Looks up the caller's profile across all three tables and updates photoUrl.
  /// Returns #ok on success, #err if the caller has no registered profile.
  public shared ({ caller }) func setProfilePhoto(photoUrl : Text) : async { #ok; #err : Text } {
    switch (businessProfiles.get(caller)) {
      case (?bp) {
        businessProfiles.add(caller, { bp with photoUrl = ?photoUrl });
        return #ok;
      };
      case null {};
    };
    switch (financierProfiles.get(caller)) {
      case (?fp) {
        financierProfiles.add(caller, { fp with photoUrl = ?photoUrl });
        return #ok;
      };
      case null {};
    };
    switch (individualsProfiles.get(caller)) {
      case (?ip) {
        individualsProfiles.add(caller, { ip with photoUrl = ?photoUrl });
        return #ok;
      };
      case null {};
    };
    #err("No registered profile found for caller");
  };

  /// Get the profile photo URL for any user by principal.
  /// Searches all three profile tables in order: business → financier → individual.
  /// Returns null if the user has no profile or has not set a photo.
  public query func getProfilePhoto(userId : Principal) : async ?Text {
    switch (businessProfiles.get(userId)) {
      case (?bp) { return bp.photoUrl };
      case null {};
    };
    switch (financierProfiles.get(userId)) {
      case (?fp) { return fp.photoUrl };
      case null {};
    };
    switch (individualsProfiles.get(userId)) {
      case (?ip) { return ip.photoUrl };
      case null {};
    };
    null;
  };
};
