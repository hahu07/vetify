import Text "mo:core/Text";
import Time "mo:core/Time";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import Notification "../types/Notification";

module {

  func urlEncode(s : Text) : Text {
    // Replace spaces and basic special chars for form encoding
    var result = "";
    for (c in s.chars()) {
      if (c == ' ') {
        result := result # "%20";
      } else if (c == '+') {
        result := result # "%2B";
      } else if (c == '&') {
        result := result # "%26";
      } else if (c == '=') {
        result := result # "%3D";
      } else {
        result := result # Text.fromChar(c);
      };
    };
    result;
  };

  // Extract a JSON string value
  func extractJsonText(body : Text, key : Text) : ?Text {
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

  public func sendWhatsAppMessage(
    recipientPhone : Text,
    message : Text,
    statusChange : Text,
    transform : Outcall.Transform,
    twilioAuthHeader : Text,
    twilioFrom : Text,
  ) : async Notification.NotificationRecord {
    // twilioFrom format: "accountSid|whatsappFromNumber"
    let parts = twilioFrom.split(#char '|');
    let accountSid = switch (parts.next()) {
      case (?sid) sid;
      case null "";
    };
    let fromNumber = switch (parts.next()) {
      case (?num) num;
      case null twilioFrom;
    };
    let url = "https://api.twilio.com/2010-04-01/Accounts/" # accountSid # "/Messages.json";
    let body = "From=whatsapp%3A%2B" # urlEncode(fromNumber)
      # "&To=whatsapp%3A%2B" # urlEncode(recipientPhone)
      # "&Body=" # urlEncode(message);
    let headers = [
      { name = "Authorization"; value = twilioAuthHeader },
      { name = "Content-Type"; value = "application/x-www-form-urlencoded" },
    ];
    var success = false;
    try {
      let resp = await Outcall.httpPostRequest(url, headers, body, transform);
      // Twilio success: response contains an "sid" field
      switch (extractJsonText(resp, "sid")) {
        case (?_) { success := true };
        case null {
          // Twilio error: log the error message (field "message")
          success := false;
        };
      };
    } catch (_) {
      success := false;
    };
    {
      recipientPhone;
      message;
      statusChange;
      sentAt = Time.now();
      success;
    };
  };
};
