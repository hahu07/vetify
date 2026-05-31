import Common "common";

module {
  public type KycStatus = {
    #Pending;
    #InProgress;
    #Verified;
    #Failed;
  };

  public type KycCheckRecord = {
    bvnVerified : Bool;
    ninVerified : Bool;
    cacVerified : Bool;
    tinVerified : Bool;
    // watchlistClean = false means FLAGGED or parse error (fail-safe — never assumed clean)
    watchlistClean : Bool;
    // watchlistParseError = true means the watchlist API response could not be parsed
    watchlistParseError : Bool;
    creditScore : Nat;
    kycStatus : KycStatus;
    verifiedAt : ?Common.Timestamp;
  };

  public func defaultKycRecord() : KycCheckRecord = {
    bvnVerified = false;
    ninVerified = false;
    cacVerified = false;
    tinVerified = false;
    watchlistClean = false;
    watchlistParseError = false;
    creditScore = 0;
    kycStatus = #Pending;
    verifiedAt = null;
  };
};
