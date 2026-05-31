import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import CredentialsTypes "../types/credentials";

mixin (
  accessControlState : AccessControl.AccessControlState,
  credentialsState : { var credentials : CredentialsTypes.CredentialsSettings },
) {
  public type MaskedCredentials = {
    monoSecretKey : Text;
    openAiApiKey : Text;
    twilioAccountSid : Text;
    twilioAuthToken : Text;
    twilioWhatsappFrom : Text;
  };

  // Super-admin only: update all integration credentials
  public shared ({ caller }) func setCredentials(
    newCreds : CredentialsTypes.CredentialsSettings
  ) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Super-admin only");
    };
    credentialsState.credentials := newCreds;
  };

  // SECURITY: credentials are never returned in plaintext to external callers.
  // This endpoint returns only masked values: first 4 chars + "****" if set,
  // or empty string if not configured. Full credential values are never exposed.
  // Super-admin only: retrieve masked credentials for display in the settings panel.
  public shared query ({ caller }) func getCredentials() : async MaskedCredentials {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Super-admin only");
    };
    let c = credentialsState.credentials;
    // Mask: show first 4 chars then **** so the admin can confirm which key is set
    // without exposing the full secret. Empty string if not configured.
    func mask(v : Text) : Text {
      let len = v.size();
      if (len == 0) ""
      else if (len <= 4) "****"
      else v.chars().toArray().sliceToArray(0, 4).foldLeft("", func(acc : Text, c : Char) : Text { acc # Text.fromChar(c) }) # "****"
    };
    {
      monoSecretKey    = mask(c.monoSecretKey);
      openAiApiKey     = mask(c.openAiApiKey);
      twilioAccountSid = mask(c.twilioAccountSid);
      twilioAuthToken  = mask(c.twilioAuthToken);
      twilioWhatsappFrom = mask(c.twilioWhatsappFrom);
    }
  };
};
