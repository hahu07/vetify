import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";

module {

  // Stable map: principal -> last-call nanosecond timestamp
  public type RateLimitState = Map.Map<Principal, Int>;

  public func init() : RateLimitState {
    Map.empty<Principal, Int>()
  };

  // Check whether the caller is within the cooldown window.
  // Returns true (allowed) and records the current timestamp.
  // Returns false (denied) if the caller called too recently.
  public func checkAndRecord(
    state : RateLimitState,
    caller : Principal,
    cooldownNanos : Int,
  ) : Bool {
    let now = Time.now();
    switch (state.get(caller)) {
      case (?last) {
        if (now - last < cooldownNanos) {
          return false; // still within cooldown
        };
      };
      case null {}; // first call — always allowed
    };
    state.add(caller, now);
    true;
  };
};
