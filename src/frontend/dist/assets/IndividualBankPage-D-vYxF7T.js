import { v as createLucideIcon, g as useBackend, D as useQueryClient, n as useQuery, V as RegistrationStatus, E as useMutation, j as jsxRuntimeExports, P as PageHeader, Q as TriangleAlert, b as Button, af as RefreshCw, C as Card, e as CardContent, w as Skeleton, c as CardHeader, d as CardTitle, f as CircleCheck, ah as LoaderCircle, B as Badge, L as Lock, l as ue } from "./index-DiwSGmNR.js";
import { I as IndividualLayout } from "./IndividualLayout-qouIDf8N.js";
import { B as Banknote } from "./banknote-BBqTpavX.js";
import { C as CreditCard } from "./credit-card-CXB9DyZH.js";
import { I as Info } from "./info-xit6tx8b.js";
import "./use-user-role-DlEe0uPV.js";
import "./user-BQRpN4aJ.js";
import "./message-circle-C1jDekiM.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
  ["path", { d: "M10 14 21 3", key: "gplh6r" }],
  ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", key: "a6xqqp" }]
];
const ExternalLink = createLucideIcon("external-link", __iconNode);
function IndividualBankPage() {
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
  const isLoading = profileQuery.isLoading;
  const isFinancingReady = (profile == null ? void 0 : profile.registrationStatus) === RegistrationStatus.financingReady || (profile == null ? void 0 : profile.registrationStatus) === RegistrationStatus.approved;
  const bankStatus = profile == null ? void 0 : profile.bankLinkStatus;
  const isLinked = (bankStatus == null ? void 0 : bankStatus.__kind__) === "Linked";
  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const result = await actor.requestIndividualBankLink();
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: (url) => {
      queryClient.invalidateQueries({ queryKey: ["individual_profile"] });
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (err) => ue.error(
      err instanceof Error ? err.message : "Failed to initiate bank link."
    )
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(IndividualLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-6 space-y-6 max-w-2xl", "data-ocid": "individual_bank.page", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Bank Account Linking",
        subtitle: "Link your bank account via Mono to unlock your full Mizan assessment.",
        breadcrumbs: [{ label: "Bank Linking" }]
      }
    ),
    profileQuery.isError && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3",
        "data-ocid": "individual_bank.error_state",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 shrink-0 text-destructive" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: "Failed to load profile." }),
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
              "data-ocid": "individual_bank.retry_button",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
                "Retry"
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      Card,
      {
        className: "border-[var(--individual-accent,oklch(0.65_0.18_60))]/20 bg-[var(--individual-accent,oklch(0.65_0.18_60))]/5",
        "data-ocid": "individual_bank.info_card",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "pt-5", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Banknote, { className: "h-5 w-5 shrink-0 mt-0.5 text-[var(--individual-accent,oklch(0.65_0.18_60))]" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-foreground", children: "Why link your bank account?" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground leading-relaxed", children: "Linking your bank account via Mono allows Mizan (الميزان) to run a full underwriting assessment using your real transaction history — analysing income stability, debt behaviour, and repayment capacity." })
          ] })
        ] }) })
      }
    ),
    isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "pt-5 space-y-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-5 w-40" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-9 w-52" })
    ] }) }) : isLinked ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_bank.linked_state", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 text-base", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-4 w-4 text-emerald-500" }),
        "Bank Account Linked"
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "space-y-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-300 dark:border-emerald-700 px-3 py-2.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-4 w-4 text-emerald-600 dark:text-emerald-400" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-emerald-700 dark:text-emerald-300", children: "Your bank account is successfully linked." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Mizan will now run a full assessment using your verified transaction history. Check your Assessment Scores page for updated results." })
      ] })
    ] }) : (bankStatus == null ? void 0 : bankStatus.__kind__) === "LinkFailed" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
      Card,
      {
        className: "border-destructive/30",
        "data-ocid": "individual_bank.link_failed_state",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 text-base text-destructive", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4" }),
            "Bank Linking Failed"
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "space-y-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: bankStatus.LinkFailed }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                type: "button",
                className: "gap-2 bg-[var(--individual-accent,oklch(0.65_0.18_60))] text-white hover:opacity-90",
                onClick: () => linkMutation.mutate(),
                disabled: linkMutation.isPending,
                "data-ocid": "individual_bank.retry_link_button",
                children: [
                  linkMutation.isPending ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-4 w-4" }),
                  "Try Again"
                ]
              }
            )
          ] })
        ]
      }
    ) : isFinancingReady ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_bank.link_prompt_card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 text-base", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CreditCard, { className: "h-4 w-4 text-primary" }),
        "Link Your Bank Account"
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "space-y-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30", children: "Financing Ready" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Your account has been cleared for bank linking." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Click below to securely connect your bank account through Mono. You will be redirected to your bank's authentication page." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            type: "button",
            className: "gap-2 bg-[var(--individual-accent,oklch(0.65_0.18_60))] text-white hover:opacity-90",
            onClick: () => linkMutation.mutate(),
            disabled: linkMutation.isPending,
            "data-ocid": "individual_bank.link_button",
            children: [
              linkMutation.isPending ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ExternalLink, { className: "h-4 w-4" }),
              linkMutation.isPending ? "Opening Mono Connect…" : "Link Your Bank Account"
            ]
          }
        )
      ] })
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx(
      Card,
      {
        className: "border-dashed",
        "data-ocid": "individual_bank.locked_state",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "pt-6 pb-6", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center text-center gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-full bg-muted p-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "h-5 w-5 text-muted-foreground" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground", children: "Bank Linking Locked" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground max-w-xs", children: "Your account must be marked financing-ready by our review team before you can link your bank account." })
          ] })
        ] }) })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3",
        "data-ocid": "individual_bank.security_note",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Info, { className: "h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Your bank credentials are never stored on Vetify. Mono provides secure, consent-based read-only access to your financial data." })
        ]
      }
    )
  ] }) });
}
export {
  IndividualBankPage as default
};
