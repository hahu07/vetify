import type { FinancierProfile } from "@/backend";
import { AdminLayout } from "@/components/AdminLayout";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/use-backend";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

type FinancierStatus = "Active" | "Inactive" | "PendingReview";

function statusBadgeClass(status: FinancierStatus): string {
  switch (status) {
    case "Active":
      return "bg-primary/10 text-primary border-primary/25 dark:bg-primary/20";
    case "Inactive":
      return "bg-destructive/10 text-destructive border-destructive/25";
    default:
      return "bg-chart-4/10 text-foreground border-chart-4/25";
  }
}

// ── Deactivate Dialog ──────────────────────────────────────────────────────

interface DeactivateDialogProps {
  institutionName: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

function DeactivateDialog({
  institutionName,
  open,
  onClose,
  onConfirm,
  isPending,
}: DeactivateDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        data-ocid="admin.deactivate_dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display">
            Deactivate {institutionName}?
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            This financier will no longer be able to view applicant profiles.
          </p>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="deactivate-reason">Reason (required)</Label>
          <Input
            id="deactivate-reason"
            placeholder="e.g. License expired"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
            data-ocid="admin.deactivate_dialog.reason_input"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setReason("");
              onClose();
            }}
            disabled={isPending}
            data-ocid="admin.deactivate_dialog.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!reason.trim() || isPending}
            onClick={() => {
              if (reason.trim()) {
                onConfirm(reason.trim());
                setReason("");
              }
            }}
            data-ocid="admin.deactivate_dialog.confirm_button"
          >
            {isPending ? "Deactivating…" : "Confirm Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── FinancierRow ────────────────────────────────────────────────────────────

interface FinancierRowProps {
  fin: FinancierProfile;
  idx: number;
  onToggle: (
    userId: string,
    name: string,
    currentStatus: FinancierStatus,
  ) => void;
  isPending: boolean;
}

function FinancierRow({ fin, idx, onToggle, isPending }: FinancierRowProps) {
  const status: FinancierStatus =
    (fin.financierStatus as FinancierStatus | undefined) ?? "PendingReview";
  const isActive = status === "Active";

  return (
    <Card data-ocid={`admin.financier.item.${idx}`}>
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {fin.institutionName}
          </p>
          <p className="text-xs text-muted-foreground">
            {fin.contactPerson} · {fin.phone}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="outline"
            className={statusBadgeClass(status)}
            data-ocid={`admin.financier.status_badge.${idx}`}
          >
            {status}
          </Badge>
          <Button
            size="sm"
            variant={isActive ? "destructive" : "outline"}
            disabled={isPending}
            type="button"
            onClick={() =>
              onToggle(fin.userId.toString(), fin.institutionName, status)
            }
            data-ocid={`admin.financier.toggle_button.${idx}`}
          >
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── AdminFinanciersPage ────────────────────────────────────────────────────

export default function AdminFinanciersPage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [deactivateTarget, setDeactivateTarget] = useState<{
    userId: string;
    name: string;
    status: FinancierStatus;
  } | null>(null);

  const financiersQuery = useQuery({
    queryKey: ["admin_financiers", currentPage],
    queryFn: async () => {
      if (!actor)
        return { items: [], total: 0n, page: 1n, pageSize: BigInt(PAGE_SIZE) };
      return actor.adminListFinanciers(BigInt(currentPage), BigInt(PAGE_SIZE));
    },
    enabled: !!actor,
    placeholderData: (prev) => prev,
  });

  const financierStatusMutation = useMutation({
    mutationFn: async ({
      userId,
      status,
      reason,
    }: { userId: string; status: FinancierStatus; reason: string }) => {
      if (!actor) throw new Error("Not connected");
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      const { Principal } = await import("@icp-sdk/core/principal");
      if (typeof actorAny.setFinancierStatus === "function") {
        return actorAny.setFinancierStatus(
          Principal.fromText(userId),
          status,
          reason,
        );
      }
      throw new Error("setFinancierStatus not available on this deployment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_financiers"] });
      toast.success("Financier status updated");
    },
    onError: (err) =>
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update financier status",
      ),
  });

  const _financiersRaw = financiersQuery.data;
  const financiers: FinancierProfile[] =
    _financiersRaw &&
    !Array.isArray(_financiersRaw) &&
    (_financiersRaw as unknown as { items?: FinancierProfile[] }).items
      ? (_financiersRaw as unknown as { items: FinancierProfile[] }).items
      : [];

  const totalFinanciers = _financiersRaw
    ? Number(
        (_financiersRaw as unknown as { total?: bigint }).total ??
          financiers.length,
      )
    : 0;
  const totalPages = Math.max(1, Math.ceil(totalFinanciers / PAGE_SIZE));

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <PageHeader
          title="Registered Financiers"
          subtitle="Manage financier institution accounts and their platform access."
          breadcrumbs={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Financiers" },
          ]}
        />

        {financiersQuery.isLoading ? (
          <div className="space-y-3">
            {["a", "b", "c"].map((k) => (
              <Skeleton key={k} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : financiers.length === 0 ? (
          <Card>
            <CardContent
              className="py-12 text-center text-sm text-muted-foreground"
              data-ocid="admin.financiers.empty_state"
            >
              <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              No financiers registered yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {financiers.map((fin, idx) => (
              <FinancierRow
                key={fin.userId.toString()}
                fin={fin}
                idx={idx + 1}
                onToggle={(userId, name, currentStatus) => {
                  if (currentStatus === "Active") {
                    setDeactivateTarget({
                      userId,
                      name,
                      status: currentStatus,
                    });
                  } else {
                    financierStatusMutation.mutate({
                      userId,
                      status: "Active",
                      reason: "Activated by admin",
                    });
                  }
                }}
                isPending={financierStatusMutation.isPending}
              />
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(p) => setCurrentPage(p)}
          isLoading={financiersQuery.isFetching}
        />
      </div>

      {deactivateTarget && (
        <DeactivateDialog
          institutionName={deactivateTarget.name}
          open={!!deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={(reason) => {
            financierStatusMutation.mutate(
              { userId: deactivateTarget.userId, status: "Inactive", reason },
              { onSettled: () => setDeactivateTarget(null) },
            );
          }}
          isPending={financierStatusMutation.isPending}
        />
      )}
    </AdminLayout>
  );
}
