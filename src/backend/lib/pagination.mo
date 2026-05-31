import List "mo:core/List";
import Array "mo:core/Array";

module {
  // Generic paginated result type
  public type Page<T> = {
    items : [T];
    total : Nat;
    page : Nat;
    pageSize : Nat;
  };

  // Paginate an array; page is 0-indexed; pageSize is capped at 100
  public func paginate<T>(items : [T], page : Nat, pageSize : Nat) : Page<T> {
    // ISSUE 10 FIX: hard cap at 100 records per page to prevent canister DoS
    let effectivePageSize = if (pageSize == 0) 20 else if (pageSize > 100) 100 else pageSize;
    let total = items.size();
    let start = page * effectivePageSize;
    if (start >= total) {
      return { items = []; total; page; pageSize = effectivePageSize };
    };
    let end = if (start + effectivePageSize > total) total else start + effectivePageSize;
    { items = items.sliceToArray(start, end); total; page; pageSize = effectivePageSize };
  };
};
