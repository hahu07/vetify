import { t as createLucideIcon, j as jsxRuntimeExports, C as Card, e as CardContent, af as LoaderCircle, aa as TriangleAlert, b as Button, c as CardHeader, d as CardTitle, B as Badge, z as RiskLevel, y as cn, r as reactExports, f as CircleCheck, G as Dialog, J as DialogContent, K as DialogHeader, M as DialogTitle, at as DialogDescription, h as Label, I as Input, N as DialogFooter, l as ue, S as ShieldCheck, aq as KycStatus, s as CircleX, g as useBackend, A as useQueryClient, m as useNavigate, n as useQuery, D as useMutation, F as FullPageLoader, O as RegistrationStatus, P as PageHeader, ab as Scale } from "./index-CPnZ4-ee.js";
import { a as RiskLevel__1 } from "./index-CBpXODzm.js";
import { R as RefreshCw } from "./refresh-cw-LvkTVX9-.js";
import { B as BrainCircuit } from "./credit-card-DL9b9S-9.js";
import { B as Building2 } from "./building-2-CxKUCXUo.js";
import { T as TrendingUp } from "./trending-up-BbF36D2u.js";
import { B as Banknote } from "./banknote-B82VkdfH.js";
import { A as ArrowRight } from "./arrow-right-Yq6p0pFk.js";
import { B as BusinessLayout } from "./BusinessLayout-CqGyLu9A.js";
import { C as CircleAlert } from "./circle-alert-DERsjRfM.js";
import { C as Clock } from "./clock-BRCXs4iw.js";
import { M as MizanScoresCard } from "./MizanScoresCard-N8FPY3Kp.js";
import { T as TawthiqStatusCard } from "./TawthiqStatusCard-ZZWvtEOt.js";
import { P as Pencil } from "./pencil-ClwGYYG1.js";
import "./use-user-role-gvzFlaTO.js";
import "./user--fZ_EEDP.js";
import "./textarea-DWu_HpBl.js";
import "./message-square-B7hLhon-.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$2 = [["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]];
const Circle = createLucideIcon("circle", __iconNode$2);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$1 = [
  ["path", { d: "M16 17h6v-6", key: "t6n2it" }],
  ["path", { d: "m22 17-8.5-8.5-5 5L2 7", key: "x473p" }]
];
const TrendingDown = createLucideIcon("trending-down", __iconNode$1);
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
      d: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
      key: "18etb6"
    }
  ],
  ["path", { d: "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4", key: "xoc0q4" }]
];
const Wallet = createLucideIcon("wallet", __iconNode);
function ScoreBar({
  label,
  score,
  dataOcid
}) {
  const color = score >= 75 ? "bg-emerald-500 dark:bg-emerald-400" : score >= 50 ? "bg-amber-500 dark:bg-amber-400" : "bg-destructive";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", "data-ocid": dataOcid, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-medium text-foreground", children: label }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "span",
        {
          className: cn(
            "text-sm font-bold",
            score >= 75 ? "text-emerald-600 dark:text-emerald-400" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-destructive"
          ),
          children: [
            score,
            "%"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-2 w-full overflow-hidden rounded-full bg-muted", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: cn(
          "h-full rounded-full transition-all duration-700",
          color
        ),
        style: { width: `${Math.min(score, 100)}%` },
        role: "progressbar",
        "aria-valuenow": score,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-label": label,
        tabIndex: 0
      }
    ) })
  ] });
}
function riskBadge(risk) {
  switch (risk) {
    case RiskLevel.Low:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30", children: "Low Risk" });
    case RiskLevel.Medium:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-amber-500/15 text-amber-700 border-amber-300 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30", children: "Medium Risk" });
    case RiskLevel.High:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "destructive", children: "High Risk" });
    default:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "secondary", children: "Unknown" });
  }
}
function AiScoresCard({
  scoringRecord,
  isLoading = false,
  error = null,
  onRetry
}) {
  const readiness = Number(scoringRecord.financingReadinessScore);
  const halal = Number(scoringRecord.halalComplianceScore);
  const scoredDate = new Date(
    Number(scoringRecord.scoredAt) / 1e6
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { className: "border-border", "data-ocid": "ai_scores_card", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-center justify-center py-10 gap-2 text-sm text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
      "Loading AI scores…"
    ] }) });
  }
  if (error) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { className: "border-border", "data-ocid": "ai_scores_card", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "py-8 space-y-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "flex items-center gap-2 text-destructive",
          "data-ocid": "ai_scores_card.error_state",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 shrink-0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-medium", children: "Unable to load scores" })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: error }),
      onRetry && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "sm",
          className: "gap-1.5",
          onClick: onRetry,
          "data-ocid": "ai_scores_card.retry_button",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
            "Retry"
          ]
        }
      )
    ] }) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "border-border", "data-ocid": "ai_scores_card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(CardHeader, { className: "pb-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(BrainCircuit, { className: "h-4 w-4 text-primary" }),
          "AI Scoring Results"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "data-ocid": "ai_scores_card.risk_badge", children: riskBadge(scoringRecord.riskLevel) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
        "Scored on ",
        scoredDate
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "space-y-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ScoreBar,
        {
          label: "Financing Readiness",
          score: readiness,
          dataOcid: "ai_scores_card.readiness_bar"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ScoreBar,
        {
          label: "Halal Compliance",
          score: halal,
          dataOcid: "ai_scores_card.halal_bar"
        }
      ),
      scoringRecord.scoringNotes && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "rounded-md border border-border bg-muted/40 px-3 py-2.5",
          "data-ocid": "ai_scores_card.scoring_notes",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1", children: "Scoring Notes" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-foreground leading-relaxed", children: scoringRecord.scoringNotes })
          ]
        }
      )
    ] })
  ] });
}
function formatCurrency(amount, currency = "NGN") {
  const n = Number(amount);
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(n);
}
function maskBalance(balance, currency = "NGN") {
  const formatted = formatCurrency(balance, currency);
  if (formatted === "—") return "—";
  const digits = formatted.replace(/[^0-9]/g, "");
  if (digits.length <= 4) return formatted;
  return formatted.replace(digits.slice(2, -3), "•••");
}
function BankLinkSection({
  bankLinkRecord,
  isFinancingReady,
  onLinkBank,
  isLoading = false,
  error = null,
  onRetry
}) {
  const [open, setOpen] = reactExports.useState(false);
  const [accountId, setAccountId] = reactExports.useState("");
  const [isSubmitting, setIsSubmitting] = reactExports.useState(false);
  const isLinked = bankLinkRecord.status.__kind__ === "Linked";
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accountId.trim()) return;
    setIsSubmitting(true);
    try {
      await onLinkBank(accountId.trim());
      ue.success("Bank account linked. AI scoring is now in progress.");
      setOpen(false);
      setAccountId("");
    } catch (err) {
      ue.error(
        err instanceof Error ? err.message : "Failed to link bank account."
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "relative border-border", "data-ocid": "bank_link_section", children: [
      isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
        "Loading bank data…"
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-4 w-4 text-primary" }),
          "Bank Account (Mono)"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Badge,
          {
            variant: isLinked ? "default" : "secondary",
            className: cn(
              "text-xs",
              isLinked ? "bg-emerald-500/15 text-emerald-700 border-emerald-300" : ""
            ),
            "data-ocid": "bank_link_section.status_badge",
            children: isLinked ? "Linked" : "Not Linked"
          }
        )
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { children: [
        error && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "mb-4 flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5",
            "data-ocid": "bank_link_section.error_state",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 shrink-0 text-destructive" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: error })
              ] }),
              onRetry && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Button,
                {
                  type: "button",
                  variant: "outline",
                  size: "sm",
                  className: "self-start gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10",
                  onClick: onRetry,
                  "data-ocid": "bank_link_section.retry_button",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
                    "Retry"
                  ]
                }
              )
            ]
          }
        ),
        isLinked ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "space-y-4",
            "data-ocid": "bank_link_section.linked_info",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
                bankLinkRecord.institutionName && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-md border border-border bg-muted/40 dark:bg-muted/20 px-3 py-2.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground uppercase tracking-wide mb-0.5", children: "Institution" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-foreground truncate", children: bankLinkRecord.institutionName })
                ] }),
                bankLinkRecord.balance !== void 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-md border border-border bg-muted/40 dark:bg-muted/20 px-3 py-2.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground uppercase tracking-wide mb-0.5", children: "Balance" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-foreground", children: maskBalance(
                    bankLinkRecord.balance,
                    bankLinkRecord.currency
                  ) })
                ] })
              ] }),
              bankLinkRecord.transactionSummary && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "space-y-2",
                  "data-ocid": "bank_link_section.transaction_summary",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: [
                      "Transaction Summary",
                      bankLinkRecord.transactionSummary.months > 0n && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-1 normal-case", children: [
                        "(",
                        Number(bankLinkRecord.transactionSummary.months),
                        " ",
                        "months)"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-2 sm:grid-cols-3", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 rounded-md border border-border bg-emerald-500/5 px-3 py-2", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(TrendingUp, { className: "h-4 w-4 shrink-0 text-emerald-500" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Income" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold text-emerald-700", children: formatCurrency(
                            bankLinkRecord.transactionSummary.income,
                            bankLinkRecord.currency
                          ) })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 rounded-md border border-border bg-primary/5 px-3 py-2", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(Banknote, { className: "h-4 w-4 shrink-0 text-primary" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Credits" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold text-foreground", children: formatCurrency(
                            bankLinkRecord.transactionSummary.totalCredits,
                            bankLinkRecord.currency
                          ) })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 rounded-md border border-border bg-destructive/5 px-3 py-2", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(TrendingDown, { className: "h-4 w-4 shrink-0 text-destructive" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Debits" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold text-destructive", children: formatCurrency(
                            bankLinkRecord.transactionSummary.totalDebits,
                            bankLinkRecord.currency
                          ) })
                        ] })
                      ] })
                    ] })
                  ]
                }
              ),
              bankLinkRecord.linkedAt !== void 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 text-xs text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-3 w-3 text-emerald-500" }),
                "Linked on",
                " ",
                new Date(
                  Number(bankLinkRecord.linkedAt) / 1e6
                ).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })
              ] })
            ]
          }
        ) : isFinancingReady ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "space-y-3",
            "data-ocid": "bank_link_section.link_prompt",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Your profile has been marked as financing-ready. Link your bank account via Mono to fetch verified financial data and trigger AI scoring." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Button,
                {
                  className: "gap-2",
                  onClick: () => setOpen(true),
                  "data-ocid": "bank_link_section.open_modal_button",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Wallet, { className: "h-4 w-4" }),
                    "Link Bank Account",
                    /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "h-4 w-4" })
                  ]
                }
              )
            ]
          }
        ) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "space-y-2",
            "data-ocid": "bank_link_section.locked_prompt",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Bank account linking via Mono becomes available once your profile reaches financing-ready status." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Button,
                {
                  variant: "outline",
                  disabled: true,
                  className: "gap-2 cursor-not-allowed opacity-60",
                  "data-ocid": "bank_link_section.locked_button",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Wallet, { className: "h-4 w-4" }),
                    "Link Bank Account (Locked)"
                  ]
                }
              )
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      DialogContent,
      {
        className: "sm:max-w-md",
        "data-ocid": "bank_link_section.dialog",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { className: "font-display", children: "Link Bank Account" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { children: "Enter your Mono account ID to securely link your bank account. Your transaction data will be fetched and used to generate your AI financing score." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "mono-account-id", children: "Mono Account ID" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Input,
                {
                  id: "mono-account-id",
                  placeholder: "e.g. 5f4d8b2c3a1e9f7b6d0c4a8e",
                  value: accountId,
                  onChange: (e) => setAccountId(e.target.value),
                  autoComplete: "off",
                  spellCheck: false,
                  required: true,
                  "data-ocid": "bank_link_section.input"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "You can find your Mono account ID from your Mono Connect session or your Mono dashboard." })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogFooter, { className: "gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  type: "button",
                  variant: "outline",
                  onClick: () => setOpen(false),
                  disabled: isSubmitting,
                  "data-ocid": "bank_link_section.cancel_button",
                  children: "Cancel"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  type: "submit",
                  disabled: isSubmitting || !accountId.trim(),
                  className: "gap-2",
                  "data-ocid": "bank_link_section.submit_button",
                  children: isSubmitting ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
                    "Linking…"
                  ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Wallet, { className: "h-4 w-4" }),
                    "Link Account"
                  ] })
                }
              )
            ] })
          ] })
        ]
      }
    ) })
  ] });
}
function CheckRow({ label, description, status, dataOcid }) {
  const cfg = {
    verified: {
      icon: CircleCheck,
      color: "text-emerald-500 dark:text-emerald-400",
      text: "Verified"
    },
    failed: { icon: CircleX, color: "text-destructive", text: "Failed" },
    pending: { icon: Circle, color: "text-muted-foreground", text: "Pending" }
  };
  const { icon: Icon, color, text } = cfg[status];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "flex items-center justify-between gap-3 py-2.5",
      "data-ocid": dataOcid,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5 min-w-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: cn("h-4 w-4 shrink-0", color) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground", children: label }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground truncate", children: description })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("text-xs font-medium shrink-0", color), children: text })
      ]
    }
  );
}
function kycStatusToBadge(status) {
  switch (status) {
    case KycStatus.Verified:
      return {
        label: "KYC Verified",
        variant: "default",
        className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
      };
    case KycStatus.Failed:
      return {
        label: "KYC Failed",
        variant: "destructive",
        className: ""
      };
    case KycStatus.InProgress:
      return {
        label: "In Progress",
        variant: "secondary",
        className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
      };
    default:
      return {
        label: "Pending",
        variant: "secondary",
        className: ""
      };
  }
}
function boolToStatus(val) {
  return val ? "verified" : "failed";
}
function KycStatusCard({
  kycRecord,
  isLoading = false,
  error = null,
  onRetry
}) {
  const badge = kycStatusToBadge(kycRecord.kycStatus);
  const checks = [
    {
      label: "BVN Verification",
      description: "Bank Verification Number confirmed with NIBSS",
      status: boolToStatus(kycRecord.bvnVerified),
      dataOcid: "kyc_card.bvn_check"
    },
    {
      label: "NIN Verification",
      description: "National Identification Number confirmed with NIMC",
      status: boolToStatus(kycRecord.ninVerified),
      dataOcid: "kyc_card.nin_check"
    },
    {
      label: "CAC Business Registration",
      description: "Corporate Affairs Commission registration verified",
      status: boolToStatus(kycRecord.cacVerified),
      dataOcid: "kyc_card.cac_check"
    },
    {
      label: "TIN Verification",
      description: "Tax Identification Number verified with FIRS",
      status: boolToStatus(kycRecord.tinVerified),
      dataOcid: "kyc_card.tin_check"
    },
    {
      label: "Watchlist Screening",
      description: "No adverse matches on financial watchlists",
      status: kycRecord.watchlistClean ? "verified" : "failed",
      dataOcid: "kyc_card.watchlist_check"
    }
  ];
  const creditScore = Number(kycRecord.creditScore);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "relative border-border", "data-ocid": "kyc_card", children: [
    isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
      "Verifying your information…"
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheck, { className: "h-4 w-4 text-primary" }),
        "KYC Verification"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Badge,
        {
          variant: badge.variant,
          className: cn("text-xs", badge.className),
          "data-ocid": "kyc_card.status_badge",
          children: badge.label
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "divide-y divide-border", children: checks.map((check) => /* @__PURE__ */ jsxRuntimeExports.jsx(CheckRow, { ...check }, check.label)) }),
      creditScore > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "mt-3 flex items-center justify-between rounded-md bg-muted/50 px-3 py-2",
          "data-ocid": "kyc_card.credit_score",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { className: "h-4 w-4 text-muted-foreground" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-muted-foreground", children: "Credit Score" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-foreground", children: creditScore })
          ]
        }
      ),
      error && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "mt-3 flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5",
          "data-ocid": "kyc_card.error_state",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: error }),
            onRetry && /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                type: "button",
                variant: "outline",
                size: "sm",
                className: "self-start gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10",
                onClick: onRetry,
                "data-ocid": "kyc_card.retry_button",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
                  "Retry"
                ]
              }
            )
          ]
        }
      ),
      kycRecord.kycStatus === KycStatus.Failed && !error && onRetry && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "sm",
          className: "mt-3 gap-1.5",
          onClick: onRetry,
          "data-ocid": "kyc_card.retry_kyc_button",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
            "Retry KYC"
          ]
        }
      ),
      kycRecord.verifiedAt !== void 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex items-center gap-1.5 text-xs text-muted-foreground", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-3 w-3" }),
        "Verified",
        " ",
        new Date(
          Number(kycRecord.verifiedAt) / 1e6
        ).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric"
        })
      ] })
    ] })
  ] });
}
function normaliseRiskLevel(candid) {
  if (!candid) return RiskLevel__1.Medium;
  const key = typeof candid === "string" ? candid : Object.keys(candid)[0] ?? "Medium";
  if (key === "Low") return RiskLevel__1.Low;
  if (key === "High") return RiskLevel__1.High;
  return RiskLevel__1.Medium;
}
function normaliseMizanRecord(raw) {
  return {
    incomeStabilityScore: raw.incomeStabilityScore,
    debtBehaviorScore: raw.debtBehaviorScore,
    repaymentPatternScore: raw.repaymentPatternScore,
    revenueTrendScore: raw.revenueTrendScore,
    overallReadinessScore: raw.overallReadinessScore,
    halalComplianceScore: raw.halalComplianceScore,
    riskClassification: normaliseRiskLevel(
      raw.riskClassification
    ),
    isBorderline: raw.isBorderline,
    borderlineReasons: raw.borderlineReasons,
    narrativeSummary: raw.narrativeSummary,
    computedAt: raw.computedAt
  };
}
function ApplicantDashboard() {
  var _a, _b, _c, _d;
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pollingRef = reactExports.useRef(null);
  const profileQuery = useQuery({
    queryKey: ["applicant_profile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMyBusinessProfile();
    },
    enabled: !!actor
  });
  const profileUserId = ((_a = profileQuery.data) == null ? void 0 : _a.userId) ?? null;
  const tawthiqQuery = useQuery({
    queryKey: ["tawthiq_record", profileUserId == null ? void 0 : profileUserId.toString()],
    queryFn: async () => {
      if (!actor || !profileUserId) return null;
      return actor.getTawthiqRecord(profileUserId);
    },
    enabled: !!actor && !!profileUserId
  });
  const mizanQuery = useQuery({
    queryKey: ["mizan_record", profileUserId == null ? void 0 : profileUserId.toString()],
    queryFn: async () => {
      if (!actor || !profileUserId) return null;
      const actorAny = actor;
      if (typeof actorAny.getMizanResult !== "function") return null;
      const result = await actorAny.getMizanResult(
        profileUserId.toString()
      );
      if (!result) return null;
      if ("ok" in result) return normaliseMizanRecord(result.ok);
      return null;
    },
    enabled: !!actor && !!profileUserId
  });
  const preliminaryMizanQuery = useQuery({
    queryKey: ["preliminary_mizan_record", profileUserId == null ? void 0 : profileUserId.toString()],
    queryFn: async () => {
      if (!actor) return null;
      const result = await actor.getPreliminaryMizanResult();
      if (!result) return null;
      return normaliseMizanRecord(result);
    },
    enabled: !!actor && !!profileUserId
  });
  reactExports.useEffect(() => {
    var _a2, _b2, _c2;
    const kycStatus = (_b2 = (_a2 = profileQuery.data) == null ? void 0 : _a2.kycRecord) == null ? void 0 : _b2.kycStatus;
    const tawthiqDone = ((_c2 = tawthiqQuery.data) == null ? void 0 : _c2.completedAt) != null;
    const mizanDone = !!mizanQuery.data;
    const kycNeedsPolling = kycStatus === KycStatus.InProgress || kycStatus === KycStatus.Pending;
    const shouldPoll = kycNeedsPolling || !tawthiqDone || !mizanDone;
    if (shouldPoll && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        void queryClient.invalidateQueries({ queryKey: ["applicant_profile"] });
        void queryClient.invalidateQueries({ queryKey: ["tawthiq_record"] });
        void queryClient.invalidateQueries({ queryKey: ["mizan_record"] });
        void queryClient.invalidateQueries({
          queryKey: ["preliminary_mizan_record"]
        });
      }, 3e3);
    } else if (!shouldPoll && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [
    (_c = (_b = profileQuery.data) == null ? void 0 : _b.kycRecord) == null ? void 0 : _c.kycStatus,
    (_d = tawthiqQuery.data) == null ? void 0 : _d.completedAt,
    mizanQuery.data,
    queryClient
  ]);
  reactExports.useEffect(() => {
    const id = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["tawthiq_record"] });
    }, 5e3);
    return () => clearInterval(id);
  }, [queryClient]);
  const linkBankMutation = useMutation({
    mutationFn: async (accountId) => {
      if (!actor) throw new Error("Not connected");
      return actor.linkBankAccount(accountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant_profile"] });
    },
    onError: (err) => ue.error(err instanceof Error ? err.message : "Bank link failed")
  });
  const submitAppealMutation = useMutation({
    mutationFn: async ({
      flagId,
      appealText,
      documentUrl,
      documentName
    }) => {
      if (!actor) throw new Error("Not connected");
      const result = await actor.submitTawthiqAppeal(
        flagId,
        appealText,
        documentUrl,
        documentName
      );
      if ("err" in result) throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tawthiq_record"] });
      ue.success(
        "Appeal submitted successfully. It is now under admin review."
      );
    },
    onError: (err) => ue.error(
      err instanceof Error ? err.message : "Failed to submit appeal"
    )
  });
  async function handleSubmitAppeal(flagId, appealText, documentUrl, documentName) {
    await submitAppealMutation.mutateAsync({
      flagId,
      appealText,
      documentUrl,
      documentName
    });
  }
  if (profileQuery.isLoading) return /* @__PURE__ */ jsxRuntimeExports.jsx(FullPageLoader, {});
  const profile = profileQuery.data ?? null;
  const displayName = (profile == null ? void 0 : profile.businessName) ?? "Applicant";
  const regStatus = (profile == null ? void 0 : profile.registrationStatus) ?? RegistrationStatus.pending;
  const isFinancingReady = regStatus === RegistrationStatus.financingReady;
  const isApproved = regStatus === RegistrationStatus.approved;
  const statusConfig = {
    [RegistrationStatus.pending]: {
      label: "Pending",
      className: "bg-muted text-muted-foreground"
    },
    [RegistrationStatus.kycInProgress]: {
      label: "KYC In Progress",
      className: "bg-chart-4/15 text-foreground border-chart-4/30"
    },
    [RegistrationStatus.underReview]: {
      label: "Under Review",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
    },
    [RegistrationStatus.financingReady]: {
      label: "Financing Ready",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
    },
    [RegistrationStatus.approved]: {
      label: "Approved",
      className: "bg-primary/15 text-primary border-primary/30"
    },
    [RegistrationStatus.rejected]: {
      label: "Rejected",
      className: "bg-destructive/15 text-destructive border-destructive/30"
    }
  };
  const { label: statusLabel, className: statusClass } = statusConfig[regStatus];
  const hasScores = (profile == null ? void 0 : profile.scoringRecord) && Number(profile.scoringRecord.scoredAt) > 0;
  const fullMizan = mizanQuery.data ?? null;
  const prelimMizan = preliminaryMizanQuery.data ?? null;
  const showPrelim = !!prelimMizan;
  const showFull = !!fullMizan;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(BusinessLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-4xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: `Welcome, ${displayName}`,
        subtitle: isApproved ? "Your profile is verified and active." : isFinancingReady ? "Your profile is financing-ready. Link your bank account to proceed." : "Complete your verification to become financing-ready.",
        breadcrumbs: [{ label: "Dashboard" }],
        actions: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              variant: "outline",
              size: "sm",
              className: "gap-1.5",
              onClick: () => navigate({ to: "/business/profile" }),
              "data-ocid": "applicant_dashboard.edit_profile_button",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Pencil, { className: "h-3.5 w-3.5" }),
                "Edit Profile"
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Badge,
            {
              className: cn("text-xs", statusClass),
              "data-ocid": "applicant_dashboard.registration_status_badge",
              children: statusLabel
            }
          )
        ] })
      }
    ),
    (isFinancingReady || isApproved) && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "mb-8 flex items-center gap-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-5 py-4",
        "data-ocid": "applicant_dashboard.financing_ready_banner",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheck, { className: "h-6 w-6 shrink-0 text-emerald-600" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-semibold text-emerald-800 dark:text-emerald-300", children: isApproved ? "Profile Approved!" : "Your Profile is Financing-Ready!" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-emerald-700 dark:text-emerald-400", children: isApproved ? "Your profile is now visible to verified halal financiers on the platform." : "Link your bank account below to complete your financial profile and trigger AI scoring." })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
      (profile == null ? void 0 : profile.kycRecord) && /* @__PURE__ */ jsxRuntimeExports.jsx("section", { "data-ocid": "applicant_dashboard.kyc_section", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        KycStatusCard,
        {
          kycRecord: profile.kycRecord,
          isLoading: profile.kycRecord.kycStatus === KycStatus.InProgress || profile.kycRecord.kycStatus === KycStatus.Pending,
          onRetry: () => queryClient.invalidateQueries({
            queryKey: ["applicant_profile"]
          })
        }
      ) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("section", { "data-ocid": "applicant_dashboard.tawthiq_section", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        TawthiqStatusCard,
        {
          tawthiqRecord: tawthiqQuery.data ?? null,
          isLoading: tawthiqQuery.isLoading,
          onSubmitAppeal: handleSubmitAppeal
        }
      ) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("section", { "data-ocid": "applicant_dashboard.mizan_section", children: !showPrelim && !showFull ? /* @__PURE__ */ jsxRuntimeExports.jsx(
        Card,
        {
          className: "border-border border-dashed",
          "data-ocid": "applicant_dashboard.mizan_pending",
          children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex flex-col items-center justify-center py-10 text-center", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "mb-3 h-10 w-10 text-muted-foreground/40" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "font-semibold text-foreground", children: [
              "Mizan (",
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-arabic", children: "الميزان" }),
              ") Assessment Pending"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 max-w-sm text-sm text-muted-foreground", children: "Mizan assessment will begin after Tawthiq verification completes." })
          ] })
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
        showPrelim && !showFull && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "rounded-xl border border-amber-300/60 dark:border-amber-700/50 ring-1 ring-amber-200/60 dark:ring-amber-800/40",
            "data-ocid": "applicant_dashboard.mizan_preliminary_card",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-4 pt-3 pb-1 flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-amber-800 dark:text-amber-300", children: "Preliminary Risk Assessment" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium border border-amber-300/60 dark:border-amber-700/50", children: "Preliminary" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "px-4 pb-2 text-[11px] text-amber-700 dark:text-amber-500", children: "Based on your registration data. A full assessment will be available after you link your bank account." }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                MizanScoresCard,
                {
                  mizan: prelimMizan,
                  isLoading: preliminaryMizanQuery.isLoading,
                  mizanDivergenceAlert: (profile == null ? void 0 : profile.mizanDivergenceAlert) ?? false
                }
              )
            ]
          }
        ),
        showPrelim && showFull && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "rounded-xl border border-amber-200/50 dark:border-amber-800/40 opacity-80",
            "data-ocid": "applicant_dashboard.mizan_preliminary_card",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-4 pt-3 pb-1 flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-4 w-4 text-amber-500 dark:text-amber-500 shrink-0" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-amber-700 dark:text-amber-400", children: "Preliminary Risk Assessment" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500 font-medium border border-amber-200/60 dark:border-amber-700/40", children: "Superseded by Full Assessment" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "px-4 pb-2 text-[11px] text-muted-foreground", children: "Initial estimate based on registration data." }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                MizanScoresCard,
                {
                  mizan: prelimMizan,
                  isLoading: preliminaryMizanQuery.isLoading,
                  mizanDivergenceAlert: (profile == null ? void 0 : profile.mizanDivergenceAlert) ?? false
                }
              )
            ]
          }
        ),
        showFull && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "rounded-xl border border-primary/30 dark:border-primary/40 ring-1 ring-primary/15 dark:ring-primary/20",
            "data-ocid": "applicant_dashboard.mizan_full_card",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-4 pt-3 pb-1 flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-4 w-4 text-primary shrink-0" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-foreground", children: "Bank-Verified Risk Assessment" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 dark:bg-primary/20 text-primary font-medium border border-primary/25", children: "Full Assessment" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "px-4 pb-2 text-[11px] text-muted-foreground", children: "Based on your verified Mono bank transaction data." }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                MizanScoresCard,
                {
                  mizan: fullMizan,
                  isLoading: mizanQuery.isLoading,
                  mizanDivergenceAlert: (profile == null ? void 0 : profile.mizanDivergenceAlert) ?? false
                }
              )
            ]
          }
        )
      ] }) }),
      (profile == null ? void 0 : profile.bankLinkRecord) && /* @__PURE__ */ jsxRuntimeExports.jsx("section", { "data-ocid": "applicant_dashboard.bank_section", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        BankLinkSection,
        {
          bankLinkRecord: profile.bankLinkRecord,
          isFinancingReady,
          onLinkBank: async (accountId) => {
            await linkBankMutation.mutateAsync(accountId);
          }
        }
      ) }),
      hasScores && (profile == null ? void 0 : profile.scoringRecord) && /* @__PURE__ */ jsxRuntimeExports.jsx("section", { "data-ocid": "applicant_dashboard.ai_scores_section", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AiScoresCard, { scoringRecord: profile.scoringRecord }) }),
      !hasScores && /* @__PURE__ */ jsxRuntimeExports.jsx(
        Card,
        {
          className: "border-border border-dashed",
          "data-ocid": "applicant_dashboard.scores_pending",
          children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex flex-col items-center justify-center py-10 text-center", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(BrainCircuit, { className: "mb-3 h-10 w-10 text-muted-foreground/40" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground", children: "AI Scoring Pending" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 max-w-sm text-sm text-muted-foreground", children: "Your financing readiness, halal compliance, and risk scores will appear here after your bank account is linked and AI analysis is complete." })
          ] })
        }
      )
    ] })
  ] }) });
}
export {
  ApplicantDashboard as default
};
