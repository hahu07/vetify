import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Messaging "../types/Messaging";
import Array "mo:core/Array";
import Result "mo:core/Result";

module {
  // State slice passed from main.mo via the mixin.
  public type MessagingState = {
    threads : Map.Map<Text, Messaging.DirectMessageThread>;
    var nextMessageId : Nat;
  };

  // Build the canonical thread id from applicantId and financierId.
  public func buildThreadId(applicantId : Text, financierId : Text) : Text {
    applicantId # "#" # financierId;
  };

  // Send a message in an existing or newly created thread.
  // Returns the assigned messageId on success.
  public func sendMessage(
    state : MessagingState,
    applicantId : Text,
    financierId : Text,
    senderId : Principal,
    recipientId : Principal,
    messageText : Text,
    now : Int,
  ) : Result.Result<Nat, Text> {
    let threadId = buildThreadId(applicantId, financierId);
    let msgId = state.nextMessageId;
    state.nextMessageId += 1;

    let newMsg : Messaging.Message = {
      messageId = msgId;
      senderId;
      recipientId;
      applicantId;
      financierId;
      messageText;
      timestamp = now;
      isRead = false;
    };

    switch (state.threads.get(threadId)) {
      case (?existing) {
        let updatedThread : Messaging.DirectMessageThread = {
          existing with
          messages = existing.messages.concat([newMsg]);
          lastMessageAt = now;
        };
        state.threads.add(threadId, updatedThread);
      };
      case null {
        let thread : Messaging.DirectMessageThread = {
          threadId;
          participantIds = [senderId, recipientId];
          messages = [newMsg];
          lastMessageAt = now;
        };
        state.threads.add(threadId, thread);
      };
    };

    #ok msgId;
  };

  // Retrieve all messages in a thread, visible only to participants.
  public func getThreadMessages(
    state : MessagingState,
    applicantId : Text,
    financierId : Text,
    callerId : Principal,
  ) : [Messaging.Message] {
    let threadId = buildThreadId(applicantId, financierId);
    switch (state.threads.get(threadId)) {
      case null { [] };
      case (?thread) {
        // Only participants may read the thread
        let isParticipant = thread.participantIds.find<Principal>(func(p) { p == callerId }) != null;
        if (isParticipant) { thread.messages } else { [] };
      };
    };
  };

  // Mark all messages in a thread as read for the given reader.
  public func markMessagesRead(
    state : MessagingState,
    applicantId : Text,
    financierId : Text,
    readerId : Principal,
  ) : Result.Result<(), Text> {
    let threadId = buildThreadId(applicantId, financierId);
    switch (state.threads.get(threadId)) {
      case null { #err "Thread not found" };
      case (?thread) {
        let isParticipant = thread.participantIds.find<Principal>(func(p) { p == readerId }) != null;
        if (not isParticipant) {
          return #err "Not a participant";
        };
        let updatedMessages = thread.messages.map(func(msg) {
            if (msg.recipientId == readerId and not msg.isRead) {
              { msg with isRead = true }
            } else {
              msg
            }
          }
        );
        let updatedThread : Messaging.DirectMessageThread = {
          thread with messages = updatedMessages
        };
        state.threads.add(threadId, updatedThread);
        #ok ();
      };
    };
  };

  // Return all threads in which the caller is a participant.
  public func getMyThreads(
    state : MessagingState,
    caller : Principal,
  ) : [Messaging.DirectMessageThread] {
    let result = List.empty<Messaging.DirectMessageThread>();
    for ((_, thread) in state.threads.entries()) {
      let isParticipant = thread.participantIds.find<Principal>(func(p) { p == caller }) != null;
      if (isParticipant) { result.add(thread) };
    };
    result.toArray();
  };

  // Count unread messages across all threads for the caller.
  public func getUnreadCount(
    state : MessagingState,
    caller : Principal,
  ) : Nat {
    var count = 0;
    for ((_, thread) in state.threads.entries()) {
      let isParticipant = thread.participantIds.find<Principal>(func(p) { p == caller }) != null;
      if (isParticipant) {
        for (msg in thread.messages.values()) {
          if (msg.recipientId == caller and not msg.isRead) {
            count += 1;
          };
        };
      };
    };
    count;
  };
};
