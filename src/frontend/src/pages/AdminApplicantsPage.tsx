import {
  HalalComplianceStatus,
  type IndividualProfile,
  type IndividualSummary,
  KycStatus,
  RegistrationStatus,
  RiskLevel__1,
  Variant_conditionalReady_notReady_ready,
} from "@/backend";
import type { BusinessProfile, TawthiqRecord } from "@/backend";
import { AdminLayout } from "@/components/AdminLayout";
import { MizanScoresCard } from "@/components/MizanScoresCard";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { TawthiqStatusCard } from "@/components/TawthiqStatusCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBackend } from "@/hooks/use-backend";
import type { MizanRecord } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock,
  CreditCard,
  Link2,
  MessageSquare,
  Scale,
  Search,
  Shield,
  TrendingUp,
  User,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

type StatusTransition = {
  label: string;
  next: RegistrationStatus;
  danger?: boolean;
};

function allowedTransitions(status: RegistrationStatus): StatusTransition[] {
  switch (status) {
    case RegistrationStatus.pending:
      return [{ label: "Start Review", next: RegistrationStatus.underReview }];
    case RegistrationStatus.underReview:
      return [
        {
          label: "Mark Financing-Ready",
          next: RegistrationStatus.financingReady,
        },
        { label: "Reject", next: RegistrationStatus.rejected, danger: true },
      ];
    case RegistrationStatus.financingReady:
      return [
        { label: "Approve", next: RegistrationStatus.approved },
        { label: "Reject", next: RegistrationStatus.rejected, danger: true },
      ];
    default:
      return [];
  }
}

function statusBadgeClass(status: RegistrationStatus): string {
  switch (status) {
    case RegistrationStatus.approved:
      return "bg-primary/10 text-primary border-primary/25 dark:bg-primary/20";
    case RegistrationStatus.financingReady:
      return "bg-accent/10 text-accent-foreground border-accent/25 dark:bg-accent/20";
    case RegistrationStatus.underReview:
      return "bg-chart-4/10 text-foreground border-chart-4/25";
    case RegistrationStatus.rejected:
      return "bg-destructive/10 text-destructive border-destructive/25";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function kycStatusIcon(verified: boolean) {
  return verified ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
  ) : (
    <XCircle className="h-3.5 w-3.5 text-destructive" />
  );
}

function riskBadge(risk: RiskLevel__1) {
  const cls =
    risk === RiskLevel__1.low
      ? "bg-primary/10 text-primary"
      : risk === RiskLevel__1.medium
        ? "bg-chart-2/10 text-chart-2"
        : risk === RiskLevel__1.high
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {risk}
    </span>
  );
}

