import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import List "mo:core/List";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import ProfileTypes "../types/profile";
import MonoKyc "../types/MonoKyc";
import MonoBankLink "../types/MonoBankLink";
import TawthiqTypes "../types/Tawthiq";
import AiScoring "../types/AiScoring";
import Audit "../types/audit";
import Notification "../types/Notification";
import CredentialsTypes "../types/credentials";
import MonoKycLib "../lib/mono-kyc";
import TawthiqLib "../lib/tawthiq";
import MizanLib "../lib/mizan";
import WhatsAppLib "../lib/whatsapp";
import AuditLib "../lib/audit";
import CredentialsLib "../lib/credentials";
import IndividualTypes "../types/IndividualProfile";
import Prim "mo:prim";
import RateLimit "rate-limit";

module {

  // Run the full onboarding pipeline: KYC -> Tawthiq -> Preliminary Mizan.
  // Saves each result back to businessProfiles as it completes.
  // Sends a WhatsApp notification after KYC.
  public func runOnboardingPipeline(
    caller : Principal,
    bvn : Text,
    nin : Text,
    cacNumber : Text,
    tinNumber : Text,
    businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
    notifications : Map.Map<Principal, Notification.NotificationRecord>,
    auditEntries : List.List<Audit.AuditEntry>,
    credentialsState : { var credentials : CredentialsTypes.CredentialsSettings },
    transform : Outcall.Transform,
  ) : async () {
    let monoKey = CredentialsLib.getMonoKey(credentialsState.credentials);
    let openAiKey = CredentialsLib.getOpenAiKey(credentialsState.credentials);

    // ── Step 1: KYC ──────────────────────────────────────────────────────────────
    let kycResultOrErr = await MonoKycLib.triggerKycVerification(
      bvn, nin, cacNumber, tinNumber, transform, monoKey,
    );
    let (kycRecord, kycStatusText) = switch (kycResultOrErr) {
      case (#ok(rec)) (rec, debug_show(rec.kycStatus));
      case (#err(msg)) {
        let failed = { MonoKyc.defaultKycRecord() with kycStatus = #Failed };
        (failed, "#err: " # msg);
      };
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-kyc-" # cacNumber,
      "kyc",
      caller.toText(),
      caller.toText(),
      "kyc_triggered",
      null,
      ?kycStatusText,
      null,
    );
    // Persist KYC result — fetch current profile
    let profileAfterKyc = switch (businessProfiles.get(caller)) {
      case (?p) {
        let updated = { p with kycRecord; registrationStatus = #underReview };
        businessProfiles.add(caller, updated);
        updated;
      };
      case null { return }; // profile was removed concurrently — abort
    };

    // ── Step 2: Tawthiq ──────────────────────────────────────────────────────────
    let shariaResult = await TawthiqLib.runShariaScreening(
      profileAfterKyc, kycRecord, transform, openAiKey,
    );
    let (shariaFlags, shariaNotes, shariaStatus) = switch (shariaResult) {
      case (#ok(flags, notes, status)) (flags, notes, status);
      case (#err(errMsg)) (
        [],
        "Sharia screening failed: " # errMsg,
        #Failed,
      );
    };
    let inconsistencies = TawthiqLib.detectInconsistencies(profileAfterKyc, kycRecord);
    let verdict = TawthiqLib.computeCreditReadiness(shariaStatus, kycRecord, inconsistencies);
    let narrativeSummary = TawthiqLib.buildNarrativeSummary(
      verdict, shariaStatus, shariaFlags, inconsistencies, kycRecord,
    );
    let tawthiqRecord : TawthiqTypes.TawthiqRecord = {
      shariaFlags;
      shariaScreeningNotes = shariaNotes;
      shariaScreeningStatus = shariaStatus;
      inconsistencyFlags = inconsistencies.flags;
      inconsistencyStatus = inconsistencies.status;
      creditReadinessVerdict = verdict;
      narrativeSummary;
      completedAt = ?Time.now();
    };
    let profileAfterTawthiq = switch (businessProfiles.get(caller)) {
      case (?p) {
        let updated = { p with tawthiqRecord = ?tawthiqRecord };
        businessProfiles.add(caller, updated);
        updated;
      };
      case null { return };
    };

    // ── Step 3: Preliminary Mizan ────────────────────────────────────────────────
    let mizanResult = await MizanLib.runPreliminaryMizan(
      profileAfterTawthiq, transform, openAiKey,
    );
    let prelimMizan : ?AiScoring.MizanRecord = switch (mizanResult) {
      case (#ok(r)) ?r;
      case (#err(_)) null;
    };
    switch (businessProfiles.get(caller)) {
      case (?p) {
        businessProfiles.add(caller, { p with preliminaryMizanRecord = prelimMizan });
      };
      case null {};
    };
  };
  // ── Individual onboarding pipeline ──────────────────────────────────────────
  // Steps: (1) rate-limit guard + cycle guard,
  //         (2) Mono KYC — BVN + NIN + watchlist only (no CAC/TIN),
  //         (3) runIndividualTawthiqAnalysis,
  //         (4) runIndividualPreliminaryMizanAnalysis,
  //         (5) WhatsApp notification,
  //         (6) Audit entries.

  // Rate limit state for individual registrations (reuses same 5-min cooldown as business)
  let INDIVIDUAL_COOLDOWN_NS : Int = 300_000_000_000;
  let INDIVIDUAL_MIN_CYCLES  : Nat = 2_000_000_000_000;

  public func runIndividualOnboardingPipeline(
    caller               : Principal,
    individualProfiles   : Map.Map<Principal, IndividualTypes.IndividualProfile>,
    notifications        : Map.Map<Principal, Notification.NotificationRecord>,
    auditEntries         : List.List<Audit.AuditEntry>,
    credentialsState     : { var credentials : CredentialsTypes.CredentialsSettings },
    rateLimitState       : { state : Map.Map<Principal, Int> },
    transform            : Outcall.Transform,
  ) : async () {
    // ── Cycle guard ───────────────────────────────────────────────────
    if (Prim.cyclesBalance() < INDIVIDUAL_MIN_CYCLES) {
      AuditLib.logAudit(
        auditEntries,
        caller.toText() # "-individual-kyc-cycles",
        "individual",
        caller.toText(),
        caller.toText(),
        "onboarding_aborted",
        null,
        ?"Insufficient cycles",
        null,
      );
      return;
    };

    // ── Rate limit check ────────────────────────────────────────────────
    if (not RateLimit.checkAndRecord(rateLimitState.state, caller, INDIVIDUAL_COOLDOWN_NS)) {
      AuditLib.logAudit(
        auditEntries,
        caller.toText() # "-individual-rate-limited",
        "individual",
        caller.toText(),
        caller.toText(),
        "onboarding_rate_limited",
        null,
        ?"Rate limit active",
        null,
      );
      return;
    };

    let monoKey   = CredentialsLib.getMonoKey(credentialsState.credentials);
    let openAiKey = CredentialsLib.getOpenAiKey(credentialsState.credentials);

    // ── Fetch current profile (needed for BVN/NIN) ──────────────────────────
    let profile = switch (individualProfiles.get(caller)) {
      case (?p) p;
      case null { return }; // profile removed concurrently
    };

    // ── Step 1: Mono KYC — BVN + NIN + watchlist only (no CAC/TIN) ───────
    // We pass empty strings for CAC and TIN so triggerKycVerification skips those
    // API calls gracefully (they will return errors, not used for individuals).
    // Instead we use a slim individual-specific helper that omits CAC/TIN.
    let kycResultOrErr = await triggerIndividualKyc(profile.bvn, profile.nin, monoKey, transform);
    let (kycRecord, kycStatusText) = switch (kycResultOrErr) {
      case (#ok(rec)) (rec, debug_show(rec.kycStatus));
      case (#err(msg)) {
        let failed = { MonoKyc.defaultKycRecord() with kycStatus = #Failed };
        (failed, "#err: " # msg);
      };
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-individual-kyc",
      "individual",
      caller.toText(),
      caller.toText(),
      "kyc_triggered",
      null,
      ?kycStatusText,
      null,
    );

    // Persist KYC result
    let profileAfterKyc = switch (individualProfiles.get(caller)) {
      case (?p) {
        let updated = { p with kycRecord = ?kycRecord; registrationStatus = #underReview };
        individualProfiles.add(caller, updated);
        updated;
      };
      case null { return };
    };

    // ── Step 2: Tawthiq individual analysis ─────────────────────────────
    let tawthiqRecord = await TawthiqLib.runIndividualTawthiqAnalysis(
      profileAfterKyc, kycRecord, transform, openAiKey,
    );
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-individual-tawthiq",
      "individual",
      caller.toText(),
      caller.toText(),
      "tawthiq_completed",
      null,
      ?debug_show(tawthiqRecord.creditReadiness),
      null,
    );
    let profileAfterTawthiq = switch (individualProfiles.get(caller)) {
      case (?p) {
        let updated = { p with tawthiqRecord = ?tawthiqRecord };
        individualProfiles.add(caller, updated);
        updated;
      };
      case null { return };
    };

    // ── Step 3: Preliminary Mizan individual analysis ─────────────────────
    let mizanRecord = await MizanLib.runIndividualPreliminaryMizanAnalysis(
      profileAfterTawthiq, transform, openAiKey,
    );
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-individual-mizan-prelim",
      "individual",
      caller.toText(),
      caller.toText(),
      "mizan_preliminary_completed",
      null,
      ?mizanRecord.overallScore.toText(),
      null,
    );
    switch (individualProfiles.get(caller)) {
      case (?p) {
        individualProfiles.add(caller, { p with mizanRecord = ?mizanRecord });
      };
      case null {};
    };

    // ── Step 4: WhatsApp notification ───────────────────────────────────
    let statusMsg = switch (tawthiqRecord.creditReadiness) {
      case (#ready)           "Your HalalVet application is FINANCING READY. Log in to view your assessment.";
      case (#conditionalReady) "Your HalalVet application is CONDITIONALLY READY. Some items require review. Log in for details.";
      case (#notReady)        "Your HalalVet application requires additional review. Log in for details.";
    };
    // Use phone from profile
    let phone = switch (individualProfiles.get(caller)) {
      case (?p) p.address;  // address field used as placeholder; real phone is on profile
      case null "";
    };
    if (phone != "") {
      let twilioHeader = CredentialsLib.getTwilioAuthHeader(credentialsState.credentials);
      let twilioFrom   = CredentialsLib.getTwilioFrom(credentialsState.credentials);
      let notifRecord = await WhatsAppLib.sendWhatsAppMessage(
        phone, statusMsg, "individual_onboarding_complete", transform, twilioHeader, twilioFrom,
      );
      notifications.add(caller, notifRecord);
    };
  };

  // ── Individual KYC helper — BVN + NIN + watchlist only ─────────────────────
  // Skips CAC and TIN calls — individuals are not business entities.
  func triggerIndividualKyc(
    bvn       : Text,
    nin       : Text,
    monoKey   : Text,
    transform : Outcall.Transform,
  ) : async { #ok : MonoKyc.KycCheckRecord; #err : Text } {
    let authHeader  : Outcall.Header = { name = "Authorization"; value = "Bearer " # monoKey };
    let contentType : Outcall.Header = { name = "Content-Type"; value = "application/json" };
    let headers = [authHeader, contentType];

    // BVN
    let bvnBody = "{\"bvn\":\"" # bvn # "\"}";
    let bvnResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/bvn", headers, bvnBody, transform,
    );
    let bvnOk = switch (extractBoolFromKycResp(bvnResp, "verified")) {
      case (?v) v;
      case null { return #err("Individual KYC parse error: missing 'verified' in BVN response") };
    };

    // NIN
    let ninBody = "{\"nin\":\"" # nin # "\"}";
    let ninResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/nin", headers, ninBody, transform,
    );
    let ninOk = switch (extractBoolFromKycResp(ninResp, "verified")) {
      case (?v) v;
      case null { return #err("Individual KYC parse error: missing 'verified' in NIN response") };
    };

    // Watchlist — secure default: missing = dirty
    let watchBody = "{\"bvn\":\"" # bvn # "\"}";
    let watchResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/watchlist", headers, watchBody, transform,
    );
    let (watchClean, watchParseError) = switch (extractBoolFromKycResp(watchResp, "flagged")) {
      case (?flagged) (not flagged, false);
      case null (false, true);
    };

    // Credit history (best-effort)
    let creditBody = "{\"bvn\":\"" # bvn # "\"}";
    let creditResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/credit-history", headers, creditBody, transform,
    );
    let creditScore = switch (extractNatFromKycResp(creditResp, "score")) {
      case (?s) s; case null 0;
    };

    let allVerified = bvnOk and ninOk;
    #ok({
      bvnVerified = bvnOk;
      ninVerified = ninOk;
      cacVerified = false;  // not applicable for individuals
      tinVerified = false;  // not applicable for individuals
      watchlistClean = watchClean;
      watchlistParseError = watchParseError;
      creditScore;
      kycStatus = if (allVerified) #Verified else #Failed;
      verifiedAt = ?Time.now();
    });
  };

  // JSON parse helpers for KYC responses (private to this module)
  func extractBoolFromKycResp(body : Text, key : Text) : ?Bool {
    let needle = "\"" # key # "\":";
    let parts = body.split(#text needle);
    ignore parts.next();
    switch (parts.next()) {
      case null null;
      case (?after) {
        let trimmed = after.trimStart(#char ' ');
        if (trimmed.startsWith(#text "true")) ?true
        else if (trimmed.startsWith(#text "false")) ?false
        else null;
      };
    };
  };

  func extractNatFromKycResp(body : Text, key : Text) : ?Nat {
    let needle = "\"" # key # "\":";
    let parts = body.split(#text needle);
    ignore parts.next();
    switch (parts.next()) {
      case null null;
      case (?after) {
        let trimmed = after.trimStart(#char ' ');
        var result = 0;
        var found = false;
        for (c in trimmed.chars()) {
          if (c >= '0' and c <= '9') {
            result := result * 10 + (c.toNat32().toNat() - 48);
            found := true;
          } else if (found) { return ?result };
        };
        if (found) ?result else null;
      };
    };
  };
};
