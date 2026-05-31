import { t as createLucideIcon, g as useBackend, r as reactExports, n as useQuery, j as jsxRuntimeExports, E as AdminLayout, P as PageHeader, b as Button, Y as X, C as Card, e as CardContent, al as ClipboardList, B as Badge, v as Skeleton } from "./index-CPnZ4-ee.js";
import { P as Pagination } from "./Pagination-CELRZ_t0.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-C-qTt0dW.js";
import { C as Clock } from "./clock-BRCXs4iw.js";
import "./index-C6Eg3qxK.js";
import "./chevron-up-C9u-2erU.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  [
    "path",
    {
      d: "M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",
      key: "sc7q7i"
    }
  ]
];
const Funnel = createLucideIcon("funnel", __iconNode);
const PAGE_SIZE = 20;
const ENTITY_TYPES = [
  { value: "all", label: "All Entities" },
  { value: "business", label: "Business" },
  { value: "financier", label: "Financier" },
  { value: "kyc", label: "KYC" },
  { value: "banklink", label: "Bank Link" }
];
function formatTimestamp(ts) {
  const ms = Number(ts) / 1e6;
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function entityBadgeClass(entityType) {
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
function truncatePrincipal(principal) {
  if (principal.length <= 16) return principal;
  return `${principal.slice(0, 8)}…${principal.slice(-4)}`;
}
function AuditTableSkeleton() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2", children: ["a", "b", "c", "d", "e"].map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-14 w-full rounded-lg" }, k)) });
}
function AuditTrailPage() {
  var _a, _b;
  const { actor } = useBackend();
  const [currentPage, setCurrentPage] = reactExports.useState(1);
  const [entityTypeFilter, setEntityTypeFilter] = reactExports.useState("all");
  const auditQuery = useQuery({
    queryKey: ["audit_log", currentPage, entityTypeFilter],
    queryFn: async () => {
      if (!actor) return { entries: [], total: 0n, page: 0n };
      const result = await actor.getAuditLog(
        BigInt(currentPage),
        BigInt(PAGE_SIZE)
      );
      if (!result || !result.entries)
        return { entries: [], total: 0n, page: 0n };
      return result;
    },
    enabled: !!actor,
    placeholderData: (prev) => prev
  });
  const entries = ((_a = auditQuery.data) == null ? void 0 : _a.entries) ?? [];
  const total = Number(((_b = auditQuery.data) == null ? void 0 : _b.total) ?? 0n);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filteredEntries = entityTypeFilter === "all" ? entries : entries.filter(
    (e) => e.entityType.toLowerCase() === entityTypeFilter.toLowerCase()
  );
  const hasFilters = entityTypeFilter !== "all";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AdminLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-6xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Audit Trail",
        subtitle: "A complete log of all status changes and actions on the platform.",
        breadcrumbs: [
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Audit Trail" }
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "mb-6 flex flex-wrap items-center gap-3",
        "data-ocid": "audit.filters_section",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Funnel, { className: "h-4 w-4 text-muted-foreground" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-muted-foreground", children: "Filter by:" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Select,
            {
              value: entityTypeFilter,
              onValueChange: (val) => {
                setEntityTypeFilter(val);
                setCurrentPage(1);
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  SelectTrigger,
                  {
                    className: "w-44",
                    "data-ocid": "audit.entity_type_select",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Entity Type" })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: ENTITY_TYPES.map((et) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: et.value, children: et.label }, et.value)) })
              ]
            }
          ),
          hasFilters && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              variant: "ghost",
              size: "sm",
              onClick: () => {
                setEntityTypeFilter("all");
                setCurrentPage(1);
              },
              className: "gap-1.5 text-muted-foreground hover:text-foreground",
              "data-ocid": "audit.clear_filters_button",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-3.5 w-3.5" }),
                "Clear Filters"
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-auto text-sm text-muted-foreground", children: [
            total,
            " total entries"
          ] })
        ]
      }
    ),
    auditQuery.isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(AuditTableSkeleton, {}) : filteredEntries.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      CardContent,
      {
        className: "flex flex-col items-center justify-center py-16",
        "data-ocid": "audit.empty_state",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ClipboardList, { className: "mb-3 h-10 w-10 text-muted-foreground/40" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground", children: "No audit entries yet" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Actions and status changes will appear here." })
        ]
      }
    ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "overflow-x-auto rounded-lg border border-border",
        "data-ocid": "audit.table",
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full min-w-[900px] text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { className: "border-b border-border bg-muted/40 dark:bg-muted/20", children: [
            "Timestamp",
            "Entity Type",
            "Entity ID",
            "Action",
            "Changed By",
            "Old Value",
            "New Value",
            "Reason"
          ].map((col) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "th",
            {
              className: "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
              children: col
            },
            col
          )) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { className: "divide-y divide-border", children: filteredEntries.map((entry, idx) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "tr",
            {
              className: "bg-card hover:bg-muted/30 transition-colors dark:bg-card/80",
              "data-ocid": `audit.row.item.${idx + 1}`,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "whitespace-nowrap px-4 py-3 text-xs text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-3 w-3 shrink-0" }),
                  formatTimestamp(entry.timestamp)
                ] }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Badge,
                  {
                    variant: "outline",
                    className: entityBadgeClass(entry.entityType),
                    children: entry.entityType
                  }
                ) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "span",
                  {
                    className: "font-mono text-xs text-foreground",
                    title: entry.entityId,
                    children: truncatePrincipal(entry.entityId)
                  }
                ) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-3 font-medium text-foreground", children: entry.action }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "span",
                  {
                    className: "font-mono text-xs text-muted-foreground",
                    title: entry.changedBy,
                    children: truncatePrincipal(entry.changedBy)
                  }
                ) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "max-w-[120px] truncate px-4 py-3 text-xs text-muted-foreground", children: entry.oldValue ?? "—" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "max-w-[120px] truncate px-4 py-3 text-xs text-foreground", children: entry.newValue ?? "—" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "max-w-[160px] truncate px-4 py-3 text-xs text-muted-foreground", children: entry.reason ?? "—" })
              ]
            },
            entry.id ?? `${entry.timestamp}-${idx}`
          )) })
        ] })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      Pagination,
      {
        currentPage,
        totalPages,
        onPageChange: (p) => setCurrentPage(p),
        isLoading: auditQuery.isFetching
      }
    )
  ] }) });
}
export {
  AuditTrailPage as default
};
