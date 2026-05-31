import { g as useBackend, A as useQueryClient, n as useQuery, j as jsxRuntimeExports, P as PageHeader, aa as TriangleAlert, b as Button, C as Card, e as CardContent, v as Skeleton, c as CardHeader, d as CardTitle, p as Shield, y as cn, ab as Scale, B as Badge, ar as Variant_full_preliminary, ah as Variant_conditionalReady_notReady_ready } from "./index-CPnZ4-ee.js";
import { I as IndividualLayout } from "./IndividualLayout-8MgciXM0.js";
import { R as RefreshCw } from "./refresh-cw-LvkTVX9-.js";
import { B as BrainCircuit } from "./credit-card-DL9b9S-9.js";
import { I as Info } from "./info-BqIv1IIh.js";
import "./use-user-role-gvzFlaTO.js";
import "./user--fZ_EEDP.js";
function verdictBadge(verdict) {
  switch (verdict) {
    case Variant_conditionalReady_notReady_ready.ready:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30", children: "Credit Ready" });
    case Variant_conditionalReady_notReady_ready.conditionalReady:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30", children: "Conditional" });
    case Variant_conditionalReady_notReady_ready.notReady:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "destructive", children: "Not Ready" });
    default:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "secondary", children: "Pending" });
  }
}
function ScoreBar({
  label,
  explanation,
  score,
  colorClass,
  ocid
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", "data-ocid": ocid, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground", children: label }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: explanation })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-lg font-bold text-foreground ml-4", children: score })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-2 w-full overflow-hidden rounded-full bg-muted", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: cn(
          "h-full rounded-full transition-all duration-700",
          colorClass
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
  ] });
}
function riskBadge(riskStr) {
  const lower = riskStr.toLowerCase();
  if (lower === "low")
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30", children: "Low Risk" });
  if (lower === "high") return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "destructive", children: "High Risk" });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30", children: "Medium Risk" });
}
function halalBarColor(score) {
  if (score >= 80) return "bg-emerald-500 dark:bg-emerald-400";
  if (score >= 60) return "bg-amber-500 dark:bg-amber-400";
  return "bg-red-500 dark:bg-red-400";
}
function mizanBarColor(score) {
  if (score >= 70) return "bg-emerald-500 dark:bg-emerald-400";
  if (score >= 45) return "bg-amber-500 dark:bg-amber-400";
  return "bg-red-500 dark:bg-red-400";
}
function IndividualScoresPage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["individual_profile"],
    queryFn: async () => {
      if (!actor) return null;
      const result = await actor.getMyIndividualProfile();
      if (result.__kind__ === "err") return null;
      return result.ok;
    },
    enabled: !!actor
  });
  const profile = profileQuery.data ?? null;
  const tawthiq = (profile == null ? void 0 : profile.tawthiqRecord) ?? null;
  const mizan = (profile == null ? void 0 : profile.mizanRecord) ?? null;
  const isLoading = profileQuery.isLoading;
  const tawthiqShariaScore = tawthiq ? Number(tawthiq.shariaComplianceScore) : 0;
  const overallScore = mizan ? Number(mizan.overallScore) : 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(IndividualLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "p-6 space-y-8 max-w-3xl",
      "data-ocid": "individual_scores.page",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          PageHeader,
          {
            title: "Tawthiq & Mizan Assessment",
            subtitle: "Your full AI-powered financing readiness and risk profile.",
            breadcrumbs: [{ label: "Assessment Scores" }]
          }
        ),
        profileQuery.isError && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 shrink-0 text-destructive" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: "Failed to load scores." }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              type: "button",
              variant: "outline",
              size: "sm",
              className: "ml-auto gap-1.5 text-destructive border-destructive/40",
              onClick: () => queryClient.invalidateQueries({
                queryKey: ["individual_profile"]
              }),
              "data-ocid": "individual_scores.retry_button",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
                "Retry"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { "data-ocid": "individual_scores.tawthiq_section", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(BrainCircuit, { className: "h-5 w-5 text-primary" }),
            "Tawthiq",
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-base font-normal text-muted-foreground", children: "(التوثيق)" })
          ] }),
          isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "pt-5 space-y-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-5 w-40" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-3 w-full" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-3 w-3/4" })
          ] }) }) : !tawthiq ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "pt-5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Tawthiq assessment has not been completed yet." }) }) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_scores.tawthiq_verdict_card", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardTitle, { className: "text-sm font-medium text-muted-foreground", children: "Credit Readiness Verdict" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "space-y-4", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-3", children: verdictBadge(tawthiq.creditReadiness) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: "space-y-1.5",
                    "data-ocid": "individual_scores.sharia_score",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "h-3.5 w-3.5 text-primary" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground", children: "Shariah Compliance Score" })
                        ] }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-bold text-foreground", children: tawthiqShariaScore })
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-2 w-full overflow-hidden rounded-full bg-muted", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "div",
                        {
                          className: cn(
                            "h-full rounded-full transition-all duration-700",
                            halalBarColor(tawthiqShariaScore)
                          ),
                          style: {
                            width: `${Math.min(tawthiqShariaScore, 100)}%`
                          },
                          role: "progressbar",
                          tabIndex: 0,
                          "aria-valuenow": tawthiqShariaScore,
                          "aria-valuemin": 0,
                          "aria-valuemax": 100,
                          "aria-label": "Shariah compliance"
                        }
                      ) })
                    ]
                  }
                )
              ] })
            ] }),
            tawthiq.shariaFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Card,
              {
                className: "border-amber-300 dark:border-amber-700",
                "data-ocid": "individual_scores.tawthiq_flags_card",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4" }),
                    "Shariah Flags"
                  ] }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-2", children: tawthiq.shariaFlags.map((flag) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "li",
                    {
                      className: "flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" }),
                        flag
                      ]
                    },
                    flag
                  )) }) })
                ]
              }
            ),
            tawthiq.narrativeSummary && /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_scores.tawthiq_narrative_card", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardTitle, { className: "text-sm font-medium text-muted-foreground", children: "Assessment Explanation" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm leading-relaxed text-foreground", children: tawthiq.narrativeSummary }) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { "data-ocid": "individual_scores.mizan_section", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-5 w-5 text-primary" }),
            "Mizan",
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-base font-normal text-muted-foreground", children: "(الميزان)" })
          ] }),
          isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "pt-5 space-y-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-5 w-40" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-2 w-full" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-2 w-full" })
          ] }) }) : !mizan ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "pt-5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Mizan assessment will be available after KYC verification completes." }) }) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_scores.mizan_overview_card", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(CardTitle, { className: "text-base", children: "Overall Mizan Score" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Badge,
                  {
                    className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 text-xs",
                    "data-ocid": "individual_scores.mizan_stage_badge",
                    children: mizan.stage === Variant_full_preliminary.preliminary ? "Preliminary Assessment" : "Full Assessment"
                  }
                )
              ] }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "space-y-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-baseline gap-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "span",
                  {
                    className: "font-display text-5xl font-bold text-foreground",
                    "data-ocid": "individual_scores.mizan_overall_score",
                    children: overallScore
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground text-sm", children: "/ 100" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ml-auto", children: riskBadge(
                  typeof mizan.riskLevel === "string" ? mizan.riskLevel : Object.keys(
                    mizan.riskLevel
                  )[0] ?? "Medium"
                ) })
              ] }) })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { "data-ocid": "individual_scores.mizan_subscores_card", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "pt-5 space-y-5", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ScoreBar,
                {
                  label: "Income Stability Score",
                  explanation: "How consistent and regular is your income?",
                  score: Number(mizan.incomeStabilityScore),
                  colorClass: mizanBarColor(
                    Number(mizan.incomeStabilityScore)
                  ),
                  ocid: "individual_scores.income_stability"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ScoreBar,
                {
                  label: "Debt Behaviour Score",
                  explanation: "How responsibly do you manage existing debt?",
                  score: Number(mizan.debtBehaviorScore),
                  colorClass: mizanBarColor(Number(mizan.debtBehaviorScore)),
                  ocid: "individual_scores.debt_behavior"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ScoreBar,
                {
                  label: "Repayment Capacity Score",
                  explanation: "Can you comfortably repay the requested financing amount?",
                  score: Number(mizan.repaymentCapacityScore),
                  colorClass: mizanBarColor(
                    Number(mizan.repaymentCapacityScore)
                  ),
                  ocid: "individual_scores.repayment_capacity"
                }
              )
            ] }) }),
            mizan.borderlineFlag && /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                className: "flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3",
                "data-ocid": "individual_scores.mizan_borderline_alert",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-amber-800 dark:text-amber-300", children: "Manual Review Required" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xs text-amber-700 dark:text-amber-400", children: "This assessment has been flagged for manual review by our underwriting team." })
                  ] })
                ]
              }
            ),
            mizan.narrativeSummary && /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_scores.mizan_narrative_card", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardTitle, { className: "text-sm font-medium text-muted-foreground", children: "Underwriting Summary" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm leading-relaxed text-foreground", children: mizan.narrativeSummary }) })
            ] }),
            mizan.stage === Variant_full_preliminary.preliminary && /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                className: "flex items-start gap-2 rounded-md bg-muted/30 border border-border px-3 py-2.5",
                "data-ocid": "individual_scores.mizan_preliminary_note",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Info, { className: "h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "This is a preliminary assessment based on your registration data. A full Mizan assessment will run after you link your bank account." })
                ]
              }
            )
          ] })
        ] })
      ]
    }
  ) });
}
export {
  IndividualScoresPage as default
};
