const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-CPnZ4-ee.js","assets/index-R6qPL6fG.css"])))=>i.map(i=>d[i]);
import { r as reactExports, aF as useDirection, aA as useControllableState, j as jsxRuntimeExports, az as Primitive, aG as useId, aH as Root, aI as Item, aC as composeEventHandlers, aJ as createRovingFocusGroupScope, aE as createContextScope, ay as Presence, y as cn, g as useBackend, A as useQueryClient, aK as useSearch, n as useQuery, D as useMutation, E as AdminLayout, P as PageHeader, ak as Search, b as Button, Y as X, v as Skeleton, C as Card, e as CardContent, aa as TriangleAlert, O as RegistrationStatus, l as ue, _ as __vitePreload, aq as KycStatus, B as Badge, o as ChevronDown, i as Separator, p as Shield, q as Link2, f as CircleCheck, ab as Scale, G as Dialog, J as DialogContent, K as DialogHeader, M as DialogTitle, h as Label, I as Input, N as DialogFooter, s as CircleX, H as HalalComplianceStatus, R as RiskLevel__1, ah as Variant_conditionalReady_notReady_ready } from "./index-CPnZ4-ee.js";
import { M as MizanScoresCard } from "./MizanScoresCard-N8FPY3Kp.js";
import { P as Pagination } from "./Pagination-CELRZ_t0.js";
import { T as TawthiqStatusCard } from "./TawthiqStatusCard-ZZWvtEOt.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-C-qTt0dW.js";
import { B as Building2 } from "./building-2-CxKUCXUo.js";
import { U as User } from "./user--fZ_EEDP.js";
import { M as MessageSquare } from "./message-square-B7hLhon-.js";
import { C as ChevronUp } from "./chevron-up-C9u-2erU.js";
import { C as CircleDot } from "./circle-dot-D5vDNc64.js";
import { T as TrendingUp } from "./trending-up-BbF36D2u.js";
import { C as Clock } from "./clock-BRCXs4iw.js";
import "./index-CBpXODzm.js";
import "./refresh-cw-LvkTVX9-.js";
import "./textarea-DWu_HpBl.js";
import "./index-C6Eg3qxK.js";
var TABS_NAME = "Tabs";
var [createTabsContext] = createContextScope(TABS_NAME, [
  createRovingFocusGroupScope
]);
var useRovingFocusGroupScope = createRovingFocusGroupScope();
var [TabsProvider, useTabsContext] = createTabsContext(TABS_NAME);
var Tabs$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeTabs,
      value: valueProp,
      onValueChange,
      defaultValue,
      orientation = "horizontal",
      dir,
      activationMode = "automatic",
      ...tabsProps
    } = props;
    const direction = useDirection(dir);
    const [value, setValue] = useControllableState({
      prop: valueProp,
      onChange: onValueChange,
      defaultProp: defaultValue ?? "",
      caller: TABS_NAME
    });
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      TabsProvider,
      {
        scope: __scopeTabs,
        baseId: useId(),
        value,
        onValueChange: setValue,
        orientation,
        dir: direction,
        activationMode,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Primitive.div,
          {
            dir: direction,
            "data-orientation": orientation,
            ...tabsProps,
            ref: forwardedRef
          }
        )
      }
    );
  }
);
Tabs$1.displayName = TABS_NAME;
var TAB_LIST_NAME = "TabsList";
var TabsList$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeTabs, loop = true, ...listProps } = props;
    const context = useTabsContext(TAB_LIST_NAME, __scopeTabs);
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeTabs);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Root,
      {
        asChild: true,
        ...rovingFocusGroupScope,
        orientation: context.orientation,
        dir: context.dir,
        loop,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Primitive.div,
          {
            role: "tablist",
            "aria-orientation": context.orientation,
            ...listProps,
            ref: forwardedRef
          }
        )
      }
    );
  }
);
TabsList$1.displayName = TAB_LIST_NAME;
var TRIGGER_NAME = "TabsTrigger";
var TabsTrigger$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeTabs, value, disabled = false, ...triggerProps } = props;
    const context = useTabsContext(TRIGGER_NAME, __scopeTabs);
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeTabs);
    const triggerId = makeTriggerId(context.baseId, value);
    const contentId = makeContentId(context.baseId, value);
    const isSelected = value === context.value;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Item,
      {
        asChild: true,
        ...rovingFocusGroupScope,
        focusable: !disabled,
        active: isSelected,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Primitive.button,
          {
            type: "button",
            role: "tab",
            "aria-selected": isSelected,
            "aria-controls": contentId,
            "data-state": isSelected ? "active" : "inactive",
            "data-disabled": disabled ? "" : void 0,
            disabled,
            id: triggerId,
            ...triggerProps,
            ref: forwardedRef,
            onMouseDown: composeEventHandlers(props.onMouseDown, (event) => {
              if (!disabled && event.button === 0 && event.ctrlKey === false) {
                context.onValueChange(value);
              } else {
                event.preventDefault();
              }
            }),
            onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
              if ([" ", "Enter"].includes(event.key)) context.onValueChange(value);
            }),
            onFocus: composeEventHandlers(props.onFocus, () => {
              const isAutomaticActivation = context.activationMode !== "manual";
              if (!isSelected && !disabled && isAutomaticActivation) {
                context.onValueChange(value);
              }
            })
          }
        )
      }
    );
  }
);
TabsTrigger$1.displayName = TRIGGER_NAME;
var CONTENT_NAME = "TabsContent";
var TabsContent = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeTabs, value, forceMount, children, ...contentProps } = props;
    const context = useTabsContext(CONTENT_NAME, __scopeTabs);
    const triggerId = makeTriggerId(context.baseId, value);
    const contentId = makeContentId(context.baseId, value);
    const isSelected = value === context.value;
    const isMountAnimationPreventedRef = reactExports.useRef(isSelected);
    reactExports.useEffect(() => {
      const rAF = requestAnimationFrame(() => isMountAnimationPreventedRef.current = false);
      return () => cancelAnimationFrame(rAF);
    }, []);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Presence, { present: forceMount || isSelected, children: ({ present }) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      Primitive.div,
      {
        "data-state": isSelected ? "active" : "inactive",
        "data-orientation": context.orientation,
        role: "tabpanel",
        "aria-labelledby": triggerId,
        hidden: !present,
        id: contentId,
        tabIndex: 0,
        ...contentProps,
        ref: forwardedRef,
        style: {
          ...props.style,
          animationDuration: isMountAnimationPreventedRef.current ? "0s" : void 0
        },
        children: present && children
      }
    ) });
  }
);
TabsContent.displayName = CONTENT_NAME;
function makeTriggerId(baseId, value) {
  return `${baseId}-trigger-${value}`;
}
function makeContentId(baseId, value) {
  return `${baseId}-content-${value}`;
}
var Root2 = Tabs$1;
var List = TabsList$1;
var Trigger = TabsTrigger$1;
function Tabs({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Root2,
    {
      "data-slot": "tabs",
      className: cn("flex flex-col gap-2", className),
      ...props
    }
  );
}
function TabsList({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    List,
    {
      "data-slot": "tabs-list",
      className: cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      ),
      ...props
    }
  );
}
function TabsTrigger({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Trigger,
    {
      "data-slot": "tabs-trigger",
      className: cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      ),
      ...props
    }
  );
}
const PAGE_SIZE = 20;
function allowedTransitions(status) {
  switch (status) {
    case RegistrationStatus.pending:
      return [{ label: "Start Review", next: RegistrationStatus.underReview }];
    case RegistrationStatus.underReview:
      return [
        {
          label: "Mark Financing-Ready",
          next: RegistrationStatus.financingReady
        },
        { label: "Reject", next: RegistrationStatus.rejected, danger: true }
      ];
    case RegistrationStatus.financingReady:
      return [
        { label: "Approve", next: RegistrationStatus.approved },
        { label: "Reject", next: RegistrationStatus.rejected, danger: true }
      ];
    default:
      return [];
  }
}
function statusBadgeClass(status) {
  switch (status) {
    case RegistrationStatus.approved:
      return "bg-primary/10 text-primary border-primary/25 dark:bg-primary/20";
    case RegistrationStatus.financingReady:
      return "bg-accent/10 text-accent-foreground border-accent/25 dark:bg-accent/20";
    case RegistrationStatus.underReview:
      return "bg-chart-4/10 text-foreground border-chart-4/25";
    case RegistrationStatus.rejected:
      return "bg-destructive/10 text-destructive border-destructive/25";
    default:
      return "bg-muted text-muted-foreground";
  }
}
function kycStatusIcon(verified) {
  return verified ? /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-3.5 w-3.5 text-primary" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(CircleX, { className: "h-3.5 w-3.5 text-destructive" });
}
function riskBadge(risk) {
  const cls = risk === RiskLevel__1.low ? "bg-primary/10 text-primary" : risk === RiskLevel__1.medium ? "bg-chart-2/10 text-chart-2" : risk === RiskLevel__1.high ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-medium ${cls}`, children: risk });
}
function halalBadge(status) {
  const cls = status === HalalComplianceStatus.compliant ? "bg-primary/10 text-primary" : status === HalalComplianceStatus.flagged ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-medium ${cls}`, children: status });
}
function creditReadinessBadge(verdict) {
  const isReady = verdict === Variant_conditionalReady_notReady_ready.ready || verdict === "ready";
  const isConditional = verdict === Variant_conditionalReady_notReady_ready.conditionalReady || verdict === "conditionalReady";
  const cls = isReady ? "bg-primary/10 text-primary border-primary/25" : isConditional ? "bg-chart-3/10 text-foreground border-chart-3/25" : "bg-destructive/10 text-destructive border-destructive/25";
  const label = isReady ? "Ready" : isConditional ? "Conditional" : "Not Ready";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "outline", className: cls, children: label });
}
function RejectDialog({
  businessName,
  open,
  onClose,
  onConfirm,
  isPending
}) {
  const [reason, setReason] = reactExports.useState("");
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Dialog,
    {
      open,
      onOpenChange: (o) => {
        if (!o) {
          setReason("");
          onClose();
        }
      },
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { className: "sm:max-w-md", "data-ocid": "admin.reject_dialog", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogTitle, { className: "font-display", children: [
            "Reject ",
            businessName,
            "?"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Are you sure you want to reject this applicant? This action will send a WhatsApp notification with your reason." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 py-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "reject-reason", children: "Rejection Reason (required)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Input,
            {
              id: "reject-reason",
              placeholder: "e.g. Insufficient financial history",
              value: reason,
              onChange: (e) => setReason(e.target.value),
              autoFocus: true,
              "data-ocid": "admin.reject_dialog.reason_input"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogFooter, { className: "gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              type: "button",
              variant: "outline",
              onClick: () => {
                setReason("");
                onClose();
              },
              disabled: isPending,
              "data-ocid": "admin.reject_dialog.cancel_button",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              type: "button",
              variant: "destructive",
              disabled: !reason.trim() || isPending,
              onClick: () => {
                if (reason.trim()) onConfirm(reason.trim());
              },
              "data-ocid": "admin.reject_dialog.confirm_button",
              children: isPending ? "Rejecting…" : "Confirm Reject"
            }
          )
        ] })
      ] })
    }
  );
}
function BusinessRow({
  biz,
  idx,
  onReject,
  onAdvance,
  isPending
}) {
  var _a;
  const [expanded, setExpanded] = reactExports.useState(false);
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const transitions = allowedTransitions(biz.registrationStatus);
  const hasScores = biz.scoringRecord.financingReadinessScore > 0n;
  const mizanQuery = useQuery({
    queryKey: ["mizan_result", biz.userId.toString()],
    queryFn: async () => {
      if (!actor) return null;
      const actorAny = actor;
      if (typeof actorAny.getMizanResult !== "function") return null;
      const result = await actorAny.getMizanResult(biz.userId.toString());
      if (!result) return null;
      if ("ok" in result) return result.ok;
      return null;
    },
    enabled: !!actor && expanded
  });
  const retriggerMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const actorAny = actor;
      if (typeof actorAny.triggerMizanAnalysis !== "function")
        throw new Error("triggerMizanAnalysis not available");
      const res = await actorAny.triggerMizanAnalysis(
        biz.userId.toString()
      );
      if ("err" in res) throw new Error(res.err);
      return res.ok;
    },
    onSuccess: () => {
      ue.success("Mizan analysis re-triggered");
      queryClient.invalidateQueries({
        queryKey: ["mizan_result", biz.userId.toString()]
      });
    },
    onError: (err) => ue.error(
      err instanceof Error ? err.message : "Failed to re-trigger Mizan analysis"
    )
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Card,
    {
      className: "transition-smooth hover:border-primary/30",
      "data-ocid": `admin.business.item.${idx}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-center justify-between gap-3 py-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-4 w-4 shrink-0 text-muted-foreground" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "truncate text-sm font-semibold text-foreground", children: biz.businessName }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
                biz.businessType,
                " · ",
                biz.phoneNumber
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "span",
              {
                className: biz.kycRecord.kycStatus === KycStatus.Verified ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary" : biz.kycRecord.kycStatus === KycStatus.Failed ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive" : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground",
                "data-ocid": `admin.business.kyc_status.${idx}`,
                children: [
                  "KYC: ",
                  biz.kycRecord.kycStatus
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Badge,
              {
                variant: "outline",
                className: statusBadgeClass(biz.registrationStatus),
                "data-ocid": `admin.business.status_badge.${idx}`,
                children: biz.registrationStatus
              }
            ),
            transitions.map(
              (t) => t.danger ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  size: "sm",
                  variant: "destructive",
                  disabled: isPending,
                  onClick: () => onReject(biz.userId.toString(), biz.businessName),
                  "data-ocid": `admin.business.reject_button.${idx}`,
                  children: t.label
                },
                t.next
              ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  size: "sm",
                  variant: "outline",
                  disabled: isPending,
                  onClick: () => onAdvance(biz.userId.toString(), t.next),
                  "data-ocid": `admin.business.advance_button.${idx}`,
                  children: t.label
                },
                t.next
              )
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Button,
              {
                size: "sm",
                variant: "ghost",
                type: "button",
                onClick: () => setExpanded((v) => !v),
                "aria-label": expanded ? "Collapse" : "Expand",
                "data-ocid": `admin.business.expand_button.${idx}`,
                children: expanded ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronUp, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "h-4 w-4" })
              }
            )
          ] })
        ] }),
        expanded && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "grid gap-6 pb-5 pt-4 sm:grid-cols-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": `admin.business.kyc_detail.${idx}`, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "h-3.5 w-3.5" }),
                " KYC Verification"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-1.5", children: [
                ["BVN", biz.kycRecord.bvnVerified],
                ["NIN", biz.kycRecord.ninVerified],
                ["CAC", biz.kycRecord.cacVerified],
                ["TIN", biz.kycRecord.tinVerified],
                ["Watchlist Clear", biz.kycRecord.watchlistClean]
              ].map(([label, val]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-center gap-2 text-sm", children: [
                kycStatusIcon(val),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-foreground", children: label })
              ] }, label)) }),
              biz.kycRecord.creditScore > 0n && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-2 text-xs text-muted-foreground", children: [
                "Credit score:",
                " ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: biz.kycRecord.creditScore.toString() })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": `admin.business.bank_link_detail.${idx}`, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Link2, { className: "h-3.5 w-3.5" }),
                " Bank Account"
              ] }),
              biz.bankLinkRecord.status.__kind__ === "Linked" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "flex items-center gap-1 text-sm text-primary", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-3.5 w-3.5" }),
                  " Linked"
                ] }),
                biz.bankLinkRecord.institutionName && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: biz.bankLinkRecord.institutionName }),
                biz.bankLinkRecord.balance !== void 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
                  "Balance: ",
                  biz.bankLinkRecord.currency ?? "NGN",
                  " ",
                  (_a = biz.bankLinkRecord.balance) == null ? void 0 : _a.toString()
                ] })
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "flex items-center gap-1 text-sm text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(CircleDot, { className: "h-3.5 w-3.5" }),
                " Not linked"
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": `admin.business.ai_scores_detail.${idx}`, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(TrendingUp, { className: "h-3.5 w-3.5" }),
                " AI Scores"
              ] }),
              hasScores ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Financing Readiness" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-lg font-bold text-primary", children: [
                    biz.scoringRecord.financingReadinessScore.toString(),
                    "%"
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Halal Compliance" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-lg font-bold text-foreground", children: [
                      biz.scoringRecord.halalComplianceScore.toString(),
                      "%"
                    ] }),
                    halalBadge(biz.halalComplianceStatus)
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Risk Level" }),
                  riskBadge(biz.riskLevel)
                ] }),
                biz.scoringRecord.scoringNotes && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: biz.scoringRecord.scoringNotes })
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Not scored yet" })
            ] })
          ] }),
          biz.mizanDivergenceAlert && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "py-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-300/60 dark:border-amber-700/50", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-3.5 w-3.5" }),
              "Score Divergence — Preliminary and full Mizan scores differ significantly"
            ] }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            CardContent,
            {
              className: "pb-5 pt-4",
              "data-ocid": `admin.business.tawthiq_detail.${idx}`,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-3.5 w-3.5" }),
                  " Tawthiq — Verification & Compliance"
                ] }),
                biz.tawthiqRecord ? /* @__PURE__ */ jsxRuntimeExports.jsx(TawthiqStatusCard, { tawthiqRecord: biz.tawthiqRecord }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: "flex items-center gap-2 rounded-md bg-muted/40 px-4 py-3 text-sm text-muted-foreground",
                    "data-ocid": `admin.business.tawthiq_pending.${idx}`,
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-4 w-4 shrink-0 animate-pulse" }),
                      "Tawthiq analysis pending…"
                    ]
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            CardContent,
            {
              className: "pb-5 pt-4",
              "data-ocid": `admin.business.mizan_detail.${idx}`,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TrendingUp, { className: "h-3.5 w-3.5" }),
                  " Mizan (الميزان) — Risk & Underwriting"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  MizanScoresCard,
                  {
                    mizan: mizanQuery.data ?? null,
                    isLoading: mizanQuery.isLoading,
                    isAdmin: true,
                    onRetrigger: () => retriggerMutation.mutate()
                  }
                )
              ]
            }
          )
        ] })
      ]
    }
  );
}
const FINANCING_PURPOSE_LABELS = {
  homePurchase: "Home Purchase",
  vehicle: "Vehicle",
  education: "Education",
  medical: "Medical",
  startupCapital: "Startup Capital",
  other: "Other"
};
function IndividualRow({
  summary,
  idx,
  onChangeStatus,
  onMarkReady,
  isPending
}) {
  const [expanded, setExpanded] = reactExports.useState(false);
  const { actor } = useBackend();
  const id = summary.id ?? summary.userId;
  const idStr = (id == null ? void 0 : id.toString()) ?? "";
  const detailQuery = useQuery({
    queryKey: ["admin_individual_detail", idStr],
    queryFn: async () => {
      if (!actor || !idStr) return null;
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      const res = await actor.adminGetIndividual(Principal.fromText(idStr));
      if ("__kind__" in res) {
        if (res.__kind__ === "ok")
          return res.ok;
        return null;
      }
      return null;
    },
    enabled: !!actor && expanded && !!idStr
  });
  const detail = detailQuery.data;
  const tawthiq = (detail == null ? void 0 : detail.tawthiqRecord) ?? null;
  const mizan = (detail == null ? void 0 : detail.mizanRecord) ?? null;
  const kyc = (detail == null ? void 0 : detail.kycRecord) ?? null;
  const transitions = allowedTransitions(summary.registrationStatus);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Card,
    {
      className: "transition-smooth hover:border-primary/30",
      "data-ocid": `admin.individual.item.${idx}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-center justify-between gap-3 py-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "h-4 w-4 shrink-0 text-muted-foreground" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "truncate text-sm font-semibold text-foreground", children: summary.fullName }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
                FINANCING_PURPOSE_LABELS[summary.financingPurpose] ?? summary.financingPurpose,
                " · ",
                "₦",
                Number(summary.amountSought).toLocaleString()
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "span",
              {
                className: summary.riskLevel === RiskLevel__1.low ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary" : summary.riskLevel === RiskLevel__1.medium ? "rounded-full bg-chart-2/10 px-2 py-0.5 text-xs text-chart-2" : summary.riskLevel === RiskLevel__1.pending ? "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground" : "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive",
                "data-ocid": `admin.individual.risk_badge.${idx}`,
                children: summary.riskLevel
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Badge,
              {
                variant: "outline",
                className: statusBadgeClass(summary.registrationStatus),
                "data-ocid": `admin.individual.status_badge.${idx}`,
                children: summary.registrationStatus
              }
            ),
            transitions.map(
              (t) => t.danger ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  size: "sm",
                  variant: "destructive",
                  type: "button",
                  disabled: isPending,
                  onClick: () => onChangeStatus(idStr, t.next),
                  "data-ocid": `admin.individual.reject_button.${idx}`,
                  children: t.label
                },
                t.next
              ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  size: "sm",
                  variant: "outline",
                  type: "button",
                  disabled: isPending,
                  onClick: () => onChangeStatus(idStr, t.next),
                  "data-ocid": `admin.individual.advance_button.${idx}`,
                  children: t.label
                },
                t.next
              )
            ),
            summary.registrationStatus === RegistrationStatus.financingReady && /* @__PURE__ */ jsxRuntimeExports.jsx(
              Button,
              {
                size: "sm",
                variant: "default",
                type: "button",
                disabled: isPending,
                onClick: () => onMarkReady(idStr),
                "data-ocid": `admin.individual.mark_ready_button.${idx}`,
                children: "Mark Financing-Ready"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Button,
              {
                size: "sm",
                variant: "ghost",
                type: "button",
                onClick: () => setExpanded((v) => !v),
                "aria-label": expanded ? "Collapse" : "Expand",
                "data-ocid": `admin.individual.expand_button.${idx}`,
                children: expanded ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronUp, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "h-4 w-4" })
              }
            )
          ] })
        ] }),
        expanded && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
          detailQuery.isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "py-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-48" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-64" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-40" })
          ] }) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "grid gap-6 pb-5 pt-4 sm:grid-cols-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": `admin.individual.kyc_detail.${idx}`, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "h-3.5 w-3.5" }),
                " KYC Verification"
              ] }),
              kyc ? /* @__PURE__ */ jsxRuntimeExports.jsxs("ul", { className: "space-y-1.5", children: [
                [
                  ["BVN", kyc.bvnVerified],
                  ["NIN", kyc.ninVerified],
                  ["Watchlist Clear", kyc.watchlistClean]
                ].map(([label, val]) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "li",
                  {
                    className: "flex items-center gap-2 text-sm",
                    children: [
                      kycStatusIcon(val),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-foreground", children: label })
                    ]
                  },
                  label
                )),
                kyc.creditScore > 0n && /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "text-xs text-muted-foreground", children: [
                  "Credit score:",
                  " ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: kyc.creditScore.toString() })
                ] })
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "KYC data unavailable" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": `admin.individual.tawthiq_detail.${idx}`, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-3.5 w-3.5" }),
                " Tawthiq Summary"
              ] }),
              tawthiq ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: "Credit Readiness:" }),
                  creditReadinessBadge(tawthiq.creditReadiness)
                ] }),
                tawthiq.shariaFlags && tawthiq.shariaFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-destructive", children: [
                  tawthiq.shariaFlags.length,
                  " Sharia flag",
                  tawthiq.shariaFlags.length > 1 ? "s" : ""
                ] }),
                tawthiq.narrativeSummary && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground line-clamp-3", children: tawthiq.narrativeSummary })
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-3.5 w-3.5 animate-pulse" }),
                " Pending…"
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": `admin.individual.mizan_detail.${idx}`, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(TrendingUp, { className: "h-3.5 w-3.5" }),
                " Mizan Summary"
              ] }),
              mizan ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Overall Score" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-lg font-bold text-primary", children: Number(mizan.overallScore ?? 0) })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Risk Level" }),
                  riskBadge(mizan.riskLevel)
                ] }),
                mizan.narrativeSummary && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground line-clamp-3", children: mizan.narrativeSummary })
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-3.5 w-3.5 animate-pulse" }),
                " Pending…"
              ] })
            ] })
          ] })
        ] })
      ]
    }
  );
}
function IndividualApplicantsTab() {
  var _a, _b;
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const [page, setPage] = reactExports.useState(1);
  const [search, setSearch] = reactExports.useState("");
  const [statusFilter, setStatusFilter] = reactExports.useState("all");
  const [purposeFilter, setPurposeFilter] = reactExports.useState("all");
  const individualsQuery = useQuery({
    queryKey: ["admin_individuals_list", page],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0 };
      const res = await actor.adminListIndividuals(
        BigInt(page),
        BigInt(PAGE_SIZE)
      );
      if ("__kind__" in res && res.__kind__ === "ok") {
        const data = res.ok;
        return { items: data.items ?? [], total: Number(data.total ?? 0) };
      }
      return { items: [], total: 0 };
    },
    enabled: !!actor,
    placeholderData: (prev) => prev
  });
  const changeStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status
    }) => {
      if (!actor) throw new Error("Not connected");
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      const res = await actor.adminChangeIndividualStatus(
        Principal.fromText(id),
        status
      );
      if ("__kind__" in res && res.__kind__ === "err")
        throw new Error(res.err);
    },
    onSuccess: () => {
      ue.success("Status updated", { duration: 4e3 });
      queryClient.invalidateQueries({ queryKey: ["admin_individuals_list"] });
    },
    onError: (err) => ue.error(
      err instanceof Error ? err.message : "Failed to update status"
    )
  });
  const markReadyMutation = useMutation({
    mutationFn: async (id) => {
      if (!actor) throw new Error("Not connected");
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      const res = await actor.adminSetIndividualFinancingReady(
        Principal.fromText(id)
      );
      if ("__kind__" in res && res.__kind__ === "err")
        throw new Error(res.err);
    },
    onSuccess: () => {
      ue.success("Marked as financing-ready", { duration: 4e3 });
      queryClient.invalidateQueries({ queryKey: ["admin_individuals_list"] });
    },
    onError: (err) => ue.error(err instanceof Error ? err.message : "Failed to mark ready")
  });
  const allItems = ((_a = individualsQuery.data) == null ? void 0 : _a.items) ?? [];
  const total = ((_b = individualsQuery.data) == null ? void 0 : _b.total) ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const normalizedSearch = search.toLowerCase();
  const filtered = reactExports.useMemo(() => {
    return allItems.filter((ind) => {
      if (normalizedSearch && !ind.fullName.toLowerCase().includes(normalizedSearch))
        return false;
      if (statusFilter !== "all" && ind.registrationStatus !== statusFilter)
        return false;
      if (purposeFilter !== "all" && ind.financingPurpose !== purposeFilter)
        return false;
      return true;
    });
  }, [allItems, normalizedSearch, statusFilter, purposeFilter]);
  const hasFilters = !!normalizedSearch || statusFilter !== "all" || purposeFilter !== "all";
  const isPending = changeStatusMutation.isPending || markReadyMutation.isPending;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex flex-wrap items-center gap-3",
        "data-ocid": "admin.individuals.filters_bar",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex-1 min-w-[200px]", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                placeholder: "Search by name…",
                value: search,
                onChange: (e) => {
                  setSearch(e.target.value);
                  setPage(1);
                },
                className: "h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring",
                "data-ocid": "admin.individuals.search_input"
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Select,
            {
              value: statusFilter,
              onValueChange: (v) => {
                setStatusFilter(v);
                setPage(1);
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  SelectTrigger,
                  {
                    className: "w-44",
                    "data-ocid": "admin.individuals.status_filter",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Status" })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "all", children: "All Status" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: RegistrationStatus.pending, children: "Pending" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: RegistrationStatus.underReview, children: "Under Review" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: RegistrationStatus.financingReady, children: "Financing Ready" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: RegistrationStatus.approved, children: "Approved" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: RegistrationStatus.rejected, children: "Rejected" })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Select,
            {
              value: purposeFilter,
              onValueChange: (v) => {
                setPurposeFilter(v);
                setPage(1);
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  SelectTrigger,
                  {
                    className: "w-44",
                    "data-ocid": "admin.individuals.purpose_filter",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Purpose" })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "all", children: "All Purposes" }),
                  Object.entries(FINANCING_PURPOSE_LABELS).map(([k, v]) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: k, children: v }, k))
                ] })
              ]
            }
          ),
          hasFilters && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              variant: "ghost",
              size: "sm",
              type: "button",
              onClick: () => {
                setSearch("");
                setStatusFilter("all");
                setPurposeFilter("all");
                setPage(1);
              },
              className: "gap-1.5 text-muted-foreground hover:text-foreground",
              "data-ocid": "admin.individuals.clear_filters_button",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-3.5 w-3.5" }),
                " Clear"
              ]
            }
          )
        ]
      }
    ),
    individualsQuery.isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: ["a", "b", "c"].map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-14 w-full rounded-xl" }, k)) }) : filtered.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      CardContent,
      {
        className: "py-12 text-center text-sm text-muted-foreground",
        "data-ocid": "admin.individuals.empty_state",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "mx-auto mb-3 h-10 w-10 text-muted-foreground/40" }),
          hasFilters ? "No individuals match the current filters." : "No individual applicants registered yet."
        ]
      }
    ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: filtered.map((ind, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      IndividualRow,
      {
        summary: ind,
        idx: i + 1,
        onChangeStatus: (id, next) => changeStatusMutation.mutate({ id, status: next }),
        onMarkReady: (id) => markReadyMutation.mutate(id),
        isPending
      },
      ind.id ? String(ind.id) : ind.fullName
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      Pagination,
      {
        currentPage: page,
        totalPages,
        onPageChange: (p) => setPage(p),
        isLoading: individualsQuery.isFetching
      }
    ),
    hasFilters && filtered.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex items-center gap-2 text-xs text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-3.5 w-3.5" }),
      "Showing ",
      filtered.length,
      " of ",
      allItems.length,
      " on this page"
    ] })
  ] });
}
function AdminApplicantsPage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const searchParams = useSearch({ strict: false });
  const search = searchParams;
  const [activeTab, setActiveTab] = reactExports.useState(
    (search == null ? void 0 : search.tab) === "individuals" ? "individuals" : "businesses"
  );
  const [currentPage, setCurrentPage] = reactExports.useState(1);
  const [searchText, setSearchText] = reactExports.useState("");
  const [kycStatusFilter, setKycStatusFilter] = reactExports.useState("all");
  const [financingReadyFilter, setFinancingReadyFilter] = reactExports.useState("all");
  const [riskLevelFilter, setRiskLevelFilter] = reactExports.useState("all");
  const [rejectTarget, setRejectTarget] = reactExports.useState(null);
  const businessesQuery = useQuery({
    queryKey: ["admin_businesses", currentPage],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
      const actorAny = actor;
      if (typeof actorAny.adminListBusinessesPaginated === "function") {
        return actorAny.adminListBusinessesPaginated(
          BigInt(currentPage),
          BigInt(PAGE_SIZE)
        );
      }
      const page = await actor.adminListBusinesses(
        BigInt(currentPage),
        BigInt(PAGE_SIZE)
      );
      return {
        items: page.items ?? [],
        total: Number(page.total ?? 0n),
        page: currentPage,
        pageSize: PAGE_SIZE
      };
    },
    enabled: !!actor,
    placeholderData: (prev) => prev
  });
  const statusMutation = useMutation({
    mutationFn: async ({
      userId,
      status,
      reason
    }) => {
      if (!actor) throw new Error("Not connected");
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      const actorAny = actor;
      if (reason && typeof actorAny.updateBusinessStatusWithReason === "function") {
        return actorAny.updateBusinessStatusWithReason(
          Principal.fromText(userId),
          status,
          reason
        );
      }
      return actor.updateBusinessStatus(
        Principal.fromText(userId),
        status,
        null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_businesses"] });
      ue.success("Status updated", {
        icon: /* @__PURE__ */ jsxRuntimeExports.jsx(MessageSquare, { className: "h-4 w-4 text-primary" }),
        duration: 5e3
      });
    },
    onError: (err) => ue.error(
      err instanceof Error ? err.message : "Failed to update status"
    )
  });
  const pageData = businessesQuery.data;
  const allPageBusinesses = (pageData == null ? void 0 : pageData.items) ?? [];
  const totalBusinesses = Number((pageData == null ? void 0 : pageData.total) ?? allPageBusinesses.length);
  const totalPages = Math.max(1, Math.ceil(totalBusinesses / PAGE_SIZE));
  const normalizedSearch = searchText.toLowerCase();
  const filteredBusinesses = reactExports.useMemo(() => {
    return allPageBusinesses.filter((b) => {
      if (normalizedSearch && !b.businessName.toLowerCase().includes(normalizedSearch) && !b.phoneNumber.toLowerCase().includes(normalizedSearch) && !b.cacNumber.toLowerCase().includes(normalizedSearch))
        return false;
      if (kycStatusFilter !== "all" && b.kycRecord.kycStatus !== kycStatusFilter)
        return false;
      if (financingReadyFilter === "yes" && !b.financingReady) return false;
      if (financingReadyFilter === "no" && b.financingReady) return false;
      if (riskLevelFilter !== "all" && b.riskLevel.toLowerCase() !== riskLevelFilter.toLowerCase())
        return false;
      return true;
    });
  }, [
    allPageBusinesses,
    normalizedSearch,
    kycStatusFilter,
    financingReadyFilter,
    riskLevelFilter
  ]);
  const hasFilters = normalizedSearch || kycStatusFilter !== "all" || financingReadyFilter !== "all" || riskLevelFilter !== "all";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(AdminLayout, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-6xl px-4 py-10", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        PageHeader,
        {
          title: "Applicants",
          subtitle: "Review and manage business and individual applicant status, KYC results, and AI scores.",
          breadcrumbs: [
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Applicants" }
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Tabs,
        {
          value: activeTab,
          onValueChange: (v) => setActiveTab(v),
          className: "mb-6",
          children: /* @__PURE__ */ jsxRuntimeExports.jsxs(TabsList, { "data-ocid": "admin.applicants.tab_switcher", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              TabsTrigger,
              {
                value: "businesses",
                className: "gap-2",
                "data-ocid": "admin.applicants.businesses_tab",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-4 w-4" }),
                  "Business Applicants"
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              TabsTrigger,
              {
                value: "individuals",
                className: "gap-2",
                "data-ocid": "admin.applicants.individuals_tab",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "h-4 w-4" }),
                  "Individual Applicants"
                ]
              }
            )
          ] })
        }
      ),
      activeTab === "businesses" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "mb-4 flex flex-wrap items-center gap-3",
            "data-ocid": "admin.applicants.filters_bar",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex-1 min-w-[200px]", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    type: "text",
                    placeholder: "Search by name, phone, or CAC…",
                    value: searchText,
                    onChange: (e) => {
                      setSearchText(e.target.value);
                      setCurrentPage(1);
                    },
                    className: "h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring",
                    "data-ocid": "admin.applicants.search_input"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Select,
                {
                  value: kycStatusFilter,
                  onValueChange: (v) => {
                    setKycStatusFilter(v);
                    setCurrentPage(1);
                  },
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      SelectTrigger,
                      {
                        className: "w-40",
                        "data-ocid": "admin.applicants.kyc_status_filter",
                        children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "KYC Status" })
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: [
                      "all",
                      "Pending",
                      "InProgress",
                      "Verified",
                      "Failed"
                    ].map((v) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: v, children: v === "all" ? "All KYC" : v }, v)) })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Select,
                {
                  value: financingReadyFilter,
                  onValueChange: (v) => {
                    setFinancingReadyFilter(v);
                    setCurrentPage(1);
                  },
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      SelectTrigger,
                      {
                        className: "w-40",
                        "data-ocid": "admin.applicants.financing_ready_filter",
                        children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Financing Ready" })
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "all", children: "All Ready Status" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "yes", children: "Ready" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "no", children: "Not Ready" })
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Select,
                {
                  value: riskLevelFilter,
                  onValueChange: (v) => {
                    setRiskLevelFilter(v);
                    setCurrentPage(1);
                  },
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      SelectTrigger,
                      {
                        className: "w-36",
                        "data-ocid": "admin.applicants.risk_level_filter",
                        children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Risk Level" })
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "all", children: "All Risk" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "low", children: "Low" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "medium", children: "Medium" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "high", children: "High" })
                    ] })
                  ]
                }
              ),
              hasFilters && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Button,
                {
                  variant: "ghost",
                  size: "sm",
                  type: "button",
                  onClick: () => {
                    setSearchText("");
                    setKycStatusFilter("all");
                    setFinancingReadyFilter("all");
                    setRiskLevelFilter("all");
                    setCurrentPage(1);
                  },
                  className: "gap-1.5 text-muted-foreground hover:text-foreground",
                  "data-ocid": "admin.applicants.clear_filters_button",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-3.5 w-3.5" }),
                    " Clear Filters"
                  ]
                }
              )
            ]
          }
        ),
        businessesQuery.isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: ["a", "b", "c"].map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-14 w-full rounded-xl" }, k)) }) : filteredBusinesses.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          CardContent,
          {
            className: "py-12 text-center text-sm text-muted-foreground",
            "data-ocid": "admin.applicants.empty_state",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "mx-auto mb-3 h-10 w-10 text-muted-foreground/40" }),
              hasFilters ? "No businesses match the current filters." : "No business applicants registered yet."
            ]
          }
        ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: filteredBusinesses.map((biz, idx) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          BusinessRow,
          {
            biz,
            idx: idx + 1,
            onReject: (userId, name) => setRejectTarget({ userId, name }),
            onAdvance: (userId, next) => statusMutation.mutate({ userId, status: next }),
            isPending: statusMutation.isPending
          },
          biz.userId.toString()
        )) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Pagination,
          {
            currentPage,
            totalPages,
            onPageChange: (p) => setCurrentPage(p),
            isLoading: businessesQuery.isFetching
          }
        ),
        hasFilters && filteredBusinesses.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex items-center gap-2 text-xs text-muted-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-3.5 w-3.5" }),
          "Showing ",
          filteredBusinesses.length,
          " of",
          " ",
          allPageBusinesses.length,
          " on this page"
        ] })
      ] }),
      activeTab === "individuals" && /* @__PURE__ */ jsxRuntimeExports.jsx(IndividualApplicantsTab, {})
    ] }),
    rejectTarget && /* @__PURE__ */ jsxRuntimeExports.jsx(
      RejectDialog,
      {
        businessName: rejectTarget.name,
        open: !!rejectTarget,
        onClose: () => setRejectTarget(null),
        onConfirm: (reason) => {
          statusMutation.mutate(
            {
              userId: rejectTarget.userId,
              status: RegistrationStatus.rejected,
              reason
            },
            { onSettled: () => setRejectTarget(null) }
          );
        },
        isPending: statusMutation.isPending
      }
    )
  ] });
}
export {
  AdminApplicantsPage as default
};
