import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Storage "mo:caffeineai-object-storage/Storage";
import DocTypes "../types/document";
import DocLib "../lib/document";

mixin (
  accessControlState : AccessControl.AccessControlState,
  documents : Map.Map<(Principal, DocTypes.DocumentType), DocTypes.DocumentRecord>,
) {

  // Upload or update a document reference for the caller
  public shared ({ caller }) func uploadDocument(
    docType : DocTypes.DocumentType,
    storageRef : Storage.ExternalBlob,
  ) : async DocTypes.DocumentRecord {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    DocLib.saveDocument(documents, caller, docType, storageRef);
  };

  // List all document records for the caller
  public query ({ caller }) func listMyDocuments() : async [DocTypes.DocumentRecord] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    DocLib.listDocuments(documents, caller);
  };

  // Get a specific document for the caller
  public query ({ caller }) func getMyDocument(
    docType : DocTypes.DocumentType,
  ) : async ?DocTypes.DocumentRecord {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    DocLib.getDocument(documents, caller, docType);
  };

  // Admin: get document list for any user
  public query ({ caller }) func getDocumentsForUser(
    userId : Principal,
  ) : async [DocTypes.DocumentRecord] {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    DocLib.listDocuments(documents, userId);
  };
};
