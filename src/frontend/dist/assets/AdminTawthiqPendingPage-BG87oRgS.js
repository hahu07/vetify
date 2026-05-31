import { r as reactExports, g as useBackend, n as useQuery, j as jsxRuntimeExports, E as AdminLayout, P as PageHeader, v as Skeleton, C as Card, e as CardContent, ag as FileSearch, A as useQueryClient, D as useMutation, l as ue, o as ChevronDown, b as Button, Q as Save, B as Badge, ah as Variant_conditionalReady_notReady_ready, ai as Variant_major_minor, aj as AppealStatus, I as Input } from "./index-CPnZ4-ee.js";
import { P as Pagination } from "./Pagination-CELRZ_t0.js";
import { T as Textarea } from "./textarea-DWu_HpBl.js";
import { C as CircleAlert } from "./circle-alert-DERsjRfM.js";
import { C as ChevronUp } from "./chevron-up-C9u-2erU.js";
import { M as MessageSquare } from "./message-square-B7hLhon-.js";
import { D as Download } from "./download-CFlTkAVv.js";
const PAGE_SIZE = 20;
function verdictBadge(verdict) {
  if (!verdict) return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "secondary", children: "Pending" });
  if (verdict === Variant_conditionalReady_notReady_ready.ready)
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", children: "Ready" });
  if (verdict === Variant_conditionalReady_notReady_ready.conditionalReady)
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", children: "Conditional Ready" });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "destructive", children: "Not Ready" });
}
function ShariaFlagRow({ flag }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-start gap-2 text-sm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "span",
      {
        className: `mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${flag.severity === Variant_major_minor.major ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`,
        children: flag.severity
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-foreground font-medium", children: flag.indicator }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-muted-foreground", children: [
      "(",
      flag.category,
      ")"
    ] })
  ] });
}
function InconsistencyRow({ flag }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-border/50 last:border-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2 pr-4 text-sm font-medium text-foreground", children: flag.field }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2 pr-4 text-sm text-muted-foreground", children: flag.declaredValue }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2 text-sm text-foreground", children: flag.verifiedValue })
  ] });
}
function AppealStatusBadge({ status }) {
  if (status === AppealStatus.accepted)
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", children: "Accepted" });
  if (status === AppealStatus.rejected)
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "destructive", children: "Rejected" });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", children: "Pending" });
}
function AppealCard({
  appeal,
  businessUserId
}) {
  const [rejectMode, setRejectMode] = reactExports.useState(false);
  const [rejectionReason, setRejectionReason] = reactExports.useState("");
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const { mutate: reviewAppeal, isPending: isReviewing } = useMutation({
    mutationFn: async ({
      decision,
      note
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.reviewTawthiqAppeal(
        businessUserId,
        appeal.id,
        decision,
        note
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      ue.success("Appeal reviewed successfully");
      queryClient.invalidateQueries({
        queryKey: ["tawthiq", "appeals", businessUserId.toString()]
      });
      setRejectMode(false);
      setRejectionReason("");
    },
    onError: (err) => ue.error(`Failed to review appeal: ${err.message}`)
  });
  const isPending = appeal.status === AppealStatus.pending;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "rounded-lg border border-border/40 bg-muted/20 dark:bg-muted/10 p-3 space-y-2",
      "data-ocid": "tawthiq_pending.appeal_card",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-0.5 min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Flag:" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-mono text-foreground", children: appeal.flagId })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
              "Submitted",
              " ",
              new Date(
                Number(appeal.submittedAt) / 1e6
              ).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric"
              })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(AppealStatusBadge, { status: appeal.status })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-foreground leading-relaxed", children: appeal.appealText }),
        appeal.documentUrl && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "a",
          {
            href: appeal.documentUrl,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "inline-flex items-center gap-1.5 text-xs text-primary hover:underline",
            "data-ocid": "tawthiq_pending.appeal_download_button",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "h-3 w-3" }),
              appeal.documentName ?? "View Document"
            ]
          }
        ),
        isPending && !rejectMode && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "flex gap-2 pt-1",
            "data-ocid": "tawthiq_pending.appeal_actions",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  type: "button",
                  size: "sm",
                  variant: "outline",
                  className: "gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs h-7 px-2.5",
                  onClick: () => reviewAppeal({ decision: AppealStatus.accepted, note: "" }),
                  disabled: isReviewing,
                  "data-ocid": "tawthiq_pending.appeal_accept_button",
                  children: "Accept Appeal"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  type: "button",
                  size: "sm",
                  variant: "outline",
                  className: "gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 text-xs h-7 px-2.5",
                  onClick: () => setRejectMode(true),
                  disabled: isReviewing,
                  "data-ocid": "tawthiq_pending.appeal_reject_button",
                  children: "Reject Appeal"
                }
              )
            ]
          }
        ),
        isPending && rejectMode && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "space-y-2 pt-1 border-t border-border/40",
            "data-ocid": "tawthiq_pending.appeal_reject_form",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "label",
                {
                  htmlFor: `reject-reason-${appeal.id}`,
                  className: "text-xs font-medium text-muted-foreground",
                  children: "Enter rejection reason (required)"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Input,
                {
                  id: `reject-reason-${appeal.id}`,
                  value: rejectionReason,
                  onChange: (e) => setRejectionReason(e.target.value),
                  placeholder: "Reason for rejection…",
                  className: "h-8 text-sm",
                  "data-ocid": "tawthiq_pending.appeal_reject_reason_input"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Button,
                  {
                    type: "button",
                    size: "sm",
                    className: "gap-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-7 px-2.5",
                    onClick: () => reviewAppeal({
                      decision: AppealStatus.rejected,
                      note: rejectionReason
                    }),
                    disabled: isReviewing || !rejectionReason.trim(),
                    "data-ocid": "tawthiq_pending.appeal_confirm_rejection_button",
                    children: isReviewing ? "Submitting…" : "Confirm Rejection"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Button,
                  {
                    type: "button",
                    size: "sm",
                    variant: "ghost",
                    className: "text-xs h-7 px-2.5",
                    onClick: () => {
                      setRejectMode(false);
                      setRejectionReason("");
                    },
                    disabled: isReviewing,
                    "data-ocid": "tawthiq_pending.appeal_cancel_rejection_button",
                    children: "Cancel"
                  }
                )
              ] })
            ]
          }
        ),
        !isPending && (appeal.adminNote || appeal.reviewedAt) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pt-1.5 border-t border-border/40 space-y-0.5", children: [
          appeal.adminNote && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: "Admin note:" }),
            " ",
            appeal.adminNote
          ] }),
          appeal.reviewedAt && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
            "Reviewed",
            " ",
            new Date(
              Number(appeal.reviewedAt) / 1e6
            ).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric"
            })
          ] })
        ] })
      ]
    }
  );
}
function AppealsSection({ businessUserId }) {
  const { actor, isFetching } = useBackend();
  const { data: appeals, isLoading } = useQuery({
    queryKey: ["tawthiq", "appeals", businessUserId.toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTawthiqAppeals(businessUserId);
    },
    enabled: !!actor && !isFetching,
    staleTime: 2e4
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": "tawthiq_pending.appeals_section", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(MessageSquare, { className: "h-3.5 w-3.5" }),
      "Appeals"
    ] }),
    isLoading && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-16 w-full rounded-lg" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-16 w-full rounded-lg" })
    ] }),
    !isLoading && (!appeals || appeals.length === 0) && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "p",
      {
        className: "text-xs text-muted-foreground italic",
        "data-ocid": "tawthiq_pending.appeals_empty",
        children: "No appeals submitted"
      }
    ),
    !isLoading && appeals && appeals.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2", "data-ocid": "tawthiq_pending.appeals_list", children: appeals.map((appeal) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      AppealCard,
      {
        appeal,
        businessUserId
      },
      appeal.id
    )) })
  ] });
}
function PendingRow({ business }) {
  const [expanded, setExpanded] = reactExports.useState(false);
  const [noteText, setNoteText] = reactExports.useState("");
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const tawthiq = business.tawthiqRecord;
  const { data: existingNote } = useQuery({
    queryKey: ["tawthiq", "note", business.userId.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getTawthiqAdminNote(business.userId);
    },
    enabled: !!actor && expanded,
    staleTime: 3e4
  });
  const prevNote = existingNote ?? "";
  if (noteText === "" && prevNote !== "") {
    setNoteText(prevNote);
  }
  const { mutate: saveNote, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.saveTawthiqAdminNote(
        business.userId,
        noteText
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      ue.success("Note saved");
      queryClient.invalidateQueries({
        queryKey: ["tawthiq", "note", business.userId.toString()]
      });
    },
    onError: (err) => ue.error(`Failed to save: ${err.message}`)
  });
  const shariaFlags = (tawthiq == null ? void 0 : tawthiq.shariaFlags) ?? [];
  const inconsistencyFlags = (tawthiq == null ? void 0 : tawthiq.inconsistencyFlags) ?? [];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden",
      "data-ocid": "tawthiq_pending.row",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            type: "button",
            onClick: () => setExpanded((v) => !v),
            className: "flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors",
            "data-ocid": "tawthiq_pending.expand_button",
            "aria-expanded": expanded,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold text-foreground truncate", children: business.businessName }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-muted-foreground font-mono", children: [
                    "CAC: ",
                    business.cacNumber
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-2", children: [
                  verdictBadge(tawthiq == null ? void 0 : tawthiq.creditReadinessVerdict),
                  shariaFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-amber-600 dark:text-amber-400", children: [
                    shariaFlags.length,
                    " Shariah flag",
                    shariaFlags.length !== 1 ? "s" : ""
                  ] }),
                  inconsistencyFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-destructive", children: [
                    inconsistencyFlags.length,
                    " inconsistenc",
                    inconsistencyFlags.length !== 1 ? "ies" : "y"
                  ] })
                ] })
              ] }),
              expanded ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronUp, { className: "h-4 w-4 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "h-4 w-4 shrink-0 text-muted-foreground" })
            ]
          }
        ),
        expanded && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-t border-border/50 px-5 py-4 space-y-5 bg-background", children: [
          (tawthiq == null ? void 0 : tawthiq.narrativeSummary) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5", children: "Narrative Summary" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-foreground leading-relaxed", children: tawthiq.narrativeSummary })
          ] }),
          shariaFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2", children: [
              "Shariah Flags (",
              shariaFlags.length,
              ")"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-1.5", children: shariaFlags.map((f) => /* @__PURE__ */ jsxRuntimeExports.jsx(ShariaFlagRow, { flag: f }, f.indicator)) })
          ] }),
          inconsistencyFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2", children: [
              "Inconsistencies (",
              inconsistencyFlags.length,
              ")"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-lg border border-border/50 overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-border/50 bg-muted/30", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left text-xs font-semibold text-muted-foreground", children: "Field" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left text-xs font-semibold text-muted-foreground", children: "Declared" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left text-xs font-semibold text-muted-foreground", children: "Verified" })
              ] }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { className: "divide-y divide-border/30", children: inconsistencyFlags.map((f) => /* @__PURE__ */ jsxRuntimeExports.jsx(InconsistencyRow, { flag: f }, f.field)) })
            ] }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(AppealsSection, { businessUserId: business.userId }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "label",
              {
                htmlFor: `note-${business.userId.toString()}`,
                className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block",
                children: "Admin Note"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Textarea,
              {
                id: `note-${business.userId.toString()}`,
                value: noteText,
                onChange: (e) => setNoteText(e.target.value),
                placeholder: "Add review notes for this application…",
                rows: 3,
                className: "resize-none text-sm",
                "data-ocid": "tawthiq_pending.note_textarea"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                type: "button",
                size: "sm",
                className: "mt-2 gap-1.5",
                onClick: () => saveNote(),
                disabled: isSaving,
                "data-ocid": "tawthiq_pending.save_note_button",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Save, { className: "h-3.5 w-3.5" }),
                  isSaving ? "Saving…" : "Save Note"
                ]
              }
            )
          ] })
        ] })
      ]
    }
  );
}
function AdminTawthiqPendingPage() {
  const [page, setPage] = reactExports.useState(1);
  const { actor, isFetching } = useBackend();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tawthiq", "pending", page],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getTawthiqPendingReviews(BigInt(page), BigInt(PAGE_SIZE));
    },
    enabled: !!actor && !isFetching
  });
  const totalPages = data ? Math.max(1, Math.ceil(Number(data.totalCount) / PAGE_SIZE)) : 1;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AdminLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Pending Reviews",
        subtitle: "Tawthiq (التوثيق) — Applications requiring admin attention"
      }
    ),
    isError && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive",
        "data-ocid": "tawthiq_pending.error_state",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { className: "h-4 w-4 shrink-0" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Failed to load pending reviews." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: () => refetch(),
              className: "ml-auto underline underline-offset-2 hover:no-underline",
              "data-ocid": "tawthiq_pending.retry_button",
              children: "Retry"
            }
          )
        ]
      }
    ),
    isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", "data-ocid": "tawthiq_pending.loading_state", children: ["s1", "s2", "s3", "s4", "s5"].map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-[72px] w-full rounded-xl" }, k)) }),
    !isLoading && data && data.items.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
      Card,
      {
        className: "border-border/50",
        "data-ocid": "tawthiq_pending.empty_state",
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex flex-col items-center gap-3 py-16 text-center", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(FileSearch, { className: "h-10 w-10 text-muted-foreground/50" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground", children: "No pending reviews" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "All applications have been reviewed." })
        ] })
      }
    ),
    !isLoading && data && data.items.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", "data-ocid": "tawthiq_pending.list", children: data.items.map((business) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        PendingRow,
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
  AdminTawthiqPendingPage as default
};
