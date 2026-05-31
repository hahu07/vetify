module {
  public type CredentialsSettings = {
    monoSecretKey : Text;
    openAiApiKey : Text;
    twilioAccountSid : Text;
    twilioAuthToken : Text;
    twilioWhatsappFrom : Text;
  };

  public let defaultCredentials : CredentialsSettings = {
    monoSecretKey = "";
    openAiApiKey = "";
    twilioAccountSid = "";
    twilioAuthToken = "";
    twilioWhatsappFrom = "";
  };
};
