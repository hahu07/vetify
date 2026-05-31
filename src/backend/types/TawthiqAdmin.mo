import Common "common";

module {
  // Aggregate stats for the Tawthiq admin overview
  public type TawthiqOverviewStats = {
    totalProcessed : Nat;
    passedCount : Nat;
    conditionalCount : Nat;
    notReadyCount : Nat;
    pendingCount : Nat;
  };

  // A per-business admin annotation note
  public type TawthiqAdminNote = {
    businessUserId : Common.UserId;
    note : Text;
    updatedAt : Common.Timestamp;
    updatedBy : Common.UserId;
  };
};
