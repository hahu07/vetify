import { r as reactExports, j as jsxRuntimeExports, b as Button, l as ue, C as Card, e as CardContent, w as Skeleton, x as Link, y as ChevronRight, B as Badge, z as cn, S as ShieldCheck, T as Trash2, A as RiskLevel } from "./index-DiwSGmNR.js";
import { F as FinancierLayout, B as Bookmark, C as Compass } from "./FinancierLayout-Bfo9Osfi.js";
import { u as useShortlist, a as useComparisonData, K as KashifCompatibilityGauge } from "./useKashif-Apu9RdPR.js";
import { C as Checkbox } from "./checkbox-Bc_5PGPA.js";
import { D as Download } from "./download-xUmMlO34.js";
import { B as Building2 } from "./building-2-CCds38tC.js";
import "./use-user-role-DlEe0uPV.js";
import "./message-circle-C1jDekiM.js";
import "./user-BQRpN4aJ.js";
import "./index-Hp8SMVjr.js";
import "./check-COltzNMb.js";
function riskBadgeClass(risk) {
  if (risk === RiskLevel.Low)
    return "bg-primary/10 text-primary border-primary/20";
  if (risk === RiskLevel.Medium)
    return "bg-warning/20 text-warning-foreground border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/20";
}
function halalBadgeClass(score) {
  if (score >= 70) return "bg-primary/10 text-primary border-primary/20";
  if (score >= 40)
    return "bg-warning/20 text-warning-foreground border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/20";
}
function bestIndex(values) {
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
function ShortlistCard({
  result,
  checked,
  onToggleCompare,
  onRemove,
  compareDisabled,
  index
}) {
  const id = result.businessId.toString();
  const score = Number(result.compatibilityScore);
  const halal = Number(result.halalComplianceScore);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Card,
    {
      className: cn(
        "transition-all duration-200 border",
        checked ? "shadow-comparison-lift border-primary/40" : "shadow-kashif-card hover:shadow-kashif-hover border-border"
      ),
      "data-ocid": `shortlist.card.${index}`,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-start gap-4 p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 shrink-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Checkbox,
          {
            id: `compare-${id}`,
            checked,
            onCheckedChange: () => onToggleCompare(id),
            disabled: compareDisabled && !checked,
            "aria-label": `Compare ${result.displayName}`,
            "data-ocid": `shortlist.compare_checkbox.${index}`
          }
        ) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "shrink-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          KashifCompatibilityGauge,
          {
            score,
            size: 72,
            strokeWidth: 7,
            showLabel: false,
            static: true
          }
        ) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "p",
            {
              className: "font-display font-semibold text-foreground truncate",
              title: result.displayName,
              children: result.displayName
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xs text-muted-foreground truncate", children: result.businessCategory }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Badge,
              {
                variant: "outline",
                className: cn("text-xs", riskBadgeClass(result.riskLevel)),
                "data-ocid": `shortlist.risk_badge.${index}`,
                children: [
                  result.riskLevel,
                  " Risk"
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Badge,
              {
                variant: "outline",
                className: cn("text-xs", halalBadgeClass(halal)),
                "data-ocid": `shortlist.halal_badge.${index}`,
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheck, { className: "mr-1 h-3 w-3" }),
                  "Halal ",
                  halal,
                  "%"
                ]
              }
            )
          ] }),
          result.financingTypes.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1.5 text-xs text-muted-foreground", children: [
            result.financingTypes.slice(0, 3).join(" · "),
            result.financingTypes.length > 3 && ` +${result.financingTypes.length - 3}`
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "shrink-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "icon",
            onClick: () => onRemove(id),
            "aria-label": `Remove ${result.displayName} from shortlist`,
            className: "text-muted-foreground hover:text-destructive",
            "data-ocid": `shortlist.remove_button.${index}`,
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "h-4 w-4" })
          }
        ) })
      ] })
    }
  );
}
const COMPARISON_ROWS = [
  {
    label: "Compatibility Score",
    getValue: (r) => Number(r.compatibilityScore),
    numeric: true
  },
  {
    label: "Risk Level",
    getValue: (r) => r.riskLevel,
    numeric: false
  },
  {
    label: "Halal Compliance Score",
    getValue: (r) => Number(r.halalComplianceScore),
    numeric: true
  },
  {
    label: "Business Category",
    getValue: (r) => r.businessCategory || "—",
    numeric: false
  },
  {
    label: "Financing Types",
    getValue: (r) => r.financingTypes.length > 0 ? r.financingTypes.join(", ") : "—",
    numeric: false
  }
];
function ComparisonTable({ results, isLoading }) {
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { className: "shadow-comparison-lift", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "p-4 space-y-3", children: ["s1", "s2", "s3", "s4", "s5"].map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-8 w-full" }, k)) }) });
  }
  if (results.length === 0) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Card,
    {
      className: "shadow-comparison-lift border-primary/20 overflow-hidden",
      "data-ocid": "shortlist.comparison_table",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-b border-border bg-primary/5 px-4 py-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-display text-sm font-semibold text-foreground", children: "Side-by-Side Comparison" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: "Cells with a green highlight indicate the best value in each row." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-border", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-44", children: "Metric" }),
            results.map((r, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
              "th",
              {
                className: "px-4 py-3 text-left font-medium text-foreground max-w-[160px]",
                "data-ocid": `shortlist.comparison_header.${i + 1}`,
                children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "block truncate", title: r.displayName, children: r.displayName })
              },
              r.businessId.toString()
            ))
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: COMPARISON_ROWS.map((row) => {
            const values = results.map((r) => row.getValue(r));
            const best = row.numeric ? bestIndex(values) : -1;
            return /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "tr",
              {
                className: "border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground", children: row.label }),
                  results.map((r, colIdx) => {
                    const val = row.getValue(r);
                    const isBest = best === colIdx;
                    return /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "td",
                      {
                        className: cn(
                          "px-4 py-3 font-medium text-foreground",
                          isBest && "rounded-sm"
                        ),
                        style: isBest ? {
                          backgroundColor: "oklch(var(--comparison-diff))"
                        } : void 0,
                        "data-ocid": `shortlist.comparison_cell.${row.label.toLowerCase().replace(/\s+/g, "_")}.${colIdx + 1}`,
                        children: row.label === "Compatibility Score" || row.label === "Halal Compliance Score" ? `${val}%` : String(val)
                      },
                      r.businessId.toString()
                    );
                  })
                ]
              },
              row.label
            );
          }) })
        ] }) })
      ]
    }
  );
}
function EmptyShortlist() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "flex flex-col items-center justify-center gap-4 py-24 text-center",
      "data-ocid": "shortlist.empty_state",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-primary/10", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Bookmark, { className: "h-8 w-8 text-primary" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-display text-lg font-semibold text-foreground", children: "Your shortlist is empty" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1.5 max-w-xs text-sm text-muted-foreground", children: "Visit the Discovery page to browse financing-ready borrowers and bookmark the ones that match your investment criteria." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { asChild: true, type: "button", className: "mt-2 gap-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/financier/discover", "data-ocid": "shortlist.discover_link", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Compass, { className: "h-4 w-4" }),
          "Go to Discovery",
          /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4" })
        ] }) })
      ]
    }
  );
}
function exportShortlistCSV(items) {
  if (items.length === 0) return false;
  const headers = [
    "Business Name",
    "Risk Level",
    "Halal Compliance Score",
    "Mizan Overall Score",
    "Business Category",
    "Financing Types"
  ];
  const rows = items.map((r) => [
    r.displayName,
    r.riskLevel,
    `${Number(r.halalComplianceScore)}%`,
    `${Number(r.compatibilityScore)}%`,
    r.businessCategory || "",
    r.financingTypes.join(" | ")
  ]);
  const csvContent = [headers, ...rows].map(
    (row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  link.href = url;
  link.download = `shortlist-export-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
function KashifShortlistPage() {
  const {
    shortlist,
    isLoading: shortlistLoading,
    removeFromShortlist
  } = useShortlist();
  const [compareIds, setCompareIds] = reactExports.useState(/* @__PURE__ */ new Set());
  const allShortlistedIds = shortlist.map((e) => e.businessId.toString());
  const enrichQuery = useComparisonData(allShortlistedIds);
  const enrichedMap = new Map(
    (enrichQuery.data ?? []).map((r) => [r.businessId.toString(), r])
  );
  const selectedIds = Array.from(compareIds);
  const comparisonQuery = useComparisonData(selectedIds);
  const canAddMore = compareIds.size < 4;
  function toggleCompare(id) {
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
  function handleRemove(id) {
    removeFromShortlist(id);
    setCompareIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }
  const showComparison = compareIds.size >= 2;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(FinancierLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-5xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-8", "data-ocid": "shortlist.page_header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Bookmark, { className: "h-5 w-5 text-primary" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "font-display text-2xl font-bold text-foreground", children: [
          "Kashif",
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-normal text-muted-foreground text-xl", children: "(الكاشف)" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-muted-foreground", children: "My Shortlist" }),
      shortlist.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-xs text-muted-foreground", children: "Select 2–4 borrowers using the checkboxes to compare them side-by-side." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { "data-ocid": "shortlist.section", children: [
      !shortlistLoading && !enrichQuery.isLoading && shortlist.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-end mb-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "sm",
          className: "gap-2",
          onClick: () => {
            const allItems = Array.from(enrichedMap.values());
            const exported = exportShortlistCSV(allItems);
            if (!exported) {
              ue.info("No items to export");
            }
          },
          "data-ocid": "shortlist.export_button",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "h-4 w-4" }),
            "Export CSV"
          ]
        }
      ) }),
      shortlistLoading || enrichQuery.isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: ["s1", "s2", "s3"].map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { className: "shadow-kashif-card", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-start gap-4 p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "mt-1 h-4 w-4 rounded" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-[72px] w-[72px] shrink-0 rounded-full" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 space-y-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-3/4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-3 w-1/2" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-6 w-24 rounded-full" })
        ] })
      ] }) }, k)) }) : shortlist.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyShortlist, {}) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: shortlist.map((entry, idx) => {
        const id = entry.businessId.toString();
        const enriched = enrichedMap.get(id);
        if (!enriched) {
          return /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { className: "shadow-kashif-card", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-center gap-3 p-4", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-5 w-5 text-muted-foreground shrink-0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground truncate", children: "Loading…" })
          ] }) }, id);
        }
        return /* @__PURE__ */ jsxRuntimeExports.jsx(
          ShortlistCard,
          {
            result: enriched,
            checked: compareIds.has(id),
            onToggleCompare: toggleCompare,
            onRemove: handleRemove,
            compareDisabled: !canAddMore,
            index: idx + 1
          },
          id
        );
      }) })
    ] }),
    showComparison && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-10", "data-ocid": "shortlist.comparison_section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-4 flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "font-display text-lg font-semibold text-foreground", children: [
          "Comparison",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-2 text-sm font-normal text-muted-foreground", children: [
            "(",
            compareIds.size,
            " selected)"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "sm",
            onClick: () => setCompareIds(/* @__PURE__ */ new Set()),
            className: "text-muted-foreground",
            "data-ocid": "shortlist.clear_comparison_button",
            children: "Clear"
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ComparisonTable,
        {
          results: comparisonQuery.data ?? [],
          isLoading: comparisonQuery.isLoading
        }
      )
    ] })
  ] }) });
}
export {
  KashifShortlistPage as default
};
