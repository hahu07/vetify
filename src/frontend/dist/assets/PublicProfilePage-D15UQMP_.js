import { v as createLucideIcon, aO as useParams, Z as useActor, r as reactExports, j as jsxRuntimeExports, x as Link, w as Skeleton, f as CircleCheck, B as Badge, ad as createActor } from "./index-DiwSGmNR.js";
import { A as ArrowLeft } from "./arrow-left-BJTB5Y2P.js";
import { T as TrendingUp } from "./trending-up-BRtYxp1l.js";
import { T as TrendingDown } from "./trending-down-CGf3mZQH.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [["path", { d: "M5 12h14", key: "1ays0h" }]];
const Minus = createLucideIcon("minus", __iconNode);
const purposeLabels = {
  homePurchase: "Home Purchase",
  vehicle: "Vehicle",
  education: "Education",
  medical: "Medical",
  startupCapital: "Startup Capital",
  other: "Other"
};
const instrumentLabels = {
  murabaha: "Murabaha",
  musharakah: "Musharakah",
  mudarabah: "Mudarabah",
  ijarah: "Ijarah",
  istisna: "Istisna",
  salam: "Salam",
  other: "Other"
};
const statusConfig = {
  financingReady: { label: "Financing Ready", variant: "default" },
  underReview: { label: "Under Review", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  pending: { label: "Pending", variant: "outline" },
  rejected: { label: "Not Eligible", variant: "destructive" },
  kycInProgress: { label: "KYC In Progress", variant: "secondary" }
};
function formatNGN(amount) {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}
function RiskIcon({ score }) {
  const n = Number(score);
  if (n >= 70) return /* @__PURE__ */ jsxRuntimeExports.jsx(TrendingUp, { className: "h-4 w-4 text-green-600" });
  if (n >= 40) return /* @__PURE__ */ jsxRuntimeExports.jsx(Minus, { className: "h-4 w-4 text-yellow-600" });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(TrendingDown, { className: "h-4 w-4 text-red-600" });
}
function riskLabel(score) {
  const n = Number(score);
  if (n >= 70) return "Low Risk";
  if (n >= 40) return "Moderate Risk";
  return "Higher Risk";
}
function PublicProfilePage() {
  const { id } = useParams({ strict: false });
  const { actor, isFetching } = useActor(createActor);
  const [profile, setProfile] = reactExports.useState(void 0);
  const [loading, setLoading] = reactExports.useState(true);
  reactExports.useEffect(() => {
    if (!actor || isFetching) return;
    let cancelled = false;
    setLoading(true);
    actor.get_public_profile(id).then((result) => {
      if (!cancelled) {
        setProfile(result ?? null);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [actor, isFetching, id]);
  const statusCfg = profile ? statusConfig[profile.registrationStatus] ?? {
    label: profile.registrationStatus,
    variant: "outline"
  } : null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-h-screen bg-background", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "sticky top-0 z-40 border-b border-border bg-card shadow-sm", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto flex h-14 max-w-3xl items-center justify-between px-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Link,
        {
          to: "/",
          className: "flex items-center gap-2 text-primary hover:text-primary/80 transition-colors",
          "data-ocid": "public_profile.back_home_link",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowLeft, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-medium", children: "Back to Home" })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-display text-lg font-bold tracking-tight text-primary", children: "Vetify" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "mx-auto max-w-3xl px-4 py-10", children: loading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", "data-ocid": "public_profile.loading_state", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-8 w-48" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-64" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-32 w-full" })
    ] }) : profile === null ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex flex-col items-center py-24 text-center",
        "data-ocid": "public_profile.empty_state",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-4 rounded-full bg-muted p-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-8 w-8 text-muted-foreground" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-xl font-semibold text-foreground", children: "Profile Not Found" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 max-w-sm text-sm text-muted-foreground", children: "This profile is not yet public or does not exist. If you believe this is an error, please contact the applicant directly." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Link,
            {
              to: "/",
              className: "mt-6 text-sm text-primary hover:underline",
              "data-ocid": "public_profile.go_home_link",
              children: "Return to Vetify home"
            }
          )
        ]
      }
    ) : profile ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-xl border border-border bg-card p-6", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-display text-2xl font-bold text-foreground", children: profile.fullName }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: [
            purposeLabels[profile.financingPurpose] ?? profile.financingPurpose,
            " ",
            "Financing"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-end gap-2", children: [
          statusCfg && /* @__PURE__ */ jsxRuntimeExports.jsx(
            Badge,
            {
              variant: statusCfg.variant,
              "data-ocid": "public_profile.status_badge",
              children: statusCfg.label
            }
          ),
          profile.registrationStatus === "financingReady" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary",
              "data-ocid": "public_profile.verified_badge",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-3 w-3" }),
                "Verified by Vetify"
              ]
            }
          )
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-border bg-card p-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold uppercase tracking-widest text-muted-foreground", children: "Preferred Instrument" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-base font-medium text-foreground", children: instrumentLabels[profile.preferredInstrument] ?? profile.preferredInstrument })
        ] }),
        profile.amountSought != null && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "rounded-xl border border-border bg-card p-4",
            "data-ocid": "public_profile.amount_sought_card",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold uppercase tracking-widest text-muted-foreground", children: "Amount Sought" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-base font-medium text-foreground", children: formatNGN(profile.amountSought) })
            ]
          }
        ),
        profile.monthlyIncome != null && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "rounded-xl border border-border bg-card p-4",
            "data-ocid": "public_profile.monthly_income_card",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold uppercase tracking-widest text-muted-foreground", children: "Monthly Income" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-base font-medium text-foreground", children: formatNGN(profile.monthlyIncome) })
            ]
          }
        ),
        profile.mizanScore != null && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "rounded-xl border border-border bg-card p-4",
            "data-ocid": "public_profile.mizan_score_card",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold uppercase tracking-widest text-muted-foreground", children: "Mizan Risk Score" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1 flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(RiskIcon, { score: profile.mizanScore }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-base font-medium text-foreground", children: [
                  Number(profile.mizanScore),
                  "/100"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-sm text-muted-foreground", children: [
                  "(",
                  riskLabel(profile.mizanScore),
                  ")"
                ] })
              ] })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "text-foreground", children: "About this profile:" }),
        " ",
        "This profile has been verified by Vetify's AI-powered vetting process. Displayed fields are controlled by the applicant's privacy settings."
      ] })
    ] }) : null }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("footer", { className: "mt-16 border-t border-border bg-muted/40 py-6", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-auto max-w-3xl px-4 text-center", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
      "© ",
      (/* @__PURE__ */ new Date()).getFullYear(),
      ". Built with love using",
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "a",
        {
          href: `https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "vetify")}`,
          target: "_blank",
          rel: "noopener noreferrer",
          className: "text-primary hover:underline",
          children: "caffeine.ai"
        }
      )
    ] }) }) })
  ] });
}
export {
  PublicProfilePage as default
};
