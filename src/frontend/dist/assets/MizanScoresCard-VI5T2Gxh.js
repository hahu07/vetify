import { j as jsxRuntimeExports, C as Card, c as CardHeader, w as Skeleton, e as CardContent, ae as Scale, d as CardTitle, B as Badge, z as cn, Q as TriangleAlert, b as Button, af as RefreshCw, r as reactExports } from "./index-DiwSGmNR.js";
import { a as RiskLevel__1 } from "./index-B7t3rgHq.js";
import { C as Clock } from "./clock-BRirAh28.js";
function riskColor(risk) {
  switch (risk) {
    case RiskLevel__1.Low:
      return {
        ring: "text-[oklch(var(--gauge-low))]",
        stroke: "oklch(var(--gauge-low))",
        badge: "bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
        bar: "bg-emerald-500 dark:bg-emerald-400",
        label: "Low Risk"
      };
    case RiskLevel__1.Medium:
      return {
        ring: "text-[oklch(var(--gauge-medium))]",
        stroke: "oklch(var(--gauge-medium))",
        badge: "bg-amber-500/15 text-amber-700 border-amber-300 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
        bar: "bg-amber-500 dark:bg-amber-400",
        label: "Medium Risk"
      };
    default:
      return {
        ring: "text-[oklch(var(--gauge-high))]",
        stroke: "oklch(var(--gauge-high))",
        badge: "bg-red-500/15 text-red-700 border-red-300 hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
        bar: "bg-red-500 dark:bg-red-400",
        label: "High Risk"
      };
  }
}
function halalColor(score) {
  if (score >= 80)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500 dark:bg-emerald-400",
      label: "Compliant"
    };
  if (score >= 60)
    return {
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500 dark:bg-amber-400",
      label: "Conditional"
    };
  return {
    text: "text-red-600 dark:text-red-400",
    bar: "bg-red-500 dark:bg-red-400",
    label: "Non-Compliant"
  };
}
function ScoreRing({ score, size = 96, strokeColor, label }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - Math.min(score, 100) / 100);
  const svgRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.style.strokeDashoffset = circumference.toString();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)";
        el.style.strokeDashoffset = dashoffset.toString();
      });
    });
  }, [circumference, dashoffset]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col items-center gap-1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", style: { width: size, height: size }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "svg",
      {
        width: size,
        height: size,
        viewBox: `0 0 ${size} ${size}`,
        className: "-rotate-90",
        "aria-hidden": "true",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "circle",
            {
              cx: size / 2,
              cy: size / 2,
              r: radius,
              fill: "none",
              stroke: "oklch(var(--score-ring-bg))",
              strokeWidth: 8
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "circle",
            {
              ref: svgRef,
              cx: size / 2,
              cy: size / 2,
              r: radius,
              fill: "none",
              stroke: strokeColor,
              strokeWidth: 8,
              strokeLinecap: "round",
              strokeDasharray: circumference,
              strokeDashoffset: circumference
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "span",
        {
          className: "text-xl font-bold leading-none text-foreground",
          "aria-label": label ?? `Score: ${score}`,
          children: score
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mt-0.5 text-[10px] text-muted-foreground", children: "0-100" })
    ] })
  ] }) });
}
function SubScoreCard({
  label,
  score,
  barClass,
  dataOcid
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "rounded-lg border border-border bg-card p-3 space-y-2",
      "data-ocid": dataOcid,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-medium text-muted-foreground", children: label }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-bold text-foreground", children: score })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-1.5 w-full overflow-hidden rounded-full bg-muted", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: cn(
              "h-full rounded-full transition-all duration-700",
              barClass
            ),
            style: { width: `${Math.min(score, 100)}%` },
            role: "progressbar",
            tabIndex: 0,
            "aria-valuenow": score,
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-label": label
          }
        ) })
      ]
    }
  );
}
function MizanScoresCard({
  mizan,
  isLoading = false,
  onRetrigger,
  isAdmin = false,
  mizanDivergenceAlert = false
}) {
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "border-border", "data-ocid": "mizan_scores_card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(CardHeader, { className: "pb-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-5 w-48" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-3.5 w-64 mt-1" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "space-y-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-24 w-24 rounded-full" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-2 gap-3", children: [0, 1, 2, 3].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-14 rounded-lg" }, i)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-16 rounded-lg" })
      ] })
    ] });
  }
  if (!mizan) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Card,
      {
        className: "border-border border-dashed",
        "data-ocid": "mizan_scores_card.pending_state",
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex flex-col items-center justify-center py-10 text-center", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "mb-3 h-10 w-10 text-muted-foreground/40" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "font-display font-semibold text-foreground", children: [
            "Mizan (",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-arabic", children: "الميزان" }),
            ") Pending"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 max-w-xs text-sm text-muted-foreground", children: "Mizan analysis will run after bank account is linked and verified financial data is available." })
        ] })
      }
    );
  }
  const overall = Number(mizan.overallReadinessScore);
  const halal = Number(mizan.halalComplianceScore);
  const colors = riskColor(mizan.riskClassification);
  const halalColors = halalColor(halal);
  const computedDate = mizan.computedAt ? new Date(Number(mizan.computedAt) / 1e6).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  ) : null;
  const subscores = [
    {
      label: "Income Stability",
      score: Number(mizan.incomeStabilityScore),
      ocid: "mizan_scores_card.income_stability"
    },
    {
      label: "Debt Behavior",
      score: Number(mizan.debtBehaviorScore),
      ocid: "mizan_scores_card.debt_behavior"
    },
    {
      label: "Repayment Pattern",
      score: Number(mizan.repaymentPatternScore),
      ocid: "mizan_scores_card.repayment_pattern"
    },
    {
      label: "Revenue Trend",
      score: Number(mizan.revenueTrendScore),
      ocid: "mizan_scores_card.revenue_trend"
    }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "border-border", "data-ocid": "mizan_scores_card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(CardHeader, { className: "pb-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-4 w-4 text-primary shrink-0" }),
            "Mizan",
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-normal text-muted-foreground", children: "(الميزان)" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: "AI-Powered Risk & Underwriting Assessment" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Badge,
          {
            className: cn("shrink-0", colors.badge),
            "data-ocid": "mizan_scores_card.risk_badge",
            children: colors.label
          }
        )
      ] }),
      computedDate && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground flex items-center gap-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-3 w-3" }),
        "Last analysed: ",
        computedDate
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "space-y-5", children: [
      mizanDivergenceAlert && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3",
          "data-ocid": "mizan_scores_card.divergence_alert",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-amber-800 dark:text-amber-300", children: "Score Divergence Detected" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xs text-amber-700 dark:text-amber-400", children: "The preliminary assessment and full bank-verified assessment differ significantly. Please review both scores carefully." })
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "flex flex-col items-center gap-2",
          "data-ocid": "mizan_scores_card.overall_ring",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Overall Readiness" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              ScoreRing,
              {
                score: overall,
                size: 112,
                strokeColor: colors.stroke,
                label: `Overall readiness: ${overall}`
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "grid grid-cols-2 gap-3",
          "data-ocid": "mizan_scores_card.subscores_grid",
          children: subscores.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            SubScoreCard,
            {
              label: s.label,
              score: s.score,
              barClass: colors.bar,
              dataOcid: s.ocid
            },
            s.ocid
          ))
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "rounded-lg border border-border bg-card p-3",
          "data-ocid": "mizan_scores_card.halal_compliance",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between mb-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Halal Compliance" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: cn("text-sm font-bold", halalColors.text), children: [
                halal,
                " — ",
                halalColors.label
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-2 w-full overflow-hidden rounded-full bg-muted", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: cn(
                  "h-full rounded-full transition-all duration-700",
                  halalColors.bar
                ),
                style: { width: `${Math.min(halal, 100)}%` },
                role: "progressbar",
                tabIndex: 0,
                "aria-valuenow": halal,
                "aria-valuemin": 0,
                "aria-valuemax": 100,
                "aria-label": "Halal compliance"
              }
            ) })
          ]
        }
      ),
      mizan.isBorderline && mizan.borderlineReasons.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "rounded-lg border border-amber-300 dark:border-amber-700 px-4 py-3",
          style: { background: "oklch(var(--borderline-bg))" },
          "data-ocid": "mizan_scores_card.borderline_alert",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-amber-800 dark:text-amber-300", children: "Flagged for Human Review" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-1 pl-1", children: mizan.borderlineReasons.map((reason) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "li",
              {
                className: "flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" }),
                  reason
                ]
              },
              reason
            )) })
          ]
        }
      ),
      mizan.narrativeSummary && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "rounded-lg px-4 py-3",
          style: { background: "oklch(var(--narrative-bg))" },
          "data-ocid": "mizan_scores_card.narrative_summary",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Narrative Underwriting Summary" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm italic leading-relaxed text-foreground", children: mizan.narrativeSummary })
          ]
        }
      ),
      isAdmin && onRetrigger && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "sm",
          className: "gap-1.5",
          onClick: onRetrigger,
          "data-ocid": "mizan_scores_card.retrigger_button",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
            "Re-run Mizan Analysis"
          ]
        }
      ) })
    ] })
  ] });
}
export {
  MizanScoresCard as M
};
