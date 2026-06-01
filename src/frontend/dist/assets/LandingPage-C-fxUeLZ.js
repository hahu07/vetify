import { u as useAuth, a as useRouter, r as reactExports, j as jsxRuntimeExports, B as Badge, b as Button, L as Lock, C as Card, c as CardHeader, d as CardTitle, e as CardContent, S as ShieldCheck, f as CircleCheck } from "./index-DiwSGmNR.js";
import { L as Layout } from "./Layout-BNWWW4Ou.js";
import { u as useUserRole } from "./use-user-role-DlEe0uPV.js";
import { m as motion } from "./proxy-Bis1-hmp.js";
import { S as Star } from "./star-DOnBQFnM.js";
import { A as ArrowRight } from "./arrow-right-fSzxzFUk.js";
import { B as Building2 } from "./building-2-CCds38tC.js";
import { U as User } from "./user-BQRpN4aJ.js";
import { T as TrendingUp } from "./trending-up-BRtYxp1l.js";
const features = [
  {
    icon: Building2,
    title: "Business Vetting",
    description: "CAC document verification, revenue analysis, and ethical business practices screening via Mono APIs.",
    href: "/register/business",
    cta: "Register as Business",
    accentClass: "bg-primary/10 dark:bg-primary/20",
    iconClass: "text-primary",
    borderHover: "hover:border-primary/40"
  },
  {
    icon: User,
    title: "Apply as Individual",
    description: "Seeking personal halal financing? Apply as an individual — BVN/NIN verification, Shariah compliance check, and matched financiers.",
    href: "/register/individual",
    cta: "Apply as Individual",
    accentClass: "bg-[var(--individual-accent,oklch(0.75_0.16_60))]/10 dark:bg-[var(--individual-accent,oklch(0.75_0.16_60))]/20",
    iconClass: "text-[var(--individual-accent,oklch(0.65_0.18_60))]",
    borderHover: "hover:border-[var(--individual-accent,oklch(0.75_0.16_60))]/40"
  },
  {
    icon: TrendingUp,
    title: "Financier Portal",
    description: "Access financing-ready profiles vetted to Shariah standards. Browse verified applicants.",
    href: "/register/financier",
    cta: "Join as Financier",
    accentClass: "bg-primary/10 dark:bg-primary/20",
    iconClass: "text-primary",
    borderHover: "hover:border-primary/40"
  }
];
const trustPoints = [
  "Shariah-compliant vetting process",
  "Decentralized on Internet Computer Protocol",
  "Transparent audit-ready profiles",
  "Nigeria & emerging markets focus"
];
function LandingPage() {
  const { isAuthenticated, isInitializing, login, isLoggingIn } = useAuth();
  const { role, isLoading } = useUserRole();
  const router = useRouter();
  reactExports.useEffect(() => {
    if (!isAuthenticated || isInitializing || isLoading) return;
    if (role === "business") {
      router.navigate({ to: "/business/dashboard" });
    } else if (role === "individual") {
      router.navigate({ to: "/individual/dashboard" });
    } else if (role === "financier") {
      router.navigate({ to: "/financier/dashboard" });
    } else if (role === "admin") {
      router.navigate({ to: "/admin/dashboard" });
    }
  }, [isAuthenticated, role, isLoading, isInitializing, router]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Layout, { hideNav: !isAuthenticated, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "section",
      {
        className: "relative overflow-hidden bg-card border-b border-border dark:bg-card/90",
        "data-ocid": "landing.hero_section",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.5_0.22_135/0.08),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top_left,oklch(0.5_0.22_135/0.04),transparent_60%)]" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "container mx-auto px-4 py-20 md:py-28 lg:py-32", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
            motion.div,
            {
              initial: { opacity: 0, y: 24 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.6 },
              className: "mx-auto max-w-3xl text-center",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Badge,
                  {
                    variant: "secondary",
                    className: "mb-5 inline-flex gap-1.5 border border-primary/30 bg-primary/10 text-primary",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Star, { className: "h-3 w-3" }),
                      "Halal Finance Infrastructure"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl", children: [
                  "Trusted Ethical Finance",
                  " ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-primary", children: "Vetting" }),
                  " Platform"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-5 text-lg text-muted-foreground md:text-xl", children: "Seamlessly connect and vet applicants according to Shariah principles. AI-powered profiling for ethical financiers in Nigeria and beyond." }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center", children: isAuthenticated ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Button,
                  {
                    size: "lg",
                    onClick: () => {
                      if (role === "financier") {
                        router.navigate({ to: "/financier/dashboard" });
                      } else if (role === "admin") {
                        router.navigate({ to: "/admin/dashboard" });
                      } else if (role === "individual") {
                        router.navigate({ to: "/individual/dashboard" });
                      } else {
                        router.navigate({ to: "/business/dashboard" });
                      }
                    },
                    className: "gap-2",
                    "data-ocid": "landing.go_to_dashboard_button",
                    children: [
                      "Go to Dashboard ",
                      /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "h-4 w-4" })
                    ]
                  }
                ) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    Button,
                    {
                      size: "lg",
                      onClick: login,
                      disabled: isInitializing || isLoggingIn,
                      className: "gap-2",
                      "data-ocid": "landing.signin_button",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "h-4 w-4" }),
                        isInitializing ? "Loading…" : isLoggingIn ? "Connecting…" : "Sign In with Internet Identity"
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-muted-foreground", children: "Secure · Decentralized · Private" })
                ] }) })
              ]
            }
          ) })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "section",
      {
        className: "bg-background py-16 md:py-20",
        "data-ocid": "landing.features_section",
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto px-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            motion.div,
            {
              initial: { opacity: 0, y: 16 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true },
              transition: { duration: 0.5 },
              className: "mb-10 text-center",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-3xl font-bold text-foreground", children: "Three Pathways to Ethical Finance" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-muted-foreground", children: "Whether you seek financing as a business or individual, or provide it as a financier, Vetify has a path for you." })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-6 md:grid-cols-3 max-w-5xl mx-auto", children: features.map((feat, idx) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            motion.div,
            {
              initial: { opacity: 0, y: 24 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true },
              transition: { duration: 0.5, delay: idx * 0.1 },
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Card,
                {
                  className: `group h-full border-border ${feat.borderHover} hover:shadow-md transition-smooth dark:bg-card/80`,
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(CardHeader, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "div",
                        {
                          className: `mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg ${feat.accentClass}`,
                          children: /* @__PURE__ */ jsxRuntimeExports.jsx(feat.icon, { className: `h-5 w-5 ${feat.iconClass}` })
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(CardTitle, { className: "font-display text-lg", children: feat.title })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex flex-col justify-between gap-5", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: feat.description }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        Button,
                        {
                          variant: "outline",
                          className: `w-full gap-2 transition-colors ${feat.title === "Apply as Individual" ? "group-hover:border-[var(--individual-accent,oklch(0.75_0.16_60))] group-hover:text-[var(--individual-accent,oklch(0.65_0.18_60))]" : "group-hover:border-primary group-hover:text-primary"}`,
                          onClick: () => router.navigate({
                            to: feat.href
                          }),
                          "data-ocid": `landing.${feat.title.toLowerCase().replace(/\s/g, "_")}_cta`,
                          children: [
                            feat.cta,
                            " ",
                            /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "h-3.5 w-3.5" })
                          ]
                        }
                      )
                    ] })
                  ]
                }
              )
            },
            feat.title
          )) })
        ] })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "section",
      {
        className: "bg-muted/40 py-16 md:py-20",
        "data-ocid": "landing.trust_section",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "container mx-auto px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-auto max-w-2xl", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: -16 },
            whileInView: { opacity: 1, x: 0 },
            viewport: { once: true },
            transition: { duration: 0.5 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-4 flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheck, { className: "h-6 w-6 text-primary" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-2xl font-bold text-foreground", children: "Built on Trust & Transparency" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-7 text-muted-foreground", children: "Vetify combines decentralized technology with deep ethical finance expertise to create a platform you can rely on." }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-3", children: trustPoints.map((point) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-5 w-5 shrink-0 text-primary" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-medium text-foreground", children: point })
              ] }, point)) }),
              !isAuthenticated && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Button,
                {
                  size: "lg",
                  className: "mt-8 gap-2",
                  onClick: login,
                  disabled: isInitializing || isLoggingIn,
                  "data-ocid": "landing.trust_cta_button",
                  children: [
                    "Get Started Today ",
                    /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "h-4 w-4" })
                  ]
                }
              )
            ]
          }
        ) }) })
      }
    )
  ] });
}
export {
  LandingPage as default
};
