import { r as reactExports, g as useBackend, n as useQuery, j as jsxRuntimeExports, E as AdminLayout, P as PageHeader, ak as Search, I as Input, Y as X, b as Button, v as Skeleton, C as Card, e as CardContent, al as ClipboardList, o as ChevronDown, B as Badge } from "./index-CPnZ4-ee.js";
import { P as Pagination } from "./Pagination-CELRZ_t0.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-C-qTt0dW.js";
import { C as CircleAlert } from "./circle-alert-DERsjRfM.js";
import { C as ChevronUp } from "./chevron-up-C9u-2erU.js";
import "./index-C6Eg3qxK.js";
const PAGE_SIZE = 20;
function formatDate(ts) {
  if (!ts) return "—";
  const ms = Number(ts) / 1e6;
  return new Date(ms).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}
function verdictBadge(verdict) {
  if (!verdict) return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "secondary", children: "Pending" });
  if ("ready" in verdict)
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", children: "Ready" });
  if ("conditionalReady" in verdict)
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", children: "Conditional" });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "destructive", children: "Not Ready" });
}
function AssessmentRow({ business }) {
  const [expanded, setExpanded] = reactExports.useState(false);
  const { actor } = useBackend();
  const tawthiq = business.tawthiqRecord;
  const { data: adminNote } = useQuery({
    queryKey: ["tawthiq", "note", business.userId.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getTawthiqAdminNote(business.userId);
    },
    enabled: !!actor && expanded,
    staleTime: 6e4
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden",
      "data-ocid": "tawthiq_assessments.row",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            type: "button",
            onClick: () => setExpanded((v) => !v),
            className: "flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors",
            "data-ocid": "tawthiq_assessments.expand_button",
            "aria-expanded": expanded,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold text-foreground truncate", children: business.businessName }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground text-right whitespace-nowrap", children: formatDate(tawthiq == null ? void 0 : tawthiq.completedAt) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                  verdictBadge(tawthiq == null ? void 0 : tawthiq.creditReadinessVerdict),
                  ((tawthiq == null ? void 0 : tawthiq.shariaFlags.length) ?? 0) > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-amber-600 dark:text-amber-400", children: [
                    tawthiq.shariaFlags.length,
                    " Shariah flag",
                    tawthiq.shariaFlags.length !== 1 ? "s" : ""
                  ] }),
                  ((tawthiq == null ? void 0 : tawthiq.inconsistencyFlags.length) ?? 0) > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-destructive", children: [
                    tawthiq.inconsistencyFlags.length,
                    " inconsistenc",
                    tawthiq.inconsistencyFlags.length !== 1 ? "ies" : "y"
                  ] })
                ] })
              ] }),
              expanded ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronUp, { className: "h-4 w-4 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "h-4 w-4 shrink-0 text-muted-foreground" })
            ]
          }
        ),
        expanded && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-t border-border/50 px-5 py-4 space-y-4 bg-background", children: [
          (tawthiq == null ? void 0 : tawthiq.narrativeSummary) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5", children: "Narrative" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-foreground leading-relaxed", children: tawthiq.narrativeSummary })
          ] }),
          (tawthiq == null ? void 0 : tawthiq.shariaFlags) && tawthiq.shariaFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5", children: "Shariah Flags" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-1", children: tawthiq.shariaFlags.map((f) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "text-sm text-foreground", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: f.indicator }),
              " ",
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-muted-foreground", children: [
                "(",
                f.category,
                " · ",
                f.severity,
                ")"
              ] })
            ] }, f.indicator)) })
          ] }),
          (tawthiq == null ? void 0 : tawthiq.inconsistencyFlags) && tawthiq.inconsistencyFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5", children: "Inconsistencies" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-lg border border-border/50 overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-border/50 bg-muted/30", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left text-xs font-semibold text-muted-foreground", children: "Field" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left text-xs font-semibold text-muted-foreground", children: "Declared" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left text-xs font-semibold text-muted-foreground", children: "Verified" })
              ] }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: tawthiq.inconsistencyFlags.map((f) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "tr",
                {
                  className: "border-b border-border/30 last:border-0",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2 font-medium text-foreground", children: f.field }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2 text-muted-foreground", children: f.declaredValue }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2 text-foreground", children: f.verifiedValue })
                  ]
                },
                f.field
              )) })
            ] }) })
          ] }),
          adminNote && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5", children: "Admin Note" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-foreground rounded-lg bg-muted/40 px-3 py-2", children: adminNote })
          ] })
        ] })
      ]
    }
  );
}
function AdminTawthiqAssessmentsPage() {
  const [page, setPage] = reactExports.useState(1);
  const [verdictFilter, setVerdictFilter] = reactExports.useState("all");
  const [searchInput, setSearchInput] = reactExports.useState("");
  const [searchQuery, setSearchQuery] = reactExports.useState("");
  const { actor, isFetching } = useBackend();
  const searchRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 350);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [searchInput]);
  reactExports.useEffect(() => {
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
        resolvedSearch
      );
    },
    enabled: !!actor && !isFetching
  });
  const totalPages = data ? Math.max(1, Math.ceil(Number(data.totalCount) / PAGE_SIZE)) : 1;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AdminLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Completed Assessments",
        subtitle: "Tawthiq (التوثيق) — Full log of all onboarding verdicts"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex flex-wrap items-center gap-3",
        "data-ocid": "tawthiq_assessments.filter_bar",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex-1 min-w-[200px] max-w-xs", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Input,
              {
                value: searchInput,
                onChange: (e) => setSearchInput(e.target.value),
                placeholder: "Search by business name…",
                className: "pl-9 text-sm",
                "data-ocid": "tawthiq_assessments.search_input"
              }
            ),
            searchInput && /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                onClick: () => {
                  setSearchInput("");
                  setSearchQuery("");
                },
                className: "absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
                "aria-label": "Clear search",
                children: /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-4 w-4" })
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Select,
            {
              value: verdictFilter,
              onValueChange: (v) => setVerdictFilter(v),
              "data-ocid": "tawthiq_assessments.verdict_filter_select",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  SelectTrigger,
                  {
                    className: "w-[180px] text-sm",
                    "data-ocid": "tawthiq_assessments.verdict_filter_select",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Filter by verdict" })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "all", children: "All Verdicts" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "ready", children: "Ready" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "conditionalReady", children: "Conditional Ready" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "notReady", children: "Not Ready" })
                ] })
              ]
            }
          ),
          (verdictFilter !== "all" || searchQuery) && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "sm",
              onClick: () => {
                setVerdictFilter("all");
                setSearchInput("");
                setSearchQuery("");
              },
              className: "gap-1.5 text-muted-foreground",
              "data-ocid": "tawthiq_assessments.clear_filters_button",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-3.5 w-3.5" }),
                "Clear filters"
              ]
            }
          )
        ]
      }
    ),
    isError && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive",
        "data-ocid": "tawthiq_assessments.error_state",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { className: "h-4 w-4 shrink-0" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Failed to load assessments." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: () => refetch(),
              className: "ml-auto underline underline-offset-2 hover:no-underline",
              "data-ocid": "tawthiq_assessments.retry_button",
              children: "Retry"
            }
          )
        ]
      }
    ),
    isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "space-y-3",
        "data-ocid": "tawthiq_assessments.loading_state",
        children: ["s1", "s2", "s3", "s4", "s5"].map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-[72px] w-full rounded-xl" }, k))
      }
    ),
    !isLoading && data && data.items.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
      Card,
      {
        className: "border-border/50",
        "data-ocid": "tawthiq_assessments.empty_state",
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex flex-col items-center gap-3 py-16 text-center", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ClipboardList, { className: "h-10 w-10 text-muted-foreground/50" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground", children: "No assessments found" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: resolvedVerdict || resolvedSearch ? "Try adjusting your filters." : "Completed Tawthiq assessments will appear here." })
        ] })
      }
    ),
    !isLoading && data && data.items.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", "data-ocid": "tawthiq_assessments.list", children: data.items.map((business) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        AssessmentRow,
        {
          business
        },
        business.userId.toString()
      )) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Pagination,
        {
          currentPage: page,
          totalPages,
          onPageChange: setPage,
          isLoading
        }
      )
    ] })
  ] }) });
}
export {
  AdminTawthiqAssessmentsPage as default
};
