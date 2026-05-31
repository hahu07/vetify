import { r as reactExports, u as useAuth, V as useDarkMode, a as useRouter, j as jsxRuntimeExports, w as Link, b as Button, a0 as Sun, a1 as Moon, a2 as DropdownMenu, a3 as DropdownMenuTrigger, p as Shield, o as ChevronDown, a4 as DropdownMenuContent, a5 as DropdownMenuSeparator, a6 as DropdownMenuItem, a7 as LogOut, Y as X, Z as Menu } from "./index-CPnZ4-ee.js";
function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = reactExports.useState(false);
  const { isAuthenticated, login, logout, isInitializing, isLoggingIn } = useAuth();
  const { isDark, toggleDark } = useDarkMode();
  const router = useRouter();
  const handleLogout = () => {
    logout();
    router.navigate({ to: "/" });
    setMobileOpen(false);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-h-screen flex-col bg-background", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "sticky top-0 z-40 border-b border-border bg-card shadow-xs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto flex h-16 items-center justify-between px-4 md:px-6", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Link,
          {
            to: "/",
            className: "flex items-center gap-2.5 group",
            "data-ocid": "nav.brand_link",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "img",
                {
                  src: "/assets/generated/halalvet-logo-transparent.dim_80x80.png",
                  alt: "Vetify",
                  className: "h-8 w-8 object-contain"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-display text-xl font-bold tracking-tight text-primary group-hover:text-primary/80 transition-colors", children: "Vetify" })
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              variant: "ghost",
              size: "icon",
              onClick: toggleDark,
              "aria-label": "Toggle dark mode",
              className: "text-muted-foreground hover:text-foreground",
              "data-ocid": "nav.dark_mode_toggle",
              type: "button",
              children: isDark ? /* @__PURE__ */ jsxRuntimeExports.jsx(Sun, { className: "h-4 w-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Moon, { className: "h-4 w-4" })
            }
          ),
          isAuthenticated ? /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                variant: "outline",
                size: "sm",
                className: "hidden gap-1.5 md:flex",
                "data-ocid": "nav.account_dropdown",
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
                  "data-ocid": "nav.logout_button",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "mr-2 h-4 w-4" }),
                    "Sign Out"
                  ]
                }
              )
            ] })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              size: "sm",
              onClick: login,
              disabled: isInitializing || isLoggingIn,
              className: "hidden md:flex",
              "data-ocid": "nav.login_button",
              children: isInitializing ? "Loading…" : isLoggingIn ? "Connecting…" : "Sign In"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              variant: "ghost",
              size: "icon",
              className: "md:hidden",
              onClick: () => setMobileOpen((o) => !o),
              "aria-label": mobileOpen ? "Close menu" : "Open menu",
              "data-ocid": "nav.mobile_menu_button",
              children: mobileOpen ? /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-5 w-5" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Menu, { className: "h-5 w-5" })
            }
          )
        ] })
      ] }),
      mobileOpen && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "border-t border-border bg-card px-4 pb-4 pt-3 md:hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { className: "flex flex-col gap-1", "aria-label": "Mobile navigation", children: isAuthenticated ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Button,
        {
          variant: "ghost",
          size: "sm",
          className: "w-full justify-start text-destructive",
          onClick: handleLogout,
          "data-ocid": "nav.mobile.logout_button",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "mr-2 h-4 w-4" }),
            "Sign Out"
          ]
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
        Button,
        {
          size: "sm",
          className: "w-full",
          onClick: () => {
            login();
            setMobileOpen(false);
          },
          disabled: isInitializing || isLoggingIn,
          "data-ocid": "nav.mobile.login_button",
          children: "Sign In"
        }
      ) }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "flex-1", children }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("footer", { className: "border-t border-border bg-card", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-6 text-center text-sm text-muted-foreground md:flex-row md:text-left", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "img",
          {
            src: "/assets/generated/halalvet-logo-transparent.dim_80x80.png",
            alt: "Vetify",
            className: "h-5 w-5 object-contain opacity-70"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: "Vetify" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-border", children: "·" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Trusted Ethical Finance Vetting" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { children: [
        "© ",
        (/* @__PURE__ */ new Date()).getFullYear(),
        ". Built with love using",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "a",
          {
            href: `https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-primary hover:underline",
            children: "caffeine.ai"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Layout as L
};
