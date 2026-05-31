import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import ProfileTypes "../types/profile";
import PaginationLib "../lib/pagination";
import ProfileLib "../lib/profile";

mixin (
  accessControlState : AccessControl.AccessControlState,
  businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  financierProfiles : Map.Map<Principal, ProfileTypes.FinancierProfile>,
) {

  // Guard: caller must be an active financier
  func requireActiveFinancier(caller : Principal) {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    switch (financierProfiles.get(caller)) {
      case (?fp) {
        switch (fp.financierStatus) {
          case (#Active) {};
          case (_) Runtime.trap("Financier account is not active");
        };
      };
      case null Runtime.trap("Financier profile not found");
    };
  };

  // List only financing-ready business applicants (paginated, active financier only)
  public query ({ caller }) func listFinancingReadyApplicants(
    page : Nat,
    pageSize : Nat,
  ) : async PaginationLib.Page<ProfileTypes.ApplicantSummary> {
    requireActiveFinancier(caller);
    let all = ProfileLib.listFinancingReadyApplicants(businessProfiles);
    PaginationLib.paginate(all, page, pageSize);
  };

  // Get full business applicant profile (financing-ready only)
  public query ({ caller }) func getFinancingReadyBusiness(
    userId : Principal,
  ) : async ?ProfileTypes.BusinessProfile {
    requireActiveFinancier(caller);
    switch (businessProfiles.get(userId)) {
      case (?p) if (p.financingReady) ?p else null;
      case null null;
    };
  };
};
