module {
  // Platform-wide aggregate analytics for the super-admin dashboard.
  // All counts are snapshot values computed on demand — not incrementally maintained.
  public type AdminAnalytics = {
    totalBusinesses : Nat;         // all registered business applicants
    totalIndividuals : Nat;        // all registered individual applicants
    totalFinanciers : Nat;         // all registered financiers
    tawthiqPassCount : Nat;        // Tawthiq verdict = #ready
    tawthiqConditionalCount : Nat; // Tawthiq verdict = #conditionalReady
    tawthiqFailCount : Nat;        // Tawthiq verdict = #notReady
    averageMizanScore : Nat;       // 0–100 average across all completed Mizan assessments
    financingReadyCount : Nat;     // applicants (business + individual) with financingReady = true
    activeFinancierCount : Nat;    // financiers with FinancierStatus = #Active
    pendingReviewCount : Nat;      // applicants (business + individual) in #underReview status
    closedDealsCount : Nat;        // applicants with registrationStatus = #approved
  };
};
