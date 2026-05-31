import { g as useBackend, u as useAuth, m as useNavigate, r as reactExports, j as jsxRuntimeExports, P as PageHeader, C as Card, c as CardHeader, d as CardTitle, ae as ShieldAlert, e as CardContent, af as LoaderCircle, f as CircleCheck, b as Button } from "./index-CPnZ4-ee.js";
import { L as Layout } from "./Layout-BDI6gK-F.js";
function AdminBootstrap() {
  const { actor } = useBackend();
  const { principal, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isBootstrapped, setIsBootstrapped] = reactExports.useState(null);
  const [checkLoading, setCheckLoading] = reactExports.useState(true);
  const [isSubmitting, setIsSubmitting] = reactExports.useState(false);
  const [error, setError] = reactExports.useState(null);
  const [success, setSuccess] = reactExports.useState(false);
  reactExports.useEffect(() => {
    if (!actor) return;
    void (async () => {
      setCheckLoading(true);
      try {
        const bootstrapped = await actor.isAdminBootstrapped();
        setIsBootstrapped(bootstrapped);
      } catch {
        setIsBootstrapped(false);
      } finally {
        setCheckLoading(false);
      }
    })();
  }, [actor]);
  const handleBootstrap = async () => {
    if (!actor || !principal) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await actor.bootstrapAdmin(principal);
      setSuccess(true);
      setTimeout(() => navigate({ to: "/admin/dashboard" }), 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to bootstrap admin"
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const isLoading = checkLoading || !actor;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Layout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-lg px-4 py-16", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Admin Bootstrap",
        subtitle: "One-time setup to configure the first admin account.",
        breadcrumbs: [{ label: "Admin Setup" }]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "admin_bootstrap.card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldAlert, { className: "h-5 w-5 text-primary" }),
        "Admin Configuration"
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "space-y-5", children: [
        isLoading && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "flex items-center gap-2 text-sm text-muted-foreground",
            "data-ocid": "admin_bootstrap.loading_state",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
              "Checking admin status…"
            ]
          }
        ),
        !isLoading && isBootstrapped && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-4",
            "data-ocid": "admin_bootstrap.already_configured",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-5 w-5 shrink-0 text-emerald-500" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-emerald-800 dark:text-emerald-300", children: "Admin Already Configured" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-emerald-700 dark:text-emerald-400", children: "This platform already has an admin account set up." })
              ] })
            ]
          }
        ),
        !isLoading && !isBootstrapped && !success && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "space-y-4",
            "data-ocid": "admin_bootstrap.setup_panel",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "No admin account has been configured yet. Click the button below to designate your Internet Identity principal as the platform administrator." }),
              !isAuthenticated && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "p",
                {
                  className: "text-sm text-destructive",
                  "data-ocid": "admin_bootstrap.not_authenticated",
                  children: "You must be logged in to bootstrap admin access."
                }
              ),
              principal && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-md border border-border bg-muted/30 px-3 py-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground uppercase tracking-wide mb-0.5", children: "Your Principal" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "break-all font-mono text-xs text-foreground", children: principal.toText() })
              ] }),
              error && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "p",
                {
                  className: "text-sm text-destructive",
                  "data-ocid": "admin_bootstrap.error_state",
                  children: error
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  onClick: handleBootstrap,
                  disabled: isSubmitting || !isAuthenticated || !principal,
                  className: "w-full gap-2",
                  "data-ocid": "admin_bootstrap.submit_button",
                  type: "button",
                  children: isSubmitting ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
                    "Configuring…"
                  ] }) : "Set Myself as Admin"
                }
              )
            ]
          }
        ),
        success && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-4",
            "data-ocid": "admin_bootstrap.success_state",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-5 w-5 shrink-0 text-emerald-500" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-emerald-800 dark:text-emerald-300", children: "Admin Configured!" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-emerald-700 dark:text-emerald-400", children: "Redirecting to admin dashboard…" })
              ] })
            ]
          }
        )
      ] })
    ] })
  ] }) });
}
export {
  AdminBootstrap as default
};
