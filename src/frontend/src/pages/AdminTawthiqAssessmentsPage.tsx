import type { BusinessProfile } from "@/backend";
import { AdminLayout } from "@/components/AdminLayout";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 20;

function formatDate(ts: bigint | undefined): string {
  if (!ts) return "—";
  const ms = Number(ts) / 1_000_000;
  return new Date(ms).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function verdictBadge(
  verdict:
    | { ready: null }
    | { conditionalReady: null }
    | { notReady: null }
    | undefined,
) {
  if (!verdict) return <Badge variant="secondary">Pending</Badge>;
  if ("ready" in verdict)
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
        Ready
      </Badge>
    );
  if ("conditionalReady" in verdict)
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
        Conditional
      </Badge>
    );
  return <Badge variant="destructive">Not Ready</Badge>;
}

function AssessmentRow({ business }: { business: BusinessProfile }) {
  const [expanded, setExpanded] = useState(false);
  const { actor } = useBackend();

  const tawthiq = business.tawthiqRecord;

  const { data: adminNote } = useQuery<string | null>({
    queryKey: ["tawthiq", "note", business.userId.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getTawthiqAdminNote(business.userId);
    },
    enabled: !!actor && expanded,
    staleTime: 60_000,
  });

  return (
    <div
      className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden"
      data-ocid="tawthiq_assessments.row"
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
        data-ocid="tawthiq_assessments.expand_button"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          <span className="font-semibold text-foreground truncate">
            {business.businessName}
          </span>
          <span className="text-xs text-muted-foreground text-right whitespace-nowrap">
            {formatDate(tawthiq?.completedAt)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {verdictBadge(tawthiq?.creditReadinessVerdict)}
            {(tawthiq?.shariaFlags.length ?? 0) > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {tawthiq!.shariaFlags.length} Shariah flag
                {tawthiq!.shariaFlags.length !== 1 ? "s" : ""}
              </span>
            )}
            {(tawthiq?.inconsistencyFlags.length ?? 0) > 0 && (
              <span className="text-xs text-destructive">
                {tawthiq!.inconsistencyFlags.length} inconsistenc
                {tawthiq!.inconsistencyFlags.length !== 1 ? "ies" : "y"}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/50 px-5 py-4 space-y-4 bg-background">
          {tawthiq?.narrativeSummary && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Narrative
              </h4>
              <p className="text-sm text-foreground leading-relaxed">
                {tawthiq.narrativeSummary}
              </p>
            </div>
          )}
          {tawthiq?.shariaFlags && tawthiq.shariaFlags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Shariah Flags
              </h4>
              <ul className="space-y-1">
                {tawthiq.shariaFlags.map((f) => (
                  <li key={f.indicator} className="text-sm text-foreground">
                    <span className="font-medium">{f.indicator}</span>{" "}
                    <span className="text-muted-foreground">
                      ({f.category} · {f.severity})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tawthiq?.inconsistencyFlags &&
            tawthiq.inconsistencyFlags.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Inconsistencies
                </h4>
                <div className="rounded-lg border border-border/50 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Field
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Declared
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Verified
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tawthiq.inconsistencyFlags.map((f) => (
                        <tr
                          key={f.field}
                          className="border-b border-border/30 last:border-0"
                        >
                          <td className="px-3 py-2 font-medium text-foreground">
                            {f.field}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {f.declaredValue}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {f.verifiedValue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          {adminNote && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Admin Note
              </h4>
              <p className="text-sm text-foreground rounded-lg bg-muted/40 px-3 py-2">
                {adminNote}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminTawthiqAssessmentsPage() {
  const [page, setPage] = useState(1);
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { actor, isFetching } = useBackend();
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 350);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [searchInput]);

  // Reset page when verdict filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: verdictFilter is intentionally the only dep
  useEffect(() => {
    setPage(1);
  }, [verdictFilter]);

  const resolvedVerdict = verdictFilter === "all" ? null : verdictFilter;
  const resolvedSearch = searchQuery.trim() === "" ? null : searchQuery.trim();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tawthiq", "assessments", page, resolvedVerdict, resolvedSearch],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getTawthiqCompletedAssessments(
        BigInt(page),
        BigInt(PAGE_SIZE),
        resolvedVerdict,
        resolvedSearch,
      );
    },
    enabled: !!actor && !isFetching,
  });

  const totalPages = data
    ? Math.max(1, Math.ceil(Number(data.totalCount) / PAGE_SIZE))
    : 1;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Completed Assessments"
          subtitle="Tawthiq (التوثيق) — Full log of all onboarding verdicts"
        />

        {/* Filter Bar */}
        <div
          className="flex flex-wrap items-center gap-3"
          data-ocid="tawthiq_assessments.filter_bar"
        >
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by business name…"
              className="pl-9 text-sm"
              data-ocid="tawthiq_assessments.search_input"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select
            value={verdictFilter}
            onValueChange={(v) => setVerdictFilter(v)}
            data-ocid="tawthiq_assessments.verdict_filter_select"
          >
            <SelectTrigger
              className="w-[180px] text-sm"
              data-ocid="tawthiq_assessments.verdict_filter_select"
            >
              <SelectValue placeholder="Filter by verdict" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Verdicts</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="conditionalReady">
                Conditional Ready
              </SelectItem>
              <SelectItem value="notReady">Not Ready</SelectItem>
            </SelectContent>
          </Select>

          {(verdictFilter !== "all" || searchQuery) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setVerdictFilter("all");
                setSearchInput("");
                setSearchQuery("");
              }}
              className="gap-1.5 text-muted-foreground"
              data-ocid="tawthiq_assessments.clear_filters_button"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>

        {isError && (
          <div
            className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            data-ocid="tawthiq_assessments.error_state"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Failed to load assessments.</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="ml-auto underline underline-offset-2 hover:no-underline"
              data-ocid="tawthiq_assessments.retry_button"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading && (
          <div
            className="space-y-3"
            data-ocid="tawthiq_assessments.loading_state"
          >
            {["s1", "s2", "s3", "s4", "s5"].map((k) => (
              <Skeleton key={k} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && data && data.items.length === 0 && (
          <Card
            className="border-border/50"
            data-ocid="tawthiq_assessments.empty_state"
          >
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium text-foreground">
                No assessments found
              </p>
              <p className="text-sm text-muted-foreground">
                {resolvedVerdict || resolvedSearch
                  ? "Try adjusting your filters."
                  : "Completed Tawthiq assessments will appear here."}
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && data && data.items.length > 0 && (
          <>
            <div className="space-y-3" data-ocid="tawthiq_assessments.list">
              {data.items.map((business) => (
                <AssessmentRow
                  key={business.userId.toString()}
                  business={business}
                />
              ))}
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
