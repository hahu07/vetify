import Debug "mo:core/Debug";

module {
  // A single direct message between a financier and an applicant.
  public type Message = {
    messageId : Nat;
    senderId : Principal;
    recipientId : Principal;
    applicantId : Text;
    financierId : Text;
    messageText : Text;
    timestamp : Int;
    isRead : Bool;
  };

  // A conversation thread keyed by applicantId#financierId.
  public type DirectMessageThread = {
    threadId : Text;           // applicantId # "#" # financierId
    participantIds : [Principal];
    messages : [Message];
    lastMessageAt : Int;
  };
};
