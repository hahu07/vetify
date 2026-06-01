import { FullPageLoader } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/use-auth";
import AdminInviteRegister from "@/pages/AdminInviteRegister";
import AdminSettings from "@/pages/AdminSettings";
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from "@tanstack/react-router";
import { Suspense, lazy, useEffect } from "react";

// Lazy-loaded pages
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const RegisterBusinessPage = lazy(() => import("@/pages/RegisterBusinessPage"));
const RegisterFinancierPage = lazy(
  () => import("@/pages/RegisterFinancierPage"),
);
const ApplicantDashboard = lazy(() => import("@/pages/ApplicantDashboard"));
const FinancierDashboard = lazy(() => import("@/pages/FinancierDashboard"));
const KashifDiscoverPage = lazy(() => import("@/pages/KashifDiscoverPage"));
const KashifShortlistPage = lazy(() => import("@/pages/KashifShortlistPage"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminApplicantsPage = lazy(() => import("@/pages/AdminApplicantsPage"));
const AdminFinanciersPage = lazy(() => import("@/pages/AdminFinanciersPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const EditProfilePage = lazy(() => import("@/pages/EditProfilePage"));
const AdminMizanReviewPage = lazy(() => import("@/pages/AdminMizanReviewPage"));
const AdminMessagesPage = lazy(() => import("@/pages/AdminMessagesPage"));
const AuditTrailPage = lazy(() => import("@/pages/AuditTrailPage"));
const AdminBootstrap = lazy(() => import("@/pages/AdminBootstrap"));
const AdminTawthiqOverviewPage = lazy(
  () => import("@/pages/AdminTawthiqOverviewPage"),
);
const AdminTawthiqPendingPage = lazy(
  () => import("@/pages/AdminTawthiqPendingPage"),
);
const AdminTawthiqAssessmentsPage = lazy(
  () => import("@/pages/AdminTawthiqAssessmentsPage"),
);
const RegisterIndividualPage = lazy(
  () => import("@/pages/RegisterIndividualPage"),
);
const IndividualDashboard = lazy(() => import("@/pages/IndividualDashboard"));
const IndividualKycPage = lazy(() => import("@/pages/IndividualKycPage"));
const IndividualScoresPage = lazy(() => import("@/pages/IndividualScoresPage"));
const IndividualProfilePage = lazy(
  () => import("@/pages/IndividualProfilePage"),
);
const IndividualBankPage = lazy(() => import("@/pages/IndividualBankPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const MessagesPage = lazy(() => import("@/pages/MessagesPage"));
const PublicProfilePage = lazy(() => import("@/pages/PublicProfilePage"));
const PrivacySettingsPage = lazy(() => import("@/pages/PrivacySettingsPage"));
const DealPipelinePage = lazy(() => import("@/pages/DealPipelinePage"));

// Root route
const rootRoute = createRootRoute();

// Auth guard wrapper
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, isInitializing, navigate]);

  if (isInitializing) return <FullPageLoader label="Authenticating\u2026" />;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}

// ── Public routes ─────────────────────────────────────────────────────────

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <Suspense fallback={<FullPageLoader />}>
      <LandingPage />
    </Suspense>
  ),
});

const registerBusinessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register/business",
  component: () => (
    <Suspense fallback={<FullPageLoader />}>
      <RegisterBusinessPage />
    </Suspense>
  ),
});

const registerFinancierRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register/financier",
  component: () => (
    <Suspense fallback={<FullPageLoader />}>
      <RegisterFinancierPage />
    </Suspense>
  ),
});

const registerIndividualRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register/individual",
  component: () => (
    <Suspense fallback={<FullPageLoader />}>
      <RegisterIndividualPage />
    </Suspense>
  ),
});

// Public standalone pages
const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: () => (
    <Suspense fallback={<FullPageLoader />}>
      <TermsPage />
    </Suspense>
  ),
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: () => (
    <Suspense fallback={<FullPageLoader />}>
      <PrivacyPage />
    </Suspense>
  ),
});

const publicProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile/$id",
  component: () => (
    <Suspense fallback={<FullPageLoader />}>
      <PublicProfilePage />
    </Suspense>
  ),
});

// Bootstrap (public — no auth required)
const adminBootstrapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin-bootstrap",
  component: () => (
    <Suspense fallback={<FullPageLoader />}>
      <AdminBootstrap />
    </Suspense>
  ),
});

const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/messages",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <MessagesPage />
      </Suspense>
    </AuthGuard>
  ),
});

const privacySettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/privacy",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <PrivacySettingsPage />
      </Suspense>
    </AuthGuard>
  ),
});

const adminBootstrapSlashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/bootstrap",
  component: () => (
    <Suspense fallback={<FullPageLoader />}>
      <AdminBootstrap />
    </Suspense>
  ),
});

// Admin invite register (public — token validates on its own)
const adminInviteRegisterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/register",
  component: () => (
    <Suspense fallback={<FullPageLoader />}>
      <AdminInviteRegister />
    </Suspense>
  ),
});

// ── Admin routes ──────────────────────────────────────────────────────────

const adminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/dashboard",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <AdminDashboard />
      </Suspense>
    </AuthGuard>
  ),
});

const adminApplicantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/applicants",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <AdminApplicantsPage />
      </Suspense>
    </AuthGuard>
  ),
});

const adminFinanciersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/financiers",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <AdminFinanciersPage />
      </Suspense>
    </AuthGuard>
  ),
});

const adminMizanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/mizan",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <AdminMizanReviewPage />
      </Suspense>
    </AuthGuard>
  ),
});

const adminKashifRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/kashif",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <div>Admin Kashif</div>
      </Suspense>
    </AuthGuard>
  ),
});

const adminMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/messages",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <AdminMessagesPage />
      </Suspense>
    </AuthGuard>
  ),
});

const adminAuditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/audit",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <AuditTrailPage />
      </Suspense>
    </AuthGuard>
  ),
});

const adminTawthiqOverviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/tawthiq/overview",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <AdminTawthiqOverviewPage />
      </Suspense>
    </AuthGuard>
  ),
});

const adminTawthiqPendingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/tawthiq/pending",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <AdminTawthiqPendingPage />
      </Suspense>
    </AuthGuard>
  ),
});

const adminTawthiqAssessmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/tawthiq/assessments",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <AdminTawthiqAssessmentsPage />
      </Suspense>
    </AuthGuard>
  ),
});

const adminSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/settings",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <AdminSettings />
      </Suspense>
    </AuthGuard>
  ),
});

// ── Individual routes ────────────────────────────────────────────────────

const individualDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/individual/dashboard",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <IndividualDashboard />
      </Suspense>
    </AuthGuard>
  ),
});

const individualKycRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/individual/kyc",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <IndividualKycPage />
      </Suspense>
    </AuthGuard>
  ),
});

const individualScoresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/individual/scores",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <IndividualScoresPage />
      </Suspense>
    </AuthGuard>
  ),
});

const individualProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/individual/profile",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <IndividualProfilePage />
      </Suspense>
    </AuthGuard>
  ),
});

const individualBankRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/individual/bank",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <IndividualBankPage />
      </Suspense>
    </AuthGuard>
  ),
});

// ── Business routes ───────────────────────────────────────────────────────

const businessDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/business/dashboard",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <ApplicantDashboard />
      </Suspense>
    </AuthGuard>
  ),
});

const businessKycRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/business/kyc",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <ApplicantDashboard />
      </Suspense>
    </AuthGuard>
  ),
});

const businessBankRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/business/bank",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <ApplicantDashboard />
      </Suspense>
    </AuthGuard>
  ),
});

const businessScoresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/business/scores",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <ApplicantDashboard />
      </Suspense>
    </AuthGuard>
  ),
});

const businessProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/business/profile",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <EditProfilePage />
      </Suspense>
    </AuthGuard>
  ),
});

// ── Financier routes ─────────────────────────────────────────────────────

const financierDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/financier/dashboard",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <FinancierDashboard />
      </Suspense>
    </AuthGuard>
  ),
});

const financierApplicantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/financier/applicants",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <FinancierDashboard />
      </Suspense>
    </AuthGuard>
  ),
});
const financierDiscoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/financier/discover",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <KashifDiscoverPage />
      </Suspense>
    </AuthGuard>
  ),
});

const financierShortlistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/financier/shortlist",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <KashifShortlistPage />
      </Suspense>
    </AuthGuard>
  ),
});

const financierPipelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/financier/pipeline",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <DealPipelinePage />
      </Suspense>
    </AuthGuard>
  ),
});

const financierProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/financier/profile",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <ProfilePage />
      </Suspense>
    </AuthGuard>
  ),
});

const adminProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/profile/$userId",
  component: () => (
    <AuthGuard>
      <Suspense fallback={<FullPageLoader />}>
        <ProfilePage />
      </Suspense>
    </AuthGuard>
  ),
});

// ── Route tree ───────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  // Public
  indexRoute,
  termsRoute,
  privacyRoute,
  publicProfileRoute,
  registerBusinessRoute,
  registerFinancierRoute,
  registerIndividualRoute,
  adminBootstrapRoute,
  adminBootstrapSlashRoute,
  adminInviteRegisterRoute,
  // Authenticated
  messagesRoute,
  privacySettingsRoute,
  // Admin
  adminDashboardRoute,
  adminApplicantsRoute,
  adminFinanciersRoute,
  adminAuditRoute,
  adminMizanRoute,
  adminKashifRoute,
  adminMessagesRoute,
  adminSettingsRoute,
  adminProfileRoute,
  adminTawthiqOverviewRoute,
  adminTawthiqPendingRoute,
  adminTawthiqAssessmentsRoute,
  // Individual
  individualDashboardRoute,
  individualKycRoute,
  individualScoresRoute,
  individualProfileRoute,
  individualBankRoute,
  // Business
  businessDashboardRoute,
  businessKycRoute,
  businessBankRoute,
  businessScoresRoute,
  businessProfileRoute,
  // Financier
  financierDashboardRoute,
  financierApplicantsRoute,
  financierDiscoverRoute,
  financierShortlistRoute,
  financierPipelineRoute,
  financierProfileRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
