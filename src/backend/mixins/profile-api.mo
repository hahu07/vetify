import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import ProfileTypes "../types/profile";
import TawthiqTypes "../types/Tawthiq";
import Common "../types/common";
import ProfileLib "../lib/profile";
import Result "mo:core/Result";
import FinExt "../types/FinancierExtended";

mixin (
  accessControlState : AccessControl.AccessControlState,
  businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  financierProfiles : Map.Map<Principal, ProfileTypes.FinancierProfile>,
) {

  // ── Financier registration ─────────────────────────────────────────────

  public shared ({ caller }) func registerAsFinancier(
    institutionName : Text,
    licenseNumber : Text,
    contactPerson : Text,
    email : Text,
    phone : Text,
    areasOfFinancing : [Text],
    // ── Extended v2 fields ────────────────────────────────────────────
    financierType : FinExt.FinancierType,
    institutionDetails : ?FinExt.InstitutionDetails,
    individualDetails : ?FinExt.IndividualDetails,
    groupDetails : ?FinExt.GroupDetails,
  ) : async ProfileTypes.FinancierProfile {
    AccessControl.assignRole(accessControlState, caller, caller, #user);
    ProfileLib.registerFinancier(
      financierProfiles, caller, institutionName, licenseNumber,
      contactPerson, email, phone, areasOfFinancing,
      financierType, institutionDetails, individualDetails, groupDetails,
    );
  };

  // ── Self-profile getters ───────────────────────────────────────────────

  public query ({ caller }) func getMyBusinessProfile() : async ?ProfileTypes.BusinessProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    ProfileLib.getBusinessProfile(businessProfiles, caller);
  };

  public query ({ caller }) func getMyFinancierProfile() : async ?ProfileTypes.FinancierProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    ProfileLib.getFinancierProfile(financierProfiles, caller);
  };

  // Update caller's own business profile
  public shared ({ caller }) func updateMyProfile(
    updates : ProfileTypes.BusinessProfileUpdate,
  ) : async { #ok : (); #err : Text } {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    ProfileLib.updateBusinessProfile(businessProfiles, caller, updates);
  };

  // Tawthiq (التوثيق) result for the applicant dashboard (self or admin caller)
  public query ({ caller }) func getTawthiqRecord(
    userId : Common.UserId,
  ) : async ?TawthiqTypes.TawthiqRecord {
    // Callers can read their own record; admins can read any record
    if (caller != userId and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized");
    };
    switch (businessProfiles.get(userId)) {
      case (?p) p.tawthiqRecord;
      case null null;
    };
  };
};
