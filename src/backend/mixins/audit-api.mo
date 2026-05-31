import List "mo:core/List";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Audit "../types/audit";
import AuditLib "../lib/audit";

mixin (
  accessControlState : AccessControl.AccessControlState,
  auditEntries : List.List<Audit.AuditEntry>,
) {

  // Admin: get all audit entries paginated, sorted newest-first
  public query ({ caller }) func getAuditLog(
    page : Nat,
    pageSize : Nat,
  ) : async Audit.AuditPage {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    AuditLib.getPage(auditEntries, page, pageSize);
  };

  // Admin: get audit entries for a specific entity, paginated
  public query ({ caller }) func getAuditLogForEntity(
    entityId : Text,
    page : Nat,
    pageSize : Nat,
  ) : async Audit.AuditPage {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    AuditLib.getPageForEntity(auditEntries, entityId, page, pageSize);
  };
};
