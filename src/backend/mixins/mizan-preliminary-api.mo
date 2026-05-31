import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import ProfileTypes "../types/profile";
import AiScoring "../types/AiScoring";
import CommonTypes "../types/common";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import MizanLib "../lib/mizan";
import CredentialsLib "../lib/credentials";
import CredentialsTypes "../types/credentials";

// Mizan Preliminary mixin — exposes the registration-time (preliminary) Mizan analysis
// that runs using declared profile data before Mono bank data is available.
mixin (
  accessControlState : AccessControl.AccessControlState,
  businessProfiles : Map.Map<Principal, ProfileTypes.BusinessProfile>,
  transform : shared query (Outcall.TransformationInput) -> async Outcall.TransformationOutput,
  credentialsState : { var credentials : CredentialsTypes.CredentialsSettings },
) {

  // ── Business-facing: retrieve caller's own preliminary Mizan result ───────
  // Returns null if the preliminary analysis has not run yet.
  public query ({ caller }) func getPreliminaryMizanResult() : async ?AiScoring.MizanRecord {
    switch (businessProfiles.get(caller)) {
      case (?profile) { profile.preliminaryMizanRecord };
      case null { null };
    };
  };

  // ── Admin-facing: retrieve preliminary Mizan result for any business ──────
  // Admin only. Returns null if the preliminary analysis has not run yet.
  public query ({ caller }) func getPreliminaryMizanByBusiness(
    businessId : CommonTypes.UserId,
  ) : async ?AiScoring.MizanRecord {
    ignore caller;
    switch (businessProfiles.get(businessId)) {
      case (?profile) { profile.preliminaryMizanRecord };
      case null { null };
    };
  };

  // ── Internal: run and store the preliminary Mizan result ─────────────────
  // Called from the Tawthiq completion flow after the verdict is recorded.
  // Runs an async HTTP outcall to OpenAI and persists the result.
  public func runAndStorePreliminaryMizan(businessId : Principal) : async () {
    let profile = switch (businessProfiles.get(businessId)) {
      case null return;
      case (?p) p;
    };
    // Only run if not already computed
    switch (profile.preliminaryMizanRecord) {
      case (?_) return; // already done — skip
      case null {};
    };
    let openAiKey = CredentialsLib.getOpenAiKey(credentialsState.credentials);
    let result = await MizanLib.runPreliminaryMizan(profile, transform, openAiKey);
    let mizanRecord : ?AiScoring.MizanRecord = switch (result) {
      case (#ok(r)) ?r;
      case (#err(_)) null;
    };
    let updated : ProfileTypes.BusinessProfile = { profile with preliminaryMizanRecord = mizanRecord };
    businessProfiles.add(businessId, updated);
  };

};
