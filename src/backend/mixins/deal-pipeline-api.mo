import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Debug "mo:core/Debug";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import DealPipelineTypes "../types/DealPipeline";

/// Deal Pipeline mixin — lets each financier track applicants through stages.
/// State: outer key = financier Principal, inner key = applicant Principal.
mixin (
  accessControlState : AccessControl.AccessControlState,
  dealPipeline : Map.Map<Principal, Map.Map<Principal, DealPipelineTypes.PipelineStage>>,
) {
  /// Assign or update the pipeline stage for an applicant.
  /// The calling principal must be a registered financier.
  public shared ({ caller }) func setPipelineStage(
    applicantId : Principal,
    stage : DealPipelineTypes.PipelineStage,
  ) : async { #ok : (); #err : Text } {
    let role = AccessControl.getUserRole(accessControlState, caller);
    switch (role) {
      case (#financier) {};
      case _ { return #err("Only registered financiers can manage their pipeline") };
    };
    switch (dealPipeline.get(caller)) {
      case (?inner) { inner.add(applicantId, stage) };
      case null {
        let inner = Map.empty<Principal, DealPipelineTypes.PipelineStage>();
        inner.add(applicantId, stage);
        dealPipeline.add(caller, inner);
      };
    };
    #ok(());
  };

  /// Return all pipeline entries for the calling financier.
  public query ({ caller }) func getPipeline() : async [(Principal, DealPipelineTypes.PipelineStage)] {
    switch (dealPipeline.get(caller)) {
      case (?inner) { inner.entries().toArray() };
      case null { [] };
    };
  };

  /// Remove an applicant from the calling financier's pipeline.
  public shared ({ caller }) func removePipelineEntry(
    applicantId : Principal,
  ) : async { #ok : (); #err : Text } {
    switch (dealPipeline.get(caller)) {
      case (?inner) { inner.remove(applicantId) };
      case null {};
    };
    #ok(());
  };
};
