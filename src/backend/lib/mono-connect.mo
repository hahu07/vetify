import Time "mo:core/Time";
import Text "mo:core/Text";
import Result "mo:core/Result";
import Nat32 "mo:core/Nat32";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import MonoBankLink "../types/MonoBankLink";
import Char "mo:core/Char";

module {

  // Extract a JSON string value: finds "key":"value" and returns value
  func extractText(json : Text, key : Text) : ?Text {
    let search = "\"" # key # "\":\"";
    let parts = json.split(#text search);
    ignore parts.next();
    switch (parts.next()) {
      case null null;
      case (?rest) {
        switch (rest.split(#text "\"").next()) {
          case null null;
          case (?v) ?v;
        };
      };
    };
  };

  // Extract a JSON integer value
  func extractNat(json : Text, key : Text) : ?Nat {
    let search = "\"" # key # "\":";
    let parts = json.split(#text search);
    ignore parts.next();
    switch (parts.next()) {
      case null null;
      case (?rest) {
        let trimmed = rest.trimStart(#char ' ');
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

  public func pullBankData(
    accountId : Text,
    transform : Outcall.Transform,
    monoKey : Text,
  ) : async { #ok : MonoBankLink.BankLinkRecord; #err : Text } {
    let authHeader : Outcall.Header = { name = "Authorization"; value = "Bearer " # monoKey };
    let headers = [authHeader];
    let baseUrl = "https://api.withmono.com/accounts/";

    // ISSUE 9 FIX: Collect all 4 HTTP results before committing any state.
    // All 4 must succeed or we return #err — no partial state.

    // 1. Account info
    let accountResp = await Outcall.httpGetRequest(
      baseUrl # accountId,
      headers,
      transform,
    );
    let institutionName = switch (extractText(accountResp, "institution")) {
      case (?v) v;
      case null { return #err("account_info: missing 'institution' field") };
    };
    let balance = switch (extractNat(accountResp, "balance")) {
      case (?v) v;
      case null { return #err("account_info: missing 'balance' field") };
    };
    let currency = switch (extractText(accountResp, "currency")) {
      case (?v) v;
      case null { return #err("account_info: missing 'currency' field") };
    };

    // 2. Transactions
    let txResp = await Outcall.httpGetRequest(
      baseUrl # accountId # "/transactions",
      headers,
      transform,
    );
    let totalCredits = switch (extractNat(txResp, "total_credits")) {
      case (?v) v;
      case null { return #err("transactions: missing 'total_credits' field") };
    };
    let totalDebits = switch (extractNat(txResp, "total_debits")) {
      case (?v) v;
      case null { return #err("transactions: missing 'total_debits' field") };
    };
    let months = switch (extractNat(txResp, "months")) {
      case (?v) v;
      case null 0;  // months is best-effort, not a blocking field
    };

    // 3. Income analysis
    let incomeResp = await Outcall.httpGetRequest(
      baseUrl # accountId # "/income",
      headers,
      transform,
    );
    let income = switch (extractNat(incomeResp, "monthly_income")) {
      case (?v) v;
      case null { return #err("income: missing 'monthly_income' field") };
    };

    // All 4 calls succeeded — now safe to build and return the complete record
    #ok({
      status = #Linked;
      accountId = ?accountId;
      institutionName = ?institutionName;
      balance = ?balance;
      currency = ?currency;
      linkedAt = ?Time.now();
      transactionSummary = ?{
        income;
        totalCredits;
        totalDebits;
        months;
      };
    });
  };
};
