import { v as createLucideIcon, r as reactExports, u as useAuth, X as useDarkMode, a as useRouter, Y as useLocation, Z as useActor, j as jsxRuntimeExports, $ as SessionTimeoutModal, z as cn, a0 as X, a1 as Menu, a2 as NotificationPanel, b as Button, a3 as Sun, a4 as Moon, a5 as DropdownMenu, a6 as DropdownMenuTrigger, q as Shield, p as ChevronDown, a7 as DropdownMenuContent, a8 as DropdownMenuSeparator, a9 as DropdownMenuItem, aa as LogOut, x as Link, ab as LayoutDashboard, U as Users, B as Badge, y as ChevronRight, ac as ChevronLeft, ad as createActor } from "./index-DiwSGmNR.js";
import { u as useUserRole } from "./use-user-role-DlEe0uPV.js";
import { M as MessageCircle } from "./message-circle-C1jDekiM.js";
import { U as User } from "./user-BQRpN4aJ.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$2 = [
  ["path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z", key: "1fy3hk" }]
];
const Bookmark = createLucideIcon("bookmark", __iconNode$2);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$1 = [
  [
    "path",
    {
      d: "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z",
      key: "9ktpf1"
    }
  ],
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
];
const Compass = createLucideIcon("compass", __iconNode$1);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["line", { x1: "6", x2: "6", y1: "3", y2: "15", key: "17qcm7" }],
  ["circle", { cx: "18", cy: "6", r: "3", key: "1h7g24" }],
  ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }],
  ["path", { d: "M18 9a9 9 0 0 1-9 9", key: "n2h4wq" }]
];
const GitBranch = createLucideIcon("git-branch", __iconNode);
const navItems = [
  { label: "Overview", href: "/financier/dashboard", icon: LayoutDashboard },
  { label: "Vetted Applicants", href: "/financier/applicants", icon: Users },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Profile", href: "/financier/profile", icon: User }
];
const kashifNavItems = [
  { label: "Discover Borrowers", href: "/financier/discover", icon: Compass },
  { label: "My Shortlist", href: "/financier/shortlist", icon: Bookmark },
  { label: "Pipeline", href: "/financier/pipeline", icon: GitBranch }
];
function FinancierLayout({ children }) {
  const [collapsed, setCollapsed] = reactExports.useState(false);
  const [mobileOpen, setMobileOpen] = reactExports.useState(false);
  const [unreadCount, setUnreadCount] = reactExports.useState(0);
  const { logout } = useAuth();
  const { isDark, toggleDark } = useDarkMode();
  const { profile } = useUserRole();
  const router = useRouter();
  const location = useLocation();
  const { actor, isFetching } = useActor(createActor);
  reactExports.useEffect(() => {
    if (!actor || isFetching) return;
    const fetchUnread = () => {
      actor.get_unread_count().then((n) => setUnreadCount(Number(n))).catch(() => {
      });
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 1e4);
    return () => clearInterval(id);
  }, [actor, isFetching]);
  const institutionName = profile && "institutionName" in profile ? profile.institutionName : "Financier";
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
            "data-ocid": "financier_sidebar.brand_link",
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
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "truncate text-xs font-semibold text-primary", children: institutionName }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Financier" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "nav",
      {
        className: "flex-1 space-y-1 overflow-y-auto px-2 py-4",
        "aria-label": "Financier navigation",
        children: [
          navItems.map((item) => {
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
                "data-ocid": `financier_sidebar.${item.label.toLowerCase().replace(/\s/g, "_")}_link`,
                title: collapsed && !mobile ? item.label : void 0,
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "h-4 w-4 shrink-0" }),
                  (!collapsed || mobile) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1", children: item.label }),
                  (!collapsed || mobile) && item.label === "Messages" && unreadCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "ml-auto h-4 min-w-4 rounded-full px-1 text-[9px] leading-none", children: unreadCount })
                ]
              },
              item.href
            );
          }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4", children: [
            (!collapsed || mobile) && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60", children: "Kashif (الكاشف)" }),
            collapsed && !mobile && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-auto my-1 h-px w-8 bg-border" }),
            kashifNavItems.map((item) => {
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
                  "data-ocid": `financier_sidebar.${item.label.toLowerCase().replace(/\s/g, "_")}_link`,
                  title: collapsed && !mobile ? item.label : void 0,
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "h-4 w-4 shrink-0" }),
                    (!collapsed || mobile) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: item.label })
                  ]
                },
                item.href
              );
            })
          ] })
        ]
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
        "data-ocid": "financier_sidebar.collapse_toggle",
        children: collapsed ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronLeft, { className: "h-4 w-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs", children: "Collapse" })
        ] })
      }
    ) })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-h-screen bg-background", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(SessionTimeoutModal, { prefix: "financier" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "aside",
      {
        className: cn(
          "hidden md:flex flex-col shrink-0 bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-20" : "w-64"
        ),
        "data-ocid": "financier_sidebar.panel",
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
              "data-ocid": "financier_topbar.mobile_menu_button",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(Menu, { className: "h-5 w-5", "aria-hidden": "true" })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden text-sm font-medium text-muted-foreground sm:block", children: "Financier Portal" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(NotificationPanel, { prefix: "financier" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "icon",
              onClick: toggleDark,
              "aria-label": "Toggle dark mode",
              className: "text-muted-foreground hover:text-foreground",
              "data-ocid": "financier_topbar.dark_mode_toggle",
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
                "data-ocid": "financier_topbar.account_dropdown",
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
                  "data-ocid": "financier_topbar.logout_button",
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
  Bookmark as B,
  Compass as C,
  FinancierLayout as F
};
