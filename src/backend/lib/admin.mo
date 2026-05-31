import Map "mo:core/Map";
import Principal "mo:core/Principal";
import ProfileTypes "../types/profile";
import List "mo:core/List";
import PaginationLib "pagination";

module {
  // Paginated type aliases
  public type BusinessPage  = PaginationLib.Page<ProfileTypes.BusinessProfile>;
  public type FinancierPage = PaginationLib.Page<ProfileTypes.FinancierProfile>;

  // Collect all business profiles as array
  func allBusinesses(
    profiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  ) : [ProfileTypes.BusinessProfile] {
    let result = List.empty<ProfileTypes.BusinessProfile>();
    for ((_, p) in profiles.entries()) { result.add(p) };
    result.toArray();
  };

  // Collect all financier profiles as array
  func allFinanciers(
    profiles : Map.Map<Principal, ProfileTypes.FinancierProfile>,
  ) : [ProfileTypes.FinancierProfile] {
    let result = List.empty<ProfileTypes.FinancierProfile>();
    for ((_, p) in profiles.entries()) { result.add(p) };
    result.toArray();
  };

  // List all business applicant profiles (paginated)
  public func listBusinessProfiles(
    profiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
    page : Nat,
    pageSize : Nat,
  ) : BusinessPage {
    PaginationLib.paginate(allBusinesses(profiles), page, pageSize);
  };

  // List all financier profiles (paginated)
  public func listFinancierProfiles(
    profiles : Map.Map<Principal, ProfileTypes.FinancierProfile>,
    page : Nat,
    pageSize : Nat,
  ) : FinancierPage {
    PaginationLib.paginate(allFinanciers(profiles), page, pageSize);
  };

  // Set financier status
  public func setFinancierStatus(
    profiles : Map.Map<Principal, ProfileTypes.FinancierProfile>,
    userId : Principal,
    status : ProfileTypes.FinancierStatus,
  ) : Bool {
    switch (profiles.get(userId)) {
      case (null) { false };
      case (?p) {
        profiles.add(userId, { p with financierStatus = status });
        true;
      };
    };
  };
};
