import { g as useBackend, r as reactExports, n as useQuery, j as jsxRuntimeExports, G as AdminLayout, P as PageHeader, Q as TriangleAlert, w as Skeleton, C as Card, e as CardContent, ae as Scale, D as useQueryClient, E as useMutation, l as ue, B as Badge, z as cn, b as Button, p as ChevronDown } from "./index-DiwSGmNR.js";
import { M as MizanScoresCard } from "./MizanScoresCard-VI5T2Gxh.js";
import { P as Pagination } from "./Pagination-C2tGfPIh.js";
import { R as RiskLevel } from "./index-B7t3rgHq.js";
import { C as ChevronUp } from "./chevron-up-CzmXa_4A.js";
import "./clock-BRirAh28.js";
const PAGE_SIZE = 20;
function riskColors(risk) {
  switch (risk) {
    case RiskLevel.low:
      return "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30";
    case RiskLevel.medium:
      return "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30";
    default:
      return "bg-red-500/15 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30";
  }
}
function BorderlineRow({ biz, idx }) {
  const [expanded, setExpanded] = reactExports.useState(false);
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const mizanQuery = useQuery({
    queryKey: ["mizan_result", biz.userId.toText()],
    queryFn: async () => {
      if (!actor) return null;
      const actorAny = actor;
      if (typeof actorAny.getMizanResult !== "function") return null;
      const result = await actorAny.getMizanResult(biz.userId.toText());
      if (!result) return null;
      if ("ok" in result) return result.ok;
      if ("err" in result) return null;
      return result;
    },
    enabled: !!actor && expanded
  });
  const retriggerMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const actorAny = actor;
      if (typeof actorAny.triggerMizanAnalysis !== "function")
        throw new Error("triggerMizanAnalysis not available");
      const res = await actorAny.triggerMizanAnalysis(biz.userId.toText());
      if ("err" in res) throw new Error(res.err);
      return res.ok;
    },
    onSuccess: () => {
      ue.success("Mizan analysis re-triggered");
      queryClient.invalidateQueries({
        queryKey: ["mizan_result", biz.userId.toText()]
      });
      queryClient.invalidateQueries({ queryKey: ["admin_borderline"] });
    },
    onError: (err) => ue.error(
      err instanceof Error ? err.message : "Failed to re-trigger analysis"
    )
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Card,
    {
      className: "transition-smooth hover:border-primary/30",
      "data-ocid": `mizan_review.item.${idx}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-center justify-between gap-3 py-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-4 w-4 shrink-0 text-muted-foreground" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "truncate text-sm font-semibold text-foreground", children: biz.displayName }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Flagged for human underwriting review" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "span",
              {
                className: "text-sm font-bold tabular-nums text-foreground",
                "data-ocid": `mizan_review.overall_score.${idx}`,
                children: [
                  Number(biz.financingReadyScore),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-0.5 text-xs font-normal text-muted-foreground", children: "/100" })
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Badge,
              {
                className: cn(riskColors(biz.riskLevel)),
                "data-ocid": `mizan_review.risk_badge.${idx}`,
                children: biz.riskLevel === RiskLevel.low ? "Low Risk" : biz.riskLevel === RiskLevel.medium ? "Medium Risk" : "High Risk"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Button,
              {
                type: "button",
                size: "sm",
                variant: "ghost",
                onClick: () => setExpanded((v) => !v),
                "aria-label": expanded ? "Collapse" : "Expand",
                "data-ocid": `mizan_review.expand_button.${idx}`,
                children: expanded ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronUp, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "h-4 w-4" })
              }
            )
          ] })
        ] }),
        expanded && /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "pb-5 pt-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          MizanScoresCard,
          {
            mizan: mizanQuery.data ?? null,
            isLoading: mizanQuery.isLoading,
            isAdmin: true,
            onRetrigger: () => retriggerMutation.mutate()
          }
        ) })
      ]
    }
  );
}
function AdminMizanReviewPage() {
  var _a, _b;
  const { actor } = useBackend();
  const [currentPage, setCurrentPage] = reactExports.useState(1);
  const borderlineQuery = useQuery({
    queryKey: ["admin_borderline", currentPage],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0n };
      const actorAny = actor;
      if (typeof actorAny.listBorderlineBusinesses !== "function") {
        return { items: [], total: 0n };
      }
      return actorAny.listBorderlineBusinesses(
        BigInt(currentPage - 1)
      );
    },
    enabled: !!actor,
    placeholderData: (prev) => prev
  });
  const items = ((_a = borderlineQuery.data) == null ? void 0 : _a.items) ?? [];
  const totalItems = Number(((_b = borderlineQuery.data) == null ? void 0 : _b.total) ?? 0n);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AdminLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-5xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Mizan Review (الميزان)",
        subtitle: "Businesses flagged for human underwriting review — borderline AI risk scores.",
        breadcrumbs: [
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Mizan Review" }
        ],
        actions: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 text-amber-600 dark:text-amber-400" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-sm font-medium text-amber-700 dark:text-amber-300", children: [
            borderlineQuery.isLoading ? "…" : totalItems,
            " flagged"
          ] })
        ] })
      }
    ),
    borderlineQuery.isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: [0, 1, 2].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-14 w-full rounded-xl" }, i)) }) : items.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      CardContent,
      {
        className: "flex flex-col items-center justify-center py-16 text-center",
        "data-ocid": "mizan_review.empty_state",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "mb-3 h-12 w-12 text-muted-foreground/30" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-display font-semibold text-foreground", children: "No Borderline Cases" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 max-w-sm text-sm text-muted-foreground", children: "All Mizan-analysed businesses are within acceptable risk thresholds. No human review required at this time." })
        ]
      }
    ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", "data-ocid": "mizan_review.list", children: items.map((biz, idx) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      BorderlineRow,
      {
        biz,
        idx: idx + 1
      },
      biz.userId.toText()
    )) }),
    totalPages > 1 && /* @__PURE__ */ jsxRuntimeExports.jsx(
      Pagination,
      {
        currentPage,
        totalPages,
        onPageChange: setCurrentPage,
        isLoading: borderlineQuery.isFetching
      }
    )
  ] }) });
}
export {
  AdminMizanReviewPage as default
};
