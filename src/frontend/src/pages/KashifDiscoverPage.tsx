import { FinancierLayout } from "@/components/FinancierLayout";
import { KashifCompatibilityGauge } from "@/components/KashifCompatibilityGauge";
import { Pagination } from "@/components/Pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDealReport,
  useMatchedBorrowers,
  useShortlist,
} from "@/hooks/useKashif";
import type { CompatibilityResult } from "@/types/kashif";
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Building2,
  ChevronDown,
  ChevronUp,
  Compass,
  RefreshCw,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 20;

// ── Helpers ──────────────────────────────────────────────────────────────

function compatibilityColor(score: number): string {
  if (score >= 70) return "oklch(var(--compatibility-high))";
  if (score >= 40) return "oklch(var(--compatibility-medium))";
  return "oklch(var(--compatibility-low))";
}

function compatibilityBadgeClass(score: number): string {
  if (score >= 70)
    return "bg-[oklch(var(--compatibility-high)/0.12)] text-[oklch(var(--compatibility-high))] border-[oklch(var(--compatibility-high)/0.3)]";
  if (score >= 40)
    return "bg-[oklch(var(--compatibility-medium)/0.12)] text-[oklch(var(--compatibility-medium))] border-[oklch(var(--compatibility-medium)/0.3)]";
  return "bg-[oklch(var(--compatibility-low)/0.12)] text-[oklch(var(--compatibility-low))] border-[oklch(var(--compatibility-low)/0.3)]";
}

