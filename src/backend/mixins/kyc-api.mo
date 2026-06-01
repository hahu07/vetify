import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import List "mo:core/List";
import Text "mo:core/Text";
import Prim "mo:prim";
import AccessControl "mo:caffeineai-authorization/access-control";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import ProfileTypes "../types/profile";
import MonoKyc "../types/MonoKyc";
import MonoBankLink "../types/MonoBankLink";
import AiScoring "../types/AiScoring";
import Notification "../types/Notification";
import Audit "../types/audit";
import CredentialsTypes "../types/credentials";
import BizExt "../types/BusinessExtended";
import ProfileLib "../lib/profile";
import MonoConnectLib "../lib/mono-connect";
import AiScoringLib "../lib/ai-scoring";
import WhatsAppLib "../lib/whatsapp";
import AuditLib "../lib/audit";
import CredentialsLib "../lib/credentials";
import MizanLib "../lib/mizan";
import RateLimit "../lib/rate-limit";
import OrchestrationLib "../lib/orchestration";

mixin (
  accessControlState : AccessControl.AccessControlState,
  businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  notifications : Map.Map<Principal, Notification.NotificationRecord>,
  auditEntries : List.List<Audit.AuditEntry>,
  credentialsState : { var credentials : CredentialsTypes.CredentialsSettings },
  rateLimitState : RateLimit.RateLimitState,
) {

  // 5-minute rate limit cooldown for registration+KYC
  let REGISTRATION_COOLDOWN_NS : Int = 300_000_000_000;
  // 2T cycle minimum before initiating HTTP outcall chains
  let KYC_MIN_CYCLES : Nat = 2_000_000_000_000;

  // Input validators
  func validateBvn(s : Text) : Bool { s.size() == 11 and s.chars().toArray().find(func(c) { not (c >= '0' and c <= '9') }) == null };
  func validateNin(s : Text) : Bool { s.size() == 11 and s.chars().toArray().find(func(c) { not (c >= '0' and c <= '9') }) == null };
  func validateTin(s : Text) : Bool {
    s.size() >= 8 and s.size() <= 15 and
    s.chars().toArray().find(func(c) { not ((c >= '0' and c <= '9') or (c >= 'A' and c <= 'Z') or (c >= 'a' and c <= 'z')) }) == null
  };
  func validateCac(s : Text) : Bool {
    s.size() >= 7 and s.size() <= 20 and
    s.chars().toArray().find(func(c) { not ((c >= '0' and c <= '9') or (c >= 'A' and c <= 'Z') or (c >= 'a' and c <= 'z')) }) == null
  };
  func validatePhone(s : Text) : Bool {
    let digits = if (s.startsWith(#text "+234")) {
      let cs = s.chars().toArray();
      cs.sliceToArray(4, cs.size()).foldLeft("", func(acc, c) { acc # Text.fromChar(c) })
    } else if (s.startsWith(#text "0")) {
      let cs = s.chars().toArray();
      cs.sliceToArray(1, cs.size()).foldLeft("", func(acc, c) { acc # Text.fromChar(c) })
    } else { return false };
    digits.size() == 10 and digits.chars().toArray().find(func(c) { not (c >= '0' and c <= '9') }) == null
  };

  // ── HTTP transform (required for outcalls — strips non-deterministic headers) ——
  public query func transform(input : Outcall.TransformationInput) : async Outcall.TransformationOutput {
    Outcall.transform(input);
  };

  // ── Submit business registration and trigger Mono KYC ─────────────────────────
  public shared ({ caller }) func submitBusinessRegistrationWithKyc(
    businessName : Text,
    cacNumber : Text,
    businessType : Text,
    annualRevenue : Nat,
    contactPerson : Text,
    address : Text,
    phoneNumber : Text,
    bvn : Text,
    nin : Text,
    tinNumber : Text,
    businessDescription : Text,
    yearOfIncorporation : Text,
    financingAmountSought : Nat,
    purposeOfFinancing : Text,
    preferredInstrument : Text,
    directorsList : [BizExt.DirectorRecord],
    proprietorDetails : ?BizExt.ProprietorRecord,
  ) : async ProfileTypes.BusinessProfile {
    if (Prim.cyclesBalance() < KYC_MIN_CYCLES) {
      Runtime.trap("Insufficient cycles: admin must top up canister before processing");
    };
    if (not RateLimit.checkAndRecord(rateLimitState, caller, REGISTRATION_COOLDOWN_NS)) {
      Runtime.trap("Rate limit: please wait 5 minutes before submitting another registration");
    };
    if (not validateBvn(bvn)) {
      Runtime.trap("Invalid BVN: must be exactly 11 digits");
    };
    if (not validateNin(nin)) {
      Runtime.trap("Invalid NIN: must be exactly 11 digits");
    };
    if (not validateTin(tinNumber)) {
      Runtime.trap("Invalid TIN: must be 8-15 alphanumeric characters");
    };
    if (not validateCac(cacNumber)) {
      Runtime.trap("Invalid CAC number: must be 7-20 alphanumeric characters");
    };
    if (not validatePhone(phoneNumber)) {
      Runtime.trap("Invalid phone number: must start with 0 or +234 followed by 10 digits");
    };

    AccessControl.assignRole(accessControlState, caller, caller, #user);

    let profile : ProfileTypes.BusinessProfile = {
      userId = caller;
      businessName;
      cacNumber;
      businessType;
      annualRevenue;
      contactPerson;
      address;
      phoneNumber;
      registrationStatus = #kycInProgress;
      financingReadyScore = 0;
      riskLevel = #pending;
      halalComplianceStatus = #pending;
      financingReady = false;
      createdAt = Time.now();
      kycRecord = MonoKyc.defaultKycRecord();
      bankLinkRecord = MonoBankLink.defaultBankLinkRecord();
      scoringRecord = AiScoring.defaultScoringRecord();
      tawthiqRecord = null;
      mizanRecord = null;
      businessTypeEnum = null;
      businessDescription = ?businessDescription;
      yearOfIncorporation = ?yearOfIncorporation;
      financingAmountSought = ?financingAmountSought;
      purposeOfFinancing = ?purposeOfFinancing;
      preferredInstrument = ?preferredInstrument;
      directorsList = if (directorsList.size() > 0) { ?directorsList } else { null };
      proprietorDetails;
      preliminaryMizanRecord = null;
      mizanDivergenceAlert = false;
      photoUrl = null;
    };
    businessProfiles.add(caller, profile);

    let msg = "HalalVet: Your business \"" # businessName # "\" registration has been submitted and is under review.";
    let twilioAuthHeader = CredentialsLib.buildTwilioAuthHeader(credentialsState.credentials);
    let twilioCredentials = CredentialsLib.getTwilioCredentials(credentialsState.credentials);
    let twilioFrom = twilioCredentials.accountSid # "|" # twilioCredentials.whatsappFrom;
    let note = await WhatsAppLib.sendWhatsAppMessage(phoneNumber, msg, "submitted", transform, twilioAuthHeader, twilioFrom);
    notifications.add(caller, note);

    await OrchestrationLib.runOnboardingPipeline(
      caller, bvn, nin, cacNumber, tinNumber,
      businessProfiles, notifications, auditEntries,
      credentialsState, transform,
    );

    switch (businessProfiles.get(caller)) {
      case (?p) p;
      case null profile;
    };
  };

  // ── Link bank account and trigger AI scoring ───────────────────────────────────
  public shared ({ caller }) func linkBankAccount(accountId : Text) : async ProfileTypes.BusinessProfile {
    if (Prim.cyclesBalance() < KYC_MIN_CYCLES) {
      Runtime.trap("Insufficient cycles: admin must top up canister before processing");
    };
    let profile = switch (businessProfiles.get(caller)) {
      case (?p) p;
      case null Runtime.trap("Business profile not found");
    };
    if (not profile.financingReady) {
      Runtime.trap("Bank linking is only available once admin marks you as financing-ready");
    };

    let monoKey = CredentialsLib.getMonoKey(credentialsState.credentials);
    // ISSUE 9 FIX: pullBankData now collects all 4 HTTP results atomically.
    // On failure, record #LinkFailed with the failing call name; no partial state.
    let bankPullResult = await MonoConnectLib.pullBankData(accountId, transform, monoKey);
    let bankLinkRecord = switch (bankPullResult) {
      case (#ok(rec)) rec;
      case (#err(failReason)) {
        let failedRecord = { MonoBankLink.defaultBankLinkRecord() with
          status = #LinkFailed(failReason);
        };
        businessProfiles.add(caller, { profile with bankLinkRecord = failedRecord });
        Runtime.trap("Bank link failed: " # failReason);
      };
    };
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-banklink-" # accountId,
      "banklink",
      caller.toText(),
      caller.toText(),
      "bank_linked",
      null,
      ?accountId,
      null,
    );
    businessProfiles.add(caller, { profile with bankLinkRecord });

    let updatedProfile = switch (businessProfiles.get(caller)) {
      case (?p) p;
      case null profile;
    };

    let openAiKey = CredentialsLib.getOpenAiKey(credentialsState.credentials);
    let mizanResult = await MizanLib.runMizan(
      updatedProfile, bankLinkRecord, profile.kycRecord,
      profile.tawthiqRecord, transform, openAiKey,
    );

    let (scoringRecord, mizanRecord, mizanDivergenceAlert) = switch (mizanResult) {
      case (#ok(mizan)) {
        let scoring : AiScoring.ScoringRecord = {
          financingReadinessScore = mizan.overallReadinessScore;
          halalComplianceScore = mizan.halalComplianceScore;
          riskLevel = mizan.riskClassification;
          scoredAt = mizan.computedAt;
          scoringNotes = mizan.narrativeSummary;
        };
        // ISSUE 11: detect divergence >20 points between preliminary and full Mizan scores
        let diverged = switch (updatedProfile.preliminaryMizanRecord) {
          case null false;
          case (?prelim) {
            let diff = if (mizan.overallReadinessScore > prelim.overallReadinessScore) {
              mizan.overallReadinessScore - prelim.overallReadinessScore
            } else {
              prelim.overallReadinessScore - mizan.overallReadinessScore
            };
            diff > 20;
          };
        };
        (scoring, ?mizan, diverged);
      };
      case (#err(_mizanErr)) {
        let legacyResult = await AiScoringLib.scoreApplicant(
          updatedProfile, profile.kycRecord, bankLinkRecord, transform, openAiKey,
        );
        let scoring = switch (legacyResult) {
          case (#ok(rec)) rec;
          case (#err(msg)) Runtime.trap("AI scoring failed: " # msg);
        };
        (scoring, null, false);
      };
    };

    businessProfiles.add(caller, { updatedProfile with scoringRecord; mizanRecord; mizanDivergenceAlert });

    // ISSUE 11: log divergence alert to audit trail if detected
    if (mizanDivergenceAlert) {
      let prelimScore = switch (updatedProfile.preliminaryMizanRecord) {
        case null 0;
        case (?p) p.overallReadinessScore;
      };
      let fullScore = switch (mizanRecord) {
        case null 0;
        case (?m) m.overallReadinessScore;
      };
      AuditLib.logAudit(
        auditEntries,
        caller.toText() # "-mizan-divergence",
        "mizan",
        caller.toText(),
        caller.toText(),
        "mizan_divergence_detected",
        ?("preliminary score: " # prelimScore.toText()),
        ?("full score: " # fullScore.toText()),
        ?("Mizan divergence detected: preliminary score " # prelimScore.toText() # " vs full score " # fullScore.toText() # " — admin review recommended"),
      );
    };

    let finalProfile = switch (businessProfiles.get(caller)) {
      case (?p) p;
      case null updatedProfile;
    };
    let waMsg = "HalalVet: Your business \"" # profile.businessName # "\" bank account has been linked and Mizan underwriting analysis is complete. Financing readiness score: " # scoringRecord.financingReadinessScore.toText() # "/100.";
    let twilioAuth = CredentialsLib.buildTwilioAuthHeader(credentialsState.credentials);
    let twilioCreds = CredentialsLib.getTwilioCredentials(credentialsState.credentials);
    let twilioFrom = twilioCreds.accountSid # "|" # twilioCreds.whatsappFrom;
    let note = await WhatsAppLib.sendWhatsAppMessage(profile.phoneNumber, waMsg, "bank-linked", transform, twilioAuth, twilioFrom);
    notifications.add(caller, note);

    finalProfile;
  };
};
