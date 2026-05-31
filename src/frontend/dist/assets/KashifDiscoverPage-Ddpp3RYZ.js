import { t as createLucideIcon, r as reactExports, j as jsxRuntimeExports, C as Card, e as CardContent, v as Skeleton, b as Button, S as ShieldCheck, o as ChevronDown, i as Separator } from "./index-CPnZ4-ee.js";
import { F as FinancierLayout, C as Compass, B as Bookmark } from "./FinancierLayout-tu5bQ-jz.js";
import { K as KashifCompatibilityGauge } from "./KashifCompatibilityGauge-D8imozIo.js";
import { P as Pagination } from "./Pagination-CELRZ_t0.js";
import { b as useMatchedBorrowers, u as useShortlist, c as useDealReport } from "./useKashif-BW6305hc.js";
import { C as CircleAlert } from "./circle-alert-DERsjRfM.js";
import { R as RefreshCw } from "./refresh-cw-LvkTVX9-.js";
import { B as Building2 } from "./building-2-CxKUCXUo.js";
import { S as Star } from "./star-DgsbwJcg.js";
import { C as ChevronUp } from "./chevron-up-C9u-2erU.js";
import "./use-user-role-gvzFlaTO.js";
import "./user--fZ_EEDP.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z", key: "169p4p" }],
  ["path", { d: "m9 10 2 2 4-4", key: "1gnqz4" }]
];
const BookmarkCheck = createLucideIcon("bookmark-check", __iconNode);
const PAGE_SIZE = 20;
function compatibilityColor(score) {
  if (score >= 70) return "oklch(var(--compatibility-high))";
  if (score >= 40) return "oklch(var(--compatibility-medium))";
  return "oklch(var(--compatibility-low))";
}
function compatibilityBadgeClass(score) {
  if (score >= 70)
    return "bg-[oklch(var(--compatibility-high)/0.12)] text-[oklch(var(--compatibility-high))] border-[oklch(var(--compatibility-high)/0.3)]";
  if (score >= 40)
    return "bg-[oklch(var(--compatibility-medium)/0.12)] text-[oklch(var(--compatibility-medium))] border-[oklch(var(--compatibility-medium)/0.3)]";
  return "bg-[oklch(var(--compatibility-low)/0.12)] text-[oklch(var(--compatibility-low))] border-[oklch(var(--compatibility-low)/0.3)]";
}
function riskBadgeClass(risk) {
  const r = risk.toLowerCase();
  if (r === "low") return "bg-primary/10 text-primary border-primary/30";
  if (r === "medium")
    return "bg-[oklch(var(--compatibility-medium)/0.12)] text-[oklch(var(--compatibility-medium))] border-[oklch(var(--compatibility-medium)/0.3)]";
  return "bg-destructive/10 text-destructive border-destructive/30";
}
function formatRisk(risk) {
  const r = risk.toLowerCase();
  return r.charAt(0).toUpperCase() + r.slice(1);
}
function DealReportPanel({
  businessId,
  result,
  onCollapse
}) {
  const reportQuery = useDealReport(businessId);
  const {
    shortlistedIds,
    addToShortlist,
    removeFromShortlist,
    isAdding,
    isRemoving
  } = useShortlist();
  const isShortlisted = shortlistedIds.has(businessId);
  const isMutating = isAdding || isRemoving;
  const report = reportQuery.data;
  const isLoading = reportQuery.isLoading;
  const isError = reportQuery.isError;
  const resultAny = result;
  const subscores = [
    ["Income Stability", Number(resultAny.incomeStabilityScore ?? 0)],
    ["Debt Behavior", Number(resultAny.debtBehaviorScore ?? 0)],
    ["Repayment Pattern", Number(resultAny.repaymentPatternScore ?? 0)],
    ["Revenue Trend", Number(resultAny.revenueTrendScore ?? 0)]
  ].filter(([, v]) => v > 0);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      CardContent,
      {
        className: "pt-5 pb-6 space-y-5",
        "data-ocid": `kashif_discover.detail_panel.${businessId}`,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold uppercase tracking-widest text-muted-foreground", children: "Kashif (الكاشف) · Deal Report" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                type: "button",
                variant: "outline",
                size: "sm",
                disabled: isMutating,
                onClick: () => isShortlisted ? removeFromShortlist(businessId) : addToShortlist(businessId),
                className: `gap-2 transition-smooth ${isShortlisted ? "border-primary/40 bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30" : "hover:border-primary/40 hover:bg-primary/10 hover:text-primary"}`,
                "data-ocid": `kashif_discover.shortlist_button.${businessId}`,
                children: [
                  isShortlisted ? /* @__PURE__ */ jsxRuntimeExports.jsx(BookmarkCheck, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Bookmark, { className: "h-4 w-4" }),
                  isShortlisted ? "Remove from Shortlist" : "Add to Shortlist"
                ]
              }
            )
          ] }),
          subscores.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheck, { className: "h-3.5 w-3.5" }),
              " Mizan (الميزان) Subscores"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-2 gap-x-6 gap-y-3", children: subscores.map(([label, val]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-1 flex items-center justify-between", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: label }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "span",
                  {
                    className: "text-xs font-bold tabular-nums",
                    style: { color: compatibilityColor(val) },
                    children: val
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-1.5 w-full rounded-full bg-muted/40", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "h-1.5 rounded-full transition-all duration-700",
                  style: {
                    width: `${val}%`,
                    background: compatibilityColor(val)
                  }
                }
              ) })
            ] }, label)) })
          ] }),
          isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "space-y-3",
              "data-ocid": `kashif_discover.report_loading.${businessId}`,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-40" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-20 w-full rounded-lg" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-32" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-16 w-full rounded-lg" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-36" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-16 w-full rounded-lg" })
              ]
            }
          ) : isError ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive",
              "data-ocid": `kashif_discover.report_error.${businessId}`,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { className: "h-4 w-4 shrink-0" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Could not load deal report." }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Button,
                  {
                    type: "button",
                    variant: "ghost",
                    size: "sm",
                    onClick: () => reportQuery.refetch(),
                    className: "ml-auto gap-1.5 text-destructive hover:text-destructive",
                    "data-ocid": `kashif_discover.report_retry.${businessId}`,
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
                      " Retry"
                    ]
                  }
                )
              ]
            }
          ) : report ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: [
            ["Executive Summary", report.executiveSummary],
            ["Financial Highlights", report.financialHighlights],
            ["Risk Breakdown", report.riskBreakdown],
            ["Shariah Compliance", report.shariahComplianceStatus],
            ["Credit Readiness", report.creditReadiness],
            ["Financing Recommendation", report.financingRecommendation]
          ].map(([title, body]) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "rounded-lg border border-border bg-[oklch(var(--deal-highlight)/0.4)] dark:bg-[oklch(var(--deal-highlight)/0.6)] p-4",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: title }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm leading-relaxed text-foreground", children: body })
              ]
            },
            title
          )) }) : null,
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-start", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "sm",
              onClick: onCollapse,
              className: "gap-1.5 text-muted-foreground hover:text-foreground",
              "data-ocid": `kashif_discover.collapse_button.${businessId}`,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronUp, { className: "h-4 w-4" }),
                " Collapse"
              ]
            }
          ) })
        ]
      }
    )
  ] });
}
function BorrowerRow({
  result,
  index,
  isExpanded,
  onToggle
}) {
  const businessId = result.businessId.toString();
  const score = Number(result.compatibilityScore);
  const halalScore = Number(result.halalComplianceScore);
  const { shortlistedIds } = useShortlist();
  const isShortlisted = shortlistedIds.has(businessId);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Card,
    {
      className: `transition-smooth hover:border-primary/30 dark:bg-[oklch(var(--deal-card-bg))] ${isExpanded ? "border-primary/40 shadow-md" : ""}`,
      "data-ocid": `kashif_discover.borrower.item.${index}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-center gap-4 py-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "shrink-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            KashifCompatibilityGauge,
            {
              score,
              size: 60,
              strokeWidth: 6,
              showLabel: false,
              static: true
            }
          ) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-display text-base font-semibold text-foreground truncate", children: result.displayName }),
              isShortlisted && /* @__PURE__ */ jsxRuntimeExports.jsx(
                Star,
                {
                  className: "h-3.5 w-3.5 fill-primary text-primary",
                  "aria-label": "Shortlisted"
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xs text-muted-foreground truncate", children: result.businessCategory }),
            result.financingTypes.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1.5 flex flex-wrap gap-1.5", children: result.financingTypes.map((ft) => /* @__PURE__ */ jsxRuntimeExports.jsx(
              "span",
              {
                className: "inline-block rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
                children: ft
              },
              ft
            )) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "span",
              {
                className: `rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums ${compatibilityBadgeClass(score)}`,
                "data-ocid": `kashif_discover.score_badge.${index}`,
                children: score
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "span",
              {
                className: `rounded-full border px-2.5 py-0.5 text-xs font-medium ${riskBadgeClass(result.riskLevel.toString())}`,
                "data-ocid": `kashif_discover.risk_badge.${index}`,
                children: [
                  formatRisk(result.riskLevel.toString()),
                  " Risk"
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "span",
              {
                className: "flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary",
                "data-ocid": `kashif_discover.halal_badge.${index}`,
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheck, { className: "h-3 w-3" }),
                  halalScore,
                  "% Halal"
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Button,
              {
                type: "button",
                variant: "ghost",
                size: "sm",
                onClick: onToggle,
                className: "gap-1.5 text-muted-foreground hover:text-foreground",
                "aria-label": isExpanded ? "Collapse details" : "Expand deal report",
                "data-ocid": `kashif_discover.expand_button.${index}`,
                children: isExpanded ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronUp, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "h-4 w-4" })
              }
            )
          ] })
        ] }),
        isExpanded && /* @__PURE__ */ jsxRuntimeExports.jsx(
          DealReportPanel,
          {
            businessId,
            result,
            onCollapse: onToggle
          }
        )
      ]
    }
  );
}
function KashifDiscoverPage() {
  const [page, setPage] = reactExports.useState(1);
  const [expandedId, setExpandedId] = reactExports.useState(null);
  const { data, isLoading, isError, refetch } = useMatchedBorrowers(
    page,
    PAGE_SIZE
  );
  const items = ((data == null ? void 0 : data.items) ?? []).sort(
    (a, b) => Number(b.compatibilityScore) - Number(a.compatibilityScore)
  );
  const total = Number((data == null ? void 0 : data.total) ?? 0n);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  function toggleExpand(id) {
    setExpandedId((prev) => prev === id ? null : id);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(FinancierLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "container mx-auto max-w-4xl px-4 py-10",
      "data-ocid": "kashif_discover.page",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-8", "data-ocid": "kashif_discover.header", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 dark:bg-primary/25", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Compass, { className: "h-5 w-5 text-primary" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "font-display text-2xl font-bold tracking-tight text-foreground", children: [
                "Kashif",
                " ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-body text-lg font-medium text-muted-foreground", children: "(الكاشف)" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Investment Discovery" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-sm text-muted-foreground max-w-xl", children: "Financing-ready applicants ranked by compatibility score (0–100). Expand any borrower to view the full Kashif deal report." })
        ] }),
        isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", "data-ocid": "kashif_discover.loading_state", children: ["s1", "s2", "s3", "s4"].map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-center gap-4 py-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-[60px] w-[60px] rounded-full" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 space-y-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-40" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-3 w-24" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-3 w-32" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-7 w-16 rounded-full" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-7 w-20 rounded-full" })
        ] }) }, k)) }) : isError ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { "data-ocid": "kashif_discover.error_state", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex flex-col items-center justify-center gap-3 py-16", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { className: "h-10 w-10 text-destructive/60" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground", children: "Failed to load borrowers" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "An error occurred while fetching matched borrowers." }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              type: "button",
              variant: "outline",
              size: "sm",
              onClick: () => refetch(),
              className: "gap-2",
              "data-ocid": "kashif_discover.retry_button",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-4 w-4" }),
                " Retry"
              ]
            }
          )
        ] }) }) : items.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { "data-ocid": "kashif_discover.empty_state", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex flex-col items-center justify-center gap-3 py-20", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-muted/40", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-8 w-8 text-muted-foreground/40" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-display text-lg font-semibold text-foreground", children: "No financing-ready borrowers yet" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "max-w-sm text-center text-sm text-muted-foreground", children: "Kashif will surface matched borrowers here once they have completed the full vetting pipeline." })
        ] }) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "p",
            {
              className: "mb-4 text-xs font-medium text-muted-foreground",
              "data-ocid": "kashif_discover.result_count",
              children: [
                total,
                " matched borrower",
                total !== 1 ? "s" : "",
                " · Page ",
                page,
                " of",
                " ",
                totalPages
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "space-y-3",
              "data-ocid": "kashif_discover.borrower_list",
              children: items.map((result, idx) => {
                const id = result.businessId.toString();
                return /* @__PURE__ */ jsxRuntimeExports.jsx(
                  BorrowerRow,
                  {
                    result,
                    index: idx + 1,
                    isExpanded: expandedId === id,
                    onToggle: () => toggleExpand(id)
                  },
                  id
                );
              })
            }
          ),
          totalPages > 1 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-8", "data-ocid": "kashif_discover.pagination", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            Pagination,
            {
              currentPage: page,
              totalPages,
              onPageChange: (p) => {
                setPage(p);
                setExpandedId(null);
              },
              isLoading
            }
          ) })
        ] })
      ]
    }
  ) });
}
export {
  KashifDiscoverPage as default
};
