const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-CPnZ4-ee.js","assets/index-R6qPL6fG.css"])))=>i.map(i=>d[i]);
import { g as useBackend, m as useNavigate, r as reactExports, n as useQuery, j as jsxRuntimeExports, F as FullPageLoader, P as PageHeader, B as Badge, U as Users, S as ShieldCheck, C as Card, e as CardContent, b as Button, o as ChevronDown, R as RiskLevel__1, H as HalalComplianceStatus, i as Separator, p as Shield, q as Link2, f as CircleCheck, s as CircleX, _ as __vitePreload } from "./index-CPnZ4-ee.js";
import { F as FinancierLayout } from "./FinancierLayout-tu5bQ-jz.js";
import { P as Pagination } from "./Pagination-CELRZ_t0.js";
import { S as StatusCard } from "./StatusCard-CCnc1WpH.js";
import { T as TrendingUp } from "./trending-up-BbF36D2u.js";
import { B as Building2 } from "./building-2-CxKUCXUo.js";
import { C as ChevronUp } from "./chevron-up-C9u-2erU.js";
import { A as ArrowRight } from "./arrow-right-Yq6p0pFk.js";
import { C as CircleDot } from "./circle-dot-D5vDNc64.js";
import "./use-user-role-gvzFlaTO.js";
import "./user--fZ_EEDP.js";
import "./clock-BRCXs4iw.js";
const PAGE_SIZE = 20;
function riskBadgeVariant(risk) {
  if (risk === RiskLevel__1.low) return "bg-primary/10 text-primary";
  if (risk === RiskLevel__1.medium)
    return "bg-secondary/20 text-secondary-foreground";
  if (risk === RiskLevel__1.high) return "bg-destructive/10 text-destructive";
  return "bg-accent/10 text-accent-foreground";
}
function halalBadgeClass(status) {
  if (status === HalalComplianceStatus.compliant)
    return "bg-primary/10 text-primary";
  if (status === HalalComplianceStatus.flagged)
    return "bg-destructive/10 text-destructive";
  return "bg-accent/10 text-accent-foreground";
}
function kycIcon(verified) {
  return verified ? /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-3.5 w-3.5 text-primary" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(CircleX, { className: "h-3.5 w-3.5 text-destructive" });
}
function ApplicantDetailPanel({ userId, onCollapse }) {
  const { actor } = useBackend();
  const profileQuery = useQuery({
    queryKey: ["financing_ready_business", userId],
    queryFn: async () => {
      if (!actor) return null;
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-CPnZ4-ee.js").then((n) => n.be);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      return actor.getFinancingReadyBusiness(Principal.fromText(userId));
    },
    enabled: !!actor && !!userId
  });
  const profile = profileQuery.data;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      CardContent,
      {
        className: "grid gap-6 pb-5 pt-4 sm:grid-cols-3",
        "data-ocid": `financier_dashboard.detail_panel.${userId}`,
        children: profileQuery.isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "sm:col-span-3 text-sm text-muted-foreground", children: "Loading profile…" }) : !profile ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "sm:col-span-3 text-sm text-muted-foreground", children: "Profile not available." }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-3.5 w-3.5" }),
              " Business Info"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("dl", { className: "space-y-1.5 text-sm", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground", children: "Name" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "font-medium text-foreground", children: profile.businessName })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground", children: "Type" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "text-foreground", children: profile.businessType })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground", children: "Annual Revenue" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("dd", { className: "text-foreground", children: [
                  "₦",
                  Number(profile.annualRevenue).toLocaleString()
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground", children: "Phone" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "text-foreground", children: profile.phoneNumber })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground", children: "Address" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "text-foreground", children: profile.address })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "h-3.5 w-3.5" }),
              " KYC Status"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "mb-4 space-y-1.5", children: [
              ["BVN", profile.kycRecord.bvnVerified],
              ["NIN", profile.kycRecord.ninVerified],
              ["CAC", profile.kycRecord.cacVerified],
              ["TIN", profile.kycRecord.tinVerified],
              ["Watchlist Clear", profile.kycRecord.watchlistClean]
            ].map(([label, val]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-center gap-2 text-sm", children: [
              kycIcon(val),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-foreground", children: label })
            ] }, label)) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Link2, { className: "h-3.5 w-3.5" }),
              " Bank Account"
            ] }),
            profile.bankLinkRecord.status.__kind__ === "Linked" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "flex items-center gap-1 text-sm text-primary", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-3.5 w-3.5" }),
              " Linked",
              profile.bankLinkRecord.institutionName && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-1 text-xs text-muted-foreground", children: [
                "(",
                profile.bankLinkRecord.institutionName,
                ")"
              ] })
            ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "flex items-center gap-1 text-sm text-muted-foreground", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(CircleDot, { className: "h-3.5 w-3.5" }),
              " Not linked"
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(TrendingUp, { className: "h-3.5 w-3.5" }),
              " AI Scores"
            ] }),
            profile.scoringRecord.financingReadinessScore > 0n ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Financing Readiness" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-lg font-bold text-primary", children: [
                  profile.scoringRecord.financingReadinessScore.toString(),
                  "%"
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Halal Compliance" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-lg font-bold text-foreground", children: [
                  profile.scoringRecord.halalComplianceScore.toString(),
                  "%"
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Risk Level" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "span",
                  {
                    className: `rounded-full px-2 py-0.5 text-xs font-medium ${riskBadgeVariant(profile.riskLevel)}`,
                    children: profile.riskLevel
                  }
                )
              ] }),
              profile.scoringRecord.scoringNotes && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: profile.scoringRecord.scoringNotes })
            ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Not scored yet" })
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "pb-4 pt-0", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      Button,
      {
        type: "button",
        variant: "ghost",
        size: "sm",
        onClick: onCollapse,
        className: "gap-1.5 text-muted-foreground",
        "data-ocid": `financier_dashboard.collapse_button.${userId}`,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronUp, { className: "h-4 w-4" }),
          " Collapse"
        ]
      }
    ) })
  ] });
}
function FinancierDashboard() {
  var _a, _b;
  const { actor } = useBackend();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = reactExports.useState(1);
  const [expandedId, setExpandedId] = reactExports.useState(null);
  const profileQuery = useQuery({
    queryKey: ["financier_profile"],
    queryFn: () => (actor == null ? void 0 : actor.getMyFinancierProfile()) ?? null,
    enabled: !!actor
  });
  const applicantsQuery = useQuery({
    queryKey: ["financing_ready_applicants", currentPage],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0, page: 1 };
      const actorAny = actor;
      if (typeof actorAny.listFinancingReadyApplicantsPaginated === "function") {
        return actorAny.listFinancingReadyApplicantsPaginated(
          BigInt(currentPage),
          BigInt(PAGE_SIZE)
        );
      }
      const page = await actor.listFinancingReadyApplicants(
        BigInt(currentPage),
        BigInt(PAGE_SIZE)
      );
      return {
        items: page.items ?? [],
        total: Number(page.total ?? 0n),
        page: currentPage
      };
    },
    enabled: !!actor,
    placeholderData: (prev) => prev
  });
  if (profileQuery.isLoading) return /* @__PURE__ */ jsxRuntimeExports.jsx(FullPageLoader, {});
  const profile = profileQuery.data;
  const applicants = ((_a = applicantsQuery.data) == null ? void 0 : _a.items) ?? [];
  const total = Number(((_b = applicantsQuery.data) == null ? void 0 : _b.total) ?? applicants.length);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return /* @__PURE__ */ jsxRuntimeExports.jsx(FinancierLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-5xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: (profile == null ? void 0 : profile.institutionName) ?? "Financier Dashboard",
        subtitle: "Browse financing-ready vetted applicants on the Vetify platform.",
        breadcrumbs: [{ label: "Dashboard" }],
        actions: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Badge,
          {
            variant: "secondary",
            className: "bg-primary/10 text-primary border-primary/30 dark:bg-primary/20",
            "data-ocid": "financier_dashboard.status_badge",
            children: (profile == null ? void 0 : profile.registrationStatus) ?? "Pending"
          }
        )
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "section",
      {
        className: "mb-8",
        "data-ocid": "financier_dashboard.summary_section",
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-4 sm:grid-cols-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            StatusCard,
            {
              icon: Users,
              label: "Financing-Ready Applicants",
              value: total,
              variant: "success",
              description: "Verified applicants available",
              "data-ocid": "financier_dashboard.applicants_count_card"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            StatusCard,
            {
              icon: ShieldCheck,
              label: "Areas of Financing",
              value: (profile == null ? void 0 : profile.areasOfFinancing.length) ?? 0,
              variant: "pending",
              description: "Active financing categories",
              "data-ocid": "financier_dashboard.areas_card"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            StatusCard,
            {
              icon: TrendingUp,
              label: "Platform Status",
              value: "Active",
              variant: "success",
              description: "Vetify verified institution",
              "data-ocid": "financier_dashboard.platform_status_card"
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { "data-ocid": "financier_dashboard.applicants_section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mb-4 font-display text-lg font-semibold text-foreground", children: "Financing-Ready Applicants" }),
      applicants.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        CardContent,
        {
          className: "flex flex-col items-center justify-center py-16",
          "data-ocid": "financier_dashboard.applicants_empty_state",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Users, { className: "mb-3 h-10 w-10 text-muted-foreground/40" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground", children: "No applicants yet" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Financing-ready applicants will appear here once vetted." })
          ]
        }
      ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: applicants.map((applicant, idx) => {
        const isExpanded = expandedId === applicant.userId.toString();
        return /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Card,
          {
            className: "hover:border-primary/30 transition-smooth dark:bg-card",
            "data-ocid": `financier_dashboard.applicant.item.${idx + 1}`,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-center justify-between gap-4 py-4", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-5 w-5 text-primary" }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground truncate", children: applicant.displayName }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Business" })
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "span",
                    {
                      className: `rounded-full px-2.5 py-0.5 text-xs font-medium ${riskBadgeVariant(applicant.riskLevel)}`,
                      children: [
                        applicant.riskLevel.charAt(0).toUpperCase() + applicant.riskLevel.slice(1),
                        " ",
                        "Risk"
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "span",
                    {
                      className: `rounded-full px-2.5 py-0.5 text-xs font-medium ${halalBadgeClass(applicant.halalComplianceStatus)}`,
                      children: applicant.halalComplianceStatus.charAt(0).toUpperCase() + applicant.halalComplianceStatus.slice(1)
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-sm font-semibold text-foreground", children: [
                    Number(applicant.financingReadyScore),
                    "%"
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Button,
                    {
                      size: "sm",
                      variant: "ghost",
                      type: "button",
                      onClick: () => setExpandedId(
                        isExpanded ? null : applicant.userId.toString()
                      ),
                      "aria-label": isExpanded ? "Collapse details" : "Expand details",
                      "data-ocid": `financier_dashboard.expand_button.${idx + 1}`,
                      children: isExpanded ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronUp, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "h-4 w-4" })
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    Button,
                    {
                      size: "sm",
                      variant: "ghost",
                      type: "button",
                      onClick: () => navigate({
                        to: "/admin/profile/$userId",
                        params: { userId: applicant.userId.toString() }
                      }),
                      "data-ocid": `financier_dashboard.view_profile_button.${idx + 1}`,
                      children: [
                        "View ",
                        /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "ml-1 h-3.5 w-3.5" })
                      ]
                    }
                  )
                ] })
              ] }),
              isExpanded && /* @__PURE__ */ jsxRuntimeExports.jsx(
                ApplicantDetailPanel,
                {
                  userId: applicant.userId.toString(),
                  onCollapse: () => setExpandedId(null)
                }
              )
            ]
          },
          applicant.userId.toString()
        );
      }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Pagination,
        {
          currentPage,
          totalPages,
          onPageChange: (p) => setCurrentPage(p),
          isLoading: applicantsQuery.isFetching
        }
      )
    ] })
  ] }) });
}
export {
  FinancierDashboard as default
};