function halalBadge(status: HalalComplianceStatus) {
  const cls =
    status === HalalComplianceStatus.compliant
      ? "bg-primary/10 text-primary"
      : status === HalalComplianceStatus.flagged
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function creditReadinessBadge(
  verdict: Variant_conditionalReady_notReady_ready | string,
) {
  const isReady =
    verdict === Variant_conditionalReady_notReady_ready.ready ||
    verdict === "ready";
  const isConditional =
    verdict === Variant_conditionalReady_notReady_ready.conditionalReady ||
    verdict === "conditionalReady";
  const cls = isReady
    ? "bg-primary/10 text-primary border-primary/25"
    : isConditional
      ? "bg-chart-3/10 text-foreground border-chart-3/25"
      : "bg-destructive/10 text-destructive border-destructive/25";
  const label = isReady ? "Ready" : isConditional ? "Conditional" : "Not Ready";
  return (
    <Badge variant="outline" className={cls}>
      {label}
    </Badge>
  );
}

// ── Reject Dialog ───────────────────────────────────────────────────

interface RejectDialogProps {
  businessName: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

function RejectDialog({
  businessName,
  open,
  onClose,
  onConfirm,
  isPending,
}: RejectDialogProps) {
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
      <DialogContent className="sm:max-w-md" data-ocid="admin.reject_dialog">
        <DialogHeader>
          <DialogTitle className="font-display">
            Reject {businessName}?
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to reject this applicant? This action will
            send a WhatsApp notification with your reason.
          </p>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="reject-reason">Rejection Reason (required)</Label>
          <Input
            id="reject-reason"
            placeholder="e.g. Insufficient financial history"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
            data-ocid="admin.reject_dialog.reason_input"
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
            data-ocid="admin.reject_dialog.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!reason.trim() || isPending}
            onClick={() => {
              if (reason.trim()) onConfirm(reason.trim());
            }}
            data-ocid="admin.reject_dialog.confirm_button"
          >
            {isPending ? "Rejecting…" : "Confirm Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── BusinessRow ────────────────────────────────────────────────────────────

interface BusinessRowProps {
  biz: BusinessProfile;
  idx: number;
  onReject: (userId: string, name: string) => void;
  onAdvance: (userId: string, next: RegistrationStatus) => void;
  isPending: boolean;
}

function BusinessRow({
  biz,
  idx,
  onReject,
  onAdvance,
  isPending,
}: BusinessRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const transitions = allowedTransitions(biz.registrationStatus);
  const hasScores = biz.scoringRecord.financingReadinessScore > 0n;

  const mizanQuery = useQuery({
    queryKey: ["mizan_result", biz.userId.toString()],
    queryFn: async () => {
      if (!actor) return null;
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof actorAny.getMizanResult !== "function") return null;
      const result = (await actorAny.getMizanResult(biz.userId.toString())) as
        | { ok: MizanRecord }
        | { err: string }
        | null;
      if (!result) return null;
      if ("ok" in result) return result.ok;
      return null;
    },
    enabled: !!actor && expanded,
  });

  const retriggerMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof actorAny.triggerMizanAnalysis !== "function")
        throw new Error("triggerMizanAnalysis not available");
      const res = (await actorAny.triggerMizanAnalysis(
        biz.userId.toString(),
      )) as { ok: MizanRecord } | { err: string };
      if ("err" in res) throw new Error(res.err);
      return res.ok;
    },
    onSuccess: () => {
      toast.success("Mizan analysis re-triggered");
      queryClient.invalidateQueries({
        queryKey: ["mizan_result", biz.userId.toString()],
      });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to re-trigger Mizan analysis",
      ),
  });

  return (
    <Card
      className="transition-smooth hover:border-primary/30"
      data-ocid={`admin.business.item.${idx}`}
    >
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {biz.businessName}
            </p>
            <p className="text-xs text-muted-foreground">
              {biz.businessType} · {biz.phoneNumber}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={
              biz.kycRecord.kycStatus === KycStatus.Verified
                ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                : biz.kycRecord.kycStatus === KycStatus.Failed
                  ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                  : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            }
            data-ocid={`admin.business.kyc_status.${idx}`}
          >
            KYC: {biz.kycRecord.kycStatus}
          </span>
          <Badge
            variant="outline"
            className={statusBadgeClass(biz.registrationStatus)}
            data-ocid={`admin.business.status_badge.${idx}`}
          >
            {biz.registrationStatus}
          </Badge>
          {transitions.map((t) =>
            t.danger ? (
              <Button
                key={t.next}
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() =>
                  onReject(biz.userId.toString(), biz.businessName)
                }
                data-ocid={`admin.business.reject_button.${idx}`}
              >
                {t.label}
              </Button>
            ) : (
              <Button
                key={t.next}
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => onAdvance(biz.userId.toString(), t.next)}
                data-ocid={`admin.business.advance_button.${idx}`}
              >
                {t.label}
              </Button>
            ),
          )}
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
            data-ocid={`admin.business.expand_button.${idx}`}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>

      {expanded && (
        <>
          <Separator />
          <CardContent className="grid gap-6 pb-5 pt-4 sm:grid-cols-3">
            <div data-ocid={`admin.business.kyc_detail.${idx}`}>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Shield className="h-3.5 w-3.5" /> KYC Verification
              </p>
              <ul className="space-y-1.5">
                {(
                  [
                    ["BVN", biz.kycRecord.bvnVerified],
                    ["NIN", biz.kycRecord.ninVerified],
                    ["CAC", biz.kycRecord.cacVerified],
                    ["TIN", biz.kycRecord.tinVerified],
                    ["Watchlist Clear", biz.kycRecord.watchlistClean],
                  ] as [string, boolean][]
                ).map(([label, val]) => (
                  <li key={label} className="flex items-center gap-2 text-sm">
                    {kycStatusIcon(val)}
                    <span className="text-foreground">{label}</span>
                  </li>
                ))}
              </ul>
              {biz.kycRecord.creditScore > 0n && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Credit score:{" "}
                  <span className="font-medium text-foreground">
                    {biz.kycRecord.creditScore.toString()}
                  </span>
                </p>
              )}
            </div>

            <div data-ocid={`admin.business.bank_link_detail.${idx}`}>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" /> Bank Account
              </p>
              {biz.bankLinkRecord.status.__kind__ === "Linked" ? (
                <div className="space-y-1">
                  <p className="flex items-center gap-1 text-sm text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Linked
                  </p>
                  {biz.bankLinkRecord.institutionName && (
                    <p className="text-xs text-muted-foreground">
                      {biz.bankLinkRecord.institutionName}
                    </p>
                  )}
                  {biz.bankLinkRecord.balance !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Balance: {biz.bankLinkRecord.currency ?? "NGN"}{" "}
                      {biz.bankLinkRecord.balance?.toString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CircleDot className="h-3.5 w-3.5" /> Not linked
                </p>
              )}
            </div>

            <div data-ocid={`admin.business.ai_scores_detail.${idx}`}>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" /> AI Scores
              </p>
              {hasScores ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Financing Readiness
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {biz.scoringRecord.financingReadinessScore.toString()}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Halal Compliance
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-foreground">
                        {biz.scoringRecord.halalComplianceScore.toString()}%
                      </p>
                      {halalBadge(biz.halalComplianceStatus)}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Risk Level</p>
                    {riskBadge(biz.riskLevel)}
                  </div>
                  {biz.scoringRecord.scoringNotes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {biz.scoringRecord.scoringNotes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not scored yet</p>
              )}
            </div>
          </CardContent>

          {/* Score Divergence Alert */}
          {biz.mizanDivergenceAlert && (
            <>
              <Separator />
              <CardContent className="py-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-300/60 dark:border-amber-700/50">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Score Divergence — Preliminary and full Mizan scores differ
                  significantly
                </span>
              </CardContent>
            </>
          )}

          {/* Tawthiq Analysis Section */}
          <Separator />
          <CardContent
            className="pb-5 pt-4"
            data-ocid={`admin.business.tawthiq_detail.${idx}`}
          >
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Scale className="h-3.5 w-3.5" /> Tawthiq — Verification &
              Compliance
            </p>
            {biz.tawthiqRecord ? (
              <TawthiqStatusCard tawthiqRecord={biz.tawthiqRecord} />
            ) : (
              <div
                className="flex items-center gap-2 rounded-md bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
                data-ocid={`admin.business.tawthiq_pending.${idx}`}
              >
                <Clock className="h-4 w-4 shrink-0 animate-pulse" />
                Tawthiq analysis pending…
              </div>
            )}
          </CardContent>

          {/* Mizan — AI Risk & Underwriting */}
          <Separator />
          <CardContent
            className="pb-5 pt-4"
            data-ocid={`admin.business.mizan_detail.${idx}`}
          >
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Mizan (الميزان) — Risk &
              Underwriting
            </p>
            <MizanScoresCard
              mizan={mizanQuery.data ?? null}
              isLoading={mizanQuery.isLoading}
              isAdmin
              onRetrigger={() => retriggerMutation.mutate()}
            />
          </CardContent>
        </>
      )}
    </Card>
  );
}

