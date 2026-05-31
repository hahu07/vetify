import Blob "mo:core/Blob";
import Text "mo:core/Text";
import Nat8 "mo:core/Nat8";
import CredentialsTypes "../types/credentials";

// SECURITY: All functions in this module are internal helpers only.
// They are called exclusively by other lib/ modules (mono-kyc, mono-connect,
// ai-scoring, mizan, kashif, tawthiq, whatsapp) that need credentials at
// runtime to make HTTP outcalls. These functions MUST NOT be exposed as
// public canister endpoints.
//
// SECURITY: credentials are never returned in plaintext to external callers.
// The only external-facing credential endpoint is credentials-api.mo
// readCredentials(), which returns only masked values (first 4 chars + "****"),
// and that endpoint requires an admin role check.
module {
  public type TwilioCredentials = {
    accountSid : Text;
    authToken : Text;
    whatsappFrom : Text;
  };

  // INTERNAL USE ONLY — called by lib/mono-kyc.mo and lib/mono-connect.mo
  public func getMonoKey(creds : CredentialsTypes.CredentialsSettings) : Text {
    creds.monoSecretKey
  };

  // INTERNAL USE ONLY — called by lib/ai-scoring.mo, lib/mizan.mo, lib/kashif.mo, lib/tawthiq.mo
  public func getOpenAiKey(creds : CredentialsTypes.CredentialsSettings) : Text {
    creds.openAiApiKey
  };

  // INTERNAL USE ONLY — called by lib/whatsapp.mo
  public func getTwilioCredentials(creds : CredentialsTypes.CredentialsSettings) : TwilioCredentials {
    {
      accountSid = creds.twilioAccountSid;
      authToken = creds.twilioAuthToken;
      whatsappFrom = creds.twilioWhatsappFrom;
    }
  };

  // INTERNAL USE ONLY — convenience wrapper used by lib/whatsapp.mo
  public func getTwilioAuthHeader(creds : CredentialsTypes.CredentialsSettings) : Text {
    buildTwilioAuthHeader(creds)
  };

  // INTERNAL USE ONLY — convenience: returns "accountSid|whatsappFrom" for lib/whatsapp.mo
  public func getTwilioFrom(creds : CredentialsTypes.CredentialsSettings) : Text {
    creds.twilioAccountSid # "|" # creds.twilioWhatsappFrom
  };

  // INTERNAL USE ONLY — builds the Basic auth header by base64-encoding "sid:token"
  public func buildTwilioAuthHeader(creds : CredentialsTypes.CredentialsSettings) : Text {
    let raw = creds.twilioAccountSid # ":" # creds.twilioAuthToken;
    "Basic " # base64Encode(raw)
  };

  private func base64Encode(input : Text) : Text {
    let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let alphabetChars = alphabet.chars().toArray();
    let bytes = input.encodeUtf8().toArray();
    let len = bytes.size();
    var result = "";
    var i = 0;
    while (i < len) {
      let b0 : Nat = bytes[i].toNat();
      let b1 : Nat = if (i + 1 < len) bytes[i + 1].toNat() else 0;
      let b2 : Nat = if (i + 2 < len) bytes[i + 2].toNat() else 0;

      let n0 = b0 / 4;
      let n1 = (b0 % 4) * 16 + b1 / 16;
      let n2 = (b1 % 16) * 4 + b2 / 64;
      let n3 = b2 % 64;

      result #= Text.fromChar(alphabetChars[n0]);
      result #= Text.fromChar(alphabetChars[n1]);
      result #= if (i + 1 < len) Text.fromChar(alphabetChars[n2]) else "=";
      result #= if (i + 2 < len) Text.fromChar(alphabetChars[n3]) else "=";
      i += 3;
    };
    result
  };
};
