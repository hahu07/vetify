import Common "common";
import Storage "mo:caffeineai-object-storage/Storage";

module {
  // Document categories
  public type DocumentType = {
    #governmentId;
    #bankStatement;
    #cacCertificate;
  };

  // Upload status for a single document slot
  public type UploadStatus = {
    #notUploaded;
    #uploaded;
  };

  // Metadata record stored per uploaded document
  public type DocumentRecord = {
    userId : Common.UserId;
    docType : DocumentType;
    uploadStatus : UploadStatus;
    storageRef : ?Storage.ExternalBlob;  // null until uploaded
    uploadedAt : ?Common.Timestamp;
  };
};
