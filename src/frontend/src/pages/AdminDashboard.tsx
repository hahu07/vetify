import {
  type AdminAnalytics,
  type BusinessProfile,
  type FinancierProfile,
  RegistrationStatus,
} from "@/backend";
import { AdminLayout } from "@/components/AdminLayout";
import { FullPageLoader } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { StatusCard } from "@/components/StatusCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/use-backend";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  Building2,
  ClipboardList,
  Settings,
  TrendingUp,
  User,
  Users,
} from "lucide-react";

const PAGE_SIZE = 20;

// ── AnalyticsKpiCard ─────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  main: string | number;
  detail?: React.ReactNode;
  "data-ocid"?: string;
  onClick?: () => void;
}

function AnalyticsKpiCard({
  title,
  main,
  detail,
  onClick,
  "data-ocid": dataOcid,
}: KpiCardProps) {
  return (
    <div
      className={`analytics-kpi-card${onClick ? " cursor-pointer" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      data-ocid={dataOcid}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <p className="text-2xl font-bold font-display text-foreground leading-tight">
        {main}
      </p>
      {detail && (
        <div className="mt-1.5 text-xs text-muted-foreground">{detail}</div>
      )}
    </div>
  );
}

function MizanScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 70
      ? "bg-primary/10 text-primary border border-primary/30"
      : score >= 40
        ? "bg-[oklch(var(--chart-3)/0.1)] text-[oklch(var(--chart-3))] border border-[oklch(var(--chart-3)/0.3)]"
        : "bg-destructive/10 text-destructive border border-destructive/30";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {score >= 70 ? "Strong" : score >= 40 ? "Moderate" : "Weak"}
    </span>
  );
}

// ── Analytics section (super-admin only) ────────────────────────────────────

function AnalyticsSection({
  navigate,
}: { navigate: ReturnType<typeof useNavigate> }) {
  const { actor } = useBackend();

  const analyticsQuery = useQuery({
    queryKey: ["admin_analytics"],
    queryFn: async () => {
      if (!actor) return null;
      const res = await actor.getAdminAnalytics();
      if ("__kind__" in res) {
        if (res.__kind__ === "ok")
          return (res as { __kind__: "ok"; ok: AdminAnalytics }).ok;
        return null;
      }
      return res as AdminAnalytics;
    },
    enabled: !!actor,
  });

  if (analyticsQuery.isLoading) {
    return (
      <section className="mb-8" data-ocid="admin.analytics_section">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Platform Analytics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["s1", "s2", "s3", "s4", "s5", "s6"].map((k) => (
            <Skeleton key={k} className="h-24 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  const a = analyticsQuery.data;
  if (!a) return null;

  const totalTawthiq =
    Number(a.tawthiqPassCount) +
    Number(a.tawthiqConditionalCount) +
    Number(a.tawthiqFailCount);
  const passRate =
    totalTawthiq > 0
      ? Math.round((Number(a.tawthiqPassCount) / totalTawthiq) * 100)
      : 0;
  const conditionalRate =
    totalTawthiq > 0
      ? Math.round((Number(a.tawthiqConditionalCount) / totalTawthiq) * 100)
      : 0;
  const failRate =
    totalTawthiq > 0
      ? Math.round((Number(a.tawthiqFailCount) / totalTawthiq) * 100)
      : 0;
  const avgMizan = Number(a.averageMizanScore);
  const totalRegs =
    Number(a.totalBusinesses) +
    Number(a.totalIndividuals) +
    Number(a.totalFinanciers);

  return (
    <section className="mb-8" data-ocid="admin.analytics_section">
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Platform Analytics
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnalyticsKpiCard
          title="Total Registrations"
          main={totalRegs}
          detail={
            <span className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {Number(a.totalBusinesses)} Businesses
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {Number(a.totalIndividuals)} Individuals
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {Number(a.totalFinanciers)} Financiers
              </span>
            </span>
          }
          data-ocid="admin.analytics.total_registrations_card"
        />
        <AnalyticsKpiCard
          title="Tawthiq Results"
          main={`${passRate}% Pass`}
          detail={
            <span className="flex gap-3">
              <span className="text-primary">{passRate}% Passed</span>
              <span className="text-chart-2">
                {conditionalRate}% Conditional
              </span>
              <span className="text-destructive">{failRate}% Failed</span>
            </span>
          }
          data-ocid="admin.analytics.tawthiq_results_card"
        />
        <AnalyticsKpiCard
          title="Average Mizan Score"
          main={avgMizan.toFixed(1)}
          detail={<MizanScoreBadge score={avgMizan} />}
          data-ocid="admin.analytics.avg_mizan_card"
        />
        <AnalyticsKpiCard
          title="Active Financiers"
          main={Number(a.activeFinancierCount)}
          detail={`${Number(a.totalFinanciers)} registered total`}
          data-ocid="admin.analytics.active_financiers_card"
        />
        <AnalyticsKpiCard
          title="Pending Reviews"
          main={Number(a.pendingReviewCount)}
          detail={
            Number(a.pendingReviewCount) > 0
              ? "Need admin attention"
              : "All up to date"
          }
          onClick={() => navigate({ to: "/admin/applicants" })}
          data-ocid="admin.analytics.pending_reviews_card"
        />
        <AnalyticsKpiCard
          title="Financing-Ready"
          main={Number(a.financingReadyCount)}
          detail={"Across businesses and individuals"}
          data-ocid="admin.analytics.financing_ready_card"
        />
      </div>
    </section>
  );
}

// ── AdminDashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { actor } = useBackend();
  const navigate = useNavigate();
  const { isSuperAdmin } = useIsSuperAdmin();

  // Summary stats from both collections
  const businessesQuery = useQuery({
    queryKey: ["admin_businesses", 1],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
      const page = await (actor.adminListBusinesses(
        1n,
        BigInt(PAGE_SIZE),
      ) as unknown as Promise<{
        items: BusinessProfile[];
        total: bigint;
        page: bigint;
        pageSize: bigint;
      }>);
      return {
        items: page.items ?? [],
        total: Number(page.total ?? 0n),
        page: 1,
        pageSize: PAGE_SIZE,
      };
    },
    enabled: !!actor,
  });

  const financiersQuery = useQuery({
    queryKey: ["admin_financiers"],
    queryFn: async () => {
      if (!actor)
        return { items: [], total: 0n, page: 1n, pageSize: BigInt(PAGE_SIZE) };
      return actor.adminListFinanciers(1n, BigInt(1000));
    },
    enabled: !!actor,
  });

  // Individuals count
  const individualsQuery = useQuery({
    queryKey: ["admin_individuals", 1],
    queryFn: async () => {
      if (!actor) return { total: 0, items: [] };
      const res = await actor.adminListIndividuals(1n, 5n);
      if ("__kind__" in res && res.__kind__ === "ok") {
        return {
          total: Number(
            (res as { __kind__: "ok"; ok: { total: bigint; items: unknown[] } })
              .ok.total,
          ),
          items: [],
        };
      }
      return { total: 0, items: [] };
    },
    enabled: !!actor,
  });

  const isLoading = businessesQuery.isLoading || financiersQuery.isLoading;

  const allBusinesses: BusinessProfile[] = businessesQuery.data?.items ?? [];
  const totalBusinesses = Number(
    businessesQuery.data?.total ?? allBusinesses.length,
  );

  const _financiersRaw = financiersQuery.data;
  const financiers: FinancierProfile[] =
    _financiersRaw &&
    !Array.isArray(_financiersRaw) &&
    (_financiersRaw as unknown as { items?: FinancierProfile[] }).items
      ? (_financiersRaw as unknown as { items: FinancierProfile[] }).items
      : [];

  const pendingCount = allBusinesses.filter(
    (b) => b.registrationStatus === RegistrationStatus.pending,
  ).length;
  const reviewCount = allBusinesses.filter(
    (b) => b.registrationStatus === RegistrationStatus.underReview,
  ).length;
  const readyCount = allBusinesses.filter(
    (b) => b.registrationStatus === RegistrationStatus.financingReady,
  ).length;

  const totalIndividuals = individualsQuery.data?.total ?? 0;

  if (isLoading) return <FullPageLoader />;

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <PageHeader
          title="Admin Dashboard"
          subtitle="Overview of platform activity — applicants, financiers, and compliance."
          breadcrumbs={[{ label: "Admin" }]}
          actions={
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ to: "/admin/settings" })}
                  className="gap-1.5"
                  type="button"
                  data-ocid="admin.settings_link"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/admin/audit" })}
                className="gap-1.5"
                type="button"
                data-ocid="admin.audit_trail_link"
              >
                <ClipboardList className="h-4 w-4" />
                Audit Trail
              </Button>
            </div>
          }
        />

        {/* Super-admin Analytics KPIs */}
        {isSuperAdmin && <AnalyticsSection navigate={navigate} />}

        {/* Stats Overview */}
        <section className="mb-8" data-ocid="admin.stats_section">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard
              icon={Building2}
              label="Total Businesses"
              value={totalBusinesses}
              variant="pending"
              data-ocid="admin.total_businesses_card"
            />
            <StatusCard
              icon={User}
              label="Individuals"
              value={totalIndividuals}
              variant="pending"
              description="Individual applicants"
              data-ocid="admin.total_individuals_card"
            />
            <StatusCard
              icon={AlertTriangle}
              label="Pending Review"
              value={pendingCount + reviewCount}
              variant="pending"
              data-ocid="admin.pending_review_card"
            />
            <StatusCard
              icon={BadgeCheck}
              label="Financing Ready"
              value={readyCount}
              variant="success"
              data-ocid="admin.financing_ready_card"
            />
          </div>
        </section>

        {/* Quick-access cards */}
        <section
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-ocid="admin.quicklinks_section"
        >
          <Card
            className="cursor-pointer border-border hover:border-primary/40 transition-smooth"
            onClick={() => navigate({ to: "/admin/applicants" })}
            data-ocid="admin.applicants_quicklink"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Building2 className="h-5 w-5 text-primary" />
                Business Applicants
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Review applicant status, KYC results, and AI scores.
              {pendingCount + reviewCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {pendingCount + reviewCount} need attention
                </span>
              )}
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-border hover:border-primary/40 transition-smooth"
            onClick={() =>
              navigate({
                to: "/admin/applicants",
                search: { tab: "individuals" },
              })
            }
            data-ocid="admin.individuals_quicklink"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Users className="h-5 w-5 text-primary" />
                Individual Applicants
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {totalIndividuals}
              </span>{" "}
              registered individual{totalIndividuals !== 1 ? "s" : ""} seeking
              halal financing.
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-border hover:border-primary/40 transition-smooth"
            onClick={() => navigate({ to: "/admin/financiers" })}
            data-ocid="admin.financiers_quicklink"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Briefcase className="h-5 w-5 text-primary" />
                Registered Financiers
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {financiers.length}
              </span>{" "}
              financier{financiers.length !== 1 ? "s" : ""} — manage platform
              access and status.
            </CardContent>
          </Card>
        </section>
      </div>
    </AdminLayout>
  );
}
