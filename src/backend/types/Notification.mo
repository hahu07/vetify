import Common "common";

module {
  public type NotificationRecord = {
    recipientPhone : Text;
    message : Text;
    statusChange : Text;
    sentAt : Common.Timestamp;
    success : Bool;
  };
};
