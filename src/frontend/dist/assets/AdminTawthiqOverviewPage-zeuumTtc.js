import { g as useBackend, n as useQuery, S as ShieldCheck, f as CircleCheck, s as CircleX, j as jsxRuntimeExports, E as AdminLayout, P as PageHeader, C as Card, e as CardContent, v as Skeleton } from "./index-CPnZ4-ee.js";
import { C as CircleAlert } from "./circle-alert-DERsjRfM.js";
import { C as Clock } from "./clock-BRCXs4iw.js";
function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  isLoading
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Card,
    {
      className: "border-border/50 shadow-sm",
      "data-ocid": `tawthiq_overview.stat_card.${label.toLowerCase().replace(/\s/g, "_")}`,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "p-6", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-muted-foreground truncate", children: label }),
          isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "mt-1.5 h-9 w-20" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(
            "p",
            {
              className: `mt-1 text-3xl font-bold tabular-nums ${colorClass}`,
              children: value !== void 0 ? Number(value).toLocaleString() : "—"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `rounded-xl p-3 ${bgClass}`, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: `h-6 w-6 ${colorClass}` }) })
      ] }) })
    }
  );
}
function AdminTawthiqOverviewPage() {
  const { actor, isFetching } = useBackend();
  const {
    data: stats,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ["tawthiq", "overview", "stats"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getTawthiqOverviewStats();
    },
    enabled: !!actor && !isFetching
  });
  const statCards = [
    {
      label: "Total Processed",
      value: stats == null ? void 0 : stats.totalProcessed,
      icon: ShieldCheck,
      colorClass: "text-primary",
      bgClass: "bg-primary/10"
    },
    {
      label: "Passed",
      value: stats == null ? void 0 : stats.passedCount,
      icon: CircleCheck,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-500/10"
    },
    {
      label: "Conditional Ready",
      value: stats == null ? void 0 : stats.conditionalCount,
      icon: CircleAlert,
      colorClass: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-amber-500/10"
    },
    {
      label: "Not Ready",
      value: stats == null ? void 0 : stats.notReadyCount,
      icon: CircleX,
      colorClass: "text-destructive",
      bgClass: "bg-destructive/10"
    },
    {
      label: "Pending",
      value: stats == null ? void 0 : stats.pendingCount,
      icon: Clock,
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-500/10"
    }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AdminLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Tawthiq Overview",
        subtitle: "التوثيق — Borrower onboarding pipeline summary"
      }
    ),
    isError && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive",
        "data-ocid": "tawthiq_overview.error_state",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { className: "h-4 w-4 shrink-0" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Failed to load stats." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: () => refetch(),
              className: "ml-auto underline underline-offset-2 hover:no-underline",
              "data-ocid": "tawthiq_overview.retry_button",
              children: "Retry"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
        "data-ocid": "tawthiq_overview.stats_grid",
        children: statCards.map((card) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          StatCard,
          {
            label: card.label,
            value: card.value,
            icon: card.icon,
            colorClass: card.colorClass,
            bgClass: card.bgClass,
            isLoading
          },
          card.label
        ))
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { className: "border-border/50 shadow-sm", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "p-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-3 text-sm font-semibold text-foreground", children: "About Tawthiq (التوثيق)" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm leading-relaxed text-muted-foreground", children: [
        "Tawthiq is the AI-powered borrower onboarding agent that automates KYC, KYB, and Shariah compliance screening. It analyses each SME's profile against Mono-verified data, flags inconsistencies, and assigns a credit-readiness verdict:",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-emerald-600 dark:text-emerald-400", children: "Ready" }),
        ",",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-amber-600 dark:text-amber-400", children: "Conditional Ready" }),
        ", or",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-destructive", children: "Not Ready" }),
        "."
      ] })
    ] }) })
  ] }) });
}
export {
  AdminTawthiqOverviewPage as default
};
