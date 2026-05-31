import Common "common";

module {
  // Audit log entry — records every admin action or data access on an entity.
  // action values:
  //   "status_change"             — registration status updated
  //   "financing_ready_toggled"   — financing-ready flag flipped
  //   "kyc_triggered"             — KYC pipeline started
  //   "admin_profile_read"        — admin read a full business/financier profile (NDPR)
  //   "admin_list_access"         — admin listed business/financier records (NDPR)
  //   "admin_documents_read"      — admin read documents for a user (NDPR)
  //   "kashif_config_updated"     — admin updated Kashif scoring configuration
  public type AuditEntry = {
    id : Text;
    entityType : Text;   // "business" | "financier" | "kyc" | "banklink" | "system"
    entityId : Text;
    changedBy : Text;    // principal as text
    action : Text;       // see action values above
    oldValue : ?Text;
    newValue : ?Text;
    reason : ?Text;
    timestamp : Common.Timestamp;
  };

  // Paginated result wrapper for audit queries
  public type AuditPage = {
    entries : [AuditEntry];
    total : Nat;
    page : Nat;
  };

  // Account closure request raised by any registered user.
  // Admins process pending requests and record the outcome.
  public type AccountClosureRequest = {
    requestId : Text;
    principalId : Common.UserId;
    applicantType : {
      #business;
      #individual;
      #financier;
    };
    requestedAt : Common.Timestamp;
    processedAt : ?Common.Timestamp;
    status : {
      #pending;
      #approved;
      #rejected;
    };
    adminNote : ?Text;
  };
};
