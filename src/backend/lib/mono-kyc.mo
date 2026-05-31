import Text "mo:core/Text";
import Time "mo:core/Time";
import Result "mo:core/Result";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import MonoKyc "../types/MonoKyc";
import Nat32 "mo:core/Nat32";
import Char "mo:core/Char";

module {

  // Extract a JSON string value: finds "key":"value" and returns value
  func _extractJsonText(body : Text, key : Text) : ?Text {
    let needle = "\"" # key # "\":\"";
    let parts = body.split(#text needle);
    ignore parts.next();
    switch (parts.next()) {
      case null null;
      case (?after) {
        switch (after.split(#text "\"").next()) {
          case null null;
          case (?val) ?val;
        };
      };
    };
  };

  // Extract a JSON boolean value: finds "key":true or "key":false
  func extractJsonBool(body : Text, key : Text) : ?Bool {
    let needle = "\"" # key # "\":";
    let parts = body.split(#text needle);
    ignore parts.next();
    switch (parts.next()) {
      case null null;
      case (?after) {
        let trimmed = after.trimStart(#char ' ');
        if (trimmed.startsWith(#text "true")) ?true
        else if (trimmed.startsWith(#text "false")) ?false
        else null;
      };
    };
  };

  // Extract a JSON integer value
  func extractJsonNat(body : Text, key : Text) : ?Nat {
    let needle = "\"" # key # "\":";
    let parts = body.split(#text needle);
    ignore parts.next();
    switch (parts.next()) {
      case null null;
      case (?after) {
        let trimmed = after.trimStart(#char ' ');
        var result = 0;
        var found = false;
        for (c in trimmed.chars()) {
          if (c >= '0' and c <= '9') {
            result := result * 10 + (c.toNat32().toNat() - 48);
            found := true;
          } else if (found) {
            return ?result;
          };
        };
        if (found) ?result else null;
      };
    };
  };

  // ── Prompt-injection safe field sanitizer ──────────────────────────────────
  // Also used for whitespace-normalising before text-extract helpers.
  func sanitizeInput(s : Text) : Text {
    let lower = s.toLower();
    // Block injection keywords in user-supplied strings
    let blocked = [
      "ignore", "disregard", "forget previous", "you are now",
      "act as", "jailbreak", "override instructions"
    ];
    for (kw in blocked.vals()) {
      if (lower.contains(#text kw)) {
        return "[REDACTED]";
      };
    };
    // Truncate to 500 chars max for KYC fields
    if (s.size() > 500) {
      s.chars().toArray().sliceToArray(0, 500).foldLeft("", func(acc, c) { acc # Text.fromChar(c) })
    } else s
  };

  public func triggerKycVerification(
    bvn : Text,
    nin : Text,
    cacNumber : Text,
    tinNumber : Text,
    transform : Outcall.Transform,
    monoKey : Text,
  ) : async { #ok : MonoKyc.KycCheckRecord; #err : Text } {
    let sBvn = sanitizeInput(bvn);
    let sNin = sanitizeInput(nin);
    let sCac = sanitizeInput(cacNumber);
    let sTin = sanitizeInput(tinNumber);

    let authHeader : Outcall.Header = { name = "Authorization"; value = "Bearer " # monoKey };
    let contentType : Outcall.Header = { name = "Content-Type"; value = "application/json" };
    let headers = [authHeader, contentType];

    // BVN verification
    let bvnBody = "{\"bvn\":\"" # sBvn # "\"}";
    let bvnResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/bvn",
      headers,
      bvnBody,
      transform,
    );
    let bvnOk = switch (extractJsonBool(bvnResp, "verified")) {
      case (?v) v;
      // SECURE DEFAULT: missing field means unverified
      case null { return #err("KYC parse error: missing 'verified' in BVN response") };
    };

    // NIN verification
    let ninBody = "{\"nin\":\"" # sNin # "\"}";
    let ninResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/nin",
      headers,
      ninBody,
      transform,
    );
    let ninOk = switch (extractJsonBool(ninResp, "verified")) {
      case (?v) v;
      case null { return #err("KYC parse error: missing 'verified' in NIN response") };
    };

    // CAC verification
    let cacBody = "{\"rc_number\":\"" # sCac # "\"}";
    let cacResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/cac",
      headers,
      cacBody,
      transform,
    );
    let cacOk = switch (extractJsonBool(cacResp, "verified")) {
      case (?v) v;
      case null { return #err("KYC parse error: missing 'verified' in CAC response") };
    };

    // TIN verification
    let tinBody = "{\"tin\":\"" # sTin # "\"}";
    let tinResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/tin",
      headers,
      tinBody,
      transform,
    );
    let tinOk = switch (extractJsonBool(tinResp, "verified")) {
      case (?v) v;
      case null false; // TIN is best-effort; don't abort on missing field
    };

    // Watchlist screening — SECURE DEFAULT: missing field = flagged (unknown = fail-safe)
    let watchBody = "{\"bvn\":\"" # sBvn # "\"}";
    let watchResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/watchlist",
      headers,
      watchBody,
      transform,
    );
    // watchlistClean = true ONLY when API explicitly returns flagged:false
    // On any parse failure or missing field: clean=false, checked=false
    let (watchClean, watchParseError) = switch (extractJsonBool(watchResp, "flagged")) {
      case (?flagged) (not flagged, false);
      case null (false, true);  // unknown result — must default to unsafe/not-clean
    };

    // Credit history
    let creditBody = "{\"bvn\":\"" # sBvn # "\"}";
    let creditResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/credit-history",
      headers,
      creditBody,
      transform,
    );
    // SECURE DEFAULT: missing credit score = 0 (worst case)
    let creditScore = switch (extractJsonNat(creditResp, "score")) {
      case (?s) s;
      case null 0;
    };

    let allVerified = bvnOk and ninOk and cacOk;
    #ok({
      bvnVerified = bvnOk;
      ninVerified = ninOk;
      cacVerified = cacOk;
      tinVerified = tinOk;
      watchlistClean = watchClean;
      watchlistParseError = watchParseError;
      creditScore;
      kycStatus = if (allVerified) #Verified else #Failed;
      verifiedAt = ?Time.now();
    });
  };
  // ── Individual KYC: BVN + NIN + watchlist only (no CAC/TIN) ─────────────────
  public func triggerIndividualKyc(
    bvn : Text,
    nin : Text,
    transform : Outcall.Transform,
    monoKey : Text,
  ) : async { #ok : MonoKyc.KycCheckRecord; #err : Text } {
    let sBvn = sanitizeInput(bvn);
    let sNin = sanitizeInput(nin);

    let authHeader : Outcall.Header = { name = "Authorization"; value = "Bearer " # monoKey };
    let contentType : Outcall.Header = { name = "Content-Type"; value = "application/json" };
    let headers = [authHeader, contentType];

    // BVN verification
    let bvnBody = "{\"bvn\":\"" # sBvn # "\"}";
    let bvnResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/bvn",
      headers,
      bvnBody,
      transform,
    );
    let bvnOk = switch (extractJsonBool(bvnResp, "verified")) {
      case (?v) v;
      case null { return #err("KYC parse error: missing 'verified' in BVN response") };
    };

    // NIN verification
    let ninBody = "{\"nin\":\"" # sNin # "\"}";
    let ninResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/nin",
      headers,
      ninBody,
      transform,
    );
    let ninOk = switch (extractJsonBool(ninResp, "verified")) {
      case (?v) v;
      case null { return #err("KYC parse error: missing 'verified' in NIN response") };
    };

    // Watchlist screening — SECURE DEFAULT: missing field = flagged
    let watchBody = "{\"bvn\":\"" # sBvn # "\"}";
    let watchResp = await Outcall.httpPostRequest(
      "https://api.withmono.com/v2/lookup/watchlist",
      headers,
      watchBody,
      transform,
    );
    let (watchClean, watchParseError) = switch (extractJsonBool(watchResp, "flagged")) {
      case (?flagged) (not flagged, false);
      case null (false, true);
    };

    let allVerified = bvnOk and ninOk;
    #ok({
      bvnVerified = bvnOk;
      ninVerified = ninOk;
      cacVerified = false;
      tinVerified = false;
      watchlistClean = watchClean;
      watchlistParseError = watchParseError;
      creditScore = 0;
      kycStatus = if (allVerified) #Verified else #Failed;
      verifiedAt = ?Time.now();
    });
  };
};
