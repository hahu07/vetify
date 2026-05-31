import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Text "mo:core/Text";
import AccessControl "mo:caffeineai-authorization/access-control";
import ProfileTypes "../types/profile";
import IndividualTypes "../types/IndividualProfile";
import Common "../types/common";
import Analytics "../types/Analytics";
import Audit "../types/audit";
import Notification "../types/Notification";
import CredentialsTypes "../types/credentials";
import WhatsAppLib "../lib/whatsapp";
import AuditLib "../lib/audit";
import CredentialsLib "../lib/credentials";
import Outcall "mo:caffeineai-http-outcalls/outcall";

mixin (
  accessControlState : AccessControl.AccessControlState,
  businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  individualsProfiles : Map.Map<Principal, IndividualTypes.IndividualProfile>,
  financierProfiles : Map.Map<Principal, ProfileTypes.FinancierProfile>,
  accountClosureRequests : Map.Map<Text, Audit.AccountClosureRequest>,
  notifications : Map.Map<Principal, Notification.NotificationRecord>,
  auditEntries : List.List<Audit.AuditEntry>,
  credentialsState : { var credentials : CredentialsTypes.CredentialsSettings },
  transformFn : shared query (Outcall.TransformationInput) -> async Outcall.TransformationOutput,
) {

  // ── Admin Analytics ───────────────────────────────────────────────────────────
  public query ({ caller }) func getAdminAnalytics() : async Result.Result<Analytics.AdminAnalytics, Text> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Admin only");
    };
    let totalBusinesses = businessProfiles.size();
    let totalIndividuals = individualsProfiles.size();
    let totalFinanciers = financierProfiles.size();

    var tawthiqPassCount = 0;
    var tawthiqConditionalCount = 0;
    var tawthiqFailCount = 0;
    var mizanScoreSum = 0;
    var mizanScoreCount = 0;
    var financingReadyCount = 0;
    var pendingReviewCount = 0;
    var closedDealsCount = 0;

    for ((_, p) in businessProfiles.entries()) {
      switch (p.tawthiqRecord) {
        case null {};
        case (?rec) {
          switch (rec.creditReadinessVerdict) {
            case (#ready)           { tawthiqPassCount += 1 };
            case (#conditionalReady) { tawthiqConditionalCount += 1 };
            case (#notReady)        { tawthiqFailCount += 1 };
          };
        };
      };
      switch (p.mizanRecord) {
        case null {};
        case (?m) {
          mizanScoreSum += m.overallReadinessScore;
          mizanScoreCount += 1;
        };
      };
      if (p.registrationStatus == #financingReady) { financingReadyCount += 1 };
      if (p.registrationStatus == #underReview)    { pendingReviewCount += 1 };
      if (p.registrationStatus == #approved)       { closedDealsCount += 1 };
    };

    for ((_, p) in individualsProfiles.entries()) {
      switch (p.tawthiqRecord) {
        case null {};
        case (?rec) {
          switch (rec.creditReadiness) {
            case (#ready)           { tawthiqPassCount += 1 };
            case (#conditionalReady) { tawthiqConditionalCount += 1 };
            case (#notReady)        { tawthiqFailCount += 1 };
          };
        };
      };
      switch (p.mizanRecord) {
        case null {};
        case (?m) {
          if (m.stage == #full) {
            mizanScoreSum += m.overallScore;
            mizanScoreCount += 1;
          };
        };
      };
      if (p.registrationStatus == #financingReady) { financingReadyCount += 1 };
      if (p.registrationStatus == #underReview)    { pendingReviewCount += 1 };
      if (p.registrationStatus == #approved)       { closedDealsCount += 1 };
    };

    var activeFinancierCount = 0;
    for ((_, f) in financierProfiles.entries()) {
      if (f.financierStatus == #Active) { activeFinancierCount += 1 };
    };

    let averageMizanScore = if (mizanScoreCount == 0) 0 else mizanScoreSum / mizanScoreCount;

    #ok({
      totalBusinesses;
      totalIndividuals;
      totalFinanciers;
      tawthiqPassCount;
      tawthiqConditionalCount;
      tawthiqFailCount;
      averageMizanScore;
      financingReadyCount;
      activeFinancierCount;
      pendingReviewCount;
      closedDealsCount;
    });
  };

  // ── Admin: list all individual applicants (paginated) ────────────────────────
  public query ({ caller }) func adminListIndividuals(
    page : Nat,
    pageSize : Nat,
  ) : async Result.Result<{ items : [IndividualTypes.IndividualSummary]; total : Nat }, Text> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Admin only");
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-list-individuals-" # debug_show(page),
      "system",
      "individual_list",
      caller.toText(),
      "admin_list_access",
      null,
      ?("page=" # debug_show(page)),
      null,
    );
    let effectivePageSize = if (pageSize == 0) 20 else if (pageSize > 100) 100 else pageSize;
    let all = individualsProfiles.values().toArray().map(
      func(p) {
        {
          id = p.id;
          fullName = p.fullName;
          registrationStatus = p.registrationStatus;
          riskLevel = switch (p.mizanRecord) {
            case (?m) m.riskLevel;
            case null #pending;
          };
          financingPurpose = p.financingPurpose;
          amountSought = p.amountSought;
          createdAt = p.createdAt;
        };
      }
    );
    let total = all.size();
    let start = page * effectivePageSize;
    if (start >= total) {
      return #ok({ items = []; total });
    };
    let end = if (start + effectivePageSize > total) total else start + effectivePageSize;
    #ok({ items = all.sliceToArray(start, end); total });
  };

  // ── Admin: get full individual profile ────────────────────────────────────────
  public shared ({ caller }) func adminGetIndividual(
    id : Common.UserId,
  ) : async Result.Result<IndividualTypes.IndividualProfile, Text> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Admin only");
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-read-individual-" # id.toText(),
      "individual",
      id.toText(),
      caller.toText(),
      "admin_profile_read",
      null,
      ?("Admin read individual profile for " # id.toText()),
      null,
    );
    switch (individualsProfiles.get(id)) {
      case null #err("Individual not found");
      case (?p) #ok(p);
    };
  };

  // ── Admin: mark individual as financing-ready ─────────────────────────────────
  public shared ({ caller }) func adminSetIndividualFinancingReady(
    id : Common.UserId,
  ) : async Result.Result<(), Text> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Admin only");
    };
    switch (individualsProfiles.get(id)) {
      case null return #err("Individual not found");
      case (?p) {
        if (p.registrationStatus == #kycInProgress) {
          return #err("KYC in progress: cannot act on this profile yet");
        };
        let updated = { p with registrationStatus = #financingReady; updatedAt = Time.now() };
        individualsProfiles.add(id, updated);
        AuditLib.logAudit(
          auditEntries,
          caller.toText() # "-individual-financing-ready-" # id.toText(),
          "individual",
          id.toText(),
          caller.toText(),
          "financing_ready_toggled",
          ?debug_show(p.registrationStatus),
          ?("#financingReady"),
          null,
        );
        let creds = credentialsState.credentials;
        let msg = "HalalVet: Congratulations! Your profile has been marked financing-ready. You may now link your bank account.";
        ignore await WhatsAppLib.sendWhatsAppMessage(
          "", msg, "financing_ready", transformFn,
          CredentialsLib.getTwilioAuthHeader(creds),
          CredentialsLib.getTwilioFrom(creds),
        );
        #ok(());
      };
    };
  };

  // ── Admin: change individual registration status ──────────────────────────────
  public shared ({ caller }) func adminChangeIndividualStatus(
    id : Common.UserId,
    status : Common.RegistrationStatus,
  ) : async Result.Result<(), Text> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Admin only");
    };
    switch (individualsProfiles.get(id)) {
      case null return #err("Individual not found");
      case (?p) {
        if (p.registrationStatus == #kycInProgress) {
          return #err("KYC in progress: cannot act on this profile yet");
        };
        let oldStatus = p.registrationStatus;
        let updated = { p with registrationStatus = status; updatedAt = Time.now() };
        individualsProfiles.add(id, updated);
        AuditLib.logAudit(
          auditEntries,
          caller.toText() # "-individual-status-" # id.toText(),
          "individual",
          id.toText(),
          caller.toText(),
          "status_change",
          ?debug_show(oldStatus),
          ?debug_show(status),
          null,
        );
        let creds = credentialsState.credentials;
        let statusText = debug_show(status);
        let msg = "HalalVet: Your application status has been updated to: " # statusText;
        ignore await WhatsAppLib.sendWhatsAppMessage(
          "", msg, statusText, transformFn,
          CredentialsLib.getTwilioAuthHeader(creds),
          CredentialsLib.getTwilioFrom(creds),
        );
        #ok(());
      };
    };
  };

  // ── Admin: process account closure request ────────────────────────────────────
  public shared ({ caller }) func adminProcessAccountClosure(
    requestId : Text,
    approve : Bool,
    note : Text,
  ) : async Result.Result<(), Text> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Admin only");
    };
    switch (accountClosureRequests.get(requestId)) {
      case null return #err("Account closure request not found");
      case (?req) {
        let newStatus : { #pending; #approved; #rejected } = if (approve) #approved else #rejected;
        let updated : Audit.AccountClosureRequest = {
          req with
          status = newStatus;
          processedAt = ?Time.now();
          adminNote = ?(note);
        };
        accountClosureRequests.add(requestId, updated);
        // If approved, mark individual profile as closed
        if (approve) {
          switch (individualsProfiles.get(req.principalId)) {
            case null {};
            case (?p) {
              individualsProfiles.add(req.principalId, {
                p with
                accountClosureRequestedAt = ?Time.now();
                updatedAt = Time.now();
              });
            };
          };
        };
        // WhatsApp notification to applicant
        let creds = credentialsState.credentials;
        let outcome = if (approve) "approved" else "rejected";
        let msg = "HalalVet: Your account closure request has been " # outcome # ". " # note;
        ignore await WhatsAppLib.sendWhatsAppMessage(
          "", msg, "account_closure_" # outcome, transformFn,
          CredentialsLib.getTwilioAuthHeader(creds),
          CredentialsLib.getTwilioFrom(creds),
        );
        #ok(());
      };
    };
  };

  // ── Admin: get all account closure requests (paginated) ───────────────────────
  public query ({ caller }) func getAccountClosureRequests(
    page : Nat,
    pageSize : Nat,
  ) : async Result.Result<{ items : [Audit.AccountClosureRequest]; total : Nat }, Text> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Admin only");
    };
    let effectivePageSize = if (pageSize == 0) 20 else if (pageSize > 100) 100 else pageSize;
    let all = accountClosureRequests.values().toArray();
    let total = all.size();
    let start = page * effectivePageSize;
    if (start >= total) {
      return #ok({ items = []; total });
    };
    let end = if (start + effectivePageSize > total) total else start + effectivePageSize;
    #ok({ items = all.sliceToArray(start, end); total });
  };
};