function riskBadgeClass(risk: string): string {
  const r = risk.toLowerCase();
  if (r === "low") return "bg-primary/10 text-primary border-primary/30";
  if (r === "medium")
    return "bg-[oklch(var(--compatibility-medium)/0.12)] text-[oklch(var(--compatibility-medium))] border-[oklch(var(--compatibility-medium)/0.3)]";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

function formatRisk(risk: string): string {
  const r = risk.toLowerCase();
  return r.charAt(0).toUpperCase() + r.slice(1);
}

// ── Deal Report Panel ────────────────────────────────────────────────────

interface DealReportPanelProps {
  businessId: string;
  result: CompatibilityResult;
  onCollapse: () => void;
}

function DealReportPanel({
  businessId,
  result,
  onCollapse,
}: DealReportPanelProps) {
  const reportQuery = useDealReport(businessId);
  const {
    shortlistedIds,
    addToShortlist,
    removeFromShortlist,
    isAdding,
    isRemoving,
  } = useShortlist();
  const isShortlisted = shortlistedIds.has(businessId);
  const isMutating = isAdding || isRemoving;

  const report = reportQuery.data;
  const isLoading = reportQuery.isLoading;
  const isError = reportQuery.isError;

  // Mizan subscores — cast through unknown to access optional backend fields safely
  const resultAny = result as unknown as Record<
    string,
    bigint | number | undefined
  >;
  const subscores: [string, number][] = (
    [
      ["Income Stability", Number(resultAny.incomeStabilityScore ?? 0)],
      ["Debt Behavior", Number(resultAny.debtBehaviorScore ?? 0)],
      ["Repayment Pattern", Number(resultAny.repaymentPatternScore ?? 0)],
      ["Revenue Trend", Number(resultAny.revenueTrendScore ?? 0)],
    ] as [string, number][]
  ).filter(([, v]) => v > 0);

  return (
    <>
      <Separator />
      <CardContent
        className="pt-5 pb-6 space-y-5"
        data-ocid={`kashif_discover.detail_panel.${businessId}`}
      >
        {/* Shortlist action */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Kashif (الكاشف) · Deal Report
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isMutating}
            onClick={() =>
              isShortlisted
                ? removeFromShortlist(businessId)
                : addToShortlist(businessId)
            }
            className={`gap-2 transition-smooth ${
              isShortlisted
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                : "hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            }`}
            data-ocid={`kashif_discover.shortlist_button.${businessId}`}
          >
            {isShortlisted ? (
              <BookmarkCheck className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
            {isShortlisted ? "Remove from Shortlist" : "Add to Shortlist"}
          </Button>
        </div>

        {/* Mizan Subscores */}
        {subscores.length > 0 && (
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Mizan (الميزان) Subscores
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {subscores.map(([label, val]) => (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: compatibilityColor(val) }}
                    >
                      {val}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/40">
                    <div
                      className="h-1.5 rounded-full transition-all duration-700"
                      style={{
                        width: `${val}%`,
                        background: compatibilityColor(val),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report sections */}
        {isLoading ? (
          <div
            className="space-y-3"
            data-ocid={`kashif_discover.report_loading.${businessId}`}
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <div
            className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
            data-ocid={`kashif_discover.report_error.${businessId}`}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Could not load deal report.</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => reportQuery.refetch()}
              className="ml-auto gap-1.5 text-destructive hover:text-destructive"
              data-ocid={`kashif_discover.report_retry.${businessId}`}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : report ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Executive Summary", report.executiveSummary],
                ["Financial Highlights", report.financialHighlights],
                ["Risk Breakdown", report.riskBreakdown],
                ["Shariah Compliance", report.shariahComplianceStatus],
                ["Credit Readiness", report.creditReadiness],
                ["Financing Recommendation", report.financingRecommendation],
              ] as [string, string][]
            ).map(([title, body]) => (
              <div
                key={title}
                className="rounded-lg border border-border bg-[oklch(var(--deal-highlight)/0.4)] dark:bg-[oklch(var(--deal-highlight)/0.6)] p-4"
              >
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {title}
                </p>
                <p className="text-sm leading-relaxed text-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Collapse */}
        <div className="flex justify-start">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCollapse}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            data-ocid={`kashif_discover.collapse_button.${businessId}`}
          >
            <ChevronUp className="h-4 w-4" /> Collapse
          </Button>
        </div>
      </CardContent>
    </>
  );
}

// ── Row Card ─────────────────────────────────────────────────────────────

interface BorrowerRowProps {
  result: CompatibilityResult;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function BorrowerRow({
  result,
  index,
  isExpanded,
  onToggle,
}: BorrowerRowProps) {
  const businessId = result.businessId.toString();
  const score = Number(result.compatibilityScore);
  const halalScore = Number(result.halalComplianceScore);
  const { shortlistedIds } = useShortlist();
  const isShortlisted = shortlistedIds.has(businessId);

  return (
    <Card
      className={`transition-smooth hover:border-primary/30 dark:bg-[oklch(var(--deal-card-bg))] ${
        isExpanded ? "border-primary/40 shadow-md" : ""
      }`}
      data-ocid={`kashif_discover.borrower.item.${index}`}
    >
      {/* Summary row */}
      <CardContent className="flex items-center gap-4 py-4">
        {/* Gauge */}
        <div className="shrink-0">
          <KashifCompatibilityGauge
            score={score}
            size={60}
            strokeWidth={6}
            showLabel={false}
            static
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-semibold text-foreground truncate">
              {result.displayName}
            </p>
            {isShortlisted && (
              <Star
                className="h-3.5 w-3.5 fill-primary text-primary"
                aria-label="Shortlisted"
              />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {result.businessCategory}
          </p>
          {/* Financing types chips */}
          {result.financingTypes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {result.financingTypes.map((ft) => (
                <span
                  key={ft}
                  className="inline-block rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {ft}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Badges + expand */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Compatibility score badge */}
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums ${compatibilityBadgeClass(score)}`}
            data-ocid={`kashif_discover.score_badge.${index}`}
          >
            {score}
          </span>
          {/* Risk badge */}
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${riskBadgeClass(result.riskLevel.toString())}`}
            data-ocid={`kashif_discover.risk_badge.${index}`}
          >
            {formatRisk(result.riskLevel.toString())} Risk
          </span>
          {/* Halal score */}
          <span
            className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            data-ocid={`kashif_discover.halal_badge.${index}`}
          >
            <ShieldCheck className="h-3 w-3" />
            {halalScore}% Halal
          </span>
          {/* Expand/collapse toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            aria-label={isExpanded ? "Collapse details" : "Expand deal report"}
            data-ocid={`kashif_discover.expand_button.${index}`}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>

      {/* Expanded detail panel */}
      {isExpanded && (
        <DealReportPanel
          businessId={businessId}
          result={result}
          onCollapse={onToggle}
        />
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function KashifDiscoverPage() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useMatchedBorrowers(
    page,
    PAGE_SIZE,
  );

  const items = (data?.items ?? []).sort(
    (a, b) => Number(b.compatibilityScore) - Number(a.compatibilityScore),
  );
  const total = Number(data?.total ?? 0n);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <FinancierLayout>
      <div
        className="container mx-auto max-w-4xl px-4 py-10"
        data-ocid="kashif_discover.page"
      >
        {/* Page header */}
        <div className="mb-8" data-ocid="kashif_discover.header">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 dark:bg-primary/25">
              <Compass className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Kashif{" "}
                <span className="font-body text-lg font-medium text-muted-foreground">
                  (الكاشف)
                </span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Investment Discovery
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl">
            Financing-ready applicants ranked by compatibility score (0–100).
            Expand any borrower to view the full Kashif deal report.
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3" data-ocid="kashif_discover.loading_state">
            {["s1", "s2", "s3", "s4"].map((k) => (
              <Card key={k}>
                <CardContent className="flex items-center gap-4 py-4">
                  <Skeleton className="h-[60px] w-[60px] rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-7 w-16 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card data-ocid="kashif_discover.error_state">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
              <AlertCircle className="h-10 w-10 text-destructive/60" />
              <p className="font-medium text-foreground">
                Failed to load borrowers
              </p>
              <p className="text-sm text-muted-foreground">
                An error occurred while fetching matched borrowers.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-2"
                data-ocid="kashif_discover.retry_button"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card data-ocid="kashif_discover.empty_state">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
                <Building2 className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="font-display text-lg font-semibold text-foreground">
                No financing-ready borrowers yet
              </p>
              <p className="max-w-sm text-center text-sm text-muted-foreground">
                Kashif will surface matched borrowers here once they have
                completed the full vetting pipeline.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Result count */}
            <p
              className="mb-4 text-xs font-medium text-muted-foreground"
              data-ocid="kashif_discover.result_count"
            >
              {total} matched borrower{total !== 1 ? "s" : ""} · Page {page} of{" "}
              {totalPages}
            </p>

            <div
              className="space-y-3"
              data-ocid="kashif_discover.borrower_list"
            >
              {items.map((result, idx) => {
                const id = result.businessId.toString();
                return (
                  <BorrowerRow
                    key={id}
                    result={result}
                    index={idx + 1}
                    isExpanded={expandedId === id}
                    onToggle={() => toggleExpand(id)}
                  />
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8" data-ocid="kashif_discover.pagination">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={(p) => {
                    setPage(p);
                    setExpandedId(null);
                  }}
                  isLoading={isLoading}
                />
              </div>
            )}
          </>
        )}
      </div>
    </FinancierLayout>
  );
}
