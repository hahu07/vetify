import { t as createLucideIcon, j as jsxRuntimeExports, C as Card, c as CardHeader, d as CardTitle, ab as Scale, e as CardContent, af as LoaderCircle, i as Separator, x as ChevronRight, aw as Variant_Failed_Passed_Pending, ax as Variant_Flagged_Clean_Pending, B as Badge, ah as Variant_conditionalReady_notReady_ready, s as CircleX, aa as TriangleAlert, f as CircleCheck, ai as Variant_major_minor, y as cn, r as reactExports, b as Button, aj as AppealStatus } from "./index-CPnZ4-ee.js";
import { T as Textarea } from "./textarea-DWu_HpBl.js";
import { C as Clock } from "./clock-BRCXs4iw.js";
import { M as MessageSquare } from "./message-square-B7hLhon-.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
  ["path", { d: "M12 9v4", key: "juzpu7" }],
  ["path", { d: "M12 17h.01", key: "p32p05" }]
];
const FileWarning = createLucideIcon("file-warning", __iconNode);
function stepStatusIcon(status) {
  switch (status) {
    case "passed":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" });
    case "failed":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(CircleX, { className: "h-4 w-4 shrink-0 text-destructive" });
    default:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-4 w-4 shrink-0 text-muted-foreground animate-pulse" });
  }
}
function stepStatusBadge(status) {
  switch (status) {
    case "passed":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 text-xs", children: "Passed" });
    case "failed":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "destructive", className: "text-xs", children: "Failed" });
    default:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "secondary", className: "text-xs text-muted-foreground", children: "Pending" });
  }
}
function shariaStatusToStep(status) {
  switch (status) {
    case Variant_Failed_Passed_Pending.Passed:
      return "passed";
    case Variant_Failed_Passed_Pending.Failed:
      return "failed";
    default:
      return "pending";
  }
}
function inconsistencyStatusToStep(status) {
  switch (status) {
    case Variant_Flagged_Clean_Pending.Clean:
      return "passed";
    case Variant_Flagged_Clean_Pending.Flagged:
      return "failed";
    default:
      return "pending";
  }
}
function CreditReadinessBadge({
  verdict
}) {
  switch (verdict) {
    case Variant_conditionalReady_notReady_ready.ready:
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 text-sm font-semibold px-3 py-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-3.5 w-3.5 mr-1.5" }),
        "Ready"
      ] });
    case Variant_conditionalReady_notReady_ready.conditionalReady:
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 text-sm font-semibold px-3 py-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-3.5 w-3.5 mr-1.5" }),
        "Conditional Ready"
      ] });
    case Variant_conditionalReady_notReady_ready.notReady:
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Badge,
        {
          variant: "destructive",
          className: "text-sm font-semibold px-3 py-1",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(CircleX, { className: "h-3.5 w-3.5 mr-1.5" }),
            "Not Ready"
          ]
        }
      );
    default:
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Badge,
        {
          variant: "secondary",
          className: "text-sm text-muted-foreground px-3 py-1",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-3.5 w-3.5 mr-1.5" }),
            "Pending"
          ]
        }
      );
  }
}
function ShariaFlagItem({ flag }) {
  const isMajor = flag.severity === Variant_major_minor.major;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-2 rounded-md bg-muted/40 dark:bg-muted/20 px-3 py-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      TriangleAlert,
      {
        className: cn(
          "h-3.5 w-3.5 mt-0.5 shrink-0",
          isMajor ? "text-destructive" : "text-yellow-500"
        )
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-medium text-foreground", children: flag.indicator }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Badge,
          {
            className: cn(
              "text-[10px] px-1.5 py-0",
              isMajor ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-yellow-500/15 text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-500/30"
            ),
            children: isMajor ? "Major" : "Minor"
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-muted-foreground mt-0.5", children: flag.category })
    ] })
  ] });
}
function AppealStatusBadge({ appeal }) {
  switch (appeal.status) {
    case AppealStatus.accepted:
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 text-xs gap-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-3 w-3" }),
        "Appeal accepted"
      ] });
    case AppealStatus.rejected:
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { variant: "destructive", className: "text-xs gap-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CircleX, { className: "h-3 w-3" }),
          "Appeal rejected"
        ] }),
        appeal.adminNote && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[11px] text-muted-foreground", children: [
          "Admin note: ",
          appeal.adminNote
        ] })
      ] });
    default:
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 text-xs gap-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-3 w-3" }),
        "Appeal submitted — under review"
      ] });
  }
}
function AppealForm({ flagId, onSubmit, onCancel }) {
  const [appealText, setAppealText] = reactExports.useState("");
  const [documentUrl, setDocumentUrl] = reactExports.useState("");
  const [documentName, setDocumentName] = reactExports.useState("");
  const [isSubmitting, setIsSubmitting] = reactExports.useState(false);
  async function handleSubmit(e) {
    e.preventDefault();
    if (!appealText.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(
        flagId,
        appealText.trim(),
        documentUrl.trim() || null,
        documentName.trim() || null
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "form",
    {
      onSubmit: handleSubmit,
      className: "mt-2 rounded-lg border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-3",
      "data-ocid": "tawthiq_card.appeal_form",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(MessageSquare, { className: "h-3.5 w-3.5" }),
          "Submit an Appeal"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "label",
            {
              htmlFor: `appeal-text-${flagId}`,
              className: "text-[11px] font-medium text-muted-foreground",
              children: [
                "Explanation ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-destructive", children: "*" })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Textarea,
            {
              id: `appeal-text-${flagId}`,
              value: appealText,
              onChange: (e) => setAppealText(e.target.value),
              placeholder: "Explain why this flag may be inaccurate and provide any relevant context…",
              rows: 3,
              className: "text-sm resize-none",
              required: true,
              "data-ocid": "tawthiq_card.appeal_text_input"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[11px] font-medium text-muted-foreground", children: [
            "Supporting document",
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground/60", children: "(optional)" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[10px] text-muted-foreground", children: "Upload a supporting document via your file storage and paste the link below." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "url",
              value: documentUrl,
              onChange: (e) => setDocumentUrl(e.target.value),
              placeholder: "https://… (document URL)",
              className: "w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
              "data-ocid": "tawthiq_card.appeal_document_url_input"
            }
          ),
          documentUrl.trim() && /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "text",
              value: documentName,
              onChange: (e) => setDocumentName(e.target.value),
              placeholder: "Document name (e.g. Bank Statement June 2025)",
              className: "w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
              "data-ocid": "tawthiq_card.appeal_document_name_input"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 justify-end pt-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "sm",
              onClick: onCancel,
              disabled: isSubmitting,
              "data-ocid": "tawthiq_card.appeal_cancel_button",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              type: "submit",
              size: "sm",
              disabled: isSubmitting || !appealText.trim(),
              className: "gap-1.5",
              "data-ocid": "tawthiq_card.appeal_submit_button",
              children: [
                isSubmitting ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(MessageSquare, { className: "h-3.5 w-3.5" }),
                "Submit Appeal"
              ]
            }
          )
        ] })
      ]
    }
  );
}
function InconsistencyFlagWithAppeal({
  flag,
  flagId,
  existingAppeal,
  onSubmitAppeal,
  index
}) {
  const [showForm, setShowForm] = reactExports.useState(false);
  async function handleSubmit(fId, text, docUrl, docName) {
    if (onSubmitAppeal) {
      await onSubmitAppeal(fId, text, docUrl, docName);
    }
    setShowForm(false);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "rounded-md bg-muted/40 dark:bg-muted/20 px-3 py-2 space-y-2",
      "data-ocid": `tawthiq_card.inconsistency_flag.${index + 1}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs font-medium text-foreground flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(FileWarning, { className: "h-3.5 w-3.5 text-amber-500" }),
          flag.field
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-2 text-[11px]", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-muted-foreground", children: "Declared" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground break-words", children: flag.declaredValue })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-muted-foreground", children: "Verified" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-destructive break-words", children: flag.verifiedValue })
          ] })
        ] }),
        onSubmitAppeal && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pt-1", children: existingAppeal ? /* @__PURE__ */ jsxRuntimeExports.jsx(AppealStatusBadge, { appeal: existingAppeal }) : showForm ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          AppealForm,
          {
            flagId,
            onSubmit: handleSubmit,
            onCancel: () => setShowForm(false)
          }
        ) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            type: "button",
            variant: "outline",
            size: "sm",
            className: "h-7 text-xs gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30",
            onClick: () => setShowForm(true),
            "data-ocid": `tawthiq_card.appeal_flag_button.${index + 1}`,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(MessageSquare, { className: "h-3 w-3" }),
              "Appeal this flag"
            ]
          }
        ) })
      ]
    }
  );
}
function PipelineStep({
  number,
  title,
  status,
  children,
  dataOcid
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", "data-ocid": dataOcid, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 text-xs font-bold text-primary shrink-0", children: number }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          stepStatusIcon(status),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-foreground", children: title })
        ] })
      ] }),
      stepStatusBadge(status)
    ] }),
    children && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ml-8 space-y-2", children })
  ] });
}
function TawthiqStatusCard({
  tawthiqRecord,
  isLoading = false,
  onSubmitAppeal
}) {
  if (isLoading || tawthiqRecord === null || tawthiqRecord === void 0) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "border-border", "data-ocid": "tawthiq_card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(CardHeader, { className: "pb-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-4 w-4 text-primary" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Tawthiq" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground font-normal text-sm", children: "التوثيق" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "AI-powered verification & compliance screening" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-6 text-sm text-muted-foreground",
          "data-ocid": "tawthiq_card.loading_state",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-5 w-5 animate-spin shrink-0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground", children: "Analysis in progress…" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs mt-0.5", children: "Tawthiq is verifying your profile. This may take a moment." })
            ] })
          ]
        }
      ) })
    ] });
  }
  const shariaStep = shariaStatusToStep(tawthiqRecord.shariaScreeningStatus);
  const inconsistencyStep = inconsistencyStatusToStep(
    tawthiqRecord.inconsistencyStatus
  );
  const appealsByFlagId = /* @__PURE__ */ new Map();
  const completedAt = tawthiqRecord.completedAt ? new Date(
    Number(tawthiqRecord.completedAt) / 1e6
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }) : null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "border-border", "data-ocid": "tawthiq_card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(CardHeader, { className: "pb-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-4 w-4 text-primary" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Tawthiq" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground font-normal text-sm", children: "التوثيق" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          CreditReadinessBadge,
          {
            verdict: tawthiqRecord.creditReadinessVerdict
          }
        )
      ] }),
      completedAt && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground flex items-center gap-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-3 w-3" }),
        "Analysis completed ",
        completedAt
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "AI-powered verification & Shariah compliance screening" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "space-y-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        PipelineStep,
        {
          number: 1,
          title: "Shariah Compliance Screening",
          status: shariaStep,
          dataOcid: "tawthiq_card.sharia_step",
          children: [
            tawthiqRecord.shariaFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-1.5", "data-ocid": "tawthiq_card.sharia_flags", children: tawthiqRecord.shariaFlags.map((flag, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: flags have no unique id
              /* @__PURE__ */ jsxRuntimeExports.jsx(ShariaFlagItem, { flag }, i)
            )) }),
            tawthiqRecord.shariaFlags.length === 0 && shariaStep === "passed" && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-emerald-600 dark:text-emerald-400", children: "No Shariah compliance issues found." })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        PipelineStep,
        {
          number: 2,
          title: "Inconsistency Detection",
          status: inconsistencyStep,
          dataOcid: "tawthiq_card.inconsistency_step",
          children: [
            tawthiqRecord.inconsistencyFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "space-y-2",
                "data-ocid": "tawthiq_card.inconsistency_flags",
                children: tawthiqRecord.inconsistencyFlags.map((flag, i) => {
                  const flagId = `${flag.field}_${i}`;
                  const existingAppeal = appealsByFlagId.get(flagId);
                  return /* @__PURE__ */ jsxRuntimeExports.jsx(
                    InconsistencyFlagWithAppeal,
                    {
                      flag,
                      flagId,
                      existingAppeal,
                      onSubmitAppeal,
                      index: i
                    },
                    i
                  );
                })
              }
            ),
            tawthiqRecord.inconsistencyFlags.length === 0 && inconsistencyStep === "passed" && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-emerald-600 dark:text-emerald-400", children: "No inconsistencies detected between declared and verified data." })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "space-y-3",
          "data-ocid": "tawthiq_card.credit_readiness_step",
          children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 text-xs font-bold text-primary shrink-0", children: "3" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4 shrink-0 text-primary" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-foreground", children: "Credit-Readiness Verdict" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              CreditReadinessBadge,
              {
                verdict: tawthiqRecord.creditReadinessVerdict
              }
            )
          ] })
        }
      ),
      tawthiqRecord.narrativeSummary && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "rounded-md border border-border bg-muted/40 dark:bg-muted/20 px-3 py-3",
            "data-ocid": "tawthiq_card.narrative_summary",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5", children: "Tawthiq Analysis Summary" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-foreground leading-relaxed", children: tawthiqRecord.narrativeSummary })
            ]
          }
        )
      ] })
    ] })
  ] });
}
export {
  TawthiqStatusCard as T
};
