import { type BusinessProfile, KycStatus } from "@/backend";
import { HalalComplianceStatus, RiskLevel__1 as RiskLevel } from "@/backend";
import { FinancierLayout } from "@/components/FinancierLayout";
import { FullPageLoader } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusCard } from "@/components/StatusCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useBackend } from "@/hooks/use-backend";
import type { ApplicantSummary } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Link2,
  Shield,
  ShieldCheck,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 20;

function riskBadgeVariant(risk: string): string {
  if (risk === RiskLevel.low) return "bg-primary/10 text-primary";
  if (risk === RiskLevel.medium)
    return "bg-secondary/20 text-secondary-foreground";
  if (risk === RiskLevel.high) return "bg-destructive/10 text-destructive";
  return "bg-accent/10 text-accent-foreground";
}

function halalBadgeClass(status: HalalComplianceStatus): string {
  if (status === HalalComplianceStatus.compliant)
    return "bg-primary/10 text-primary";
  if (status === HalalComplianceStatus.flagged)
    return "bg-destructive/10 text-destructive";
  return "bg-accent/10 text-accent-foreground";
}

function kycIcon(verified: boolean) {
  return verified ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
  ) : (
    <XCircle className="h-3.5 w-3.5 text-destructive" />
  );
}

// Inline detail panel for a single applicant
interface DetailPanelProps {
  userId: string;
  onCollapse: () => void;
}

