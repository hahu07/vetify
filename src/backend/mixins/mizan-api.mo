import Map "mo:core/Map";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Prim "mo:prim";
import AccessControl "mo:caffeineai-authorization/access-control";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import ProfileTypes "../types/profile";
import AiScoring "../types/AiScoring";
import CredentialsTypes "../types/credentials";
import MizanLib "../lib/mizan";
import CredentialsLib "../lib/credentials";
import RateLimit "../lib/rate-limit";
import List "mo:core/List";
import Nat "mo:core/Nat";
import AuditTypes "../types/audit";
import AuditLib "../lib/audit";

mixin (
  accessControlState : AccessControl.AccessControlState,
  businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  transform : shared query (Outcall.TransformationInput) -> async Outcall.TransformationOutput,
  credentialsState : { var credentials : CredentialsTypes.CredentialsSettings },
  rateLimitState : RateLimit.RateLimitState,
  auditEntries : List.List<AuditTypes.AuditEntry>,
) {
  let MIZAN_COOLDOWN_NS : Int = 120_000_000_000; // 2 minutes
  let MIZAN_MIN_CYCLES : Nat = 2_000_000_000_000;

  // Get Mizan result for a business — callable by admin or the business owner
  public query ({ caller }) func getMizanResult(
    businessId : Principal,
  ) : async { #ok : AiScoring.MizanRecord; #err : Text } {
    let isAdmin = AccessControl.isAdmin(accessControlState, caller);
    let isOwner = caller == businessId;
    if (not isAdmin and not isOwner) {
      return #err("Unauthorized: Only admin or the business owner may view this result");
    };
    switch (businessProfiles.get(businessId)) {
      case null #err("Business profile not found");
      case (?p) {
        switch (p.mizanRecord) {
          case null #err("Mizan analysis has not been run for this business");
          case (?m) #ok(m);
        };
      };
    };
  };

  // List businesses where Mizan flagged isBorderline = true (admin only, paginated)
  public query ({ caller }) func listBorderlineBusinesses(
    page : Nat,
  ) : async { items : [ProfileTypes.ApplicantSummary]; total : Nat } {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    let pageSize = 20;
    var all : [ProfileTypes.ApplicantSummary] = [];
    for ((_, p) in businessProfiles.entries()) {
      switch (p.mizanRecord) {
        case (?m) {
          if (m.isBorderline) {
            let summary : ProfileTypes.ApplicantSummary = {
              userId = p.userId;
              role = #businessApplicant;
              displayName = p.businessName;
              financingReadyScore = m.overallReadinessScore;
              riskLevel = p.riskLevel;
              halalComplianceStatus = p.halalComplianceStatus;
              financingReady = p.financingReady;
            };
            all := all.concat([summary]);
          };
        };
        case null {};
      };
    };
    let total = all.size();
    let start = page * pageSize;
    let sliced : [ProfileTypes.ApplicantSummary] = if (start >= total) [] else all.sliceToArray(start, if (start + pageSize > total) total else start + pageSize);
    { items = sliced; total };
  };

  // Manually re-trigger Mizan analysis for a specific business (admin only)
  public shared ({ caller }) func triggerMizanAnalysis(
    businessId : Principal,
  ) : async { #ok : AiScoring.MizanRecord; #err : Text } {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Admin only");
    };
    if (Prim.cyclesBalance() < MIZAN_MIN_CYCLES) {
      return #err("Insufficient cycles: admin must top up canister before processing");
    };
    if (not RateLimit.checkAndRecord(rateLimitState, caller, MIZAN_COOLDOWN_NS)) {
      return #err("Rate limit: please wait 2 minutes before re-triggering Mizan analysis");
    };
    let profile = switch (businessProfiles.get(businessId)) {
      case null { return #err("Business profile not found") };
      case (?p) p;
    };
    let openAiKey = CredentialsLib.getOpenAiKey(credentialsState.credentials);
    let result = await MizanLib.runMizan(
      profile, profile.bankLinkRecord, profile.kycRecord,
      profile.tawthiqRecord, transform, openAiKey,
    );
    switch (result) {
      case (#ok(mizan)) {
        let updatedScoring : AiScoring.ScoringRecord = {
          financingReadinessScore = mizan.overallReadinessScore;
          halalComplianceScore = mizan.halalComplianceScore;
          riskLevel = mizan.riskClassification;
          scoredAt = mizan.computedAt;
          scoringNotes = mizan.narrativeSummary;
        };
        let mizanAlert : Bool = switch (profile.preliminaryMizanRecord) {
          case (?prelim) {
            let fullScore : Nat = mizan.overallReadinessScore;
            let prelimScore : Nat = prelim.overallReadinessScore;
            let diff : Nat = if (fullScore > prelimScore) { fullScore - prelimScore } else { prelimScore - fullScore };
            diff > 20;
          };
          case null { false };
        };
        businessProfiles.add(businessId, {
          profile with
          mizanRecord = ?mizan;
          scoringRecord = updatedScoring;
          mizanDivergenceAlert = mizanAlert;
        });
        if (mizanAlert) {
          let prelimScoreText = switch (profile.preliminaryMizanRecord) {
            case (?p) p.overallReadinessScore.toText();
            case null "0";
          };
          AuditLib.logAudit(
            auditEntries,
            "mizan_div_" # businessId.toText(),
            "business",
            businessId.toText(),
            caller.toText(),
            "mizan_divergence_detected",
            ?prelimScoreText,
            ?mizan.overallReadinessScore.toText(),
            ?"Mizan divergence >20 points detected — admin review recommended",
          );
        };
        #ok(mizan);
      };
      case (#err(e)) #err(e);
    };
  };
};
