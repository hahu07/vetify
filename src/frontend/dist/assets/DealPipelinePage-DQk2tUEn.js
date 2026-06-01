import { Z as useActor, D as useQueryClient, r as reactExports, n as useQuery, E as useMutation, j as jsxRuntimeExports, b as Button, af as RefreshCw, B as Badge, T as Trash2, l as ue, ax as PipelineStage, ad as createActor } from "./index-DiwSGmNR.js";
import { F as FinancierLayout } from "./FinancierLayout-Bfo9Osfi.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-0Pi_1wo9.js";
import "./use-user-role-DlEe0uPV.js";
import "./message-circle-C1jDekiM.js";
import "./user-BQRpN4aJ.js";
import "./index-IXOTxK3N.js";
import "./index-Hp8SMVjr.js";
import "./check-COltzNMb.js";
import "./chevron-up-CzmXa_4A.js";
const STAGES = [
  { key: "reviewing", label: "Reviewing", headerColor: "bg-amber-500" },
  { key: "dueDiligence", label: "Due Diligence", headerColor: "bg-blue-500" },
  { key: "offerSent", label: "Offer Sent", headerColor: "bg-purple-500" },
  { key: "closed", label: "Closed", headerColor: "bg-green-500" }
];
function truncatePrincipal(id) {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}
function stageBadgeColor(stage) {
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
function DealPipelinePage() {
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = reactExports.useState(false);
  const {
    data: pipeline = [],
    isLoading,
    refetch
  } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      if (!actor) return [];
      const res = await actor.getPipeline();
      return res;
    },
    enabled: !!actor && !isFetching
  });
  const setStageMutation = useMutation({
    mutationFn: async ({
      applicantId,
      stage
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const stageEnum = stage === "reviewing" ? PipelineStage.reviewing : stage === "dueDiligence" ? PipelineStage.dueDiligence : stage === "offerSent" ? PipelineStage.offerSent : PipelineStage.closed;
      const res = await actor.setPipelineStage(applicantId, stageEnum);
      if ("err" in res) throw new Error(res.err);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      ue.success("Stage updated");
    },
    onError: (err) => {
      ue.error(err.message || "Failed to update stage");
    }
  });
  const removeMutation = useMutation({
    mutationFn: async (applicantId) => {
      if (!actor) throw new Error("Actor not ready");
      const res = await actor.removePipelineEntry(applicantId);
      if ("err" in res) throw new Error(res.err);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      ue.success("Applicant removed from pipeline");
    },
    onError: (err) => {
      ue.error(err.message || "Failed to remove applicant");
    }
  });
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };
  const entriesByStage = {
    reviewing: [],
    dueDiligence: [],
    offerSent: [],
    closed: []
  };
  for (const [principal, stage] of pipeline) {
    const key = stage;
    if (entriesByStage[key]) {
      entriesByStage[key].push(principal.toText());
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(FinancierLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto max-w-7xl px-4 py-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-display text-2xl font-bold tracking-tight text-foreground", children: "Deal Pipeline" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Track applicants through the financing process" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "sm",
          onClick: handleRefresh,
          disabled: isRefreshing || isLoading,
          className: "gap-2",
          "data-ocid": "pipeline.refresh_button",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              RefreshCw,
              {
                className: `h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`
              }
            ),
            "Refresh"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: "Add Applicant to Pipeline:" }),
      " ",
      "Visit the",
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "/financier/discover", className: "text-primary underline", children: "Discover" }),
      " ",
      "or",
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "/financier/shortlist", className: "text-primary underline", children: "Shortlist" }),
      " ",
      "page to add applicants to your pipeline."
    ] }),
    isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", children: STAGES.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "rounded-lg border border-border bg-card p-4",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: `mb-3 h-2 rounded-full ${s.headerColor} opacity-40`
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: [1, 2].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "h-24 animate-pulse rounded-md bg-muted"
            },
            i
          )) })
        ]
      },
      s.key
    )) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", children: STAGES.map((stageDef) => {
      const ids = entriesByStage[stageDef.key];
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "flex flex-col rounded-lg border border-border bg-card shadow-sm",
          "data-ocid": `pipeline.column.${stageDef.key}`,
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                className: `flex items-center justify-between rounded-t-lg px-4 py-3 ${stageDef.headerColor}`,
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-white", children: stageDef.label }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Badge,
                    {
                      variant: "secondary",
                      className: "bg-white/20 text-white hover:bg-white/30",
                      children: ids.length
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex-1 space-y-3 p-3", children: ids.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "py-8 text-center text-sm italic text-muted-foreground", children: "No applicants in this stage" }) : ids.map((id) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                className: "rounded-md border border-border bg-background p-3 shadow-xs transition-shadow hover:shadow-sm",
                "data-ocid": `pipeline.card.${id}`,
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-2 flex items-center justify-between", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-xs text-foreground", children: truncatePrincipal(id) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Badge,
                      {
                        variant: "secondary",
                        className: `text-[10px] ${stageBadgeColor(stageDef.key)}`,
                        children: stageDef.label
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-2", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "label",
                      {
                        htmlFor: `move-select-${id}`,
                        className: "mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
                        children: "Move to:"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      Select,
                      {
                        value: stageDef.key,
                        onValueChange: (val) => setStageMutation.mutate({
                          applicantId: (
                            // eslint-disable-next-line @typescript-eslint/no-require-imports
                            require("@icp-sdk/core/principal").Principal.fromText(
                              id
                            )
                          ),
                          stage: val
                        }),
                        disabled: setStageMutation.isPending,
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            SelectTrigger,
                            {
                              id: `move-select-${id}`,
                              "data-ocid": `pipeline.move_select.${id}`,
                              children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {})
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: STAGES.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: s.key, children: s.label }, s.key)) })
                        ]
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    Button,
                    {
                      type: "button",
                      variant: "ghost",
                      size: "sm",
                      className: "h-7 w-full gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive",
                      onClick: () => removeMutation.mutate(
                        // eslint-disable-next-line @typescript-eslint/no-require-imports
                        require("@icp-sdk/core/principal").Principal.fromText(
                          id
                        )
                      ),
                      disabled: removeMutation.isPending,
                      "data-ocid": `pipeline.remove_button.${id}`,
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "h-3 w-3" }),
                        "Remove"
                      ]
                    }
                  )
                ]
              },
              id
            )) })
          ]
        },
        stageDef.key
      );
    }) })
  ] }) });
}
export {
  DealPipelinePage as default
};
