import { t as createLucideIcon, j as jsxRuntimeExports, y as cn, r as reactExports, E as AdminLayout, P as PageHeader, b as Button, aY as Eye, B as Badge, a9 as ChevronLeft, x as ChevronRight, f as CircleCheck, aZ as Copy, A as useQueryClient, l as ue } from "./index-CPnZ4-ee.js";
import { S as StatusCard } from "./StatusCard-CCnc1WpH.js";
import { d as useKashifLogs, e as useRegenerateReport } from "./useKashif-BW6305hc.js";
import { R as RefreshCw } from "./refresh-cw-LvkTVX9-.js";
import { F as FileText } from "./file-text-DN4Xb49N.js";
import { T as TrendingUp } from "./trending-up-BbF36D2u.js";
import "./clock-BRCXs4iw.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
  ["path", { d: "M18 17V9", key: "2bz60n" }],
  ["path", { d: "M13 17V5", key: "1frdt8" }],
  ["path", { d: "M8 17v-3", key: "17ska0" }]
];
const ChartColumn = createLucideIcon("chart-column", __iconNode);
function Table({ className, ...props }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      "data-slot": "table-container",
      className: "relative w-full overflow-x-auto",
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        "table",
        {
          "data-slot": "table",
          className: cn("w-full caption-bottom text-sm", className),
          ...props
        }
      )
    }
  );
}
function TableHeader({ className, ...props }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "thead",
    {
      "data-slot": "table-header",
      className: cn("[&_tr]:border-b", className),
      ...props
    }
  );
}
function TableBody({ className, ...props }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "tbody",
    {
      "data-slot": "table-body",
      className: cn("[&_tr:last-child]:border-0", className),
      ...props
    }
  );
}
function TableRow({ className, ...props }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "tr",
    {
      "data-slot": "table-row",
      className: cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      ),
      ...props
    }
  );
}
function TableHead({ className, ...props }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "th",
    {
      "data-slot": "table-head",
      className: cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      ),
      ...props
    }
  );
}
function TableCell({ className, ...props }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "td",
    {
      "data-slot": "table-cell",
      className: cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      ),
      ...props
    }
  );
}
const PAGE_SIZE = 20;
function truncatePrincipal(p) {
  if (p.length <= 16) return p;
  return `${p.slice(0, 8)}…${p.slice(-6)}`;
}
function formatDate(ts) {
  if (!ts) return "Never";
  const ms = Number(ts) > 1e12 ? Number(ts) / 1e6 : Number(ts) * 1e3;
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(ms));
}
function isThisWeek(ts) {
  const now = Date.now();
  const ms = Number(ts) > 1e12 ? Number(ts) / 1e6 : Number(ts) * 1e3;
  return now - ms < 7 * 24 * 60 * 60 * 1e3;
}
function CopyButton({ text }) {
  const [copied, setCopied] = reactExports.useState(false);
  const handle = reactExports.useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "button",
    {
      type: "button",
      onClick: handle,
      className: "ml-1.5 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground",
      "aria-label": "Copy principal",
      children: copied ? /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-3.5 w-3.5 text-primary" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Copy, { className: "h-3.5 w-3.5" })
    }
  );
}
function RegenerateButton({ businessId }) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useRegenerateReport({
    onSuccess: () => {
      ue.success("Report regeneration triggered");
      queryClient.invalidateQueries({ queryKey: ["kashif", "logs"] });
    },
    onError: (err) => {
      ue.error(err.message ?? "Regeneration failed");
    }
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Button,
    {
      type: "button",
      variant: "outline",
      size: "sm",
      disabled: isPending,
      onClick: () => mutate(businessId),
      className: "gap-1.5 h-8 px-3 text-xs",
      "data-ocid": "kashif.regenerate_button",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: cn("h-3.5 w-3.5", isPending && "animate-spin") }),
        isPending ? "Running…" : "Regenerate"
      ]
    }
  );
}
function AdminKashifPage() {
  const [page, setPage] = reactExports.useState(1);
  const { data, isLoading, isError, refetch } = useKashifLogs(page, PAGE_SIZE);
  const logs = (data == null ? void 0 : data.items) ?? [];
  const total = Number((data == null ? void 0 : data.total) ?? 0n);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalViews = logs.reduce((sum, l) => sum + Number(l.viewCount), 0);
  const thisWeekCount = logs.filter((l) => isThisWeek(l.generatedAt)).length;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AdminLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-6xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Kashif (الكاشف) — Report Oversight",
        subtitle: "Monitor investment discovery reports generated for financing-ready businesses.",
        breadcrumbs: [
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Kashif" }
        ],
        actions: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            type: "button",
            variant: "outline",
            size: "sm",
            onClick: () => refetch(),
            className: "gap-1.5",
            "data-ocid": "kashif.refresh_button",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-4 w-4" }),
              "Refresh"
            ]
          }
        ),
        "data-ocid": "kashif.page"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "section",
      {
        className: "mb-8 grid gap-4 sm:grid-cols-3",
        "data-ocid": "kashif.stats_section",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            StatusCard,
            {
              icon: FileText,
              label: "Total Reports Generated",
              value: total,
              variant: "success",
              "data-ocid": "kashif.total_reports_card"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            StatusCard,
            {
              icon: Eye,
              label: "Total Report Views",
              value: totalViews,
              variant: "pending",
              "data-ocid": "kashif.total_views_card"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            StatusCard,
            {
              icon: TrendingUp,
              label: "Generated This Week",
              value: thisWeekCount,
              variant: "warning",
              "data-ocid": "kashif.this_week_card"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "section",
      {
        className: "rounded-xl border border-border bg-card overflow-hidden shadow-xs",
        "data-ocid": "kashif.table_section",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-between border-b border-border px-5 py-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(ChartColumn, { className: "h-4 w-4 text-primary" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-base font-semibold text-foreground", children: "Report Activity Log" }),
            total > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { variant: "secondary", className: "ml-1 text-xs", children: [
              total,
              " total"
            ] })
          ] }) }),
          isError ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex flex-col items-center gap-3 py-16 text-center",
              "data-ocid": "kashif.error_state",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-muted-foreground text-sm", children: "Failed to load report logs." }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Button,
                  {
                    type: "button",
                    variant: "outline",
                    size: "sm",
                    onClick: () => refetch(),
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "mr-2 h-4 w-4" }),
                      "Retry"
                    ]
                  }
                )
              ]
            }
          ) : isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "space-y-0 divide-y divide-border",
              "data-ocid": "kashif.loading_state",
              children: Array.from({ length: 6 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-4 px-5 py-4", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-4 w-40 animate-pulse rounded bg-muted" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-4 w-28 animate-pulse rounded bg-muted" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ml-auto h-4 w-16 animate-pulse rounded bg-muted" })
                ] }, i)
              ))
            }
          ) : logs.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex flex-col items-center gap-3 py-16 text-center",
              "data-ocid": "kashif.empty_state",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(FileText, { className: "h-10 w-10 text-muted-foreground/50" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground", children: "No reports generated yet" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Reports appear here once Kashif processes a financing-ready business." })
                ] })
              ]
            }
          ) : /* @__PURE__ */ jsxRuntimeExports.jsxs(Table, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TableHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(TableRow, { className: "hover:bg-transparent", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "pl-5 font-semibold text-foreground", children: "Business ID" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-semibold text-foreground", children: "Date Generated" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "text-right font-semibold text-foreground", children: "View Count" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-semibold text-foreground", children: "Last Viewed" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "pr-5 text-right font-semibold text-foreground", children: "Actions" })
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TableBody, { children: logs.map((log, idx) => {
              const principalStr = log.businessId.toString();
              return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                TableRow,
                {
                  className: "hover:bg-muted/40 transition-colors",
                  "data-ocid": `kashif.item.${idx + 1}`,
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "pl-5", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center font-mono text-xs text-foreground", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { title: principalStr, children: truncatePrincipal(principalStr) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(CopyButton, { text: principalStr })
                    ] }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "text-sm text-muted-foreground", children: formatDate(log.generatedAt) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "text-right", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 font-mono text-sm font-medium text-foreground", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Eye, { className: "h-3.5 w-3.5 text-muted-foreground" }),
                      Number(log.viewCount)
                    ] }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "text-sm text-muted-foreground", children: log.lastViewedAt ? formatDate(log.lastViewedAt) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground/50", children: "Never" }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "pr-5 text-right", children: /* @__PURE__ */ jsxRuntimeExports.jsx(RegenerateButton, { businessId: principalStr }) })
                  ]
                },
                principalStr
              );
            }) })
          ] }),
          totalPages > 1 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex items-center justify-between border-t border-border px-5 py-3",
              "data-ocid": "kashif.pagination",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
                  "Page ",
                  page,
                  " of ",
                  totalPages,
                  " · ",
                  total,
                  " records"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Button,
                    {
                      type: "button",
                      variant: "outline",
                      size: "icon",
                      className: "h-8 w-8",
                      disabled: page <= 1,
                      onClick: () => setPage((p) => Math.max(1, p - 1)),
                      "aria-label": "Previous page",
                      "data-ocid": "kashif.pagination_prev",
                      children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronLeft, { className: "h-4 w-4" })
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Button,
                    {
                      type: "button",
                      variant: "outline",
                      size: "icon",
                      className: "h-8 w-8",
                      disabled: page >= totalPages,
                      onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
                      "aria-label": "Next page",
                      "data-ocid": "kashif.pagination_next",
                      children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4" })
                    }
                  )
                ] })
              ]
            }
          )
        ]
      }
    )
  ] }) });
}
export {
  AdminKashifPage as default
};
