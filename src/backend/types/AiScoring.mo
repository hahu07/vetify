import Common "common";

module {
  public type RiskLevel = {
    #Low;
    #Medium;
    #High;
  };

  public type ScoringRecord = {
    financingReadinessScore : Nat;  // 0–100
    halalComplianceScore : Nat;     // 0–100
    riskLevel : RiskLevel;
    scoredAt : Common.Timestamp;
    scoringNotes : Text;
  };

  // Identifies whether a Mizan run is a preliminary (registration-time) or full (post-bank-link) analysis
  public type MizanStage = {
    #preliminary;  // runs at registration time using declared profile data
    #full;         // runs after Mono bank account is linked, using verified transaction data
  };

  // Mizan (الميزان) agent result — deep underwriting with Islamic finance context
  public type MizanRecord = {
    incomeStabilityScore : Nat;     // 0–100
    debtBehaviorScore : Nat;        // 0–100
    repaymentPatternScore : Nat;    // 0–100
    revenueTrendScore : Nat;        // 0–100
    overallReadinessScore : Nat;    // 0–100
    halalComplianceScore : Nat;     // 0–100, deepened with bank transaction data
    riskClassification : RiskLevel;
    isBorderline : Bool;            // true if overallReadinessScore between 40 and 60 inclusive
    borderlineReasons : [Text];
    narrativeSummary : Text;        // Islamic finance underwriting narrative (3–5 sentences)
    computedAt : Common.Timestamp;  // nanosecond timestamp
    stage : MizanStage;             // whether this is a preliminary or full analysis
  };

  public func defaultScoringRecord() : ScoringRecord = {
    financingReadinessScore = 0;
    halalComplianceScore = 0;
    riskLevel = #Medium;
    scoredAt = 0;
    scoringNotes = "";
  };
};
