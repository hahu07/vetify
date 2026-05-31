import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import ProfileTypes "types/profile";
import DocTypes "types/document";
import NotifTypes "types/Notification";
import AuditTypes "types/audit";
import ProfileMixin "mixins/profile-api";
import DocumentMixin "mixins/document-api";
import AdminMixin "mixins/admin-api";
import FinancierMixin "mixins/financier-api";
import KycMixin "mixins/kyc-api";
import AuditMixin "mixins/audit-api";
import BootstrapMixin "mixins/bootstrap-api";
import CredentialsTypes "types/credentials";
import InviteLinks "mo:caffeineai-invite-links/invite-links-module";
import CredentialsMixin "mixins/credentials-api";
import InviteLinksMixin "mixins/invite-links-api";
import MizanMixin "mixins/mizan-api";
import KashifTypes "types/Kashif";
import KashifMixin "mixins/kashif-api";
import TawthiqAdminMixin "mixins/tawthiq-admin-api";
import CommonTypes "types/common";
import TawthiqAppealMixin "mixins/tawthiq-appeal-api";
import MizanPreliminaryMixin "mixins/mizan-preliminary-api";
import RateLimit "lib/rate-limit";
import Prim "mo:prim";
import TawthiqTypes "types/Tawthiq";
import IndividualTypes "types/IndividualProfile";

import IndividualMixin "mixins/individual-api";
import AnalyticsMixin "mixins/analytics-api";
import NotificationMixin "mixins/notification-api";




actor {
  // ── Authorization state ─────────────────────────────────────────────
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // ── Object storage (document upload infrastructure) ────────────────
  include MixinObjectStorage();

  // ── Domain state ────────────────────────────────────────────────
  let businessProfiles   = Map.empty<Principal, ProfileTypes.BusinessProfile>();
  let financierProfiles  = Map.empty<Principal, ProfileTypes.FinancierProfile>();
  let documents          = Map.empty<(Principal, DocTypes.DocumentType), DocTypes.DocumentRecord>();
  let notifications      = Map.empty<Principal, NotifTypes.NotificationRecord>();
  let auditEntries       = List.empty<AuditTypes.AuditEntry>();
  let bootstrapState     = { var bootstrapped = false; var bootstrapAdmin = null : ?Principal };
  let credentialsState   = { var credentials = CredentialsTypes.defaultCredentials };
  let inviteLinksState   = InviteLinks.initState();
  let kashifCache        = Map.empty<Principal, KashifTypes.KashifCacheEntry>();
  let shortlists         = Map.empty<Principal, List.List<KashifTypes.ShortlistEntry>>();
  let kashifLogs         = Map.empty<Principal, KashifTypes.KashifReportLog>();
  let tawthiqAdminNotes  = Map.empty<CommonTypes.UserId, Text>();
  let tawthiqAppeals     = Map.empty<Text, List.List<TawthiqTypes.TawthiqAppeal>>();
  let rateLimitState     = RateLimit.init();
  let stableStateVersion : Nat = 2;
  let kashifScoringConfig = { var config = KashifTypes.defaultScoringConfig };
  let individualsProfiles    = Map.empty<Principal, IndividualTypes.IndividualProfile>();
  let accountClosureRequests = Map.empty<Text, AuditTypes.AccountClosureRequest>();

  // ── Mixin inclusions ───────────────────────────────────────────────
  include ProfileMixin(accessControlState, businessProfiles, financierProfiles);
  include DocumentMixin(accessControlState, documents);
  include AdminMixin(accessControlState, businessProfiles, financierProfiles, documents, notifications, auditEntries, transform, credentialsState);
  include FinancierMixin(accessControlState, businessProfiles, financierProfiles);
  include KycMixin(accessControlState, businessProfiles, notifications, auditEntries, credentialsState, rateLimitState);
  include AuditMixin(accessControlState, auditEntries);
  include BootstrapMixin(accessControlState, bootstrapState);
  include CredentialsMixin(accessControlState, credentialsState);
  include InviteLinksMixin(accessControlState, inviteLinksState);
  include MizanMixin(accessControlState, businessProfiles, transform, credentialsState, rateLimitState, auditEntries);
  include KashifMixin(accessControlState, businessProfiles, financierProfiles, kashifCache, shortlists, kashifLogs, transform, credentialsState, auditEntries, kashifScoringConfig, rateLimitState);
  include TawthiqAdminMixin(accessControlState, businessProfiles, tawthiqAdminNotes);
  include TawthiqAppealMixin(accessControlState, businessProfiles, tawthiqAppeals, transform, credentialsState);
  include MizanPreliminaryMixin(accessControlState, businessProfiles, transform, credentialsState);
  include IndividualMixin(accessControlState, individualsProfiles, notifications, auditEntries, accountClosureRequests, credentialsState, rateLimitState, transform);
  include AnalyticsMixin(accessControlState, businessProfiles, individualsProfiles, financierProfiles, accountClosureRequests, notifications, auditEntries, credentialsState, transform);
  include NotificationMixin(notifications);
  public query func getStableStateVersion() : async Nat { stableStateVersion };
  public query func getCycleBalance() : async Nat { Prim.cyclesBalance() };
};

