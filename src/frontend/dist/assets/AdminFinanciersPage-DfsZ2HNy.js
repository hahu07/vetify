const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-DiwSGmNR.js","assets/index-BQq4RvRC.css"])))=>i.map(i=>d[i]);
import { g as useBackend, D as useQueryClient, r as reactExports, n as useQuery, E as useMutation, j as jsxRuntimeExports, G as AdminLayout, P as PageHeader, w as Skeleton, C as Card, e as CardContent, l as ue, _ as __vitePreload, B as Badge, b as Button, J as Dialog, K as DialogContent, M as DialogHeader, N as DialogTitle, h as Label, I as Input, O as DialogFooter } from "./index-DiwSGmNR.js";
import { P as Pagination } from "./Pagination-C2tGfPIh.js";
import { B as Briefcase } from "./briefcase-DBG_QeAu.js";
const PAGE_SIZE = 20;
function statusBadgeClass(status) {
  switch (status) {
    case "Active":
      return "bg-primary/10 text-primary border-primary/25 dark:bg-primary/20";
    case "Inactive":
      return "bg-destructive/10 text-destructive border-destructive/25";
    default:
      return "bg-chart-4/10 text-foreground border-chart-4/25";
  }
}
function DeactivateDialog({
  institutionName,
  open,
  onClose,
  onConfirm,
  isPending
}) {
  const [reason, setReason] = reactExports.useState("");
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Dialog,
    {
      open,
      onOpenChange: (o) => {
        if (!o) {
          setReason("");
          onClose();
        }
      },
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        DialogContent,
        {
          className: "sm:max-w-md",
          "data-ocid": "admin.deactivate_dialog",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogTitle, { className: "font-display", children: [
                "Deactivate ",
                institutionName,
                "?"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "This financier will no longer be able to view applicant profiles." })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 py-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "deactivate-reason", children: "Reason (required)" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Input,
                {
                  id: "deactivate-reason",
                  placeholder: "e.g. License expired",
                  value: reason,
                  onChange: (e) => setReason(e.target.value),
                  autoFocus: true,
                  "data-ocid": "admin.deactivate_dialog.reason_input"
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogFooter, { className: "gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  type: "button",
                  variant: "outline",
                  onClick: () => {
                    setReason("");
                    onClose();
                  },
                  disabled: isPending,
                  "data-ocid": "admin.deactivate_dialog.cancel_button",
                  children: "Cancel"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  type: "button",
                  variant: "destructive",
                  disabled: !reason.trim() || isPending,
                  onClick: () => {
                    if (reason.trim()) {
                      onConfirm(reason.trim());
                      setReason("");
                    }
                  },
                  "data-ocid": "admin.deactivate_dialog.confirm_button",
                  children: isPending ? "Deactivating…" : "Confirm Deactivate"
                }
              )
            ] })
          ]
        }
      )
    }
  );
}
function FinancierRow({ fin, idx, onToggle, isPending }) {
  const status = fin.financierStatus ?? "PendingReview";
  const isActive = status === "Active";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { "data-ocid": `admin.financier.item.${idx}`, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "flex items-center justify-between gap-3 py-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "truncate text-sm font-semibold text-foreground", children: fin.institutionName }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
        fin.contactPerson,
        " · ",
        fin.phone
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Badge,
        {
          variant: "outline",
          className: statusBadgeClass(status),
          "data-ocid": `admin.financier.status_badge.${idx}`,
          children: status
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Button,
        {
          size: "sm",
          variant: isActive ? "destructive" : "outline",
          disabled: isPending,
          type: "button",
          onClick: () => onToggle(fin.userId.toString(), fin.institutionName, status),
          "data-ocid": `admin.financier.toggle_button.${idx}`,
          children: isActive ? "Deactivate" : "Activate"
        }
      )
    ] })
  ] }) });
}
function AdminFinanciersPage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = reactExports.useState(1);
  const [deactivateTarget, setDeactivateTarget] = reactExports.useState(null);
  const financiersQuery = useQuery({
    queryKey: ["admin_financiers", currentPage],
    queryFn: async () => {
      if (!actor)
        return { items: [], total: 0n, page: 1n, pageSize: BigInt(PAGE_SIZE) };
      return actor.adminListFinanciers(BigInt(currentPage), BigInt(PAGE_SIZE));
    },
    enabled: !!actor,
    placeholderData: (prev) => prev
  });
  const financierStatusMutation = useMutation({
    mutationFn: async ({
      userId,
      status,
      reason
    }) => {
      if (!actor) throw new Error("Not connected");
      const actorAny = actor;
      const { Principal } = await __vitePreload(async () => {
        const { Principal: Principal2 } = await import("./index-DiwSGmNR.js").then((n) => n.bl);
        return { Principal: Principal2 };
      }, true ? __vite__mapDeps([0,1]) : void 0);
      if (typeof actorAny.setFinancierStatus === "function") {
        return actorAny.setFinancierStatus(
          Principal.fromText(userId),
          status,
          reason
        );
      }
      throw new Error("setFinancierStatus not available on this deployment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_financiers"] });
      ue.success("Financier status updated");
    },
    onError: (err) => ue.error(
      err instanceof Error ? err.message : "Failed to update financier status"
    )
  });
  const _financiersRaw = financiersQuery.data;
  const financiers = _financiersRaw && !Array.isArray(_financiersRaw) && _financiersRaw.items ? _financiersRaw.items : [];
  const totalFinanciers = _financiersRaw ? Number(
    _financiersRaw.total ?? financiers.length
  ) : 0;
  const totalPages = Math.max(1, Math.ceil(totalFinanciers / PAGE_SIZE));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(AdminLayout, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-6xl px-4 py-10", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        PageHeader,
        {
          title: "Registered Financiers",
          subtitle: "Manage financier institution accounts and their platform access.",
          breadcrumbs: [
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Financiers" }
          ]
        }
      ),
      financiersQuery.isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: ["a", "b", "c"].map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-14 w-full rounded-xl" }, k)) }) : financiers.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        CardContent,
        {
          className: "py-12 text-center text-sm text-muted-foreground",
          "data-ocid": "admin.financiers.empty_state",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Briefcase, { className: "mx-auto mb-3 h-10 w-10 text-muted-foreground/40" }),
            "No financiers registered yet."
          ]
        }
      ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2", children: financiers.map((fin, idx) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        FinancierRow,
        {
          fin,
          idx: idx + 1,
          onToggle: (userId, name, currentStatus) => {
            if (currentStatus === "Active") {
              setDeactivateTarget({
                userId,
                name,
                status: currentStatus
              });
            } else {
              financierStatusMutation.mutate({
                userId,
                status: "Active",
                reason: "Activated by admin"
              });
            }
          },
          isPending: financierStatusMutation.isPending
        },
        fin.userId.toString()
      )) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Pagination,
        {
          currentPage,
          totalPages,
          onPageChange: (p) => setCurrentPage(p),
          isLoading: financiersQuery.isFetching
        }
      )
    ] }),
    deactivateTarget && /* @__PURE__ */ jsxRuntimeExports.jsx(
      DeactivateDialog,
      {
        institutionName: deactivateTarget.name,
        open: !!deactivateTarget,
        onClose: () => setDeactivateTarget(null),
        onConfirm: (reason) => {
          financierStatusMutation.mutate(
            { userId: deactivateTarget.userId, status: "Inactive", reason },
            { onSettled: () => setDeactivateTarget(null) }
          );
        },
        isPending: financierStatusMutation.isPending
      }
    )
  ] });
}
export {
  AdminFinanciersPage as default
};
