import { RiskLevel } from "@/backend";
import { FinancierLayout } from "@/components/FinancierLayout";
import { KashifCompatibilityGauge } from "@/components/KashifCompatibilityGauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useComparisonData, useShortlist } from "@/hooks/useKashif";
import { cn } from "@/lib/utils";
import type { CompatibilityResult } from "@/types/kashif";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  Building2,
  ChevronRight,
  Compass,
  Download,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Helpers ────────────────────────────────────────────────────────────────

function riskBadgeClass(risk: RiskLevel): string {
  if (risk === RiskLevel.Low)
    return "bg-primary/10 text-primary border-primary/20";
  if (risk === RiskLevel.Medium)
    return "bg-warning/20 text-warning-foreground border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

function halalBadgeClass(score: number): string {
  if (score >= 70) return "bg-primary/10 text-primary border-primary/20";
  if (score >= 40)
    return "bg-warning/20 text-warning-foreground border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

/** Find the best (highest) numeric value across a row of comparison cells. */
function bestIndex(values: (number | string)[]): number {
  let best = -1;
  let bestVal = Number.NEGATIVE_INFINITY;
  values.forEach((v, i) => {
    const n = typeof v === "number" ? v : Number.NaN;
    if (!Number.isNaN(n) && n > bestVal) {
      bestVal = n;
      best = i;
    }
  });
  return best;
}

// ── Shortlist card ──────────────────────────────────────────────────────────

interface ShortlistCardProps {
  result: CompatibilityResult;
  checked: boolean;
  onToggleCompare: (id: string) => void;
  onRemove: (id: string) => void;
  compareDisabled: boolean;
  index: number;
}

function ShortlistCard({
  result,
  checked,
  onToggleCompare,
  onRemove,
  compareDisabled,
  index,
}: ShortlistCardProps) {
  const id = result.businessId.toString();
  const score = Number(result.compatibilityScore);
  const halal = Number(result.halalComplianceScore);

  return (
    <Card
      className={cn(
        "transition-all duration-200 border",
        checked
          ? "shadow-comparison-lift border-primary/40"
          : "shadow-kashif-card hover:shadow-kashif-hover border-border",
      )}
      data-ocid={`shortlist.card.${index}`}
    >
      <CardContent className="flex items-start gap-4 p-4">
        {/* Compare checkbox */}
        <div className="mt-1 shrink-0">
          <Checkbox
            id={`compare-${id}`}
            checked={checked}
            onCheckedChange={() => onToggleCompare(id)}
            disabled={compareDisabled && !checked}
            aria-label={`Compare ${result.displayName}`}
            data-ocid={`shortlist.compare_checkbox.${index}`}
          />
        </div>

        {/* Gauge */}
        <div className="shrink-0">
          <KashifCompatibilityGauge
            score={score}
            size={72}
            strokeWidth={7}
            showLabel={false}
            static
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p
            className="font-display font-semibold text-foreground truncate"
            title={result.displayName}
          >
            {result.displayName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {result.businessCategory}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("text-xs", riskBadgeClass(result.riskLevel))}
              data-ocid={`shortlist.risk_badge.${index}`}
            >
              {result.riskLevel} Risk
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-xs", halalBadgeClass(halal))}
              data-ocid={`shortlist.halal_badge.${index}`}
            >
              <ShieldCheck className="mr-1 h-3 w-3" />
              Halal {halal}%
            </Badge>
          </div>

          {result.financingTypes.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {result.financingTypes.slice(0, 3).join(" · ")}
              {result.financingTypes.length > 3 &&
                ` +${result.financingTypes.length - 3}`}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(id)}
            aria-label={`Remove ${result.displayName} from shortlist`}
            className="text-muted-foreground hover:text-destructive"
            data-ocid={`shortlist.remove_button.${index}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Comparison table ────────────────────────────────────────────────────────

interface ComparisonTableProps {
  results: CompatibilityResult[];
  isLoading: boolean;
}

type ComparisonRow = {
  label: string;
  getValue: (r: CompatibilityResult) => string | number;
  numeric: boolean;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Compatibility Score",
    getValue: (r) => Number(r.compatibilityScore),
    numeric: true,
  },
  {
    label: "Risk Level",
    getValue: (r) => r.riskLevel,
    numeric: false,
  },
  {
    label: "Halal Compliance Score",
    getValue: (r) => Number(r.halalComplianceScore),
    numeric: true,
  },
  {
    label: "Business Category",
    getValue: (r) => r.businessCategory || "—",
    numeric: false,
  },
  {
    label: "Financing Types",
    getValue: (r) =>
      r.financingTypes.length > 0 ? r.financingTypes.join(", ") : "—",
    numeric: false,
  },
];

function ComparisonTable({ results, isLoading }: ComparisonTableProps) {
  if (isLoading) {
    return (
      <Card className="shadow-comparison-lift">
        <CardContent className="p-4 space-y-3">
          {["s1", "s2", "s3", "s4", "s5"].map((k) => (
            <Skeleton key={k} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) return null;

  return (
    <Card
      className="shadow-comparison-lift border-primary/20 overflow-hidden"
      data-ocid="shortlist.comparison_table"
    >
      <div className="border-b border-border bg-primary/5 px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-foreground">
          Side-by-Side Comparison
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cells with a green highlight indicate the best value in each row.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-44">
                Metric
              </th>
              {results.map((r, i) => (
                <th
                  key={r.businessId.toString()}
                  className="px-4 py-3 text-left font-medium text-foreground max-w-[160px]"
                  data-ocid={`shortlist.comparison_header.${i + 1}`}
                >
                  <span className="block truncate" title={r.displayName}>
                    {r.displayName}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => {
              const values = results.map((r) => row.getValue(r));
              const best = row.numeric ? bestIndex(values) : -1;

              return (
                <tr
                  key={row.label}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </td>
                  {results.map((r, colIdx) => {
                    const val = row.getValue(r);
                    const isBest = best === colIdx;
                    return (
                      <td
                        key={r.businessId.toString()}
                        className={cn(
                          "px-4 py-3 font-medium text-foreground",
                          isBest && "rounded-sm",
                        )}
                        style={
                          isBest
                            ? {
                                backgroundColor:
                                  "oklch(var(--comparison-diff))",
                              }
                            : undefined
                        }
                        data-ocid={`shortlist.comparison_cell.${row.label.toLowerCase().replace(/\s+/g, "_")}.${colIdx + 1}`}
                      >
                        {row.label === "Compatibility Score" ||
                        row.label === "Halal Compliance Score"
                          ? `${val}%`
                          : String(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyShortlist() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-24 text-center"
      data-ocid="shortlist.empty_state"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Bookmark className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Your shortlist is empty
        </h3>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          Visit the Discovery page to browse financing-ready borrowers and
          bookmark the ones that match your investment criteria.
        </p>
      </div>
      <Button asChild type="button" className="mt-2 gap-2">
        <Link to="/financier/discover" data-ocid="shortlist.discover_link">
          <Compass className="h-4 w-4" />
          Go to Discovery
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

// ── CSV Export ──────────────────────────────────────────────────────────────

function exportShortlistCSV(items: CompatibilityResult[]) {
  if (items.length === 0) return false;
  const headers = [
    "Business Name",
    "Risk Level",
    "Halal Compliance Score",
    "Mizan Overall Score",
    "Business Category",
    "Financing Types",
  ];
  const rows = items.map((r) => [
    r.displayName,
    r.riskLevel,
    `${Number(r.halalComplianceScore)}%`,
    `${Number(r.compatibilityScore)}%`,
    r.businessCategory || "",
    r.financingTypes.join(" | "),
  ]);
  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `shortlist-export-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function KashifShortlistPage() {
  const {
    shortlist,
    isLoading: shortlistLoading,
    removeFromShortlist,
  } = useShortlist();

  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  // Enrich shortlist cards: fetch CompatibilityResult for all shortlisted IDs
  const allShortlistedIds = shortlist.map((e) => e.businessId.toString());
  const enrichQuery = useComparisonData(allShortlistedIds);
  const enrichedMap = new Map<string, CompatibilityResult>(
    (enrichQuery.data ?? []).map((r) => [r.businessId.toString(), r]),
  );

  // Comparison section data: fetch for selected IDs (capped at 4 by the hook)
  const selectedIds = Array.from(compareIds);
  const comparisonQuery = useComparisonData(selectedIds);

  const canAddMore = compareIds.size < 4;

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }

  function handleRemove(id: string) {
    removeFromShortlist(id);
    setCompareIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const showComparison = compareIds.size >= 2;

  return (
    <FinancierLayout>
      <div className="container mx-auto max-w-5xl px-4 py-10">
        {/* Header */}
        <div className="mb-8" data-ocid="shortlist.page_header">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Kashif{" "}
              <span className="font-normal text-muted-foreground text-xl">
                (الكاشف)
              </span>
            </h1>
          </div>
          <p className="mt-1 text-muted-foreground">My Shortlist</p>
          {shortlist.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Select 2–4 borrowers using the checkboxes to compare them
              side-by-side.
            </p>
          )}
        </div>

        {/* Shortlist section */}
        <section data-ocid="shortlist.section">
          {!shortlistLoading &&
            !enrichQuery.isLoading &&
            shortlist.length > 0 && (
              <div className="flex justify-end mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const allItems = Array.from(enrichedMap.values());
                    const exported = exportShortlistCSV(allItems);
                    if (!exported) {
                      toast.info("No items to export");
                    }
                  }}
                  data-ocid="shortlist.export_button"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            )}
          {shortlistLoading || enrichQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {["s1", "s2", "s3"].map((k) => (
                <Card key={k} className="shadow-kashif-card">
                  <CardContent className="flex items-start gap-4 p-4">
                    <Skeleton className="mt-1 h-4 w-4 rounded" />
                    <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : shortlist.length === 0 ? (
            <EmptyShortlist />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shortlist.map((entry, idx) => {
                const id = entry.businessId.toString();
                const enriched = enrichedMap.get(id);
                if (!enriched) {
                  return (
                    <Card key={id} className="shadow-kashif-card">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                        <p className="text-sm text-muted-foreground truncate">
                          Loading…
                        </p>
                      </CardContent>
                    </Card>
                  );
                }
                return (
                  <ShortlistCard
                    key={id}
                    result={enriched}
                    checked={compareIds.has(id)}
                    onToggleCompare={toggleCompare}
                    onRemove={handleRemove}
                    compareDisabled={!canAddMore}
                    index={idx + 1}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Comparison section */}
        {showComparison && (
          <section className="mt-10" data-ocid="shortlist.comparison_section">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Comparison
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({compareIds.size} selected)
                </span>
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCompareIds(new Set())}
                className="text-muted-foreground"
                data-ocid="shortlist.clear_comparison_button"
              >
                Clear
              </Button>
            </div>
            <ComparisonTable
              results={comparisonQuery.data ?? []}
              isLoading={comparisonQuery.isLoading}
            />
          </section>
        )}
      </div>
    </FinancierLayout>
  );
}
