import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import Result "mo:core/Result";

mixin (
  accessControlState : AccessControl.AccessControlState,
  bootstrapState : { var bootstrapped : Bool; var bootstrapAdmin : ?Principal },
) {

  // Bootstrap the very first admin. Callable only once.
  // Caller must match the principal being bootstrapped (prevents hijacking).
  public shared ({ caller }) func bootstrapAdmin(
    p : Principal,
  ) : async { #ok : (); #err : Text } {
    if (bootstrapState.bootstrapped) {
      return #err("Admin already bootstrapped");
    };
    if (caller != p) {
      return #err("Caller must match the principal being bootstrapped");
    };
    AccessControl.assignRole(accessControlState, caller, p, #admin);
    bootstrapState.bootstrapped := true;
    bootstrapState.bootstrapAdmin := ?caller;
    #ok(());
  };

  // Query whether the admin bootstrap has been done
  public query func isAdminBootstrapped() : async Bool {
    bootstrapState.bootstrapped;
  };

  // Query the number of admin principals (1 after bootstrap, 0 before)
  public query func getAdminCount() : async Nat {
    if (bootstrapState.bootstrapped) 1 else 0;
  };

  // Query the bootstrap (super-admin) principal
  public query func getBootstrapAdmin() : async ?Principal {
    bootstrapState.bootstrapAdmin;
  };
};
