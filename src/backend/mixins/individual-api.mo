import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Prim "mo:prim";
import AccessControl "mo:caffeineai-authorization/access-control";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import IndividualTypes "../types/IndividualProfile";
import Common "../types/common";
import MonoKyc "../types/MonoKyc";
import MonoBankLink "../types/MonoBankLink";
import Audit "../types/audit";
import Notification "../types/Notification";
import CredentialsTypes "../types/credentials";
import BizExt "../types/BusinessExtended";
import MonoKycLib "../lib/mono-kyc";
import TawthiqLib "../lib/tawthiq";
import MizanLib "../lib/mizan";
import MonoConnectLib "../lib/mono-connect";
import WhatsAppLib "../lib/whatsapp";
import AuditLib "../lib/audit";
import CredentialsLib "../lib/credentials";
import RateLimit "../lib/rate-limit";

mixin (
  accessControlState : AccessControl.AccessControlState,
  individualsProfiles : Map.Map<Principal, IndividualTypes.IndividualProfile>,
  notifications : Map.Map<Principal, Notification.NotificationRecord>,
  auditEntries : List.List<Audit.AuditEntry>,
  accountClosureRequests : Map.Map<Text, Audit.AccountClosureRequest>,
  credentialsState : { var credentials : CredentialsTypes.CredentialsSettings },
  rateLimitState : RateLimit.RateLimitState,
  transformFn : shared query (Outcall.TransformationInput) -> async Outcall.TransformationOutput,
) {

  let INDIVIDUAL_REGISTRATION_COOLDOWN_NS : Int = 300_000_000_000;
  let MIN_CYCLES : Nat = 2_000_000_000_000;

  func individualValidateBvn(s : Text) : Bool {
    s.size() == 11 and
    s.chars().toArray().find(func(c) { not (c >= '0' and c <= '9') }) == null
  };

  func individualValidateNin(s : Text) : Bool {
    s.size() == 11 and
    s.chars().toArray().find(func(c) { not (c >= '0' and c <= '9') }) == null
  };

  // ── Submit individual registration ────────────────────────────────────────────
  public shared ({ caller }) func submitIndividualRegistration(
    fullName : Text,
    bvn : Text,
    nin : Text,
    dateOfBirth : Text,
    address : Text,
    occupation : Text,
    employmentStatus : IndividualTypes.EmploymentStatus,
    employerName : ?Text,
    monthlyIncome : Nat,
    incomeSource : IndividualTypes.IncomeSource,
    financingPurpose : IndividualTypes.FinancingPurpose,
    financingPurposeOther : ?Text,
    amountSought : Nat,
    preferredInstrument : BizExt.PreferredInstrument,
    termsAcceptedAt : ?Common.Timestamp,
  ) : async Result.Result<Text, Text> {
    if (Prim.cyclesBalance() < MIN_CYCLES) {
      return #err("Insufficient cycles: admin must top up canister before processing");
    };
    if (not RateLimit.checkAndRecord(rateLimitState, caller, INDIVIDUAL_REGISTRATION_COOLDOWN_NS)) {
      return #err("Rate limit: please wait 5 minutes before submitting another registration");
    };
    if (fullName.size() == 0) {
      return #err("Full name cannot be empty");
    };
    if (not individualValidateBvn(bvn)) {
      return #err("Invalid BVN: must be exactly 11 digits");
    };
    if (not individualValidateNin(nin)) {
      return #err("Invalid NIN: must be exactly 11 digits");
    };
    if (amountSought == 0) {
      return #err("Financing amount sought must be greater than 0");
    };
    if (monthlyIncome == 0) {
      return #err("Monthly income must be greater than 0");
    };

    AccessControl.assignRole(accessControlState, caller, caller, #user);

    let profile : IndividualTypes.IndividualProfile = {
      id = caller;
      fullName;
      bvn;
      nin;
      dateOfBirth;
      address;
      occupation;
      employmentStatus;
      employerName;
      monthlyIncome;
      incomeSource;
      financingPurpose;
      financingPurposeOther;
      amountSought;
      preferredInstrument;
      registrationStatus = #kycInProgress;
      kycRecord = null;
      tawthiqRecord = null;
      mizanRecord = null;
      bankLinkStatus = #NotLinked;
      createdAt = Time.now();
      updatedAt = Time.now();
      termsAcceptedAt;
      accountClosureRequested = false;
      accountClosureRequestedAt = null;
      photoUrl = null;
    };
    individualsProfiles.add(caller, profile);

    // Fire-and-forget: run onboarding pipeline asynchronously
    ignore runIndividualOnboardingPipeline(caller, bvn, nin, transformFn);
    #ok("Individual registration submitted. KYC pipeline started.");
  };

  // ── Async onboarding pipeline for individuals ─────────────────────────────────
  // Runs KYC (BVN + NIN + watchlist) → Tawthiq (individual variant) → Preliminary Mizan
  func runIndividualOnboardingPipeline(
    caller : Principal,
    bvn : Text,
    nin : Text,
    transform : Outcall.Transform,
  ) : async () {
    let creds = credentialsState.credentials;
    let monoKey = CredentialsLib.getMonoKey(creds);
    let openAiKey = CredentialsLib.getOpenAiKey(creds);

    // ── KYC: BVN + NIN only (no CAC/TIN for individuals) ─────────────────────
    let kycResultOrErr = await MonoKycLib.triggerIndividualKyc(bvn, nin, transform, monoKey);
    let (kycRecord, kycStatusText) = switch (kycResultOrErr) {
      case (#ok(rec)) (rec, debug_show(rec.kycStatus));
      case (#err(msg)) {
        let failed : MonoKyc.KycCheckRecord = {
          MonoKyc.defaultKycRecord() with
          kycStatus = #Failed;
          watchlistClean = false;
        };
        (failed, "#err: " # msg);
      };
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-individual-kyc",
      "kyc",
      caller.toText(),
      caller.toText(),
      "kyc_triggered",
      null,
      ?kycStatusText,
      null,
    );
    let profileAfterKyc = switch (individualsProfiles.get(caller)) {
      case null return;
      case (?p) {
        let updated = { p with kycRecord = ?kycRecord; registrationStatus = #underReview };
        individualsProfiles.add(caller, updated);
        updated;
      };
    };

    // ── Tawthiq: individual Shariah + inconsistency screening ────────────────
    let tawthiqRecord : IndividualTypes.IndividualTawthiqRecord = await TawthiqLib.runIndividualTawthiqAnalysis(
      profileAfterKyc, kycRecord, transform, openAiKey,
    );
    let profileAfterTawthiq = switch (individualsProfiles.get(caller)) {
      case null return;
      case (?p) {
        let updated = { p with tawthiqRecord = ?tawthiqRecord };
        individualsProfiles.add(caller, updated);
        updated;
      };
    };

    // ── Preliminary Mizan: declared-data scoring ──────────────────────────────
    let mizanRecord : IndividualTypes.IndividualMizanRecord = await MizanLib.runIndividualPreliminaryMizanAnalysis(
      profileAfterTawthiq, transform, openAiKey,
    );
    switch (individualsProfiles.get(caller)) {
      case null return;
      case (?p) {
        individualsProfiles.add(caller, { p with mizanRecord = ?mizanRecord });
      };
    };

    // ── WhatsApp notification ─────────────────────────────────────────────────
    let authHeader = CredentialsLib.getTwilioAuthHeader(creds);
    let twilioFrom = CredentialsLib.getTwilioFrom(creds);
    let readyMsg = "HalalVet: Your individual application is under review. Tawthiq screening is complete.";
    // Use a placeholder phone for notification; production would pull from profile
    ignore await WhatsAppLib.sendWhatsAppMessage(
      "", readyMsg, "under_review", transform, authHeader, twilioFrom,
    );
  };

  // ── Get my individual profile ─────────────────────────────────────────────────
  public query ({ caller }) func getMyIndividualProfile() : async Result.Result<IndividualTypes.IndividualProfile, Text> {
    switch (individualsProfiles.get(caller)) {
      case null #err("No individual profile found for this principal");
      case (?p) #ok(p);
    };
  };

  // ── Update individual profile ─────────────────────────────────────────────────
  public shared ({ caller }) func updateIndividualProfile(
    address : ?Text,
    occupation : ?Text,
    employerName : ?Text,
    monthlyIncome : ?Nat,
    incomeSource : ?IndividualTypes.IncomeSource,
  ) : async Result.Result<(), Text> {
    switch (individualsProfiles.get(caller)) {
      case null return #err("No individual profile found for this principal");
      case (?p) {
        let updated = {
          p with
          address = switch (address) { case (?v) v; case null p.address };
          occupation = switch (occupation) { case (?v) v; case null p.occupation };
          employerName = switch (employerName) { case (?_) employerName; case null p.employerName };
          monthlyIncome = switch (monthlyIncome) { case (?v) v; case null p.monthlyIncome };
          incomeSource = switch (incomeSource) { case (?v) v; case null p.incomeSource };
          updatedAt = Time.now();
        };
        individualsProfiles.add(caller, updated);
        AuditLib.logAudit(
          auditEntries,
          caller.toText() # "-individual-update",
          "individual",
          caller.toText(),
          caller.toText(),
          "profile_updated",
          null,
          ?("Individual profile updated"),
          null,
        );
        #ok(());
      };
    };
  };

  // ── Request bank link (only if financing-ready) ───────────────────────────────
  public shared ({ caller }) func requestIndividualBankLink() : async Result.Result<Text, Text> {
    switch (individualsProfiles.get(caller)) {
      case null return #err("No individual profile found for this principal");
      case (?p) {
        if (p.registrationStatus != #financingReady) {
          return #err("Bank linking is only available once you are marked as financing-ready");
        };
        // Return Mono Connect URL for the individual to link their account
        let monoKey = CredentialsLib.getMonoKey(credentialsState.credentials);
        #ok("https://connect.mono.co/?key=" # monoKey # "&reference=" # caller.toText());
      };
    };
  };

  // ── Request account closure ───────────────────────────────────────────────────
  public shared ({ caller }) func requestAccountClosure() : async Result.Result<(), Text> {
    switch (individualsProfiles.get(caller)) {
      case null return #err("No individual profile found for this principal");
      case (?p) {
        if (p.accountClosureRequested) {
          return #err("An account closure request is already pending");
        };
        let requestId = caller.toText() # "-closure-" # debug_show(Time.now());
        let request : Audit.AccountClosureRequest = {
          requestId;
          principalId = caller;
          applicantType = #individual;
          requestedAt = Time.now();
          processedAt = null;
          status = #pending;
          adminNote = null;
        };
        accountClosureRequests.add(requestId, request);
        let updated = {
          p with
          accountClosureRequested = true;
          updatedAt = Time.now();
        };
        individualsProfiles.add(caller, updated);
        // Notify admin via WhatsApp
        let creds = credentialsState.credentials;
        let authHeader = CredentialsLib.getTwilioAuthHeader(creds);
        let twilioFrom = CredentialsLib.getTwilioFrom(creds);
        let msg = "HalalVet Admin: Individual applicant " # caller.toText() # " has requested account closure.";
        ignore await WhatsAppLib.sendWhatsAppMessage(
          "", msg, "account_closure_requested",
          transformFn, authHeader, twilioFrom,
        );
        #ok(());
      };
    };
  };

  // ── Poll individual status (for dashboard polling) ────────────────────────────
  public query ({ caller }) func pollIndividualStatus() : async Result.Result<{ status : Common.RegistrationStatus; tawthiqDone : Bool; mizanDone : Bool }, Text> {
    switch (individualsProfiles.get(caller)) {
      case null #err("No individual profile found for this principal");
      case (?p) #ok({
        status = p.registrationStatus;
        tawthiqDone = p.tawthiqRecord != null;
        mizanDone = p.mizanRecord != null;
      });
    };
  };
};
