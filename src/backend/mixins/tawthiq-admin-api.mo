import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import ProfileTypes "../types/profile";
import TawthiqAdminTypes "../types/TawthiqAdmin";
import TawthiqTypes "../types/Tawthiq";
import Common "../types/common";

mixin (
  accessControlState : AccessControl.AccessControlState,
  businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  tawthiqAdminNotes : Map.Map<Common.UserId, Text>,
) {

  // ── Tawthiq overview statistics ───────────────────────────────────────
  public query ({ caller }) func getTawthiqOverviewStats() : async TawthiqAdminTypes.TawthiqOverviewStats {
    ignore caller;
    var totalProcessed = 0;
    var passedCount = 0;
    var conditionalCount = 0;
    var notReadyCount = 0;
    var pendingCount = 0;
    for ((_, profile) in businessProfiles.entries()) {
      switch (profile.tawthiqRecord) {
        case null { pendingCount += 1 };
        case (?rec) {
          totalProcessed += 1;
          switch (rec.creditReadinessVerdict) {
            case (#ready)          { passedCount += 1 };
            case (#conditionalReady) { conditionalCount += 1 };
            case (#notReady)       { notReadyCount += 1 };
          };
        };
      };
    };
    { totalProcessed; passedCount; conditionalCount; notReadyCount; pendingCount };
  };

  // ── Paginated list of businesses with conditional-ready or inconsistency flags ──
  public query ({ caller }) func getTawthiqPendingReviews(
    page : Nat,
    pageSize : Nat,
  ) : async { items : [ProfileTypes.BusinessProfile]; totalCount : Nat; page : Nat; pageSize : Nat } {
    ignore caller;
    let pending = List.empty<ProfileTypes.BusinessProfile>();
    for ((_, profile) in businessProfiles.entries()) {
      switch (profile.tawthiqRecord) {
        case null {};
        case (?rec) {
          let isPending = rec.inconsistencyFlags.size() > 0 or rec.creditReadinessVerdict == #conditionalReady;
          if (isPending) { pending.add(profile) };
        };
      };
    };
    let totalCount = pending.size();
    let safePageSize = if (pageSize == 0) { 20 } else { pageSize };
    let offset = if (page == 0) { 0 } else { (page - 1) * safePageSize };
    let items = Array.fromIter(
      pending.values()
    );
    let sliced = if (offset >= totalCount) {
      []
    } else {
      let endIdx = if (offset + safePageSize > totalCount) { totalCount } else { offset + safePageSize };
      Array.tabulate(endIdx - offset, func i = items[offset + i])
    };
    { items = sliced; totalCount; page; pageSize = safePageSize };
  };

  // ── Paginated completed Tawthiq assessments with optional filters ────
  public query ({ caller }) func getTawthiqCompletedAssessments(
    page : Nat,
    pageSize : Nat,
    verdictFilter : ?Text,
    searchQuery : ?Text,
  ) : async { items : [ProfileTypes.BusinessProfile]; totalCount : Nat; page : Nat; pageSize : Nat } {
    ignore caller;
    let completed = List.empty<ProfileTypes.BusinessProfile>();
    for ((_, profile) in businessProfiles.entries()) {
      switch (profile.tawthiqRecord) {
        case null {};
        case (?rec) {
          // Apply verdict filter
          let verdictMatch = switch (verdictFilter) {
            case null { true };
            case (?f) {
              switch (rec.creditReadinessVerdict) {
                case (#ready)          { f == "ready" };
                case (#conditionalReady) { f == "conditionalReady" };
                case (#notReady)       { f == "notReady" };
              };
            };
          };
          // Apply search filter (case-insensitive businessName match)
          let searchMatch = switch (searchQuery) {
            case null { true };
            case (?q) { profile.businessName.toLower().contains(#text (q.toLower())) };
          };
          if (verdictMatch and searchMatch) { completed.add(profile) };
        };
      };
    };
    // Sort by completedAt descending (most recent first)
    let arr = Array.fromIter(completed.values());
    let sorted = arr.sort(
      func(a, b) {
        let tsA : Int = switch (a.tawthiqRecord) {
          case null { 0 };
          case (?r) { switch (r.completedAt) { case null { 0 }; case (?t) { t } } };
        };
        let tsB : Int = switch (b.tawthiqRecord) {
          case null { 0 };
          case (?r) { switch (r.completedAt) { case null { 0 }; case (?t) { t } } };
        };
        // descending: larger timestamp first
        Int.compare(tsB, tsA)
      }
    );
    let totalCount = sorted.size();
    let safePageSize = if (pageSize == 0) { 20 } else { pageSize };
    let offset = if (page == 0) { 0 } else { (page - 1) * safePageSize };
    let sliced = if (offset >= totalCount) {
      []
    } else {
      let endIdx = if (offset + safePageSize > totalCount) { totalCount } else { offset + safePageSize };
      Array.tabulate(endIdx - offset, func i = sorted[offset + i])
    };
    { items = sliced; totalCount; page; pageSize = safePageSize };
  };

  // ── Save an admin annotation note for a specific business ───────────
  public shared ({ caller }) func saveTawthiqAdminNote(
    businessUserId : Common.UserId,
    note : Text,
  ) : async { #ok : (); #err : Text } {
    ignore caller;
    switch (businessProfiles.get(businessUserId)) {
      case null { #err("Business not found") };
      case (?_) {
        tawthiqAdminNotes.add(businessUserId, note);
        #ok(())
      };
    };
  };

  // ── Retrieve the admin note for a business (if any) ─────────────────
  public query ({ caller }) func getTawthiqAdminNote(
    businessUserId : Common.UserId,
  ) : async ?Text {
    ignore caller;
    tawthiqAdminNotes.get(businessUserId);
  };
};