// ── IndividualRow ───────────────────────────────────────────────────────────

const FINANCING_PURPOSE_LABELS: Record<string, string> = {
  homePurchase: "Home Purchase",
  vehicle: "Vehicle",
  education: "Education",
  medical: "Medical",
  startupCapital: "Startup Capital",
  other: "Other",
};

interface IndividualRowProps {
  summary: IndividualSummary;
  idx: number;
  onChangeStatus: (id: string, next: RegistrationStatus) => void;
  onMarkReady: (id: string) => void;
  isPending: boolean;
}

function IndividualRow({
  summary,
  idx,
  onChangeStatus,
  onMarkReady,
  isPending,
}: IndividualRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { actor } = useBackend();

  const id =
    (
      summary as IndividualSummary & {
        id?: { toString(): string };
        userId?: { toString(): string };
      }
    ).id ??
    (summary as IndividualSummary & { userId?: { toString(): string } }).userId;
  const idStr = id?.toString() ?? "";

  const detailQuery = useQuery({
    queryKey: ["admin_individual_detail", idStr],
    queryFn: async () => {
      if (!actor || !idStr) return null;
      const { Principal } = await import("@icp-sdk/core/principal");
      const res = await actor.adminGetIndividual(Principal.fromText(idStr));
      if ("__kind__" in res) {
        if (res.__kind__ === "ok")
          return (res as { __kind__: "ok"; ok: IndividualProfile }).ok;
        return null;
      }
      return null;
    },
    enabled: !!actor && expanded && !!idStr,
  });

  const detail = detailQuery.data;
  const tawthiq = detail?.tawthiqRecord ?? null;
  const mizan = detail?.mizanRecord ?? null;
  const kyc = detail?.kycRecord ?? null;
  const transitions = allowedTransitions(summary.registrationStatus);

  return (
    <Card
      className="transition-smooth hover:border-primary/30"
      data-ocid={`admin.individual.item.${idx}`}
    >
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {summary.fullName}
            </p>
            <p className="text-xs text-muted-foreground">
              {FINANCING_PURPOSE_LABELS[summary.financingPurpose] ??
                summary.financingPurpose}
              {" · "}₦{Number(summary.amountSought).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={
              summary.riskLevel === RiskLevel__1.low
                ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                : summary.riskLevel === RiskLevel__1.medium
                  ? "rounded-full bg-chart-2/10 px-2 py-0.5 text-xs text-chart-2"
                  : summary.riskLevel === RiskLevel__1.pending
                    ? "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    : "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
            }
            data-ocid={`admin.individual.risk_badge.${idx}`}
          >
            {summary.riskLevel}
          </span>
          <Badge
            variant="outline"
            className={statusBadgeClass(summary.registrationStatus)}
            data-ocid={`admin.individual.status_badge.${idx}`}
          >
            {summary.registrationStatus}
          </Badge>
          {transitions.map((t) =>
            t.danger ? (
              <Button
                key={t.next}
                size="sm"
                variant="destructive"
                type="button"
                disabled={isPending}
                onClick={() => onChangeStatus(idStr, t.next)}
                data-ocid={`admin.individual.reject_button.${idx}`}
              >
                {t.label}
              </Button>
            ) : (
              <Button
                key={t.next}
                size="sm"
                variant="outline"
                type="button"
                disabled={isPending}
                onClick={() => onChangeStatus(idStr, t.next)}
                data-ocid={`admin.individual.advance_button.${idx}`}
              >
                {t.label}
              </Button>
            ),
          )}
          {summary.registrationStatus === RegistrationStatus.financingReady && (
            <Button
              size="sm"
              variant="default"
              type="button"
              disabled={isPending}
              onClick={() => onMarkReady(idStr)}
              data-ocid={`admin.individual.mark_ready_button.${idx}`}
            >
              Mark Financing-Ready
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
            data-ocid={`admin.individual.expand_button.${idx}`}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>

      {expanded && (
        <>
          <Separator />
          {detailQuery.isLoading ? (
            <CardContent className="py-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-40" />
              </div>
            </CardContent>
          ) : (
            <CardContent className="grid gap-6 pb-5 pt-4 sm:grid-cols-3">
              {/* KYC checks */}
              <div data-ocid={`admin.individual.kyc_detail.${idx}`}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" /> KYC Verification
                </p>
                {kyc ? (
                  <ul className="space-y-1.5">
                    {(
                      [
                        ["BVN", kyc.bvnVerified],
                        ["NIN", kyc.ninVerified],
                        ["Watchlist Clear", kyc.watchlistClean],
                      ] as [string, boolean][]
                    ).map(([label, val]) => (
                      <li
                        key={label}
                        className="flex items-center gap-2 text-sm"
                      >
                        {kycStatusIcon(val)}
                        <span className="text-foreground">{label}</span>
                      </li>
                    ))}
                    {kyc.creditScore > 0n && (
                      <li className="text-xs text-muted-foreground">
                        Credit score:{" "}
                        <span className="font-medium text-foreground">
                          {kyc.creditScore.toString()}
                        </span>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    KYC data unavailable
                  </p>
                )}
              </div>

              {/* Tawthiq summary */}
              <div data-ocid={`admin.individual.tawthiq_detail.${idx}`}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Scale className="h-3.5 w-3.5" /> Tawthiq Summary
                </p>
                {tawthiq ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Credit Readiness:
                      </span>
                      {creditReadinessBadge(tawthiq.creditReadiness)}
                    </div>
                    {tawthiq.shariaFlags && tawthiq.shariaFlags.length > 0 && (
                      <p className="text-xs text-destructive">
                        {tawthiq.shariaFlags.length} Sharia flag
                        {tawthiq.shariaFlags.length > 1 ? "s" : ""}
                      </p>
                    )}
                    {tawthiq.narrativeSummary && (
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {tawthiq.narrativeSummary}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 animate-pulse" /> Pending…
                  </div>
                )}
              </div>

              {/* Mizan summary */}
              <div data-ocid={`admin.individual.mizan_detail.${idx}`}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" /> Mizan Summary
                </p>
                {mizan ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Overall Score
                      </p>
                      <p className="text-lg font-bold text-primary">
                        {Number(mizan.overallScore ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Risk Level
                      </p>
                      {riskBadge(mizan.riskLevel)}
                    </div>
                    {mizan.narrativeSummary && (
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {mizan.narrativeSummary}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 animate-pulse" /> Pending…
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </>
      )}
    </Card>
  );
}

// ── Individual Applicants Tab ──────────────────────────────────────────

function IndividualApplicantsTab() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [purposeFilter, setPurposeFilter] = useState("all");

  const individualsQuery = useQuery({
    queryKey: ["admin_individuals_list", page],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0 };
      const res = await actor.adminListIndividuals(
        BigInt(page),
        BigInt(PAGE_SIZE),
      );
      if ("__kind__" in res && res.__kind__ === "ok") {
        const data = (
          res as {
            __kind__: "ok";
            ok: { total: bigint; items: IndividualSummary[] };
          }
        ).ok;
        return { items: data.items ?? [], total: Number(data.total ?? 0) };
      }
      return { items: [], total: 0 };
    },
    enabled: !!actor,
    placeholderData: (prev) => prev,
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: { id: string; status: RegistrationStatus }) => {
      if (!actor) throw new Error("Not connected");
      const { Principal } = await import("@icp-sdk/core/principal");
      const res = await actor.adminChangeIndividualStatus(
        Principal.fromText(id),
        status,
      );
      if ("__kind__" in res && res.__kind__ === "err")
        throw new Error((res as { __kind__: "err"; err: string }).err);
    },
    onSuccess: () => {
      toast.success("Status updated", { duration: 4000 });
      queryClient.invalidateQueries({ queryKey: ["admin_individuals_list"] });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to update status",
      ),
  });

  const markReadyMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Not connected");
      const { Principal } = await import("@icp-sdk/core/principal");
      const res = await actor.adminSetIndividualFinancingReady(
        Principal.fromText(id),
      );
      if ("__kind__" in res && res.__kind__ === "err")
        throw new Error((res as { __kind__: "err"; err: string }).err);
    },
    onSuccess: () => {
      toast.success("Marked as financing-ready", { duration: 4000 });
      queryClient.invalidateQueries({ queryKey: ["admin_individuals_list"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to mark ready"),
  });

  const allItems: IndividualSummary[] = individualsQuery.data?.items ?? [];
  const total = individualsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const normalizedSearch = search.toLowerCase();

  const filtered = useMemo(() => {
    return allItems.filter((ind) => {
      if (
        normalizedSearch &&
        !ind.fullName.toLowerCase().includes(normalizedSearch)
      )
        return false;
      if (statusFilter !== "all" && ind.registrationStatus !== statusFilter)
        return false;
      if (purposeFilter !== "all" && ind.financingPurpose !== purposeFilter)
        return false;
      return true;
    });
  }, [allItems, normalizedSearch, statusFilter, purposeFilter]);

  const hasFilters =
    !!normalizedSearch || statusFilter !== "all" || purposeFilter !== "all";
  const isPending =
    changeStatusMutation.isPending || markReadyMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-3"
        data-ocid="admin.individuals.filters_bar"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            data-ocid="admin.individuals.search_input"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger
            className="w-44"
            data-ocid="admin.individuals.status_filter"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value={RegistrationStatus.pending}>Pending</SelectItem>
            <SelectItem value={RegistrationStatus.underReview}>
              Under Review
            </SelectItem>
            <SelectItem value={RegistrationStatus.financingReady}>
              Financing Ready
            </SelectItem>
            <SelectItem value={RegistrationStatus.approved}>
              Approved
            </SelectItem>
            <SelectItem value={RegistrationStatus.rejected}>
              Rejected
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={purposeFilter}
          onValueChange={(v) => {
            setPurposeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger
            className="w-44"
            data-ocid="admin.individuals.purpose_filter"
          >
            <SelectValue placeholder="Purpose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Purposes</SelectItem>
            {Object.entries(FINANCING_PURPOSE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setPurposeFilter("all");
              setPage(1);
            }}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            data-ocid="admin.individuals.clear_filters_button"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* List */}
      {individualsQuery.isLoading ? (
        <div className="space-y-3">
          {["a", "b", "c"].map((k) => (
            <Skeleton key={k} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent
            className="py-12 text-center text-sm text-muted-foreground"
            data-ocid="admin.individuals.empty_state"
          >
            <User className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            {hasFilters
              ? "No individuals match the current filters."
              : "No individual applicants registered yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((ind, i) => (
            <IndividualRow
              key={ind.id ? String(ind.id) : ind.fullName}
              summary={ind}
              idx={i + 1}
              onChangeStatus={(id, next) =>
                changeStatusMutation.mutate({ id, status: next })
              }
              onMarkReady={(id) => markReadyMutation.mutate(id)}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
        isLoading={individualsQuery.isFetching}
      />

      {hasFilters && filtered.length > 0 && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          Showing {filtered.length} of {allItems.length} on this page
        </div>
      )}
    </div>
  );
}

// ── AdminApplicantsPage ────────────────────────────────────────────────────

export default function AdminApplicantsPage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  // Respect ?tab=individuals deep-link from dashboard quicklink
  // useSearch is called at top-level to satisfy hooks rules; the param is optional.
  const searchParams = useSearch({ strict: false }) as { tab?: string };
  const search = searchParams;

  const [activeTab, setActiveTab] = useState<"businesses" | "individuals">(
    search?.tab === "individuals" ? "individuals" : "businesses",
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [kycStatusFilter, setKycStatusFilter] = useState("all");
  const [financingReadyFilter, setFinancingReadyFilter] = useState("all");
  const [riskLevelFilter, setRiskLevelFilter] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const businessesQuery = useQuery({
    queryKey: ["admin_businesses", currentPage],
    queryFn: async () => {
      if (!actor) return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof actorAny.adminListBusinessesPaginated === "function") {
        return actorAny.adminListBusinessesPaginated(
          BigInt(currentPage),
          BigInt(PAGE_SIZE),
        ) as Promise<{
          items: BusinessProfile[];
          total: number;
          page: number;
          pageSize: number;
        }>;
      }
      const page = await (actor.adminListBusinesses(
        BigInt(currentPage),
        BigInt(PAGE_SIZE),
      ) as unknown as Promise<{
        items: BusinessProfile[];
        total: bigint;
        page: bigint;
        pageSize: bigint;
      }>);
      return {
        items: page.items ?? [],
        total: Number(page.total ?? 0n),
        page: currentPage,
        pageSize: PAGE_SIZE,
      };
    },
    enabled: !!actor,
    placeholderData: (prev) => prev,
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      userId,
      status,
      reason,
    }: { userId: string; status: RegistrationStatus; reason?: string }) => {
      if (!actor) throw new Error("Not connected");
      const { Principal } = await import("@icp-sdk/core/principal");
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (
        reason &&
        typeof actorAny.updateBusinessStatusWithReason === "function"
      ) {
        return actorAny.updateBusinessStatusWithReason(
          Principal.fromText(userId),
          status,
          reason,
        );
      }
      return actor.updateBusinessStatus(
        Principal.fromText(userId),
        status,
        null,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_businesses"] });
      toast.success("Status updated", {
        icon: <MessageSquare className="h-4 w-4 text-primary" />,
        duration: 5000,
      });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to update status",
      ),
  });

  const pageData = businessesQuery.data;
  const allPageBusinesses: BusinessProfile[] = pageData?.items ?? [];
  const totalBusinesses = Number(pageData?.total ?? allPageBusinesses.length);
  const totalPages = Math.max(1, Math.ceil(totalBusinesses / PAGE_SIZE));

  const normalizedSearch = searchText.toLowerCase();
  const filteredBusinesses = useMemo(() => {
    return allPageBusinesses.filter((b) => {
      if (
        normalizedSearch &&
        !b.businessName.toLowerCase().includes(normalizedSearch) &&
        !b.phoneNumber.toLowerCase().includes(normalizedSearch) &&
        !b.cacNumber.toLowerCase().includes(normalizedSearch)
      )
        return false;
      if (
        kycStatusFilter !== "all" &&
        b.kycRecord.kycStatus !== kycStatusFilter
      )
        return false;
      if (financingReadyFilter === "yes" && !b.financingReady) return false;
      if (financingReadyFilter === "no" && b.financingReady) return false;
      if (
        riskLevelFilter !== "all" &&
        b.riskLevel.toLowerCase() !== riskLevelFilter.toLowerCase()
      )
        return false;
      return true;
    });
  }, [
    allPageBusinesses,
    normalizedSearch,
    kycStatusFilter,
    financingReadyFilter,
    riskLevelFilter,
  ]);

  const hasFilters =
    normalizedSearch ||
    kycStatusFilter !== "all" ||
    financingReadyFilter !== "all" ||
    riskLevelFilter !== "all";

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <PageHeader
          title="Applicants"
          subtitle="Review and manage business and individual applicant status, KYC results, and AI scores."
          breadcrumbs={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Applicants" },
          ]}
        />

        {/* Tab Toggle */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "businesses" | "individuals")}
          className="mb-6"
        >
          <TabsList data-ocid="admin.applicants.tab_switcher">
            <TabsTrigger
              value="businesses"
              className="gap-2"
              data-ocid="admin.applicants.businesses_tab"
            >
              <Building2 className="h-4 w-4" />
              Business Applicants
            </TabsTrigger>
            <TabsTrigger
              value="individuals"
              className="gap-2"
              data-ocid="admin.applicants.individuals_tab"
            >
              <User className="h-4 w-4" />
              Individual Applicants
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Business Applicants Tab Content */}
        {activeTab === "businesses" && (
          <div>
            {/* Search + Filter bar */}
            <div
              className="mb-4 flex flex-wrap items-center gap-3"
              data-ocid="admin.applicants.filters_bar"
            >
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, phone, or CAC…"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                  data-ocid="admin.applicants.search_input"
                />
              </div>

              <Select
                value={kycStatusFilter}
                onValueChange={(v) => {
                  setKycStatusFilter(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger
                  className="w-40"
                  data-ocid="admin.applicants.kyc_status_filter"
                >
                  <SelectValue placeholder="KYC Status" />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "all",
                      "Pending",
                      "InProgress",
                      "Verified",
                      "Failed",
                    ] as const
                  ).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v === "all" ? "All KYC" : v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={financingReadyFilter}
                onValueChange={(v) => {
                  setFinancingReadyFilter(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger
                  className="w-40"
                  data-ocid="admin.applicants.financing_ready_filter"
                >
                  <SelectValue placeholder="Financing Ready" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ready Status</SelectItem>
                  <SelectItem value="yes">Ready</SelectItem>
                  <SelectItem value="no">Not Ready</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={riskLevelFilter}
                onValueChange={(v) => {
                  setRiskLevelFilter(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger
                  className="w-36"
                  data-ocid="admin.applicants.risk_level_filter"
                >
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setSearchText("");
                    setKycStatusFilter("all");
                    setFinancingReadyFilter("all");
                    setRiskLevelFilter("all");
                    setCurrentPage(1);
                  }}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  data-ocid="admin.applicants.clear_filters_button"
                >
                  <X className="h-3.5 w-3.5" /> Clear Filters
                </Button>
              )}
            </div>

            {businessesQuery.isLoading ? (
              <div className="space-y-3">
                {["a", "b", "c"].map((k) => (
                  <Skeleton key={k} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <Card>
                <CardContent
                  className="py-12 text-center text-sm text-muted-foreground"
                  data-ocid="admin.applicants.empty_state"
                >
                  <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  {hasFilters
                    ? "No businesses match the current filters."
                    : "No business applicants registered yet."}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredBusinesses.map((biz, idx) => (
                  <BusinessRow
                    key={biz.userId.toString()}
                    biz={biz}
                    idx={idx + 1}
                    onReject={(userId, name) =>
                      setRejectTarget({ userId, name })
                    }
                    onAdvance={(userId, next) =>
                      statusMutation.mutate({ userId, status: next })
                    }
                    isPending={statusMutation.isPending}
                  />
                ))}
              </div>
            )}

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
              isLoading={businessesQuery.isFetching}
            />

            {hasFilters && filteredBusinesses.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                Showing {filteredBusinesses.length} of{" "}
                {allPageBusinesses.length} on this page
              </div>
            )}
          </div>
        )}

        {/* Individual Applicants Tab Content */}
        {activeTab === "individuals" && <IndividualApplicantsTab />}
      </div>

      {rejectTarget && (
        <RejectDialog
          businessName={rejectTarget.name}
          open={!!rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            statusMutation.mutate(
              {
                userId: rejectTarget.userId,
                status: RegistrationStatus.rejected,
                reason,
              },
              { onSettled: () => setRejectTarget(null) },
            );
          }}
          isPending={statusMutation.isPending}
        />
      )}
    </AdminLayout>
  );
}
