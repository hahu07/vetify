import type { AuditEntry, AuditPage } from "@/backend";
import { AdminLayout } from "@/components/AdminLayout";
import { FullPageLoader } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/use-backend";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clock, Filter, X } from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 20;

const ENTITY_TYPES = [
  { value: "all", label: "All Entities" },
  { value: "business", label: "Business" },
  { value: "financier", label: "Financier" },
  { value: "kyc", label: "KYC" },
  { value: "banklink", label: "Bank Link" },
];

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function entityBadgeClass(entityType: string): string {
  switch (entityType.toLowerCase()) {
    case "business":
      return "bg-primary/10 text-primary border-primary/25 dark:bg-primary/20";
    case "financier":
      return "bg-accent/10 text-accent-foreground border-accent/25 dark:bg-accent/20";
    case "kyc":
      return "bg-chart-2/10 text-chart-2 border-chart-2/25 dark:bg-chart-2/20";
    case "banklink":
      return "bg-chart-4/10 text-foreground border-chart-4/25 dark:bg-chart-4/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function truncatePrincipal(principal: string): string {
  if (principal.length <= 16) return principal;
  return `${principal.slice(0, 8)}…${principal.slice(-4)}`;
}

function AuditTableSkeleton() {
  return (
    <div className="space-y-2">
      {["a", "b", "c", "d", "e"].map((k) => (
        <Skeleton key={k} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function AuditTrailPage() {
  const { actor } = useBackend();

  // Local state for page + entityType filters
  const [currentPage, setCurrentPage] = useState(1);
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");

  const auditQuery = useQuery({
    queryKey: ["audit_log", currentPage, entityTypeFilter],
    queryFn: async (): Promise<AuditPage> => {
      if (!actor) return { entries: [], total: 0n, page: 0n };
      const result = await actor.getAuditLog(
        BigInt(currentPage),
        BigInt(PAGE_SIZE),
      );
      if (!result || !result.entries)
        return { entries: [], total: 0n, page: 0n };
      return result;
    },
    enabled: !!actor,
    placeholderData: (prev) => prev,
  });

  const entries: AuditEntry[] = auditQuery.data?.entries ?? [];
  const total = Number(auditQuery.data?.total ?? 0n);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filteredEntries =
    entityTypeFilter === "all"
      ? entries
      : entries.filter(
          (e) => e.entityType.toLowerCase() === entityTypeFilter.toLowerCase(),
        );

  const hasFilters = entityTypeFilter !== "all";

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <PageHeader
          title="Audit Trail"
          subtitle="A complete log of all status changes and actions on the platform."
          breadcrumbs={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Audit Trail" },
          ]}
        />

        {/* Filters */}
        <div
          className="mb-6 flex flex-wrap items-center gap-3"
          data-ocid="audit.filters_section"
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filter by:</span>
          </div>
          <Select
            value={entityTypeFilter}
            onValueChange={(val) => {
              setEntityTypeFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger
              className="w-44"
              data-ocid="audit.entity_type_select"
            >
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((et) => (
                <SelectItem key={et.value} value={et.value}>
                  {et.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEntityTypeFilter("all");
                setCurrentPage(1);
              }}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              data-ocid="audit.clear_filters_button"
            >
              <X className="h-3.5 w-3.5" />
              Clear Filters
            </Button>
          )}

          <span className="ml-auto text-sm text-muted-foreground">
            {total} total entries
          </span>
        </div>

        {/* Table */}
        {auditQuery.isLoading ? (
          <AuditTableSkeleton />
        ) : filteredEntries.length === 0 ? (
          <Card>
            <CardContent
              className="flex flex-col items-center justify-center py-16"
              data-ocid="audit.empty_state"
            >
              <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-foreground">
                No audit entries yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Actions and status changes will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div
            className="overflow-x-auto rounded-lg border border-border"
            data-ocid="audit.table"
          >
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 dark:bg-muted/20">
                  {[
                    "Timestamp",
                    "Entity Type",
                    "Entity ID",
                    "Action",
                    "Changed By",
                    "Old Value",
                    "New Value",
                    "Reason",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEntries.map((entry, idx) => (
                  <tr
                    key={entry.id ?? `${entry.timestamp}-${idx}`}
                    className="bg-card hover:bg-muted/30 transition-colors dark:bg-card/80"
                    data-ocid={`audit.row.item.${idx + 1}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={entityBadgeClass(entry.entityType)}
                      >
                        {entry.entityType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-mono text-xs text-foreground"
                        title={entry.entityId}
                      >
                        {truncatePrincipal(entry.entityId)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {entry.action}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-mono text-xs text-muted-foreground"
                        title={entry.changedBy}
                      >
                        {truncatePrincipal(entry.changedBy)}
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {entry.oldValue ?? "—"}
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-3 text-xs text-foreground">
                      {entry.newValue ?? "—"}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {entry.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(p) => setCurrentPage(p)}
          isLoading={auditQuery.isFetching}
        />
      </div>
    </AdminLayout>
  );
}
