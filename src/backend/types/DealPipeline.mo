module {
  /// The stage a financier assigns to an applicant in their pipeline.
  public type PipelineStage = {
    #reviewing;
    #dueDiligence;
    #offerSent;
    #closed;
  };

  /// A single entry returned in a financier's pipeline listing.
  public type PipelineEntry = {
    applicantId : Principal;
    stage : PipelineStage;
  };
};
