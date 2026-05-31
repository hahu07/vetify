import {
  AppealStatus as AppealStatusEnum,
  type UserId,
  Variant_conditionalReady_notReady_ready,
  Variant_major_minor,
} from "@/backend";
import type {
  AppealStatus,
  BusinessProfile,
  InconsistencyFlag,
  ShariaFlag,
  TawthiqAppeal,
} from "@/backend";
import { AdminLayout } from "@/components/AdminLayout";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useBackend } from "@/hooks/use-backend";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  FileSearch,
  MessageSquare,
  Save,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

function verdictBadge(
  verdict: Variant_conditionalReady_notReady_ready | undefined,
) {
  if (!verdict) return <Badge variant="secondary">Pending</Badge>;
  if (verdict === Variant_conditionalReady_notReady_ready.ready)
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
        Ready
      </Badge>
    );
  if (verdict === Variant_conditionalReady_notReady_ready.conditionalReady)
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
        Conditional Ready
      </Badge>
    );
  return <Badge variant="destructive">Not Ready</Badge>;
}

function ShariaFlagRow({ flag }: { flag: ShariaFlag }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
          flag.severity === Variant_major_minor.major
            ? "bg-destructive/15 text-destructive"
            : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        }`}
      >
        {flag.severity}
      </span>
      <span className="text-foreground font-medium">{flag.indicator}</span>
      <span className="text-muted-foreground">({flag.category})</span>
    </li>
  );
}

function InconsistencyRow({ flag }: { flag: InconsistencyFlag }) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2 pr-4 text-sm font-medium text-foreground">
        {flag.field}
      </td>
      <td className="py-2 pr-4 text-sm text-muted-foreground">
        {flag.declaredValue}
      </td>
      <td className="py-2 text-sm text-foreground">{flag.verifiedValue}</td>
    </tr>
  );
}

function AppealStatusBadge({ status }: { status: AppealStatus }) {
  if (status === AppealStatusEnum.accepted)
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
        Accepted
      </Badge>
    );
  if (status === AppealStatusEnum.rejected)
    return <Badge variant="destructive">Rejected</Badge>;
  return (
    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
      Pending
    </Badge>
  );
}

function AppealCard({
  appeal,
  businessUserId,
}: {
  appeal: TawthiqAppeal;
  businessUserId: UserId;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  const { mutate: reviewAppeal, isPending: isReviewing } = useMutation({
    mutationFn: async ({
      decision,
      note,
    }: {
      decision: AppealStatus;
      note: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.reviewTawthiqAppeal(
        businessUserId,
        appeal.id,
        decision,
        note,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      toast.success("Appeal reviewed successfully");
      queryClient.invalidateQueries({
        queryKey: ["tawthiq", "appeals", businessUserId.toString()],
      });
      setRejectMode(false);
      setRejectionReason("");
    },
    onError: (err: Error) =>
      toast.error(`Failed to review appeal: ${err.message}`),
  });

  const isPending = appeal.status === AppealStatusEnum.pending;

  return (
    <div
      className="rounded-lg border border-border/40 bg-muted/20 dark:bg-muted/10 p-3 space-y-2"
      data-ocid="tawthiq_pending.appeal_card"
    >
      {/* Appeal header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Flag:
            </span>
            <span className="text-xs font-mono text-foreground">
              {appeal.flagId}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Submitted{" "}
            {new Date(
              Number(appeal.submittedAt) / 1_000_000,
            ).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <AppealStatusBadge status={appeal.status} />
      </div>

      {/* Appeal text */}
      <p className="text-sm text-foreground leading-relaxed">
        {appeal.appealText}
      </p>

      {/* Document attachment */}
      {appeal.documentUrl && (
        <a
          href={appeal.documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          data-ocid="tawthiq_pending.appeal_download_button"
        >
          <Download className="h-3 w-3" />
          {appeal.documentName ?? "View Document"}
        </a>
      )}

      {/* Pending actions */}
      {isPending && !rejectMode && (
        <div
          className="flex gap-2 pt-1"
          data-ocid="tawthiq_pending.appeal_actions"
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs h-7 px-2.5"
            onClick={() =>
              reviewAppeal({ decision: AppealStatusEnum.accepted, note: "" })
            }
            disabled={isReviewing}
            data-ocid="tawthiq_pending.appeal_accept_button"
          >
            Accept Appeal
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 text-xs h-7 px-2.5"
            onClick={() => setRejectMode(true)}
            disabled={isReviewing}
            data-ocid="tawthiq_pending.appeal_reject_button"
          >
            Reject Appeal
          </Button>
        </div>
      )}

      {/* Inline rejection reason */}
      {isPending && rejectMode && (
        <div
          className="space-y-2 pt-1 border-t border-border/40"
          data-ocid="tawthiq_pending.appeal_reject_form"
        >
          <label
            htmlFor={`reject-reason-${appeal.id}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Enter rejection reason (required)
          </label>
          <Input
            id={`reject-reason-${appeal.id}`}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection…"
            className="h-8 text-sm"
            data-ocid="tawthiq_pending.appeal_reject_reason_input"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-7 px-2.5"
              onClick={() =>
                reviewAppeal({
                  decision: AppealStatusEnum.rejected,
                  note: rejectionReason,
                })
              }
              disabled={isReviewing || !rejectionReason.trim()}
              data-ocid="tawthiq_pending.appeal_confirm_rejection_button"
            >
              {isReviewing ? "Submitting…" : "Confirm Rejection"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-2.5"
              onClick={() => {
                setRejectMode(false);
                setRejectionReason("");
              }}
              disabled={isReviewing}
              data-ocid="tawthiq_pending.appeal_cancel_rejection_button"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Reviewed state — show admin note and date */}
      {!isPending && (appeal.adminNote || appeal.reviewedAt) && (
        <div className="pt-1.5 border-t border-border/40 space-y-0.5">
          {appeal.adminNote && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Admin note:</span>{" "}
              {appeal.adminNote}
            </p>
          )}
          {appeal.reviewedAt && (
            <p className="text-xs text-muted-foreground">
              Reviewed{" "}
              {new Date(
                Number(appeal.reviewedAt) / 1_000_000,
              ).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AppealsSection({ businessUserId }: { businessUserId: UserId }) {
  const { actor, isFetching } = useBackend();

  const { data: appeals, isLoading } = useQuery<TawthiqAppeal[]>({
    queryKey: ["tawthiq", "appeals", businessUserId.toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTawthiqAppeals(businessUserId);
    },
    enabled: !!actor && !isFetching,
    staleTime: 20_000,
  });

  return (
    <div data-ocid="tawthiq_pending.appeals_section">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" />
        Appeals
      </h4>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      )}

      {!isLoading && (!appeals || appeals.length === 0) && (
        <p
          className="text-xs text-muted-foreground italic"
          data-ocid="tawthiq_pending.appeals_empty"
        >
          No appeals submitted
        </p>
      )}

      {!isLoading && appeals && appeals.length > 0 && (
        <div className="space-y-2" data-ocid="tawthiq_pending.appeals_list">
          {appeals.map((appeal) => (
            <AppealCard
              key={appeal.id}
              appeal={appeal}
              businessUserId={businessUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingRow({ business }: { business: BusinessProfile }) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState("");
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  const tawthiq = business.tawthiqRecord;

  // Load existing note when expanded
  const { data: existingNote } = useQuery<string | null>({
    queryKey: ["tawthiq", "note", business.userId.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getTawthiqAdminNote(business.userId);
    },
    enabled: !!actor && expanded,
    staleTime: 30_000,
  });

  // Sync existing note into textarea when loaded
  const prevNote = existingNote ?? "";
  if (noteText === "" && prevNote !== "") {
    setNoteText(prevNote);
  }

  const { mutate: saveNote, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.saveTawthiqAdminNote(
        business.userId,
        noteText,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      toast.success("Note saved");
      queryClient.invalidateQueries({
        queryKey: ["tawthiq", "note", business.userId.toString()],
      });
    },
    onError: (err: Error) => toast.error(`Failed to save: ${err.message}`),
  });

  const shariaFlags = tawthiq?.shariaFlags ?? [];
  const inconsistencyFlags = tawthiq?.inconsistencyFlags ?? [];

  return (
    <div
      className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden"
      data-ocid="tawthiq_pending.row"
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
        data-ocid="tawthiq_pending.expand_button"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground truncate">
              {business.businessName}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              CAC: {business.cacNumber}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {verdictBadge(tawthiq?.creditReadinessVerdict)}
            {shariaFlags.length > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {shariaFlags.length} Shariah flag
                {shariaFlags.length !== 1 ? "s" : ""}
              </span>
            )}
            {inconsistencyFlags.length > 0 && (
              <span className="text-xs text-destructive">
                {inconsistencyFlags.length} inconsistenc
                {inconsistencyFlags.length !== 1 ? "ies" : "y"}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/50 px-5 py-4 space-y-5 bg-background">
          {/* Narrative */}
          {tawthiq?.narrativeSummary && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Narrative Summary
              </h4>
              <p className="text-sm text-foreground leading-relaxed">
                {tawthiq.narrativeSummary}
              </p>
            </div>
          )}

          {/* Shariah Flags */}
          {shariaFlags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Shariah Flags ({shariaFlags.length})
              </h4>
              <ul className="space-y-1.5">
                {shariaFlags.map((f) => (
                  <ShariaFlagRow key={f.indicator} flag={f} />
                ))}
              </ul>
            </div>
          )}

          {/* Inconsistency Table */}
          {inconsistencyFlags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Inconsistencies ({inconsistencyFlags.length})
              </h4>
              <div className="rounded-lg border border-border/50 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                        Field
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                        Declared
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                        Verified
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {inconsistencyFlags.map((f) => (
                      <InconsistencyRow key={f.field} flag={f} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Appeals */}
          <AppealsSection businessUserId={business.userId} />

          {/* Admin Note */}
          <div>
            <label
              htmlFor={`note-${business.userId.toString()}`}
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block"
            >
              Admin Note
            </label>
            <Textarea
              id={`note-${business.userId.toString()}`}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add review notes for this application…"
              rows={3}
              className="resize-none text-sm"
              data-ocid="tawthiq_pending.note_textarea"
            />
            <Button
              type="button"
              size="sm"
              className="mt-2 gap-1.5"
              onClick={() => saveNote()}
              disabled={isSaving}
              data-ocid="tawthiq_pending.save_note_button"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? "Saving…" : "Save Note"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminTawthiqPendingPage() {
  const [page, setPage] = useState(1);
  const { actor, isFetching } = useBackend();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tawthiq", "pending", page],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getTawthiqPendingReviews(BigInt(page), BigInt(PAGE_SIZE));
    },
    enabled: !!actor && !isFetching,
  });

  const totalPages = data
    ? Math.max(1, Math.ceil(Number(data.totalCount) / PAGE_SIZE))
    : 1;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Pending Reviews"
          subtitle="Tawthiq (التوثيق) — Applications requiring admin attention"
        />

        {isError && (
          <div
            className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            data-ocid="tawthiq_pending.error_state"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Failed to load pending reviews.</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="ml-auto underline underline-offset-2 hover:no-underline"
              data-ocid="tawthiq_pending.retry_button"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3" data-ocid="tawthiq_pending.loading_state">
            {["s1", "s2", "s3", "s4", "s5"].map((k) => (
              <Skeleton key={k} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && data && data.items.length === 0 && (
          <Card
            className="border-border/50"
            data-ocid="tawthiq_pending.empty_state"
          >
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <FileSearch className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium text-foreground">No pending reviews</p>
              <p className="text-sm text-muted-foreground">
                All applications have been reviewed.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && data && data.items.length > 0 && (
          <>
            <div className="space-y-3" data-ocid="tawthiq_pending.list">
              {data.items.map((business) => (
                <PendingRow
                  key={business.userId.toString()}
                  business={business}
                />
              ))}
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
