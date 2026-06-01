import { g as useBackend, D as useQueryClient, r as reactExports, n as useQuery, at as KycStatus, V as RegistrationStatus, j as jsxRuntimeExports, P as PageHeader, C as Card, c as CardHeader, d as CardTitle, S as ShieldCheck, ah as LoaderCircle, e as CardContent, w as Skeleton, B as Badge, z as cn, b as Button, af as RefreshCw, t as CircleX, f as CircleCheck } from "./index-DiwSGmNR.js";
import { I as IndividualLayout } from "./IndividualLayout-qouIDf8N.js";
import { I as Info } from "./info-xit6tx8b.js";
import { C as CircleAlert } from "./circle-alert-Dpw3PZDg.js";
import { C as Clock } from "./clock-BRirAh28.js";
import "./use-user-role-DlEe0uPV.js";
import "./user-BQRpN4aJ.js";
import "./credit-card-CXB9DyZH.js";
import "./message-circle-C1jDekiM.js";
function CheckStateIcon({ state }) {
  switch (state) {
    case "verified":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-5 w-5 text-emerald-500 dark:text-emerald-400" });
    case "failed":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(CircleX, { className: "h-5 w-5 text-destructive" });
    default:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Clock, { className: "h-5 w-5 text-muted-foreground animate-pulse" });
  }
}
function CheckStateBadge({ state }) {
  switch (state) {
    case "verified":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 text-xs", children: "Verified" });
    case "failed":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "destructive", className: "text-xs", children: "Failed" });
    default:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "secondary", className: "text-xs", children: "Pending" });
  }
}
function boolToState(val) {
  return val ? "verified" : "failed";
}
function creditScoreInterpretation(score) {
  if (score >= 700)
    return {
      label: "Excellent",
      className: "text-emerald-600 dark:text-emerald-400"
    };
  if (score >= 580)
    return {
      label: "Good",
      className: "text-emerald-600 dark:text-emerald-400"
    };
  if (score >= 450)
    return { label: "Fair", className: "text-amber-600 dark:text-amber-400" };
  if (score > 0)
    return {
      label: "Below Average",
      className: "text-red-600 dark:text-red-400"
    };
  return { label: "Not Available", className: "text-muted-foreground" };
}
function IndividualKycPage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const pollingRef = reactExports.useRef(null);
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
  const kyc = (profile == null ? void 0 : profile.kycRecord) ?? null;
  const kycStatus = (kyc == null ? void 0 : kyc.kycStatus) ?? KycStatus.Pending;
  const needsPolling = (profile == null ? void 0 : profile.registrationStatus) === RegistrationStatus.kycInProgress || kycStatus === KycStatus.InProgress || kycStatus === KycStatus.Pending;
  reactExports.useEffect(() => {
    if (needsPolling && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        void queryClient.invalidateQueries({
          queryKey: ["individual_profile"]
        });
      }, 3e3);
    } else if (!needsPolling && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [needsPolling, queryClient]);
  const isLoading = profileQuery.isLoading;
  const creditScore = kyc ? Number(kyc.creditScore) : 0;
  const creditInterp = creditScoreInterpretation(creditScore);
  const checks = kyc ? [
    {
      label: "BVN Verification",
      state: boolToState(kyc.bvnVerified),
      description: "Bank Verification Number",
      note: "Your BVN is confirmed with NIBSS to verify your banking identity and ensure no adverse financial records.",
      ocid: "individual_kyc.bvn_check"
    },
    {
      label: "NIN Verification",
      state: boolToState(kyc.ninVerified),
      description: "National Identification Number",
      note: "Your NIN is verified with NIMC to confirm your national identity, date of birth, and address.",
      ocid: "individual_kyc.nin_check"
    },
    {
      label: "Watchlist Screening",
      state: kyc.watchlistClean ? "verified" : "failed",
      description: "Financial sanctions & fraud check",
      note: "Your identity is screened against national and international financial crime watchlists for any adverse matches.",
      ocid: "individual_kyc.watchlist_check"
    }
  ] : [];
  return /* @__PURE__ */ jsxRuntimeExports.jsx(IndividualLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-6 space-y-6 max-w-3xl", "data-ocid": "individual_kyc.page", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "KYC Verification",
        subtitle: "Identity and compliance checks run automatically via Mono.",
        breadcrumbs: [{ label: "KYC Status" }]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_kyc.status_card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheck, { className: "h-4 w-4 text-primary" }),
          "Verification Status"
        ] }),
        needsPolling && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin" }),
          "Verifying…"
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-5 w-32" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
        kycStatus === KycStatus.Verified && /* @__PURE__ */ jsxRuntimeExports.jsx(
          Badge,
          {
            className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
            "data-ocid": "individual_kyc.status_badge",
            children: "KYC Verified"
          }
        ),
        kycStatus === KycStatus.Failed && /* @__PURE__ */ jsxRuntimeExports.jsx(
          Badge,
          {
            variant: "destructive",
            "data-ocid": "individual_kyc.status_badge",
            children: "KYC Failed"
          }
        ),
        (kycStatus === KycStatus.InProgress || kycStatus === KycStatus.Pending) && /* @__PURE__ */ jsxRuntimeExports.jsx(
          Badge,
          {
            className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
            "data-ocid": "individual_kyc.status_badge",
            children: "In Progress"
          }
        )
      ] }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: isLoading ? [1, 2, 3].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "pt-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-5 w-48 mb-2" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-full" })
    ] }) }, i)) : checks.map((check) => /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { "data-ocid": check.ocid, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "pt-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3 min-w-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CheckStateIcon, { state: check.state }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-sm text-foreground", children: check.label }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: check.description })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(CheckStateBadge, { state: check.state })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Info, { className: "h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: check.note })
      ] })
    ] }) }, check.ocid)) }),
    kyc && creditScore > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_kyc.credit_score_card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 text-base", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { className: "h-4 w-4 text-primary" }),
        "Credit Score"
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-baseline gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-display text-3xl font-bold text-foreground", children: creditScore }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              className: cn("text-sm font-medium", creditInterp.className),
              children: creditInterp.label
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-xs text-muted-foreground", children: "Your credit score is derived from your BVN-linked financial history. A higher score improves your financing readiness." })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3",
        "data-ocid": "individual_kyc.info_note",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Info, { className: "h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "KYC verification is automated via Mono. If any check fails, please contact our review team for assistance." })
        ]
      }
    ),
    profileQuery.isError && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      Button,
      {
        type: "button",
        variant: "outline",
        size: "sm",
        className: "gap-1.5",
        onClick: () => queryClient.invalidateQueries({
          queryKey: ["individual_profile"]
        }),
        "data-ocid": "individual_kyc.retry_button",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
          "Retry"
        ]
      }
    )
  ] }) });
}
export {
  IndividualKycPage as default
};
