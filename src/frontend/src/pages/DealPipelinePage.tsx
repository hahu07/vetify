import { PipelineStage } from "@/backend";
import { createActor } from "@/backend";
import { FinancierLayout } from "@/components/FinancierLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STAGES = [
  { key: "reviewing", label: "Reviewing", headerColor: "bg-amber-500" },
  { key: "dueDiligence", label: "Due Diligence", headerColor: "bg-blue-500" },
  { key: "offerSent", label: "Offer Sent", headerColor: "bg-purple-500" },
  { key: "closed", label: "Closed", headerColor: "bg-green-500" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function truncatePrincipal(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function stageBadgeColor(stage: StageKey): string {
  switch (stage) {
    case "reviewing":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "dueDiligence":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "offerSent":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "closed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function DealPipelinePage() {
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: pipeline = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      if (!actor) return [];
      const res = await actor.getPipeline();
      return res;
    },
    enabled: !!actor && !isFetching,
  });

  const setStageMutation = useMutation({
    mutationFn: async ({
      applicantId,
      stage,
    }: {
      applicantId: import("@icp-sdk/core/principal").Principal;
      stage: StageKey;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const stageEnum: PipelineStage =
        stage === "reviewing"
          ? PipelineStage.reviewing
          : stage === "dueDiligence"
            ? PipelineStage.dueDiligence
            : stage === "offerSent"
              ? PipelineStage.offerSent
              : PipelineStage.closed;
      const res = await actor.setPipelineStage(applicantId, stageEnum);
      if ("err" in res) throw new Error(res.err);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      toast.success("Stage updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update stage");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (
      applicantId: import("@icp-sdk/core/principal").Principal,
    ) => {
      if (!actor) throw new Error("Actor not ready");
      const res = await actor.removePipelineEntry(applicantId);
      if ("err" in res) throw new Error(res.err);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      toast.success("Applicant removed from pipeline");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove applicant");
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const entriesByStage: Record<StageKey, Array<string>> = {
    reviewing: [],
    dueDiligence: [],
    offerSent: [],
    closed: [],
  };

  for (const [principal, stage] of pipeline) {
    const key = stage as StageKey;
    if (entriesByStage[key]) {
      entriesByStage[key].push(principal.toText());
    }
  }

  return (
    <FinancierLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Deal Pipeline
            </h1>
            <p className="text-sm text-muted-foreground">
              Track applicants through the financing process
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="gap-2"
            data-ocid="pipeline.refresh_button"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Add applicant note */}
        <div className="mb-6 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Add Applicant to Pipeline:
          </span>{" "}
          Visit the{" "}
          <a href="/financier/discover" className="text-primary underline">
            Discover
          </a>{" "}
          or{" "}
          <a href="/financier/shortlist" className="text-primary underline">
            Shortlist
          </a>{" "}
          page to add applicants to your pipeline.
        </div>

        {/* Kanban columns */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((s) => (
              <div
                key={s.key}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div
                  className={`mb-3 h-2 rounded-full ${s.headerColor} opacity-40`}
                />
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-24 animate-pulse rounded-md bg-muted"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((stageDef) => {
              const ids = entriesByStage[stageDef.key];
              return (
                <div
                  key={stageDef.key}
                  className="flex flex-col rounded-lg border border-border bg-card shadow-sm"
                  data-ocid={`pipeline.column.${stageDef.key}`}
                >
                  {/* Column header */}
                  <div
                    className={`flex items-center justify-between rounded-t-lg px-4 py-3 ${stageDef.headerColor}`}
                  >
                    <span className="text-sm font-semibold text-white">
                      {stageDef.label}
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-white/20 text-white hover:bg-white/30"
                    >
                      {ids.length}
                    </Badge>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 space-y-3 p-3">
                    {ids.length === 0 ? (
                      <p className="py-8 text-center text-sm italic text-muted-foreground">
                        No applicants in this stage
                      </p>
                    ) : (
                      ids.map((id) => (
                        <div
                          key={id}
                          className="rounded-md border border-border bg-background p-3 shadow-xs transition-shadow hover:shadow-sm"
                          data-ocid={`pipeline.card.${id}`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-mono text-xs text-foreground">
                              {truncatePrincipal(id)}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${stageBadgeColor(stageDef.key)}`}
                            >
                              {stageDef.label}
                            </Badge>
                          </div>

                          <div className="mb-2">
                            <label
                              htmlFor={`move-select-${id}`}
                              className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                            >
                              Move to:
                            </label>
                            <Select
                              value={stageDef.key}
                              onValueChange={(val) =>
                                setStageMutation.mutate({
                                  applicantId:
                                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                                    require("@icp-sdk/core/principal").Principal.fromText(
                                      id,
                                    ),
                                  stage: val as StageKey,
                                })
                              }
                              disabled={setStageMutation.isPending}
                            >
                              <SelectTrigger
                                id={`move-select-${id}`}
                                data-ocid={`pipeline.move_select.${id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STAGES.map((s) => (
                                  <SelectItem key={s.key} value={s.key}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-full gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              removeMutation.mutate(
                                // eslint-disable-next-line @typescript-eslint/no-require-imports
                                require("@icp-sdk/core/principal").Principal.fromText(
                                  id,
                                ),
                              )
                            }
                            disabled={removeMutation.isPending}
                            data-ocid={`pipeline.remove_button.${id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </FinancierLayout>
  );
}
