import Map "mo:core/Map";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import DocTypes "../types/document";
import List "mo:core/List";
import Time "mo:core/Time";
import Storage "mo:caffeineai-object-storage/Storage";

module {
  // Compare function for tuple key (Principal, DocumentType)
  func comparePrincipalDocType(
    a : (Principal, DocTypes.DocumentType),
    b : (Principal, DocTypes.DocumentType),
  ) : Order.Order {
    let pc = Principal.compare(a.0, b.0);
    if (pc != #equal) return pc;
    let aTag = switch (a.1) { case (#governmentId) 0; case (#bankStatement) 1; case (#cacCertificate) 2 };
    let bTag = switch (b.1) { case (#governmentId) 0; case (#bankStatement) 1; case (#cacCertificate) 2 };
    if (aTag < bTag) #less else if (aTag > bTag) #greater else #equal;
  };

  // Upsert a document record for the given user and document type
  public func saveDocument(
    documents : Map.Map<(Principal, DocTypes.DocumentType), DocTypes.DocumentRecord>,
    userId : Principal,
    docType : DocTypes.DocumentType,
    storageRef : Storage.ExternalBlob,
  ) : DocTypes.DocumentRecord {
    let record : DocTypes.DocumentRecord = {
      userId;
      docType;
      uploadStatus = #uploaded;
      storageRef = ?storageRef;
      uploadedAt = ?Time.now();
    };
    documents.add(comparePrincipalDocType, (userId, docType), record);
    record;
  };

  // List all document records for a user
  public func listDocuments(
    documents : Map.Map<(Principal, DocTypes.DocumentType), DocTypes.DocumentRecord>,
    userId : Principal,
  ) : [DocTypes.DocumentRecord] {
    let result = List.empty<DocTypes.DocumentRecord>();
    for (((owner, _), record) in documents.entries()) {
      if (owner == userId) {
        result.add(record);
      };
    };
    result.toArray();
  };

  // Get a single document record for a user
  public func getDocument(
    documents : Map.Map<(Principal, DocTypes.DocumentType), DocTypes.DocumentRecord>,
    userId : Principal,
    docType : DocTypes.DocumentType,
  ) : ?DocTypes.DocumentRecord {
    documents.get(comparePrincipalDocType, (userId, docType));
  };
};
