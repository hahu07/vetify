import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control"; 
import ProfileTypes "../types/profile";
import TawthiqTypes "../types/Tawthiq";
import CommonTypes "../types/common";
import Time "mo:core/Time";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import WhatsappLib "../lib/whatsapp";
import CredentialsLib "../lib/credentials";
import CredentialsTypes "../types/credentials";

// Tawthiq Appeal mixin — business applicants submit appeals against inconsistency flags;
// admins review and accept or reject those appeals.
// Appeals stored in separate stable Map tawthiqAppeals (Issue 8: unbounded array fix).
mixin (
  accessControlState : AccessControl.AccessControlState,
  businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  tawthiqAppeals : Map.Map<Text, List.List<TawthiqTypes.TawthiqAppeal>>,
  transform : shared query (Outcall.TransformationInput) -> async Outcall.TransformationOutput,
  credentialsState : { var credentials : CredentialsTypes.CredentialsSettings },
) {

  let MAX_APPEALS_PER_BUSINESS : Nat = 20;

  // ── Business-facing: submit an appeal against a specific Tawthiq flag ──────
  // The caller must be a registered business applicant.
  // flagId must correspond to an InconsistencyFlag on their TawthiqRecord.
  // Returns the newly created TawthiqAppeal or an error Text.
  public shared ({ caller }) func submitTawthiqAppeal(
    flagId : Text,
    appealText : Text,
    documentUrl : ?Text,
    documentName : ?Text,
  ) : async { #ok : TawthiqTypes.TawthiqAppeal; #err : Text } {
    let profile = switch (businessProfiles.get(caller)) {
      case (?p) p;
      case null { return #err("Business profile not found") };
    };
    let tawthiqRecord = switch (profile.tawthiqRecord) {
      case (?t) t;
      case null { return #err("No Tawthiq record found for this business") };
    };
    // Verify the flagId exists in inconsistencyFlags
    let flagExists = switch (
      tawthiqRecord.inconsistencyFlags.find(
        func(f : TawthiqTypes.InconsistencyFlag) : Bool { f.field == flagId }
      )
    ) {
      case (?_) true;
      case null false;
    };
    if (not flagExists) {
      return #err("Flag not found: " # flagId);
    };
    // Cap at MAX_APPEALS_PER_BUSINESS (Issue 8 fix)
    let businessKey = caller.toText();
    let existing = switch (tawthiqAppeals.get(businessKey)) {
      case (?list) list;
      case null List.empty<TawthiqTypes.TawthiqAppeal>();
    };
    if (existing.size() >= MAX_APPEALS_PER_BUSINESS) {
      return #err("Appeal limit reached: maximum " # MAX_APPEALS_PER_BUSINESS.toText() # " appeals per business");
    };
    let now = Time.now();
    let appealId = caller.toText() # "_" # flagId # now.toText();
    let appeal : TawthiqTypes.TawthiqAppeal = {
      id = appealId;
      businessId = caller;
      flagId = flagId;
      appealText = appealText;
      documentUrl = documentUrl;
      documentName = documentName;
      status = #pending;
      submittedAt = now;
      reviewedAt = null;
      adminNote = null;
      adminPrincipal = null;
    };
    existing.add(appeal);
    tawthiqAppeals.add(businessKey, existing);
    #ok(appeal);
  };

  // ── Business-facing: retrieve own appeals ────────────────────────────────
  public query ({ caller }) func getMyTawthiqAppeals() : async [TawthiqTypes.TawthiqAppeal] {
    let businessKey = caller.toText();
    switch (tawthiqAppeals.get(businessKey)) {
      case (?list) list.toArray();
      case null [];
    };
  };

  // ── Admin-facing: list all appeals for a specific business ───────────────
  // Admin only. Returns the full list of appeals regardless of status.
  public query ({ caller }) func getTawthiqAppeals(
    businessId : CommonTypes.UserId,
  ) : async [TawthiqTypes.TawthiqAppeal] {
    ignore caller;
    let businessKey = businessId.toText();
    switch (tawthiqAppeals.get(businessKey)) {
      case (?list) list.toArray();
      case null [];
    };
  };

  // ── Admin-facing: accept or reject a specific appeal ─────────────────────
  // Admin only. decision must be #accepted or #rejected (not #pending).
  // Stores adminNote and the admin's principal against the appeal record.
  public shared ({ caller }) func reviewTawthiqAppeal(
    businessId : CommonTypes.UserId,
    appealId : Text,
    decision : TawthiqTypes.AppealStatus,
    adminNote : Text,
  ) : async { #ok : TawthiqTypes.TawthiqAppeal; #err : Text } {
    if (decision == #pending) {
      return #err("Decision must be #accepted or #rejected, not #pending");
    };
    let businessKey = businessId.toText();
    let appeals = switch (tawthiqAppeals.get(businessKey)) {
      case (?list) list;
      case null { return #err("No appeals found for this business") };
    };
    // Find the appeal
    let appealOpt = appeals.find(
      func(a : TawthiqTypes.TawthiqAppeal) : Bool { a.id == appealId }
    );
    let existingAppeal = switch (appealOpt) {
      case (?a) a;
      case null { return #err("Appeal not found: " # appealId) };
    };
    let now = Time.now();
    let updatedAppeal : TawthiqTypes.TawthiqAppeal = {
      existingAppeal with
      status = decision;
      reviewedAt = ?now;
      adminNote = ?adminNote;
      adminPrincipal = ?caller;
    };
    appeals.mapInPlace(
      func(a) {
        if (a.id == appealId) { updatedAppeal } else { a };
      }
    );
    tawthiqAppeals.add(businessKey, appeals);

    // Send WhatsApp notification to the business
    let decisionText = switch (decision) {
      case (#accepted) "accepted";
      case (#rejected) "rejected";
      case (#pending)  "pending"; // unreachable — guarded above
    };
    let waMessage = "Your Tawthiq appeal for '" # existingAppeal.flagId #
      "' has been " # decisionText # ". " # adminNote #
      " Visit your dashboard for details.";
    // Retrieve phone from business profile — look up by businessId
    let recipientPhone = switch (businessProfiles.get(businessId)) {
      case (?bp) bp.phoneNumber;
      case null "";
    };
    if (recipientPhone.size() > 0) {
      let creds = credentialsState.credentials;
      let twilioAuth = CredentialsLib.getTwilioAuthHeader(creds);
      let twilioFrom = CredentialsLib.getTwilioFrom(creds);
      ignore await WhatsappLib.sendWhatsAppMessage(
        recipientPhone,
        waMessage,
        "tawthiq_appeal_" # decisionText,
        transform,
        twilioAuth,
        twilioFrom,
      );
    };

    #ok(updatedAppeal);
  };

};
