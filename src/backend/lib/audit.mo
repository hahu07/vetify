import List "mo:core/List";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Audit "../types/audit";

module {
  // Append a new audit entry to the shared list
  public func logAudit(
    entries : List.List<Audit.AuditEntry>,
    id : Text,
    entityType : Text,
    entityId : Text,
    changedBy : Text,
    action : Text,
    oldValue : ?Text,
    newValue : ?Text,
    reason : ?Text,
  ) {
    entries.add({
      id;
      entityType;
      entityId;
      changedBy;
      action;
      oldValue;
      newValue;
      reason;
      timestamp = Time.now();
    });
  };

  // Return paginated entries sorted newest-first (all entries)
  public func getPage(
    entries : List.List<Audit.AuditEntry>,
    page : Nat,
    pageSize : Nat,
  ) : Audit.AuditPage {
    let all = entries.toArray();
    // Reverse so newest-first
    let reversed = all.reverse();
    let total = reversed.size();
    // Cap at 100 per page (ISSUE 10)
    let safeSize = if (pageSize == 0) 20 else if (pageSize > 100) 100 else pageSize;
    let start = page * safeSize;
    if (start >= total) {
      return { entries = []; total; page };
    };
    let end = if (start + safeSize > total) total else start + safeSize;
    { entries = reversed.sliceToArray(start, end); total; page };
  };

  // Return paginated entries for a specific entity, newest-first
  public func getPageForEntity(
    entries : List.List<Audit.AuditEntry>,
    entityId : Text,
    page : Nat,
    pageSize : Nat,
  ) : Audit.AuditPage {
    let all = entries.toArray();
    let filtered = all.reverse().filter(func(e : Audit.AuditEntry) : Bool {
      e.entityId == entityId
    });
    let total = filtered.size();
    // Cap at 100 per page (ISSUE 10)
    let safeSize = if (pageSize == 0) 20 else if (pageSize > 100) 100 else pageSize;
    let start = page * safeSize;
    if (start >= total) {
      return { entries = []; total; page };
    };
    let end = if (start + safeSize > total) total else start + safeSize;
    { entries = filtered.sliceToArray(start, end); total; page };
  };
};
