import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Result "mo:core/Result";
import AccessControl "mo:caffeineai-authorization/access-control";
import ProfileTypes "../types/profile";
import DocTypes "../types/document";
import Common "../types/common";
import Notification "../types/Notification";
import Audit "../types/audit";
import AdminLib "../lib/admin";
import DocLib "../lib/document";
import ProfileLib "../lib/profile";
import WhatsAppLib "../lib/whatsapp";
import AuditLib "../lib/audit";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import CredentialsLib "../lib/credentials";
import CredentialsTypes "../types/credentials";

mixin (
  accessControlState : AccessControl.AccessControlState,
  businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  financierProfiles : Map.Map<Principal, ProfileTypes.FinancierProfile>,
  documents : Map.Map<(Principal, DocTypes.DocumentType), DocTypes.DocumentRecord>,
  notifications : Map.Map<Principal, Notification.NotificationRecord>,
  auditEntries : List.List<Audit.AuditEntry>,
  transformFn : shared query (Outcall.TransformationInput) -> async Outcall.TransformationOutput,
  credentialsState : { var credentials : CredentialsTypes.CredentialsSettings },
) {

  // List all business applicant registrations (paginated)
  // NDPR: access to personal data by data processors must be logged.
  public shared ({ caller }) func adminListBusinesses(
    page : Nat,
    pageSize : Nat,
  ) : async AdminLib.BusinessPage {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-list-businesses-" # debug_show(page),
      "system",
      "business_list",
      caller.toText(),
      "admin_list_access",
      null,
      ?("page=" # debug_show(page)),
      null,
    );
    AdminLib.listBusinessProfiles(businessProfiles, page, pageSize);
  };

  // List all financier registrations (paginated)
  // NDPR: access to personal data by data processors must be logged.
  public shared ({ caller }) func adminListFinanciers(
    page : Nat,
    pageSize : Nat,
  ) : async AdminLib.FinancierPage {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-list-financiers-" # debug_show(page),
      "system",
      "financier_list",
      caller.toText(),
      "admin_list_access",
      null,
      ?("page=" # debug_show(page)),
      null,
    );
    AdminLib.listFinancierProfiles(financierProfiles, page, pageSize);
  };

  // View full business profile.
  // NDPR: access to personal data (KYC details, bank data, scores) must be logged.
  public shared ({ caller }) func adminGetBusiness(
    userId : Principal,
  ) : async ?ProfileTypes.BusinessProfile {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-read-business-" # userId.toText(),
      "business",
      userId.toText(),
      caller.toText(),
      "admin_profile_read",
      null,
      ?("Admin read business profile for " # userId.toText()),
      null,
    );
    businessProfiles.get(userId);
  };

  // Toggle financing-ready flag for a business applicant (with audit log)
  public shared ({ caller }) func adminSetFinancingReady(
    userId : Principal,
    value : Bool,
  ) : async Bool {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    // ISSUE 3 FIX: reject action while KYC pipeline is still running
    switch (businessProfiles.get(userId)) {
      case (?p) {
        if (p.registrationStatus == #kycInProgress) {
          Runtime.trap("KYC in progress: cannot act on this profile yet");
        };
      };
      case null {};
    };
    let oldValue = switch (businessProfiles.get(userId)) {
      case (?p) ?debug_show(p.financingReady);
      case null null;
    };
    let result = ProfileLib.setFinancingReady(businessProfiles, userId, value);
    if (result) {
      AuditLib.logAudit(
        auditEntries,
        caller.toText() # "-financing-ready-" # userId.toText(),
        "business",
        userId.toText(),
        caller.toText(),
        "financing_ready_toggled",
        oldValue,
        ?debug_show(value),
        null,
      );
    };
    result;
  };

  // Update business registration status and send WhatsApp notification (with audit log)
  public shared ({ caller }) func updateBusinessStatus(
    userId : Principal,
    status : Common.RegistrationStatus,
    reason : ?Text,
  ) : async Bool {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    switch (businessProfiles.get(userId)) {
      case (null) { false };
      case (?p) {
        // ISSUE 3 FIX: reject status changes while KYC pipeline is still running
        if (p.registrationStatus == #kycInProgress) {
          Runtime.trap("KYC in progress: cannot act on this profile yet");
        };
        let oldStatus = debug_show(p.registrationStatus);
        let financingReady = status == #financingReady or p.financingReady;
        businessProfiles.add(userId, { p with registrationStatus = status; financingReady });
        let statusText = switch (status) {
          case (#pending) "pending";
          case (#kycInProgress) "KYC in progress";
          case (#underReview) "under review";
          case (#financingReady) "financing-ready";
          case (#approved) "approved";
          case (#rejected) "rejected";
        };
        AuditLib.logAudit(
          auditEntries,
          caller.toText() # "-status-" # userId.toText(),
          "business",
          userId.toText(),
          caller.toText(),
          "status_change",
          ?oldStatus,
          ?statusText,
          reason,
        );
        let msg = "HalalVet: Your business \"" # p.businessName # "\" application status has been updated to: " # statusText # ".";
        let twilioAuthHeader = CredentialsLib.buildTwilioAuthHeader(credentialsState.credentials);
        let twilioCredentials = CredentialsLib.getTwilioCredentials(credentialsState.credentials);
        let twilioFrom = twilioCredentials.accountSid # "|" # twilioCredentials.whatsappFrom;
        let note = await WhatsAppLib.sendWhatsAppMessage(p.phoneNumber, msg, statusText, transformFn, twilioAuthHeader, twilioFrom);
        notifications.add(userId, note);
        true;
      };
    };
  };

  // Set financier status (with audit log)
  public shared ({ caller }) func setFinancierStatus(
    financierId : Principal,
    status : ProfileTypes.FinancierStatus,
    reason : ?Text,
  ) : async { #ok : (); #err : Text } {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    let oldValue = switch (financierProfiles.get(financierId)) {
      case (?p) ?debug_show(p.financierStatus);
      case null null;
    };
    let ok = AdminLib.setFinancierStatus(financierProfiles, financierId, status);
    if (not ok) {
      return #err("Financier not found");
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-financier-status-" # financierId.toText(),
      "financier",
      financierId.toText(),
      caller.toText(),
      "status_change",
      oldValue,
      ?debug_show(status),
      reason,
    );
    #ok(());
  };

  // Update business profile fields (admin)
  public shared ({ caller }) func updateBusinessProfile(
    userId : Principal,
    updates : ProfileTypes.BusinessProfileUpdate,
  ) : async { #ok : (); #err : Text } {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    ProfileLib.updateBusinessProfile(businessProfiles, userId, updates);
  };

  // Admin: get document list for any user.
  // NDPR: access to personal documents must be logged.
  public shared ({ caller }) func adminGetDocumentsForUser(
    userId : Principal,
  ) : async [DocTypes.DocumentRecord] {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-read-docs-" # userId.toText(),
      "business",
      userId.toText(),
      caller.toText(),
      "admin_documents_read",
      null,
      ?("Admin read documents for " # userId.toText()),
      null,
    );
    DocLib.listDocuments(documents, userId);
  };
};