function ApplicantDetailPanel({ userId, onCollapse }: DetailPanelProps) {
  const { actor } = useBackend();

  const profileQuery = useQuery({
    queryKey: ["financing_ready_business", userId],
    queryFn: async () => {
      if (!actor) return null;
      const { Principal } = await import("@icp-sdk/core/principal");
      return actor.getFinancingReadyBusiness(Principal.fromText(userId));
    },
    enabled: !!actor && !!userId,
  });

  const profile = profileQuery.data as BusinessProfile | null | undefined;

  return (
    <>
      <Separator />
      <CardContent
        className="grid gap-6 pb-5 pt-4 sm:grid-cols-3"
        data-ocid={`financier_dashboard.detail_panel.${userId}`}
      >
        {profileQuery.isLoading ? (
          <div className="sm:col-span-3 text-sm text-muted-foreground">
            Loading profile…
          </div>
        ) : !profile ? (
          <div className="sm:col-span-3 text-sm text-muted-foreground">
            Profile not available.
          </div>
        ) : (
          <>
            {/* Business Info */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> Business Info
              </p>
              <dl className="space-y-1.5 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Name</dt>
                  <dd className="font-medium text-foreground">
                    {profile.businessName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="text-foreground">{profile.businessType}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Annual Revenue
                  </dt>
                  <dd className="text-foreground">
                    ₦{Number(profile.annualRevenue).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd className="text-foreground">{profile.phoneNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Address</dt>
                  <dd className="text-foreground">{profile.address}</dd>
                </div>
              </dl>
            </div>

            {/* KYC + Bank Link */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Shield className="h-3.5 w-3.5" /> KYC Status
              </p>
              <ul className="mb-4 space-y-1.5">
                {(
                  [
                    ["BVN", profile.kycRecord.bvnVerified],
                    ["NIN", profile.kycRecord.ninVerified],
                    ["CAC", profile.kycRecord.cacVerified],
                    ["TIN", profile.kycRecord.tinVerified],
                    ["Watchlist Clear", profile.kycRecord.watchlistClean],
                  ] as [string, boolean][]
                ).map(([label, val]) => (
                  <li key={label} className="flex items-center gap-2 text-sm">
                    {kycIcon(val)}
                    <span className="text-foreground">{label}</span>
                  </li>
                ))}
              </ul>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" /> Bank Account
              </p>
              {profile.bankLinkRecord.status.__kind__ === "Linked" ? (
                <p className="flex items-center gap-1 text-sm text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Linked
                  {profile.bankLinkRecord.institutionName && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({profile.bankLinkRecord.institutionName})
                    </span>
                  )}
                </p>
              ) : (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CircleDot className="h-3.5 w-3.5" /> Not linked
                </p>
              )}
            </div>

            {/* AI Scores */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" /> AI Scores
              </p>
              {profile.scoringRecord.financingReadinessScore > 0n ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Financing Readiness
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {profile.scoringRecord.financingReadinessScore.toString()}
                      %
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Halal Compliance
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {profile.scoringRecord.halalComplianceScore.toString()}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Risk Level</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskBadgeVariant(profile.riskLevel)}`}
                    >
                      {profile.riskLevel}
                    </span>
                  </div>
                  {profile.scoringRecord.scoringNotes && (
                    <p className="text-xs text-muted-foreground">
                      {profile.scoringRecord.scoringNotes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not scored yet</p>
              )}
            </div>
          </>
        )}
      </CardContent>
      <CardContent className="pb-4 pt-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCollapse}
          className="gap-1.5 text-muted-foreground"
          data-ocid={`financier_dashboard.collapse_button.${userId}`}
        >
          <ChevronUp className="h-4 w-4" /> Collapse
        </Button>
      </CardContent>
    </>
  );
}

export default function FinancierDashboard() {
  const { actor } = useBackend();
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["financier_profile"],
    queryFn: () => actor?.getMyFinancierProfile() ?? null,
    enabled: !!actor,
  });

  const applicantsQuery = useQuery({
    queryKey: ["financing_ready_applicants", currentPage],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0, page: 1 };
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (
        typeof actorAny.listFinancingReadyApplicantsPaginated === "function"
      ) {
        return actorAny.listFinancingReadyApplicantsPaginated(
          BigInt(currentPage),
          BigInt(PAGE_SIZE),
        ) as Promise<{
          items: ApplicantSummary[];
          total: number;
          page: number;
        }>;
      }
      // Fallback: old endpoint with pagination args
      const page = await (actor.listFinancingReadyApplicants(
        BigInt(currentPage),
        BigInt(PAGE_SIZE),
      ) as unknown as Promise<{
        items: ApplicantSummary[];
        total: bigint;
        page: bigint;
      }>);
      return {
        items: page.items ?? [],
        total: Number(page.total ?? 0n),
        page: currentPage,
      };
    },
    enabled: !!actor,
    placeholderData: (prev) => prev,
  });

  if (profileQuery.isLoading) return <FullPageLoader />;

  const profile = profileQuery.data;
  const applicants: ApplicantSummary[] = applicantsQuery.data?.items ?? [];
  const total = Number(applicantsQuery.data?.total ?? applicants.length);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <FinancierLayout>
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <PageHeader
          title={profile?.institutionName ?? "Financier Dashboard"}
          subtitle="Browse financing-ready vetted applicants on the Vetify platform."
          breadcrumbs={[{ label: "Dashboard" }]}
          actions={
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/30 dark:bg-primary/20"
              data-ocid="financier_dashboard.status_badge"
            >
              {profile?.registrationStatus ?? "Pending"}
            </Badge>
          }
        />

        {/* Summary Cards */}
        <section
          className="mb-8"
          data-ocid="financier_dashboard.summary_section"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <StatusCard
              icon={Users}
              label="Financing-Ready Applicants"
              value={total}
              variant="success"
              description="Verified applicants available"
              data-ocid="financier_dashboard.applicants_count_card"
            />
            <StatusCard
              icon={ShieldCheck}
              label="Areas of Financing"
              value={profile?.areasOfFinancing.length ?? 0}
              variant="pending"
              description="Active financing categories"
              data-ocid="financier_dashboard.areas_card"
            />
            <StatusCard
              icon={TrendingUp}
              label="Platform Status"
              value="Active"
              variant="success"
              description="Vetify verified institution"
              data-ocid="financier_dashboard.platform_status_card"
            />
          </div>
        </section>

        {/* Applicants */}
        <section data-ocid="financier_dashboard.applicants_section">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Financing-Ready Applicants
          </h2>
          {applicants.length === 0 ? (
            <Card>
              <CardContent
                className="flex flex-col items-center justify-center py-16"
                data-ocid="financier_dashboard.applicants_empty_state"
              >
                <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-foreground">No applicants yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Financing-ready applicants will appear here once vetted.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {applicants.map((applicant, idx) => {
                const isExpanded = expandedId === applicant.userId.toString();
                return (
                  <Card
                    key={applicant.userId.toString()}
                    className="hover:border-primary/30 transition-smooth dark:bg-card"
                    data-ocid={`financier_dashboard.applicant.item.${idx + 1}`}
                  >
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {applicant.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Business
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${riskBadgeVariant(applicant.riskLevel)}`}
                        >
                          {applicant.riskLevel.charAt(0).toUpperCase() +
                            applicant.riskLevel.slice(1)}{" "}
                          Risk
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${halalBadgeClass(applicant.halalComplianceStatus)}`}
                        >
                          {applicant.halalComplianceStatus
                            .charAt(0)
                            .toUpperCase() +
                            applicant.halalComplianceStatus.slice(1)}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {Number(applicant.financingReadyScore)}%
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() =>
                            setExpandedId(
                              isExpanded ? null : applicant.userId.toString(),
                            )
                          }
                          aria-label={
                            isExpanded ? "Collapse details" : "Expand details"
                          }
                          data-ocid={`financier_dashboard.expand_button.${idx + 1}`}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() =>
                            navigate({
                              to: "/admin/profile/$userId",
                              params: { userId: applicant.userId.toString() },
                            })
                          }
                          data-ocid={`financier_dashboard.view_profile_button.${idx + 1}`}
                        >
                          View <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>

                    {isExpanded && (
                      <ApplicantDetailPanel
                        userId={applicant.userId.toString()}
                        onCollapse={() => setExpandedId(null)}
                      />
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
            isLoading={applicantsQuery.isFetching}
          />
        </section>
      </div>
    </FinancierLayout>
  );
}
