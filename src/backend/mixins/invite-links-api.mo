import Runtime "mo:core/Runtime";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Random "mo:core/Random";
import AccessControl "mo:caffeineai-authorization/access-control";
import InviteLinks "mo:caffeineai-invite-links/invite-links-module";
import Array "mo:core/Array";

mixin (
  accessControlState : AccessControl.AccessControlState,
  inviteLinksState : InviteLinks.InviteLinksSystemState,
) {
  // 7 days in nanoseconds
  let sevenDaysNs : Int = 7 * 24 * 60 * 60 * 1_000_000_000;

  public type InviteLinkRecord = {
    code : Text;
    createdAt : Int;
    expiresAt : Int;
    status : Text; // "active" | "expired" | "used"
  };

  // Super-admin only: generate a single-use 7-day admin invite link
  public shared ({ caller }) func generateAdminInviteLink() : async Result.Result<Text, Text> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Super-admin only");
    };
    let blob = await Random.blob();
    let code = InviteLinks.generateUUID(blob);
    InviteLinks.generateInviteCode(inviteLinksState, code);
    #ok(code)
  };

  // Super-admin only: list all generated admin invite links with status
  public shared query ({ caller }) func listAdminInviteLinks() : async [InviteLinkRecord] {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Super-admin only");
    };
    let now = Time.now();
    let codes = InviteLinks.getInviteCodes(inviteLinksState);
    codes.map<InviteLinks.InviteCode, InviteLinkRecord>(
      func(ic) {
        let expiresAt = ic.created + sevenDaysNs;
        let status = if (ic.used) {
          "used"
        } else if (now > expiresAt) {
          "expired"
        } else {
          "active"
        };
        {
          code = ic.code;
          createdAt = ic.created;
          expiresAt;
          status;
        }
      }
    )
  };

  // Super-admin only: revoke an invite link by marking it as used
  public shared ({ caller }) func revokeAdminInviteLink(code : Text) : async Result.Result<(), Text> {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Unauthorized: Super-admin only");
    };
    switch (inviteLinksState.inviteCodes.get(code)) {
      case null { #err("Invite code not found") };
      case (?ic) {
        if (ic.used) {
          return #err("Invite code already used or revoked");
        };
        inviteLinksState.inviteCodes.add(code, { ic with used = true });
        #ok(())
      };
    }
  };

  // Public: validate an invite link (exists, not expired, not used)
  public query func validateAdminInviteLink(code : Text) : async Bool {
    let now = Time.now();
    switch (inviteLinksState.inviteCodes.get(code)) {
      case null { false };
      case (?ic) {
        let expiresAt = ic.created + sevenDaysNs;
        not ic.used and now <= expiresAt
      };
    }
  };

  // Public: redeem an invite link during admin registration
  public shared ({ caller }) func redeemAdminInviteLink(code : Text) : async Result.Result<(), Text> {
    let now = Time.now();
    switch (inviteLinksState.inviteCodes.get(code)) {
      case null { #err("Invalid invite code") };
      case (?ic) {
        let expiresAt = ic.created + sevenDaysNs;
        if (ic.used) {
          return #err("Invite code has already been used");
        };
        if (now > expiresAt) {
          return #err("Invite code has expired");
        };
        inviteLinksState.inviteCodes.add(code, { ic with used = true });
        AccessControl.assignRole(accessControlState, caller, caller, #admin);
        #ok(())
      };
    }
  };
};
