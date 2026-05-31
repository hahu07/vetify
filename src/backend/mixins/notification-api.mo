import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Notification "../types/Notification";

mixin (
  notifications : Map.Map<Principal, Notification.NotificationRecord>,
) {

  // ── Get notifications for caller (paginated, newest-first) ────────────────────
  // The existing notifications Map stores one record per principal (the latest).
  // We expose a single record as a 1-item page to remain additive.
  public query ({ caller }) func getMyNotifications(
    page : Nat,
    pageSize : Nat,
  ) : async Result.Result<{ items : [Notification.NotificationRecord]; total : Nat }, Text> {
    let effectivePageSize = if (pageSize == 0) 20 else if (pageSize > 50) 50 else pageSize;
    ignore effectivePageSize;
    ignore page;
    switch (notifications.get(caller)) {
      case null #ok({ items = []; total = 0 });
      case (?n) #ok({ items = [n]; total = 1 });
    };
  };

  // ── Count unread notifications for caller ─────────────────────────────────────
  // Current model has one record per principal — always 0 or 1 unread.
  public query ({ caller }) func getUnreadNotificationCount() : async Result.Result<Nat, Text> {
    switch (notifications.get(caller)) {
      case null #ok(0);
      case (?_) #ok(1);
    };
  };

  // ── Mark all notifications as read ────────────────────────────────────────────
  // Current model: clearing the notification record from the map marks it read.
  public shared ({ caller }) func markNotificationsRead() : async Result.Result<(), Text> {
    ignore notifications.remove(caller);
    #ok(());
  };
};
