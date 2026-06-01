import { g as useBackend, D as useQueryClient, r as reactExports, n as useQuery, at as KycStatus, V as RegistrationStatus, j as jsxRuntimeExports, Q as TriangleAlert, b as Button, af as RefreshCw, C as Card, e as CardContent, w as Skeleton, B as Badge, c as CardHeader, d as CardTitle, S as ShieldCheck, ah as LoaderCircle, ae as Scale, au as Variant_full_preliminary, f as CircleCheck, t as CircleX, aj as Variant_conditionalReady_notReady_ready } from "./index-DiwSGmNR.js";
import { I as IndividualLayout } from "./IndividualLayout-qouIDf8N.js";
import { P as ProfilePhotoUpload } from "./ProfilePhotoUpload-ByNGbYlk.js";
import { B as BrainCircuit, C as CreditCard } from "./credit-card-CXB9DyZH.js";
import "./use-user-role-DlEe0uPV.js";
import "./user-BQRpN4aJ.js";
import "./message-circle-C1jDekiM.js";
function registrationLabel(status) {
  switch (status) {
    case RegistrationStatus.pending:
      return {
        label: "Pending Review",
        className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
      };
    case RegistrationStatus.underReview:
      return {
        label: "Under Review",
        className: "bg-blue-500/15 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30"
      };
    case RegistrationStatus.kycInProgress:
      return {
        label: "KYC In Progress",
        className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
      };
    case RegistrationStatus.financingReady:
      return {
        label: "Financing Ready",
        className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
      };
    case RegistrationStatus.approved:
      return {
        label: "Approved",
        className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
      };
    case RegistrationStatus.rejected:
      return { label: "Rejected", className: "" };
    default:
      return { label: "Pending", className: "" };
  }
}
function kycCheckRow(label, ok, ocid) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between py-1.5", "data-ocid": ocid, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-foreground", children: label }),
    ok ? /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-4 w-4 text-emerald-500" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(CircleX, { className: "h-4 w-4 text-muted-foreground" })
  ] });
}
function verdictConfig(verdict) {
  switch (verdict) {
    case Variant_conditionalReady_notReady_ready.ready:
      return {
        label: "Credit Ready",
        className: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
      };
    case Variant_conditionalReady_notReady_ready.conditionalReady:
      return {
        label: "Conditional",
        className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
      };
    case Variant_conditionalReady_notReady_ready.notReady:
      return { label: "Not Ready", className: "" };
    default:
      return { label: "Pending", className: "" };
  }
}
function IndividualDashboard() {
  var _a, _b, _c;
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
  const photoQuery = useQuery({
    queryKey: ["individual_photo", (_a = profile == null ? void 0 : profile.id) == null ? void 0 : _a.toString()],
    queryFn: async () => {
      if (!actor || !(profile == null ? void 0 : profile.id)) return null;
      return actor.getProfilePhoto(profile.id);
    },
    enabled: !!actor && !!(profile == null ? void 0 : profile.id)
  });
  const isLoading = profileQuery.isLoading || photoQuery.isLoading;
  const isError = profileQuery.isError;
  const tawthiqDone = !!((_b = profile == null ? void 0 : profile.tawthiqRecord) == null ? void 0 : _b.completedAt);
  const kycStatus = ((_c = profile == null ? void 0 : profile.kycRecord) == null ? void 0 : _c.kycStatus) ?? KycStatus.Pending;
  const needsPolling = kycStatus === KycStatus.InProgress || kycStatus === KycStatus.Pending || !tawthiqDone;
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
  const regStatusBadge = profile ? registrationLabel(profile.registrationStatus) : null;
  const kyc = (profile == null ? void 0 : profile.kycRecord) ?? null;
  const tawthiq = (profile == null ? void 0 : profile.tawthiqRecord) ?? null;
  const mizan = (profile == null ? void 0 : profile.mizanRecord) ?? null;
  const isFinancingReady = (profile == null ? void 0 : profile.registrationStatus) === RegistrationStatus.financingReady || (profile == null ? void 0 : profile.registrationStatus) === RegistrationStatus.approved;
  const bankLinked = (profile == null ? void 0 : profile.bankLinkStatus.__kind__) === "Linked";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(IndividualLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "p-6 space-y-6 max-w-4xl",
      "data-ocid": "individual_dashboard.page",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-display text-2xl font-bold text-foreground", children: "My Dashboard" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Your financing readiness overview" })
        ] }),
        isError && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3",
            "data-ocid": "individual_dashboard.error_state",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 shrink-0 text-destructive" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: "Failed to load your profile." }),
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
                  "data-ocid": "individual_dashboard.retry_button",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
                    "Retry"
                  ]
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { "data-ocid": "individual_dashboard.status_card", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "pt-5", children: isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-5 w-40" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-56" })
        ] }) : profile ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              ProfilePhotoUpload,
              {
                userId: profile.id.toString(),
                displayName: profile.fullName,
                currentPhotoUrl: photoQuery.data ?? void 0,
                size: "md"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-display text-lg font-semibold text-foreground", children: profile.fullName }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [
                "Registered",
                " ",
                new Date(
                  Number(profile.createdAt) / 1e6
                ).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })
              ] })
            ] })
          ] }),
          regStatusBadge && /* @__PURE__ */ jsxRuntimeExports.jsx(
            Badge,
            {
              className: regStatusBadge.className,
              "data-ocid": "individual_dashboard.status_badge",
              children: regStatusBadge.label
            }
          )
        ] }) : null }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_dashboard.kyc_card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheck, { className: "h-4 w-4 text-primary" }),
            "KYC Verification"
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: isLoading || needsPolling && !kyc ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground py-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
            "Verifying your information…"
          ] }) : kyc ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "divide-y divide-border", children: [
            kycCheckRow(
              "BVN Verified",
              kyc.bvnVerified,
              "individual_dashboard.kyc_bvn"
            ),
            kycCheckRow(
              "NIN Verified",
              kyc.ninVerified,
              "individual_dashboard.kyc_nin"
            ),
            kycCheckRow(
              "Watchlist Clean",
              kyc.watchlistClean,
              "individual_dashboard.kyc_watchlist"
            )
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground py-2", children: "KYC checks have not started yet." }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_dashboard.tawthiq_card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(BrainCircuit, { className: "h-4 w-4 text-primary" }),
            "Tawthiq",
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-normal text-muted-foreground", children: "(التوثيق)" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-5 w-32" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-full" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-3/4" })
          ] }) : !tawthiq ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground py-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
            "Assessment in progress…"
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
            (() => {
              const vc = verdictConfig(tawthiq.creditReadiness);
              return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-muted-foreground", children: "Credit Readiness:" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Badge,
                  {
                    className: vc.className,
                    "data-ocid": "individual_dashboard.tawthiq_verdict_badge",
                    children: vc.label
                  }
                )
              ] });
            })(),
            tawthiq.shariaFlags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                className: "rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 space-y-1",
                "data-ocid": "individual_dashboard.tawthiq_flags",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold text-amber-800 dark:text-amber-300", children: "Shariah Flags" }),
                  tawthiq.shariaFlags.map((flag) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "div",
                    {
                      className: "flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-3.5 w-3.5 mt-0.5 shrink-0" }),
                        flag
                      ]
                    },
                    flag
                  ))
                ]
              }
            ),
            tawthiq.narrativeSummary && /* @__PURE__ */ jsxRuntimeExports.jsx(
              "p",
              {
                className: "text-sm text-muted-foreground leading-relaxed",
                "data-ocid": "individual_dashboard.tawthiq_narrative",
                children: tawthiq.narrativeSummary
              }
            )
          ] }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_dashboard.mizan_card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-4 w-4 text-primary" }),
              "Mizan",
              " ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-normal text-muted-foreground", children: "(الميزان)" })
            ] }),
            mizan && /* @__PURE__ */ jsxRuntimeExports.jsx(
              Badge,
              {
                className: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 text-xs",
                "data-ocid": "individual_dashboard.mizan_stage_badge",
                children: mizan.stage === Variant_full_preliminary.preliminary ? "Preliminary" : "Full Assessment"
              }
            )
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-5 w-32" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-2 w-full" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-2 w-full" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-2 w-full" })
          ] }) : !mizan ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground py-2", children: "Mizan assessment will be available after KYC verification completes." }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
            [
              [
                "Income Stability",
                Number(mizan.incomeStabilityScore),
                "individual_dashboard.mizan_income"
              ],
              [
                "Debt Behaviour",
                Number(mizan.debtBehaviorScore),
                "individual_dashboard.mizan_debt"
              ],
              [
                "Repayment Capacity",
                Number(mizan.repaymentCapacityScore),
                "individual_dashboard.mizan_repayment"
              ]
            ].map(([label, score, ocid]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": ocid, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between text-xs mb-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: label }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: score })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-1.5 w-full rounded-full bg-muted overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "h-full rounded-full bg-[var(--individual-accent,oklch(0.65_0.18_60))] transition-all duration-700",
                  style: { width: `${Math.min(score, 100)}%` },
                  role: "progressbar",
                  tabIndex: 0,
                  "aria-valuenow": score,
                  "aria-valuemin": 0,
                  "aria-valuemax": 100,
                  "aria-label": label
                }
              ) })
            ] }, ocid)),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between pt-1", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-muted-foreground", children: "Overall Score" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-bold text-lg text-foreground", children: Number(mizan.overallScore) })
            ] }),
            mizan.stage === Variant_full_preliminary.preliminary && /* @__PURE__ */ jsxRuntimeExports.jsx(
              "p",
              {
                className: "text-xs text-muted-foreground border-t border-border pt-2",
                "data-ocid": "individual_dashboard.mizan_preliminary_note",
                children: "Full assessment available after bank account is linked."
              }
            )
          ] }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_dashboard.bank_section", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(CreditCard, { className: "h-4 w-4 text-primary" }),
            "Bank Account"
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-9 w-48" }) : bankLinked ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400",
              "data-ocid": "individual_dashboard.bank_linked_state",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-4 w-4" }),
                "Bank account linked successfully."
              ]
            }
          ) : isFinancingReady ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Link your bank account via Mono to unlock your full Mizan assessment." }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                type: "button",
                className: "gap-2 bg-[var(--individual-accent,oklch(0.65_0.18_60))] text-white hover:opacity-90",
                onClick: () => {
                  window.location.href = "/individual/bank";
                },
                "data-ocid": "individual_dashboard.bank_link_button",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(CreditCard, { className: "h-4 w-4" }),
                  "Link Bank Account"
                ]
              }
            )
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx(
            "p",
            {
              className: "text-sm text-muted-foreground",
              "data-ocid": "individual_dashboard.bank_locked_state",
              children: "Your account must be marked financing-ready by our review team before you can link your bank."
            }
          ) })
        ] })
      ]
    }
  ) });
}
export {
  IndividualDashboard as default
};
