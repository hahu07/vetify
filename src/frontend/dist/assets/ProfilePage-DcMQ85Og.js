const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-CPnZ4-ee.js","assets/index-R6qPL6fG.css"])))=>i.map(i=>d[i]);
import { j as jsxRuntimeExports, aL as Root, r as reactExports, aB as useComposedRefs, aM as WarningProvider, aN as Content, aC as composeEventHandlers, aO as Title, aP as Description, aQ as Close, aR as createDialogScope, aS as Portal, aT as Overlay, aU as createSlottable, aE as createContextScope, aV as Trigger, y as cn, aW as buttonVariants, aX as useParams, g as useBackend, a as useRouter, n as useQuery, F as FullPageLoader, E as AdminLayout, P as PageHeader, b as Button, B as Badge, S as ShieldCheck, C as Card, c as CardHeader, d as CardTitle, e as CardContent, aa as TriangleAlert, l as ue, _ as __vitePreload } from "./index-CPnZ4-ee.js";
import { S as StatusCard } from "./StatusCard-CCnc1WpH.js";
import { U as UploadStatus, R as RiskLevel, H as HalalComplianceStatus } from "./index-CBpXODzm.js";
import { P as Pencil } from "./pencil-ClwGYYG1.js";
import { T as TrendingUp } from "./trending-up-BbF36D2u.js";
import { B as Building2 } from "./building-2-CxKUCXUo.js";
import { F as FileText } from "./file-text-DN4Xb49N.js";
import "./clock-BRCXs4iw.js";
var ROOT_NAME = "AlertDialog";
var [createAlertDialogContext] = createContextScope(ROOT_NAME, [
  createDialogScope
]);
var useDialogScope = createDialogScope();
var AlertDialog$1 = (props) => {
  const { __scopeAlertDialog, ...alertDialogProps } = props;
  const dialogScope = useDialogScope(__scopeAlertDialog);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Root, { ...dialogScope, ...alertDialogProps, modal: true });
};
AlertDialog$1.displayName = ROOT_NAME;
var TRIGGER_NAME = "AlertDialogTrigger";
var AlertDialogTrigger = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAlertDialog, ...triggerProps } = props;
    const dialogScope = useDialogScope(__scopeAlertDialog);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Trigger, { ...dialogScope, ...triggerProps, ref: forwardedRef });
  }
);
AlertDialogTrigger.displayName = TRIGGER_NAME;
var PORTAL_NAME = "AlertDialogPortal";
var AlertDialogPortal$1 = (props) => {
  const { __scopeAlertDialog, ...portalProps } = props;
  const dialogScope = useDialogScope(__scopeAlertDialog);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Portal, { ...dialogScope, ...portalProps });
};
AlertDialogPortal$1.displayName = PORTAL_NAME;
var OVERLAY_NAME = "AlertDialogOverlay";
var AlertDialogOverlay$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAlertDialog, ...overlayProps } = props;
    const dialogScope = useDialogScope(__scopeAlertDialog);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Overlay, { ...dialogScope, ...overlayProps, ref: forwardedRef });
  }
);
AlertDialogOverlay$1.displayName = OVERLAY_NAME;
var CONTENT_NAME = "AlertDialogContent";
var [AlertDialogContentProvider, useAlertDialogContentContext] = createAlertDialogContext(CONTENT_NAME);
var Slottable = createSlottable("AlertDialogContent");
var AlertDialogContent$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAlertDialog, children, ...contentProps } = props;
    const dialogScope = useDialogScope(__scopeAlertDialog);
    const contentRef = reactExports.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, contentRef);
    const cancelRef = reactExports.useRef(null);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      WarningProvider,
      {
        contentName: CONTENT_NAME,
        titleName: TITLE_NAME,
        docsSlug: "alert-dialog",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogContentProvider, { scope: __scopeAlertDialog, cancelRef, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Content,
          {
            role: "alertdialog",
            ...dialogScope,
            ...contentProps,
            ref: composedRefs,
            onOpenAutoFocus: composeEventHandlers(contentProps.onOpenAutoFocus, (event) => {
              var _a;
              event.preventDefault();
              (_a = cancelRef.current) == null ? void 0 : _a.focus({ preventScroll: true });
            }),
            onPointerDownOutside: (event) => event.preventDefault(),
            onInteractOutside: (event) => event.preventDefault(),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Slottable, { children }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(DescriptionWarning, { contentRef })
            ]
          }
        ) })
      }
    );
  }
);
AlertDialogContent$1.displayName = CONTENT_NAME;
var TITLE_NAME = "AlertDialogTitle";
var AlertDialogTitle$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAlertDialog, ...titleProps } = props;
    const dialogScope = useDialogScope(__scopeAlertDialog);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Title, { ...dialogScope, ...titleProps, ref: forwardedRef });
  }
);
AlertDialogTitle$1.displayName = TITLE_NAME;
var DESCRIPTION_NAME = "AlertDialogDescription";
var AlertDialogDescription$1 = reactExports.forwardRef((props, forwardedRef) => {
  const { __scopeAlertDialog, ...descriptionProps } = props;
  const dialogScope = useDialogScope(__scopeAlertDialog);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Description, { ...dialogScope, ...descriptionProps, ref: forwardedRef });
});
AlertDialogDescription$1.displayName = DESCRIPTION_NAME;
var ACTION_NAME = "AlertDialogAction";
var AlertDialogAction$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAlertDialog, ...actionProps } = props;
    const dialogScope = useDialogScope(__scopeAlertDialog);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Close, { ...dialogScope, ...actionProps, ref: forwardedRef });
  }
);
AlertDialogAction$1.displayName = ACTION_NAME;
var CANCEL_NAME = "AlertDialogCancel";
var AlertDialogCancel$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAlertDialog, ...cancelProps } = props;
    const { cancelRef } = useAlertDialogContentContext(CANCEL_NAME, __scopeAlertDialog);
    const dialogScope = useDialogScope(__scopeAlertDialog);
    const ref = useComposedRefs(forwardedRef, cancelRef);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Close, { ...dialogScope, ...cancelProps, ref });
  }
);
AlertDialogCancel$1.displayName = CANCEL_NAME;
var DescriptionWarning = ({ contentRef }) => {
  const MESSAGE = `\`${CONTENT_NAME}\` requires a description for the component to be accessible for screen reader users.

You can add a description to the \`${CONTENT_NAME}\` by passing a \`${DESCRIPTION_NAME}\` component as a child, which also benefits sighted users by adding visible context to the dialog.

Alternatively, you can use your own component as a description by assigning it an \`id\` and passing the same value to the \`aria-describedby\` prop in \`${CONTENT_NAME}\`. If the description is confusing or duplicative for sighted users, you can use the \`@radix-ui/react-visually-hidden\` primitive as a wrapper around your description component.

For more information, see https://radix-ui.com/primitives/docs/components/alert-dialog`;
  reactExports.useEffect(() => {
    var _a;
    const hasDescription = document.getElementById(
      (_a = contentRef.current) == null ? void 0 : _a.getAttribute("aria-describedby")
    );
    if (!hasDescription) console.warn(MESSAGE);
  }, [MESSAGE, contentRef]);
  return null;
};
var Root2 = AlertDialog$1;
var Portal2 = AlertDialogPortal$1;
var Overlay2 = AlertDialogOverlay$1;
var Content2 = AlertDialogContent$1;
var Action = AlertDialogAction$1;
var Cancel = AlertDialogCancel$1;
var Title2 = AlertDialogTitle$1;
var Description2 = AlertDialogDescription$1;
function AlertDialog({
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Root2, { "data-slot": "alert-dialog", ...props });
}
function AlertDialogPortal({
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Portal2, { "data-slot": "alert-dialog-portal", ...props });
}
function AlertDialogOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Overlay2,
    {
      "data-slot": "alert-dialog-overlay",
      className: cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      ),
      ...props
    }
  );
}
function AlertDialogContent({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogPortal, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogOverlay, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      Content2,
      {
        "data-slot": "alert-dialog-content",
        className: cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        ),
        ...props
      }
    )
  ] });
}
function AlertDialogHeader({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      "data-slot": "alert-dialog-header",
      className: cn("flex flex-col gap-2 text-center sm:text-left", className),
      ...props
    }
  );
}
function AlertDialogFooter({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      "data-slot": "alert-dialog-footer",
      className: cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      ),
      ...props
    }
  );
}
function AlertDialogTitle({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Title2,
    {
      "data-slot": "alert-dialog-title",
      className: cn("text-lg font-semibold", className),
      ...props
    }
  );
}
function AlertDialogDescription({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Description2,
    {
      "data-slot": "alert-dialog-description",
      className: cn("text-muted-foreground text-sm", className),
      ...props
    }
  );
}
function AlertDialogAction({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Action,
    {
      className: cn(buttonVariants(), className),
      ...props
    }
  );
}
function AlertDialogCancel({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Cancel,
    {
      className: cn(buttonVariants({ variant: "outline" }), className),
      ...props
    }
  );
}
function scoreToVariant(score) {
  const n = Number(score);
  if (n >= 75) return "success";
  if (n >= 50) return "warning";
  return "pending";
}
function riskToVariant(risk) {
  if (risk === RiskLevel.low) return "success";
  if (risk === RiskLevel.medium) return "warning";
  if (risk === RiskLevel.high) return "danger";
  return "pending";
}
function halalToVariant(status) {
  if (status === HalalComplianceStatus.compliant) return "success";
  if (status === HalalComplianceStatus.flagged) return "danger";
  return "pending";
}
function ProfilePage() {
  const { userId } = useParams({ from: "/admin/profile/$userId" });
  const { actor } = useBackend();
  const router = useRouter();
  const [showClosureDialog, setShowClosureDialog] = reactExports.useState(false);
  const [closureRequested, setClosureRequested] = reactExports.useState(false);
  const businessQuery = useQuery({
    queryKey: ["admin_business", userId],
    queryFn: async () => {
      if (!actor) return null;
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      return actor.adminGetBusiness(Principal.fromText(userId));
    },
    enabled: !!actor && !!userId
  });
  const docsQuery = useQuery({
    queryKey: ["user_documents", userId],
    queryFn: async () => {
      if (!actor) return [];
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      return actor.getDocumentsForUser(Principal.fromText(userId));
    },
    enabled: !!actor && !!userId
  });
  const isLoading = businessQuery.isLoading || docsQuery.isLoading;
  if (isLoading) return /* @__PURE__ */ jsxRuntimeExports.jsx(FullPageLoader, {});
  const profile = businessQuery.data;
  const docs = docsQuery.data ?? [];
  if (!profile) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(AdminLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "container mx-auto max-w-3xl px-4 py-10",
        "data-ocid": "profile.not_found_section",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(PageHeader, { title: "Applicant Profile" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-muted-foreground", children: "Profile not found for this user ID." })
        ]
      }
    ) });
  }
  const displayName = profile.businessName;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AdminLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-3xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: displayName,
        subtitle: "Business Applicant",
        breadcrumbs: [
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Profile" }
        ],
        actions: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              type: "button",
              variant: "outline",
              size: "sm",
              onClick: () => router.navigate({ to: "/business/profile" }),
              className: "gap-1.5",
              "data-ocid": "profile.edit_profile_button",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Pencil, { className: "h-4 w-4" }),
                "Edit Profile"
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Badge,
            {
              variant: "secondary",
              className: profile.financingReady ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700" : "",
              "data-ocid": "profile.financing_ready_badge",
              children: profile.financingReady ? "Financing Ready" : "Not Ready"
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("section", { className: "mb-8", "data-ocid": "profile.status_section", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-4 sm:grid-cols-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StatusCard,
        {
          icon: TrendingUp,
          label: "Readiness Score",
          value: `${Number(profile.financingReadyScore)}%`,
          variant: scoreToVariant(profile.financingReadyScore),
          "data-ocid": "profile.financing_score_card"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StatusCard,
        {
          icon: ShieldCheck,
          label: "Risk Level",
          value: profile.riskLevel.charAt(0).toUpperCase() + profile.riskLevel.slice(1),
          variant: riskToVariant(profile.riskLevel),
          "data-ocid": "profile.risk_card"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StatusCard,
        {
          icon: ShieldCheck,
          label: "Halal Compliance",
          value: profile.halalComplianceStatus.charAt(0).toUpperCase() + profile.halalComplianceStatus.slice(1),
          variant: halalToVariant(profile.halalComplianceStatus),
          "data-ocid": "profile.halal_card"
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "mb-8", "data-ocid": "profile.details_card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-5 w-5" }),
        "Business Details"
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("dl", { className: "grid gap-3 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Business Name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "mt-0.5 font-medium text-foreground", children: profile.businessName })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "CAC Number" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "mt-0.5 font-medium text-foreground", children: profile.cacNumber })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Business Type" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "mt-0.5 font-medium text-foreground", children: profile.businessType })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Annual Revenue" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("dd", { className: "mt-0.5 font-medium text-foreground", children: [
            "₦",
            Number(profile.annualRevenue).toLocaleString()
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Contact Person" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "mt-0.5 font-medium text-foreground", children: profile.contactPerson })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "sm:col-span-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: "Address" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "mt-0.5 font-medium text-foreground", children: profile.address })
        ] })
      ] }) })
    ] }),
    closureRequested && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "mb-8 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30",
        "data-ocid": "profile.closure_requested_banner",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-amber-800 dark:text-amber-300", children: [
            "Account closure requested. Our team will review your request within ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "14 days" }),
            "."
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { "data-ocid": "profile.documents_section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mb-4 font-display text-lg font-semibold text-foreground", children: "Submitted Documents" }),
      docs.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        CardContent,
        {
          className: "py-8 text-center text-sm text-muted-foreground",
          "data-ocid": "profile.documents_empty_state",
          children: "No documents submitted yet."
        }
      ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: docs.map((doc, idx) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3",
          "data-ocid": `profile.document.item.${idx + 1}`,
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(FileText, { className: "h-5 w-5 text-muted-foreground" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground capitalize", children: doc.docType.replace(/([A-Z])/g, " $1").trim() }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground capitalize", children: doc.uploadStatus })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Badge,
              {
                variant: "secondary",
                className: doc.uploadStatus === UploadStatus.uploaded ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700" : "",
                children: doc.uploadStatus === UploadStatus.uploaded ? "Uploaded" : "Pending"
              }
            )
          ]
        },
        `${doc.docType}-${idx}`
      )) })
    ] }),
    !closureRequested && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "section",
      {
        className: "mt-10 border-t border-border pt-8",
        "data-ocid": "profile.closure_section",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mb-1 font-display text-lg font-semibold text-foreground", children: "Danger Zone" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-4 text-sm text-muted-foreground", children: "Request account closure and permanent deletion of your data after a 14-day audit retention period." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              type: "button",
              variant: "destructive",
              onClick: () => setShowClosureDialog(true),
              "data-ocid": "profile.request_closure_button",
              children: "Request Account Closure"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      AlertDialog,
      {
        open: showClosureDialog,
        onOpenChange: setShowClosureDialog,
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogContent, { "data-ocid": "profile.closure_dialog", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogHeader, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogTitle, { children: "Request Account Closure?" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogDescription, { children: [
              "Are you sure you want to request account closure? Your data will be retained for ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "14 days" }),
              " for audit purposes before permanent deletion. This action cannot be undone."
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogFooter, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogCancel, { "data-ocid": "profile.closure_cancel_button", children: "Cancel" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              AlertDialogAction,
              {
                className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                onClick: async () => {
                  try {
                    if (actor) await actor.requestAccountClosure();
                    setClosureRequested(true);
                    setShowClosureDialog(false);
                    ue.success("Account closure request submitted.");
                  } catch {
                    ue.error(
                      "Failed to submit closure request. Please try again."
                    );
                  }
                },
                "data-ocid": "profile.closure_confirm_button",
                children: "Yes, Request Closure"
              }
            )
          ] })
        ] })
      }
    )
  ] }) });
}
export {
  ProfilePage as default
};
