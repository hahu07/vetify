import Common "common";
import Principal "mo:core/Principal";

module {
  // A single Shariah compliance flag raised during screening
  public type ShariaFlag = {
    category : Text;   // e.g. "gambling", "interest-based banking"
    indicator : Text;  // specific evidence text
    severity : { #minor; #major };
  };

  // A mismatch between declared profile data and verified KYC data
  public type InconsistencyFlag = {
    field : Text;          // e.g. "businessName", "bvn"
    declaredValue : Text;  // what the applicant stated
    verifiedValue : Text;  // what Mono returned
  };

  // Final credit-readiness classification
  public type CreditReadinessVerdict = {
    #ready;
    #conditionalReady;
    #notReady;
  };

  // Status of a Tawthiq appeal submitted by a business applicant
  public type AppealStatus = {
    #pending;
    #accepted;
    #rejected;
  };

  // A single appeal raised by a business against a specific Tawthiq inconsistency flag
  public type TawthiqAppeal = {
    id : Text;
    businessId : Common.UserId;
    flagId : Text;
    appealText : Text;
    documentUrl : ?Text;
    documentName : ?Text;
    status : AppealStatus;
    submittedAt : Common.Timestamp;
    reviewedAt : ?Common.Timestamp;
    adminNote : ?Text;
    adminPrincipal : ?Principal;
  };

  // Full Tawthiq (التوثيق) agent result for a business applicant
  // NOTE: appeals have been moved to a separate stable Map in main.mo (tawthiqAppeals)
  public type TawthiqRecord = {
    shariaFlags : [ShariaFlag];
    shariaScreeningNotes : Text;
    shariaScreeningStatus : { #Pending; #Passed; #Failed };
    inconsistencyFlags : [InconsistencyFlag];
    inconsistencyStatus : { #Pending; #Clean; #Flagged };
    creditReadinessVerdict : CreditReadinessVerdict;
    narrativeSummary : Text;
    completedAt : ?Common.Timestamp;
  };

  // Default pending record used when Tawthiq has not run yet
  public func defaultTawthiqRecord() : TawthiqRecord = {
    shariaFlags = [];
    shariaScreeningNotes = "";
    shariaScreeningStatus = #Pending;
    inconsistencyFlags = [];
    inconsistencyStatus = #Pending;
    creditReadinessVerdict = #notReady;
    narrativeSummary = "";
    completedAt = null;
  };
};
