import { r as reactExports, u as useAuth, V as useDarkMode, a as useRouter, W as useLocation, j as jsxRuntimeExports, X as SessionTimeoutModal, y as cn, Y as X, Z as Menu, $ as NotificationPanel, b as Button, a0 as Sun, a1 as Moon, a2 as DropdownMenu, a3 as DropdownMenuTrigger, p as Shield, o as ChevronDown, a4 as DropdownMenuContent, a5 as DropdownMenuSeparator, a6 as DropdownMenuItem, a7 as LogOut, w as Link, a8 as LayoutDashboard, x as ChevronRight, a9 as ChevronLeft } from "./index-CPnZ4-ee.js";
import { u as useUserRole } from "./use-user-role-gvzFlaTO.js";
import { C as CreditCard, B as BrainCircuit } from "./credit-card-DL9b9S-9.js";
import { U as User } from "./user--fZ_EEDP.js";
const navItems = [
  { label: "Overview", href: "/business/dashboard", icon: LayoutDashboard },
  { label: "KYC Status", href: "/business/kyc", icon: Shield },
  { label: "Bank Linking", href: "/business/bank", icon: CreditCard },
  { label: "AI Scores", href: "/business/scores", icon: BrainCircuit },
  { label: "Profile", href: "/business/profile", icon: User }
];
function BusinessLayout({ children }) {
  const [collapsed, setCollapsed] = reactExports.useState(false);
  const [mobileOpen, setMobileOpen] = reactExports.useState(false);
  const { logout } = useAuth();
  const { isDark, toggleDark } = useDarkMode();
  const { profile } = useUserRole();
  const router = useRouter();
  const location = useLocation();
  const businessName = profile && "businessName" in profile ? profile.businessName : "Business";
  const handleLogout = () => {
    logout();
    router.navigate({ to: "/" });
  };
  const SidebarContent = ({ mobile = false }) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full flex-col", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: cn(
          "flex h-16 items-center border-b border-sidebar-border px-4",
          collapsed && !mobile ? "justify-center px-2" : "gap-2.5"
        ),
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Link,
          {
            to: "/",
            className: "flex items-center gap-2.5 group",
            "data-ocid": "business_sidebar.brand_link",
            onClick: () => setMobileOpen(false),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "img",
                {
                  src: "/assets/generated/halalvet-logo-transparent.dim_80x80.png",
                  alt: "Vetify",
                  className: "h-8 w-8 shrink-0 object-contain"
                }
              ),
              (!collapsed || mobile) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-display text-xl font-bold tracking-tight text-primary group-hover:text-primary/80 transition-colors", children: "Vetify" })
            ]
          }
        )
      }
    ),
    (!collapsed || mobile) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-3 mt-3 rounded-md bg-primary/10 px-3 py-1.5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "truncate text-xs font-semibold text-primary", children: businessName }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Business Applicant" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "nav",
      {
        className: "flex-1 space-y-1 overflow-y-auto px-2 py-4",
        "aria-label": "Business navigation",
        children: navItems.map((item) => {
          const active = location.pathname === item.href;
          const Icon = item.icon;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Link,
            {
              to: item.href,
              onClick: () => setMobileOpen(false),
              className: cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && !mobile ? "justify-center px-2" : "",
                active ? "bg-primary text-primary-foreground shadow-xs" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              ),
              "data-ocid": `business_sidebar.${item.label.toLowerCase().replace(/\s/g, "_")}_link`,
              title: collapsed && !mobile ? item.label : void 0,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "h-4 w-4 shrink-0" }),
                (!collapsed || mobile) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: item.label })
              ]
            },
            item.href
          );
        })
      }
    ),
    !mobile && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "border-t border-sidebar-border p-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Button,
      {
        type: "button",
        variant: "ghost",
        size: "sm",
        onClick: () => setCollapsed((c) => !c),
        className: cn(
          "w-full gap-2 text-muted-foreground hover:text-foreground",
          collapsed ? "justify-center px-2" : "justify-start"
        ),
        "aria-label": collapsed ? "Expand sidebar" : "Collapse sidebar",
        "data-ocid": "business_sidebar.collapse_toggle",
        children: collapsed ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronLeft, { className: "h-4 w-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs", children: "Collapse" })
        ] })
      }
    ) })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-h-screen bg-background", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(SessionTimeoutModal, { prefix: "business" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "aside",
      {
        className: cn(
          "hidden md:flex flex-col shrink-0 bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-20" : "w-64"
        ),
        "data-ocid": "business_sidebar.panel",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarContent, {})
      }
    ),
    mobileOpen && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "dialog",
      {
        open: true,
        className: "fixed inset-0 z-50 flex md:hidden m-0 p-0 max-w-none max-h-none w-full h-full border-none bg-transparent",
        "aria-label": "Navigation sidebar",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "absolute inset-0 bg-black/50",
              onClick: () => setMobileOpen(false),
              onKeyDown: (e) => e.key === "Escape" && setMobileOpen(false)
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "relative flex w-72 flex-col bg-sidebar shadow-xl", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                onClick: () => setMobileOpen(false),
                className: "absolute right-3 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground",
                "aria-label": "Close sidebar",
                children: /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-5 w-5" })
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarContent, { mobile: true })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4 shadow-xs", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: () => setMobileOpen(true),
              className: "rounded-md p-1.5 text-muted-foreground hover:text-foreground md:hidden",
              "aria-label": "Open sidebar",
              "data-ocid": "business_topbar.mobile_menu_button",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(Menu, { className: "h-5 w-5", "aria-hidden": "true" })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden text-sm font-medium text-muted-foreground sm:block", children: "Business Portal" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(NotificationPanel, { prefix: "business" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "icon",
              onClick: toggleDark,
              "aria-label": "Toggle dark mode",
              className: "text-muted-foreground hover:text-foreground",
              "data-ocid": "business_topbar.dark_mode_toggle",
              children: isDark ? /* @__PURE__ */ jsxRuntimeExports.jsx(Sun, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Moon, { className: "h-4 w-4" })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                type: "button",
                variant: "outline",
                size: "sm",
                className: "gap-1.5",
                "data-ocid": "business_topbar.account_dropdown",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "h-3.5 w-3.5 text-primary" }),
                  "Account",
                  /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "h-3.5 w-3.5" })
                ]
              }
            ) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "end", className: "w-44", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                DropdownMenuItem,
                {
                  onClick: handleLogout,
                  className: "text-destructive focus:text-destructive",
                  "data-ocid": "business_topbar.logout_button",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "mr-2 h-4 w-4" }),
                    "Sign Out"
                  ]
                }
              )
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "flex-1 overflow-auto", children })
    ] })
  ] });
}
export {
  BusinessLayout as B
};
