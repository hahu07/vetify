import Kashif "../types/Kashif";
import Profile "../types/profile";
import AiScoring "../types/AiScoring";
import Common "../types/common";
import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import CredentialsTypes "../types/credentials";
import KashifLib "../lib/kashif";
import CredentialsLib "../lib/credentials";
import Prim "mo:prim";
import Audit "../types/audit";
import RateLimit "../lib/rate-limit";
import AuditLib "../lib/audit";

// Kashif (الكاشف) — Investment Discovery & Report Agent
// Mixin: helps financiers find matched borrowers, generate deal reports,
// manage shortlists, compare applicants, and gives admins visibility into usage.
mixin (
  accessControlState : AccessControl.AccessControlState,
  businesses : Map.Map<Common.UserId, Profile.BusinessProfile>,
  financiers : Map.Map<Common.UserId, Profile.FinancierProfile>,
  kashifCache : Map.Map<Principal, Kashif.KashifCacheEntry>,
  shortlists : Map.Map<Common.UserId, List.List<Kashif.ShortlistEntry>>,
  kashifLogs : Map.Map<Principal, Kashif.KashifReportLog>,
  transform : shared query (Outcall.TransformationInput) -> async Outcall.TransformationOutput,
  credentialsState : { var credentials : CredentialsTypes.CredentialsSettings },
  auditEntries : List.List<Audit.AuditEntry>,
  kashifScoringConfig : { var config : Kashif.KashifScoringConfig },
  rateLimitState : RateLimit.RateLimitState,
) {
  let KASHIF_COOLDOWN_NS : Int = 60_000_000_000; // 1 minute
  let KASHIF_MIN_CYCLES : Nat = 2_000_000_000_000;

  // ── Internal helpers ──────────────────────────────────────────────────────────

  // Build a CompatibilityResult for a given business and financier.
  func makeCompatibilityResult(
    financierProfile : Profile.FinancierProfile,
    bp : Profile.BusinessProfile,
  ) : Kashif.CompatibilityResult {
    let score = KashifLib.computeCompatibilityScore(financierProfile, bp, kashifScoringConfig.config);
    let (riskLevel, halalScore) = switch (bp.mizanRecord) {
      case (?m) (m.riskClassification, m.halalComplianceScore);
      case null  (bp.scoringRecord.riskLevel, bp.scoringRecord.halalComplianceScore);
    };
    // Derive suggested financing types from Tawthiq recommendation or default to businessType
    let financingTypes : [Text] = switch (bp.tawthiqRecord) {
      case (?t) {
        switch (t.creditReadinessVerdict) {
          case (#ready)           ["Murabaha", "Ijarah"];
          case (#conditionalReady) ["Murabaha"];
          case (#notReady)         [];
        };
      };
      case null ["Murabaha"];
    };
    {
      applicantType = #business;
      businessId = bp.userId;
      displayName = bp.businessName;
      compatibilityScore = score;
      riskLevel;
      halalComplianceScore = halalScore;
      businessCategory = bp.businessType;
      financingTypes;
    };
  };

  // Upsert the KashifReportLog for a business after a view.
  func recordView(businessId : Principal, generatedAt : Int) {
    let now = Time.now();
    let existing = kashifLogs.get(businessId);
    let updated : Kashif.KashifReportLog = switch (existing) {
      case null {
        { businessId; generatedAt; viewCount = 1; lastViewedAt = ?now };
      };
      case (?log) {
        { log with viewCount = log.viewCount + 1; lastViewedAt = ?now };
      };
    };
    kashifLogs.add(businessId, updated);
  };

  // ── Financier-facing endpoints ───────────────────────────────────────────────

  // Returns all financing-ready borrowers ranked by compatibility score for the
  // calling financier, with pagination.
  public shared ({ caller }) func getMatchedBorrowers(
    page : Nat,
    pageSize : Nat
  ) : async { items : [Kashif.CompatibilityResult]; total : Nat } {
    let financierProfile = switch (financiers.get(caller)) {
      case null { Runtime.trap("Financier profile not found") };
      case (?f) f;
    };
    var results : [Kashif.CompatibilityResult] = [];
    for ((_, bp) in businesses.entries()) {
      if (bp.financingReady) {
        results := results.concat([makeCompatibilityResult(financierProfile, bp)]);
      };
    };
    // Sort descending by compatibilityScore (simple insertion sort for correctness)
    let sorted = results.sort(
      func(a, b) {
        if (a.compatibilityScore > b.compatibilityScore) #less
        else if (a.compatibilityScore < b.compatibilityScore) #greater
        else #equal
      },
    );
    let total = sorted.size();
    let effectivePageSize = if (pageSize == 0) 20 else pageSize;
    let start = page * effectivePageSize;
    let end_ = if (start + effectivePageSize > total) total else start + effectivePageSize;
    let items : [Kashif.CompatibilityResult] = if (start >= total) [] else sorted.sliceToArray(start, end_);
    { items; total };
  };

  // Returns a cached deal report for the given business, or triggers generation
  // if no cache entry exists. Increments view count in the log.
  public shared ({ caller }) func getDealReport(
    businessId : Principal
  ) : async { #ok : Kashif.DealReport; #err : Text } {
    if (Prim.cyclesBalance() < KASHIF_MIN_CYCLES) {
      return #err("Insufficient cycles: admin must top up canister before processing");
    };
    if (not RateLimit.checkAndRecord(rateLimitState, caller, KASHIF_COOLDOWN_NS)) {
      return #err("Rate limit: please wait 1 minute before requesting another deal report");
    };
    let financierProfile = switch (financiers.get(caller)) {
      case null { return #err("Financier profile not found") };
      case (?f) f;
    };
    let bp = switch (businesses.get(businessId)) {
      case null { return #err("Business profile not found") };
      case (?b) b;
    };
    if (not bp.financingReady) {
      return #err("Business is not yet financing-ready");
    };

    let mizanVersion = switch (bp.mizanRecord) { case (?m) m.computedAt; case null 0 };
    let tawthiqVersion = switch (bp.tawthiqRecord) {
      case (?t) switch (t.completedAt) { case (?ts) ts; case null 0 };
      case null 0;
    };

    let cachedReport : ?Kashif.DealReport = switch (kashifCache.get(businessId)) {
      case null null;
      case (?entry) {
        if (entry.report.mizanVersion == mizanVersion and entry.report.tawthiqVersion == tawthiqVersion) {
          ?entry.report
        } else null;
      };
    };

    let report : Kashif.DealReport = switch (cachedReport) {
      case (?r) r;
      case null {
        let openAiKey = CredentialsLib.getOpenAiKey(credentialsState.credentials);
        let genResult = await KashifLib.generateDealReport(bp, transform, openAiKey);
        switch (genResult) {
          case (#err(e)) { return #err(e) };
          case (#ok(r)) {
            let scored : Kashif.DealReport = { r with compatibilityScore = KashifLib.computeCompatibilityScore(financierProfile, bp, kashifScoringConfig.config) };
            let entry : Kashif.KashifCacheEntry = {
              businessId;
              report = scored;
              cachedAt = Time.now();
            };
            kashifCache.add(businessId, entry);
            scored;
          };
        };
      };
    };

    recordView(businessId, report.generatedAt);
    #ok(report);
  };

  // Adds the given business to the calling financier's shortlist.
  public shared ({ caller }) func shortlistBorrower(
    businessId : Principal
  ) : async { #ok; #err : Text } {
    // Verify business exists and is financing-ready
    let bp = switch (businesses.get(businessId)) {
      case null { return #err("Business profile not found") };
      case (?b) b;
    };
    if (not bp.financingReady) {
      return #err("Business is not yet financing-ready");
    };
    let current = switch (shortlists.get(caller)) {
      case null List.empty<Kashif.ShortlistEntry>();
      case (?l)  l;
    };
    // Idempotent: skip if already in list
    let arr = current.toArray();
    let alreadyIn = arr.find(func(e : Kashif.ShortlistEntry) : Bool { e.businessId == businessId });
    switch (alreadyIn) {
      case (?_) {};
      case null {
        current.add({ businessId; addedAt = Time.now() });
      };
    };
    shortlists.add(caller, current);
    #ok;
  };

  // Removes the given business from the calling financier's shortlist.
  public shared ({ caller }) func removeFromShortlist(
    businessId : Principal
  ) : async { #ok; #err : Text } {
    let current = switch (shortlists.get(caller)) {
      case null { return #err("No shortlist found") };
      case (?l)  l;
    };
    let before = current.size();
    let arr = current.toArray();
    let filtered = arr.filter(func(e : Kashif.ShortlistEntry) : Bool { e.businessId != businessId });
    if (filtered.size() == before) {
      return #err("Business not found in shortlist");
    };
    let updated = List.fromArray<Kashif.ShortlistEntry>(filtered);
    shortlists.add(caller, updated);
    #ok;
  };

  // Returns the calling financier's full shortlist.
  public shared ({ caller }) func getShortlist() : async [Kashif.ShortlistEntry] {
    switch (shortlists.get(caller)) {
      case null [];
      case (?l)  l.toArray();
    };
  };

  // Returns compatibility results for up to 4 borrowers for side-by-side comparison.
  public shared ({ caller }) func getComparisonData(
    businessIds : [Principal]
  ) : async { #ok : [Kashif.CompatibilityResult]; #err : Text } {
    if (businessIds.size() > 4) {
      return #err("Comparison is limited to 4 businesses at a time");
    };
    let financierProfile = switch (financiers.get(caller)) {
      case null { return #err("Financier profile not found") };
      case (?f) f;
    };
    var results : [Kashif.CompatibilityResult] = [];
    for (bId in businessIds.vals()) {
      switch (businesses.get(bId)) {
        case null {}; // silently skip unknown ids
        case (?bp) {
          results := results.concat([makeCompatibilityResult(financierProfile, bp)]);
        };
      };
    };
    #ok(results);
  };

  // ── Admin-facing endpoints ──────────────────────────────────────────────────────

  // Returns paginated Kashif report activity logs across all businesses.
  public shared ({ caller }) func adminGetKashifLogs(
    page : Nat,
    pageSize : Nat
  ) : async { items : [Kashif.KashifReportLog]; total : Nat } {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    var all : [Kashif.KashifReportLog] = [];
    for ((_, log) in kashifLogs.entries()) {
      all := all.concat([log]);
    };
    let total = all.size();
    let effectivePageSize = if (pageSize == 0) 20 else pageSize;
    let start = page * effectivePageSize;
    let end_ = if (start + effectivePageSize > total) total else start + effectivePageSize;
    let items : [Kashif.KashifReportLog] = if (start >= total) [] else all.sliceToArray(start, end_);
    { items; total };
  };

  // Forces regeneration of the cached deal report for a specific business.
  public shared ({ caller }) func adminTriggerReportRegeneration(
    businessId : Principal
  ) : async { #ok; #err : Text } {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Admin only");
    };
    switch (businesses.get(businessId)) {
      case null { return #err("Business profile not found") };
      case (?_) {};
    };
    // Remove cache entry — next getDealReport call will regenerate
    kashifCache.remove(businessId);
    #ok;
  };

  // Returns the current Kashif scoring configuration.
  public query ({ caller }) func getKashifScoringConfig() : async Kashif.KashifScoringConfig {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    kashifScoringConfig.config;
  };

  // Admin: update the Kashif compatibility scoring configuration.
  // Changes take effect immediately for all future computeCompatibilityScore calls.
  // Cached deal reports are invalidated so they will be regenerated with the new config.
  // Config change is logged to the audit trail.
  public shared ({ caller }) func updateKashifScoringConfig(
    newConfig : Kashif.KashifScoringConfig
  ) : async { #ok; #err : Text } {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Admin only");
    };
    // Validate: defaultScore must be 0–100
    if (newConfig.defaultScore > 100) {
      return #err("defaultScore must be between 0 and 100");
    };
    let oldConfigText = debug_show(kashifScoringConfig.config);
    kashifScoringConfig.config := newConfig;
    // Invalidate all cached deal reports — they must be regenerated with the new weights
    for ((key, _) in kashifCache.entries()) {
      kashifCache.remove(key);
    };
    // Audit log: config change
    AuditLib.logAudit(
      auditEntries,
      caller.toText() # "-kashif-config-" # debug_show(Time.now()),
      "system",
      "kashif_scoring_config",
      caller.toText(),
      "kashif_config_updated",
      ?oldConfigText,
      ?debug_show(newConfig),
      null,
    );
    #ok;
  };
};
