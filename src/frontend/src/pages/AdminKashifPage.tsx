import { AdminLayout } from "@/components/AdminLayout";
import { PageHeader } from "@/components/PageHeader";
import { StatusCard } from "@/components/StatusCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useKashifLogs, useRegenerateReport } from "@/hooks/useKashif";
import { cn } from "@/lib/utils";
import type { KashifReportLog } from "@/types/kashif";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncatePrincipal(p: string): string {
  if (p.length <= 16) return p;
  return `${p.slice(0, 8)}…${p.slice(-6)}`;
}

function formatDate(ts: bigint | undefined): string {
  if (!ts) return "Never";
  const ms = Number(ts) > 1e12 ? Number(ts) / 1_000_000 : Number(ts) * 1000;
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function isThisWeek(ts: bigint): boolean {
  const now = Date.now();
  const ms = Number(ts) > 1e12 ? Number(ts) / 1_000_000 : Number(ts) * 1000;
  return now - ms < 7 * 24 * 60 * 60 * 1000;
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      type="button"
      onClick={handle}
      className="ml-1.5 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Copy principal"
    >
      {copied ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ── RegenerateButton ──────────────────────────────────────────────────────────

function RegenerateButton({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useRegenerateReport({
    onSuccess: () => {
      toast.success("Report regeneration triggered");
      queryClient.invalidateQueries({ queryKey: ["kashif", "logs"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Regeneration failed");
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => mutate(businessId)}
      className="gap-1.5 h-8 px-3 text-xs"
      data-ocid="kashif.regenerate_button"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
      {isPending ? "Running…" : "Regenerate"}
    </Button>
  );
}

// ── AdminKashifPage ───────────────────────────────────────────────────────────

export default function AdminKashifPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useKashifLogs(page, PAGE_SIZE);

  const logs: KashifReportLog[] = data?.items ?? [];
  const total = Number(data?.total ?? 0n);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Compute summary stats client-side
  const totalViews = logs.reduce((sum, l) => sum + Number(l.viewCount), 0);
  const thisWeekCount = logs.filter((l) => isThisWeek(l.generatedAt)).length;

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <PageHeader
          title="Kashif (الكاشف) — Report Oversight"
          subtitle="Monitor investment discovery reports generated for financing-ready businesses."
          breadcrumbs={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Kashif" },
          ]}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
              data-ocid="kashif.refresh_button"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          }
          data-ocid="kashif.page"
        />

        {/* Summary Stats */}
        <section
          className="mb-8 grid gap-4 sm:grid-cols-3"
          data-ocid="kashif.stats_section"
        >
          <StatusCard
            icon={FileText}
            label="Total Reports Generated"
            value={total}
            variant="success"
            data-ocid="kashif.total_reports_card"
          />
          <StatusCard
            icon={Eye}
            label="Total Report Views"
            value={totalViews}
            variant="pending"
            data-ocid="kashif.total_views_card"
          />
          <StatusCard
            icon={TrendingUp}
            label="Generated This Week"
            value={thisWeekCount}
            variant="warning"
            data-ocid="kashif.this_week_card"
          />
        </section>

        {/* Report Logs Table */}
        <section
          className="rounded-xl border border-border bg-card overflow-hidden shadow-xs"
          data-ocid="kashif.table_section"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="font-display text-base font-semibold text-foreground">
                Report Activity Log
              </h2>
              {total > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {total} total
                </Badge>
              )}
            </div>
          </div>

          {isError ? (
            <div
              className="flex flex-col items-center gap-3 py-16 text-center"
              data-ocid="kashif.error_state"
            >
              <p className="text-muted-foreground text-sm">
                Failed to load report logs.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div
              className="space-y-0 divide-y divide-border"
              data-ocid="kashif.loading_state"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div
              className="flex flex-col items-center gap-3 py-16 text-center"
              data-ocid="kashif.empty_state"
            >
              <FileText className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-foreground">
                  No reports generated yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reports appear here once Kashif processes a financing-ready
                  business.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5 font-semibold text-foreground">
                    Business ID
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Date Generated
                  </TableHead>
                  <TableHead className="text-right font-semibold text-foreground">
                    View Count
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Last Viewed
                  </TableHead>
                  <TableHead className="pr-5 text-right font-semibold text-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log, idx) => {
                  const principalStr = log.businessId.toString();
                  return (
                    <TableRow
                      key={principalStr}
                      className="hover:bg-muted/40 transition-colors"
                      data-ocid={`kashif.item.${idx + 1}`}
                    >
                      <TableCell className="pl-5">
                        <div className="flex items-center font-mono text-xs text-foreground">
                          <span title={principalStr}>
                            {truncatePrincipal(principalStr)}
                          </span>
                          <CopyButton text={principalStr} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(log.generatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 font-mono text-sm font-medium text-foreground">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          {Number(log.viewCount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.lastViewedAt ? (
                          formatDate(log.lastViewedAt)
                        ) : (
                          <span className="text-muted-foreground/50">
                            Never
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <RegenerateButton businessId={principalStr} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between border-t border-border px-5 py-3"
              data-ocid="kashif.pagination"
            >
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} records
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                  data-ocid="kashif.pagination_prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                  data-ocid="kashif.pagination_next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
