import Result "mo:core/Result";
import Time "mo:core/Time";
import Messaging "../types/Messaging";
import MessagingLib "../lib/messaging";

mixin (
  messagingState : MessagingLib.MessagingState,
) {

  // ── Send a message ─────────────────────────────────────────────────────────────
  // Either participant (applicant or financier) may initiate or reply.
  // Returns the assigned messageId on success.
  public shared ({ caller }) func send_message(
    applicantId : Text,
    financierId : Text,
    recipientId : Principal,
    messageText : Text,
  ) : async Result.Result<Nat, Text> {
    MessagingLib.sendMessage(
      messagingState,
      applicantId,
      financierId,
      caller,
      recipientId,
      messageText,
      Time.now(),
    );
  };

  // ── Retrieve all messages in a thread ─────────────────────────────────────────
  // Only participants of the thread (applicantId principal or financierId principal)
  // may read its messages.
  public query ({ caller }) func get_thread_messages(
    applicantId : Text,
    financierId : Text,
  ) : async [Messaging.Message] {
    MessagingLib.getThreadMessages(messagingState, applicantId, financierId, caller);
  };

  // ── Mark messages in a thread as read ─────────────────────────────────────────
  public shared ({ caller }) func mark_messages_read(
    applicantId : Text,
    financierId : Text,
  ) : async Result.Result<(), Text> {
    MessagingLib.markMessagesRead(messagingState, applicantId, financierId, caller);
  };

  // ── List all threads for the caller ───────────────────────────────────────────
  public query ({ caller }) func get_my_threads() : async [Messaging.DirectMessageThread] {
    MessagingLib.getMyThreads(messagingState, caller);
  };

  // ── Count unread messages across all threads ───────────────────────────────────
  public query ({ caller }) func get_unread_count() : async Nat {
    MessagingLib.getUnreadCount(messagingState, caller);
  };
};
