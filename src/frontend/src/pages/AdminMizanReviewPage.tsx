import { AdminLayout } from "@/components/AdminLayout";
import { MizanScoresCard } from "@/components/MizanScoresCard";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/use-backend";
import { cn } from "@/lib/utils";
import type { ApplicantSummary, MizanRecord } from "@/types";
import { RiskLevel } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, Scale } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

function riskColors(risk: RiskLevel) {
  switch (risk) {
    case RiskLevel.low:
      return "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30";
    case RiskLevel.medium:
      return "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30";
    default:
      return "bg-red-500/15 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30";
  }
}

interface BorderlineRowProps {
  biz: ApplicantSummary;
  idx: number;
}

function BorderlineRow({ biz, idx }: BorderlineRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  const mizanQuery = useQuery({
    queryKey: ["mizan_result", biz.userId.toText()],
    queryFn: async () => {
      if (!actor) return null;
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof actorAny.getMizanResult !== "function") return null;
      const result = (await actorAny.getMizanResult(biz.userId.toText())) as
        | { ok: MizanRecord }
        | { err: string }
        | MizanRecord
        | null;
      if (!result) return null;
      if ("ok" in result) return result.ok;
      if ("err" in result) return null;
      return result as MizanRecord;
    },
    enabled: !!actor && expanded,
  });

  const retriggerMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof actorAny.triggerMizanAnalysis !== "function")
        throw new Error("triggerMizanAnalysis not available");
      const res = (await actorAny.triggerMizanAnalysis(biz.userId.toText())) as
        | { ok: MizanRecord }
        | { err: string };
      if ("err" in res) throw new Error(res.err);
      return res.ok;
    },
    onSuccess: () => {
      toast.success("Mizan analysis re-triggered");
      queryClient.invalidateQueries({
        queryKey: ["mizan_result", biz.userId.toText()],
      });
      queryClient.invalidateQueries({ queryKey: ["admin_borderline"] });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to re-trigger analysis",
      ),
  });

  return (
    <Card
      className="transition-smooth hover:border-primary/30"
      data-ocid={`mizan_review.item.${idx}`}
    >
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Scale className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {biz.displayName}
            </p>
            <p className="text-xs text-muted-foreground">
              Flagged for human underwriting review
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="text-sm font-bold tabular-nums text-foreground"
            data-ocid={`mizan_review.overall_score.${idx}`}
          >
            {Number(biz.financingReadyScore)}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">
              /100
            </span>
          </span>
          <Badge
            className={cn(riskColors(biz.riskLevel))}
            data-ocid={`mizan_review.risk_badge.${idx}`}
          >
            {biz.riskLevel === RiskLevel.low
              ? "Low Risk"
              : biz.riskLevel === RiskLevel.medium
                ? "Medium Risk"
                : "High Risk"}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
            data-ocid={`mizan_review.expand_button.${idx}`}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>

      {expanded && (
        <CardContent className="pb-5 pt-0">
          <MizanScoresCard
            mizan={mizanQuery.data ?? null}
            isLoading={mizanQuery.isLoading}
            isAdmin
            onRetrigger={() => retriggerMutation.mutate()}
          />
        </CardContent>
      )}
    </Card>
  );
}

export default function AdminMizanReviewPage() {
  const { actor } = useBackend();
  const [currentPage, setCurrentPage] = useState(1);

  const borderlineQuery = useQuery({
    queryKey: ["admin_borderline", currentPage],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0n };
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof actorAny.listBorderlineBusinesses !== "function") {
        return { items: [] as ApplicantSummary[], total: 0n };
      }
      return actorAny.listBorderlineBusinesses(
        BigInt(currentPage - 1),
      ) as Promise<{ items: ApplicantSummary[]; total: bigint }>;
    },
    enabled: !!actor,
    placeholderData: (prev) => prev,
  });

  const items: ApplicantSummary[] = borderlineQuery.data?.items ?? [];
  const totalItems = Number(borderlineQuery.data?.total ?? 0n);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <PageHeader
          title="Mizan Review (الميزان)"
          subtitle="Businesses flagged for human underwriting review — borderline AI risk scores."
          breadcrumbs={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Mizan Review" },
          ]}
          actions={
            <div className="flex items-center gap-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {borderlineQuery.isLoading ? "…" : totalItems} flagged
              </span>
            </div>
          }
        />

        {borderlineQuery.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent
              className="flex flex-col items-center justify-center py-16 text-center"
              data-ocid="mizan_review.empty_state"
            >
              <Scale className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="font-display font-semibold text-foreground">
                No Borderline Cases
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                All Mizan-analysed businesses are within acceptable risk
                thresholds. No human review required at this time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3" data-ocid="mizan_review.list">
            {items.map((biz, idx) => (
              <BorderlineRow
                key={biz.userId.toText()}
                biz={biz}
                idx={idx + 1}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            isLoading={borderlineQuery.isFetching}
          />
        )}
      </div>
    </AdminLayout>
  );
}
