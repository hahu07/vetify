import { r as reactExports, u as useAuth, X as useDarkMode, a as useRouter, Y as useLocation, Z as useActor, j as jsxRuntimeExports, $ as SessionTimeoutModal, z as cn, a0 as X, a1 as Menu, a2 as NotificationPanel, b as Button, a3 as Sun, a4 as Moon, a5 as DropdownMenu, a6 as DropdownMenuTrigger, p as ChevronDown, a7 as DropdownMenuContent, a8 as DropdownMenuSeparator, a9 as DropdownMenuItem, aa as LogOut, x as Link, ab as LayoutDashboard, q as Shield, B as Badge, y as ChevronRight, ac as ChevronLeft, ad as createActor } from "./index-DiwSGmNR.js";
import { u as useUserRole } from "./use-user-role-DlEe0uPV.js";
import { U as User } from "./user-BQRpN4aJ.js";
import { B as BrainCircuit, C as CreditCard } from "./credit-card-CXB9DyZH.js";
import { M as MessageCircle } from "./message-circle-C1jDekiM.js";
const navItems = [
  { label: "Overview", href: "/individual/dashboard", icon: LayoutDashboard },
  { label: "KYC Status", href: "/individual/kyc", icon: Shield },
  {
    label: "Tawthiq Assessment",
    href: "/individual/scores",
    icon: BrainCircuit
  },
  { label: "Bank Linking", href: "/individual/bank", icon: CreditCard },
  { label: "My Profile", href: "/individual/profile", icon: User },
  { label: "Messages", href: "/messages", icon: MessageCircle }
];
function IndividualLayout({ children }) {
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
  const fullName = profile && "fullName" in profile ? profile.fullName : "Individual";
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
            "data-ocid": "individual_sidebar.brand_link",
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
              (!collapsed || mobile) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-display text-xl font-bold tracking-tight text-[var(--individual-accent,oklch(0.65_0.18_60))] group-hover:opacity-80 transition-opacity", children: "Vetify" })
            ]
          }
        )
      }
    ),
    (!collapsed || mobile) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-3 mt-3 rounded-md bg-[var(--individual-accent,oklch(0.75_0.16_60))]/10 px-3 py-1.5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "truncate text-xs font-semibold text-[var(--individual-accent,oklch(0.65_0.18_60))]", children: fullName }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Individual Applicant" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "nav",
      {
        className: "flex-1 space-y-1 overflow-y-auto px-2 py-4",
        "aria-label": "Individual navigation",
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
                active ? "bg-[var(--individual-accent,oklch(0.65_0.18_60))] text-white shadow-xs" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              ),
              "data-ocid": `individual_sidebar.${item.label.toLowerCase().replace(/\s/g, "_")}_link`,
              title: collapsed && !mobile ? item.label : void 0,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "h-4 w-4 shrink-0" }),
                (!collapsed || mobile) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1", children: item.label }),
                (!collapsed || mobile) && item.label === "Messages" && unreadCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "ml-auto h-4 min-w-4 rounded-full px-1 text-[9px] leading-none", children: unreadCount })
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
        "data-ocid": "individual_sidebar.collapse_toggle",
        children: collapsed ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronLeft, { className: "h-4 w-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs", children: "Collapse" })
        ] })
      }
    ) })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-h-screen bg-background", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(SessionTimeoutModal, { prefix: "individual" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "aside",
      {
        className: cn(
          "hidden md:flex flex-col shrink-0 bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-20" : "w-64"
        ),
        "data-ocid": "individual_sidebar.panel",
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
              "data-ocid": "individual_topbar.mobile_menu_button",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(Menu, { className: "h-5 w-5", "aria-hidden": "true" })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden text-sm font-medium text-muted-foreground sm:block", children: "Individual Portal" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(NotificationPanel, { prefix: "individual" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "icon",
              onClick: toggleDark,
              "aria-label": "Toggle dark mode",
              className: "text-muted-foreground hover:text-foreground",
              "data-ocid": "individual_topbar.dark_mode_toggle",
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
                className: "gap-1.5 border-[var(--individual-accent,oklch(0.75_0.16_60))]/40 hover:border-[var(--individual-accent,oklch(0.75_0.16_60))]",
                "data-ocid": "individual_topbar.account_dropdown",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "h-3.5 w-3.5 text-[var(--individual-accent,oklch(0.65_0.18_60))]" }),
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
                  "data-ocid": "individual_topbar.logout_button",
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
  IndividualLayout as I
};
