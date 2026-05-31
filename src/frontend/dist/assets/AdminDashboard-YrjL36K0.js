import { t as createLucideIcon, g as useBackend, m as useNavigate, au as useIsSuperAdmin, n as useQuery, O as RegistrationStatus, j as jsxRuntimeExports, F as FullPageLoader, E as AdminLayout, P as PageHeader, b as Button, av as Settings, al as ClipboardList, aa as TriangleAlert, C as Card, c as CardHeader, d as CardTitle, e as CardContent, U as Users, v as Skeleton } from "./index-CPnZ4-ee.js";
import { S as StatusCard } from "./StatusCard-CCnc1WpH.js";
import { B as Building2 } from "./building-2-CxKUCXUo.js";
import { U as User } from "./user--fZ_EEDP.js";
import { B as Briefcase } from "./briefcase-WXFhcC7l.js";
import "./clock-BRCXs4iw.js";
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
      d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
      key: "3c2336"
    }
  ],
  ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
];
const BadgeCheck = createLucideIcon("badge-check", __iconNode);
const PAGE_SIZE = 20;
function AnalyticsKpiCard({
  title,
  main,
  detail,
  onClick,
  "data-ocid": dataOcid
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: `analytics-kpi-card${onClick ? " cursor-pointer" : ""}`,
      onClick,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") onClick == null ? void 0 : onClick();
      },
      "data-ocid": dataOcid,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground", children: title }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-2xl font-bold font-display text-foreground leading-tight", children: main }),
        detail && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1.5 text-xs text-muted-foreground", children: detail })
      ]
    }
  );
}
function MizanScoreBadge({ score }) {
  const cls = score >= 70 ? "bg-primary/10 text-primary border border-primary/30" : score >= 40 ? "bg-[oklch(var(--chart-3)/0.1)] text-[oklch(var(--chart-3))] border border-[oklch(var(--chart-3)/0.3)]" : "bg-destructive/10 text-destructive border border-destructive/30";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "span",
    {
      className: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`,
      children: score >= 70 ? "Strong" : score >= 40 ? "Moderate" : "Weak"
    }
  );
}
function AnalyticsSection({
  navigate
}) {
  const { actor } = useBackend();
  const analyticsQuery = useQuery({
    queryKey: ["admin_analytics"],
    queryFn: async () => {
      if (!actor) return null;
      const res = await actor.getAdminAnalytics();
      if ("__kind__" in res) {
        if (res.__kind__ === "ok")
          return res.ok;
        return null;
      }
      return res;
    },
    enabled: !!actor
  });
  if (analyticsQuery.isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mb-8", "data-ocid": "admin.analytics_section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: "Platform Analytics" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: ["s1", "s2", "s3", "s4", "s5", "s6"].map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-24 rounded-lg" }, k)) })
    ] });
  }
  const a = analyticsQuery.data;
  if (!a) return null;
  const totalTawthiq = Number(a.tawthiqPassCount) + Number(a.tawthiqConditionalCount) + Number(a.tawthiqFailCount);
  const passRate = totalTawthiq > 0 ? Math.round(Number(a.tawthiqPassCount) / totalTawthiq * 100) : 0;
  const conditionalRate = totalTawthiq > 0 ? Math.round(Number(a.tawthiqConditionalCount) / totalTawthiq * 100) : 0;
  const failRate = totalTawthiq > 0 ? Math.round(Number(a.tawthiqFailCount) / totalTawthiq * 100) : 0;
  const avgMizan = Number(a.averageMizanScore);
  const totalRegs = Number(a.totalBusinesses) + Number(a.totalIndividuals) + Number(a.totalFinanciers);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mb-8", "data-ocid": "admin.analytics_section", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: "Platform Analytics" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        AnalyticsKpiCard,
        {
          title: "Total Registrations",
          main: totalRegs,
          detail: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex flex-wrap gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-3 w-3" }),
              Number(a.totalBusinesses),
              " Businesses"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "h-3 w-3" }),
              Number(a.totalIndividuals),
              " Individuals"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Briefcase, { className: "h-3 w-3" }),
              Number(a.totalFinanciers),
              " Financiers"
            ] })
          ] }),
          "data-ocid": "admin.analytics.total_registrations_card"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        AnalyticsKpiCard,
        {
          title: "Tawthiq Results",
          main: `${passRate}% Pass`,
          detail: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-primary", children: [
              passRate,
              "% Passed"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-chart-2", children: [
              conditionalRate,
              "% Conditional"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-destructive", children: [
              failRate,
              "% Failed"
            ] })
          ] }),
          "data-ocid": "admin.analytics.tawthiq_results_card"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        AnalyticsKpiCard,
        {
          title: "Average Mizan Score",
          main: avgMizan.toFixed(1),
          detail: /* @__PURE__ */ jsxRuntimeExports.jsx(MizanScoreBadge, { score: avgMizan }),
          "data-ocid": "admin.analytics.avg_mizan_card"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        AnalyticsKpiCard,
        {
          title: "Active Financiers",
          main: Number(a.activeFinancierCount),
          detail: `${Number(a.totalFinanciers)} registered total`,
          "data-ocid": "admin.analytics.active_financiers_card"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        AnalyticsKpiCard,
        {
          title: "Pending Reviews",
          main: Number(a.pendingReviewCount),
          detail: Number(a.pendingReviewCount) > 0 ? "Need admin attention" : "All up to date",
          onClick: () => navigate({ to: "/admin/applicants" }),
          "data-ocid": "admin.analytics.pending_reviews_card"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        AnalyticsKpiCard,
        {
          title: "Financing-Ready",
          main: Number(a.financingReadyCount),
          detail: "Across businesses and individuals",
          "data-ocid": "admin.analytics.financing_ready_card"
        }
      )
    ] })
  ] });
}
function AdminDashboard() {
  var _a, _b, _c;
  const { actor } = useBackend();
  const navigate = useNavigate();
  const { isSuperAdmin } = useIsSuperAdmin();
  const businessesQuery = useQuery({
    queryKey: ["admin_businesses", 1],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
      const page = await actor.adminListBusinesses(
        1n,
        BigInt(PAGE_SIZE)
      );
      return {
        items: page.items ?? [],
        total: Number(page.total ?? 0n),
        page: 1,
        pageSize: PAGE_SIZE
      };
    },
    enabled: !!actor
  });
  const financiersQuery = useQuery({
    queryKey: ["admin_financiers"],
    queryFn: async () => {
      if (!actor)
        return { items: [], total: 0n, page: 1n, pageSize: BigInt(PAGE_SIZE) };
      return actor.adminListFinanciers(1n, BigInt(1e3));
    },
    enabled: !!actor
  });
  const individualsQuery = useQuery({
    queryKey: ["admin_individuals", 1],
    queryFn: async () => {
      if (!actor) return { total: 0, items: [] };
      const res = await actor.adminListIndividuals(1n, 5n);
      if ("__kind__" in res && res.__kind__ === "ok") {
        return {
          total: Number(
            res.ok.total
          ),
          items: []
        };
      }
      return { total: 0, items: [] };
    },
    enabled: !!actor
  });
  const isLoading = businessesQuery.isLoading || financiersQuery.isLoading;
  const allBusinesses = ((_a = businessesQuery.data) == null ? void 0 : _a.items) ?? [];
  const totalBusinesses = Number(
    ((_b = businessesQuery.data) == null ? void 0 : _b.total) ?? allBusinesses.length
  );
  const _financiersRaw = financiersQuery.data;
  const financiers = _financiersRaw && !Array.isArray(_financiersRaw) && _financiersRaw.items ? _financiersRaw.items : [];
  const pendingCount = allBusinesses.filter(
    (b) => b.registrationStatus === RegistrationStatus.pending
  ).length;
  const reviewCount = allBusinesses.filter(
    (b) => b.registrationStatus === RegistrationStatus.underReview
  ).length;
  const readyCount = allBusinesses.filter(
    (b) => b.registrationStatus === RegistrationStatus.financingReady
  ).length;
  const totalIndividuals = ((_c = individualsQuery.data) == null ? void 0 : _c.total) ?? 0;
  if (isLoading) return /* @__PURE__ */ jsxRuntimeExports.jsx(FullPageLoader, {});
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AdminLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-6xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Admin Dashboard",
        subtitle: "Overview of platform activity — applicants, financiers, and compliance.",
        breadcrumbs: [{ label: "Admin" }],
        actions: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          isSuperAdmin && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              variant: "outline",
              size: "sm",
              onClick: () => navigate({ to: "/admin/settings" }),
              className: "gap-1.5",
              type: "button",
              "data-ocid": "admin.settings_link",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Settings, { className: "h-4 w-4" }),
                "Settings"
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              variant: "outline",
              size: "sm",
              onClick: () => navigate({ to: "/admin/audit" }),
              className: "gap-1.5",
              type: "button",
              "data-ocid": "admin.audit_trail_link",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(ClipboardList, { className: "h-4 w-4" }),
                "Audit Trail"
              ]
            }
          )
        ] })
      }
    ),
    isSuperAdmin && /* @__PURE__ */ jsxRuntimeExports.jsx(AnalyticsSection, { navigate }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("section", { className: "mb-8", "data-ocid": "admin.stats_section", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StatusCard,
        {
          icon: Building2,
          label: "Total Businesses",
          value: totalBusinesses,
          variant: "pending",
          "data-ocid": "admin.total_businesses_card"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StatusCard,
        {
          icon: User,
          label: "Individuals",
          value: totalIndividuals,
          variant: "pending",
          description: "Individual applicants",
          "data-ocid": "admin.total_individuals_card"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StatusCard,
        {
          icon: TriangleAlert,
          label: "Pending Review",
          value: pendingCount + reviewCount,
          variant: "pending",
          "data-ocid": "admin.pending_review_card"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        StatusCard,
        {
          icon: BadgeCheck,
          label: "Financing Ready",
          value: readyCount,
          variant: "success",
          "data-ocid": "admin.financing_ready_card"
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "section",
      {
        className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
        "data-ocid": "admin.quicklinks_section",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Card,
            {
              className: "cursor-pointer border-border hover:border-primary/40 transition-smooth",
              onClick: () => navigate({ to: "/admin/applicants" }),
              "data-ocid": "admin.applicants_quicklink",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-5 w-5 text-primary" }),
                  "Business Applicants"
                ] }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "text-sm text-muted-foreground", children: [
                  "Review applicant status, KYC results, and AI scores.",
                  pendingCount + reviewCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-3 w-3" }),
                    pendingCount + reviewCount,
                    " need attention"
                  ] })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Card,
            {
              className: "cursor-pointer border-border hover:border-primary/40 transition-smooth",
              onClick: () => navigate({
                to: "/admin/applicants",
                search: { tab: "individuals" }
              }),
              "data-ocid": "admin.individuals_quicklink",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Users, { className: "h-5 w-5 text-primary" }),
                  "Individual Applicants"
                ] }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "text-sm text-muted-foreground", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: totalIndividuals }),
                  " ",
                  "registered individual",
                  totalIndividuals !== 1 ? "s" : "",
                  " seeking halal financing."
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Card,
            {
              className: "cursor-pointer border-border hover:border-primary/40 transition-smooth",
              onClick: () => navigate({ to: "/admin/financiers" }),
              "data-ocid": "admin.financiers_quicklink",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Briefcase, { className: "h-5 w-5 text-primary" }),
                  "Registered Financiers"
                ] }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "text-sm text-muted-foreground", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: financiers.length }),
                  " ",
                  "financier",
                  financiers.length !== 1 ? "s" : "",
                  " — manage platform access and status."
                ] })
              ]
            }
          )
        ]
      }
    )
  ] }) });
}
export {
  AdminDashboard as default
};
