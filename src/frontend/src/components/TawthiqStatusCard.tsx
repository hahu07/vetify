import type {
  InconsistencyFlag,
  ShariaFlag,
  TawthiqAppeal,
  TawthiqRecord,
} from "@/backend";
import {
  AppealStatus,
  Variant_Failed_Passed_Pending,
  Variant_Flagged_Clean_Pending,
  Variant_conditionalReady_notReady_ready,
  Variant_major_minor,
} from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileWarning,
  Loader2,
  MessageSquare,
  Scale,
  XCircle,
} from "lucide-react";
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type SubmitAppealFn = (
  flagId: string,
  appealText: string,
  documentUrl: string | null,
  documentName: string | null,
) => Promise<void>;

interface TawthiqStatusCardProps {
  tawthiqRecord: TawthiqRecord | null | undefined;
  isLoading?: boolean;
  onSubmitAppeal?: SubmitAppealFn;
}

type StepStatus = "pending" | "passed" | "failed";

function stepStatusIcon(status: StepStatus) {
  switch (status) {
    case "passed":
      return (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
      );
    case "failed":
      return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
    default:
      return (
        <Clock className="h-4 w-4 shrink-0 text-muted-foreground animate-pulse" />
      );
  }
}

function stepStatusBadge(status: StepStatus) {
  switch (status) {
    case "passed":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 text-xs">
          Passed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="text-xs">
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-xs text-muted-foreground">
          Pending
        </Badge>
      );
  }
}

function shariaStatusToStep(status: Variant_Failed_Passed_Pending): StepStatus {
  switch (status) {
    case Variant_Failed_Passed_Pending.Passed:
      return "passed";
    case Variant_Failed_Passed_Pending.Failed:
      return "failed";
    default:
      return "pending";
  }
}

function inconsistencyStatusToStep(
  status: Variant_Flagged_Clean_Pending,
): StepStatus {
  switch (status) {
    case Variant_Flagged_Clean_Pending.Clean:
      return "passed";
    case Variant_Flagged_Clean_Pending.Flagged:
      return "failed";
    default:
      return "pending";
  }
}

function CreditReadinessBadge({
  verdict,
}: {
  verdict: Variant_conditionalReady_notReady_ready;
}) {
  switch (verdict) {
    case Variant_conditionalReady_notReady_ready.ready:
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 text-sm font-semibold px-3 py-1">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Ready
        </Badge>
      );
    case Variant_conditionalReady_notReady_ready.conditionalReady:
      return (
        <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 text-sm font-semibold px-3 py-1">
          <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
          Conditional Ready
        </Badge>
      );
    case Variant_conditionalReady_notReady_ready.notReady:
      return (
        <Badge
          variant="destructive"
          className="text-sm font-semibold px-3 py-1"
        >
          <XCircle className="h-3.5 w-3.5 mr-1.5" />
          Not Ready
        </Badge>
      );
    default:
      return (
        <Badge
          variant="secondary"
          className="text-sm text-muted-foreground px-3 py-1"
        >
          <Clock className="h-3.5 w-3.5 mr-1.5" />
          Pending
        </Badge>
      );
  }
}

function ShariaFlagItem({ flag }: { flag: ShariaFlag }) {
  const isMajor = flag.severity === Variant_major_minor.major;
  return (
    <div className="flex items-start gap-2 rounded-md bg-muted/40 dark:bg-muted/20 px-3 py-2">
      <AlertTriangle
        className={cn(
          "h-3.5 w-3.5 mt-0.5 shrink-0",
          isMajor ? "text-destructive" : "text-yellow-500",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">
            {flag.indicator}
          </span>
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0",
              isMajor
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : "bg-yellow-500/15 text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-500/30",
            )}
          >
            {isMajor ? "Major" : "Minor"}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {flag.category}
        </p>
      </div>
    </div>
  );
}

// ── AppealStatusBadge ──────────────────────────────────────────────────────

function AppealStatusBadge({ appeal }: { appeal: TawthiqAppeal }) {
  switch (appeal.status) {
    case AppealStatus.accepted:
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 text-xs gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Appeal accepted
        </Badge>
      );
    case AppealStatus.rejected:
      return (
        <div className="space-y-1">
          <Badge variant="destructive" className="text-xs gap-1">
            <XCircle className="h-3 w-3" />
            Appeal rejected
          </Badge>
          {appeal.adminNote && (
            <p className="text-[11px] text-muted-foreground">
              Admin note: {appeal.adminNote}
            </p>
          )}
        </div>
      );
    default:
      return (
        <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 text-xs gap-1">
          <Clock className="h-3 w-3" />
          Appeal submitted — under review
        </Badge>
      );
  }
}

// ── AppealForm ─────────────────────────────────────────────────────────────

interface AppealFormProps {
  flagId: string;
  onSubmit: SubmitAppealFn;
  onCancel: () => void;
}

function AppealForm({ flagId, onSubmit, onCancel }: AppealFormProps) {
  const [appealText, setAppealText] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appealText.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(
        flagId,
        appealText.trim(),
        documentUrl.trim() || null,
        documentName.trim() || null,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 rounded-lg border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-3"
      data-ocid="tawthiq_card.appeal_form"
    >
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" />
        Submit an Appeal
      </p>

      <div className="space-y-1">
        <label
          htmlFor={`appeal-text-${flagId}`}
          className="text-[11px] font-medium text-muted-foreground"
        >
          Explanation <span className="text-destructive">*</span>
        </label>
        <Textarea
          id={`appeal-text-${flagId}`}
          value={appealText}
          onChange={(e) => setAppealText(e.target.value)}
          placeholder="Explain why this flag may be inaccurate and provide any relevant context…"
          rows={3}
          className="text-sm resize-none"
          required
          data-ocid="tawthiq_card.appeal_text_input"
        />
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground">
          Supporting document{" "}
          <span className="text-muted-foreground/60">(optional)</span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          Upload a supporting document via your file storage and paste the link
          below.
        </p>
        <input
          type="url"
          value={documentUrl}
          onChange={(e) => setDocumentUrl(e.target.value)}
          placeholder="https://… (document URL)"
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          data-ocid="tawthiq_card.appeal_document_url_input"
        />
        {documentUrl.trim() && (
          <input
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="Document name (e.g. Bank Statement June 2025)"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            data-ocid="tawthiq_card.appeal_document_name_input"
          />
        )}
      </div>

      <div className="flex items-center gap-2 justify-end pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
          data-ocid="tawthiq_card.appeal_cancel_button"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || !appealText.trim()}
          className="gap-1.5"
          data-ocid="tawthiq_card.appeal_submit_button"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}
          Submit Appeal
        </Button>
      </div>
    </form>
  );
}

// ── InconsistencyFlagWithAppeal ────────────────────────────────────────────

interface InconsistencyFlagWithAppealProps {
  flag: InconsistencyFlag;
  flagId: string;
  existingAppeal?: TawthiqAppeal;
  onSubmitAppeal?: SubmitAppealFn;
  index: number;
}

function InconsistencyFlagWithAppeal({
  flag,
  flagId,
  existingAppeal,
  onSubmitAppeal,
  index,
}: InconsistencyFlagWithAppealProps) {
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(
    fId: string,
    text: string,
    docUrl: string | null,
    docName: string | null,
  ) {
    if (onSubmitAppeal) {
      await onSubmitAppeal(fId, text, docUrl, docName);
    }
    setShowForm(false);
  }

  return (
    <div
      className="rounded-md bg-muted/40 dark:bg-muted/20 px-3 py-2 space-y-2"
      data-ocid={`tawthiq_card.inconsistency_flag.${index + 1}`}
    >
      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
        <FileWarning className="h-3.5 w-3.5 text-amber-500" />
        {flag.field}
      </p>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-muted-foreground">Declared</p>
          <p className="font-medium text-foreground break-words">
            {flag.declaredValue}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Verified</p>
          <p className="font-medium text-destructive break-words">
            {flag.verifiedValue}
          </p>
        </div>
      </div>

      {/* Appeal section */}
      {onSubmitAppeal && (
        <div className="pt-1">
          {existingAppeal ? (
            <AppealStatusBadge appeal={existingAppeal} />
          ) : showForm ? (
            <AppealForm
              flagId={flagId}
              onSubmit={handleSubmit}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              onClick={() => setShowForm(true)}
              data-ocid={`tawthiq_card.appeal_flag_button.${index + 1}`}
            >
              <MessageSquare className="h-3 w-3" />
              Appeal this flag
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface PipelineStepProps {
  number: number;
  title: string;
  status: StepStatus;
  children?: React.ReactNode;
  dataOcid: string;
}

function PipelineStep({
  number,
  title,
  status,
  children,
  dataOcid,
}: PipelineStepProps) {
  return (
    <div className="space-y-3" data-ocid={dataOcid}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 text-xs font-bold text-primary shrink-0">
            {number}
          </div>
          <div className="flex items-center gap-2">
            {stepStatusIcon(status)}
            <span className="text-sm font-semibold text-foreground">
              {title}
            </span>
          </div>
        </div>
        {stepStatusBadge(status)}
      </div>
      {children && <div className="ml-8 space-y-2">{children}</div>}
    </div>
  );
}

export function TawthiqStatusCard({
  tawthiqRecord,
  isLoading = false,
  onSubmitAppeal,
}: TawthiqStatusCardProps) {
  if (isLoading || tawthiqRecord === null || tawthiqRecord === undefined) {
    return (
      <Card className="border-border" data-ocid="tawthiq_card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Scale className="h-4 w-4 text-primary" />
            <span>Tawthiq</span>
            <span className="text-muted-foreground font-normal text-sm">
              التوثيق
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            AI-powered verification &amp; compliance screening
          </p>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-6 text-sm text-muted-foreground"
            data-ocid="tawthiq_card.loading_state"
          >
            <Loader2 className="h-5 w-5 animate-spin shrink-0" />
            <div>
              <p className="font-medium text-foreground">
                Analysis in progress…
              </p>
              <p className="text-xs mt-0.5">
                Tawthiq is verifying your profile. This may take a moment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const shariaStep = shariaStatusToStep(tawthiqRecord.shariaScreeningStatus);
  const inconsistencyStep = inconsistencyStatusToStep(
    tawthiqRecord.inconsistencyStatus,
  );

  // Appeals are fetched externally via getMyTawthiqAppeals — no appeals field on TawthiqRecord.
  // InconsistencyFlagWithAppeal components receive onSubmitAppeal only; existing appeal state
  // must be managed by the parent. For business dashboard we pass no existingAppeal here.
  const appealsByFlagId = new Map<string, TawthiqAppeal>();

  const completedAt = tawthiqRecord.completedAt
    ? new Date(
        Number(tawthiqRecord.completedAt) / 1_000_000,
      ).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Card className="border-border" data-ocid="tawthiq_card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Scale className="h-4 w-4 text-primary" />
            <span>Tawthiq</span>
            <span className="text-muted-foreground font-normal text-sm">
              التوثيق
            </span>
          </CardTitle>
          <CreditReadinessBadge
            verdict={tawthiqRecord.creditReadinessVerdict}
          />
        </div>
        {completedAt && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Analysis completed {completedAt}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          AI-powered verification &amp; Shariah compliance screening
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Step 1: Shariah Compliance */}
        <PipelineStep
          number={1}
          title="Shariah Compliance Screening"
          status={shariaStep}
          dataOcid="tawthiq_card.sharia_step"
        >
          {tawthiqRecord.shariaFlags.length > 0 && (
            <div className="space-y-1.5" data-ocid="tawthiq_card.sharia_flags">
              {tawthiqRecord.shariaFlags.map((flag, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: flags have no unique id
                <ShariaFlagItem key={i} flag={flag} />
              ))}
            </div>
          )}
          {tawthiqRecord.shariaFlags.length === 0 &&
            shariaStep === "passed" && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                No Shariah compliance issues found.
              </p>
            )}
        </PipelineStep>

        <Separator />

        {/* Step 2: Inconsistency Detection (with appeals) */}
        <PipelineStep
          number={2}
          title="Inconsistency Detection"
          status={inconsistencyStep}
          dataOcid="tawthiq_card.inconsistency_step"
        >
          {tawthiqRecord.inconsistencyFlags.length > 0 && (
            <div
              className="space-y-2"
              data-ocid="tawthiq_card.inconsistency_flags"
            >
              {tawthiqRecord.inconsistencyFlags.map((flag, i) => {
                const flagId = `${flag.field}_${i}`;
                const existingAppeal = appealsByFlagId.get(flagId);
                return (
                  <InconsistencyFlagWithAppeal
                    // biome-ignore lint/suspicious/noArrayIndexKey: flags have no unique id
                    key={i}
                    flag={flag}
                    flagId={flagId}
                    existingAppeal={existingAppeal}
                    onSubmitAppeal={onSubmitAppeal}
                    index={i}
                  />
                );
              })}
            </div>
          )}
          {tawthiqRecord.inconsistencyFlags.length === 0 &&
            inconsistencyStep === "passed" && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                No inconsistencies detected between declared and verified data.
              </p>
            )}
        </PipelineStep>

        <Separator />

        {/* Step 3: Credit-Readiness Verdict */}
        <div
          className="space-y-3"
          data-ocid="tawthiq_card.credit_readiness_step"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 text-xs font-bold text-primary shrink-0">
                3
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Credit-Readiness Verdict
                </span>
              </div>
            </div>
            <CreditReadinessBadge
              verdict={tawthiqRecord.creditReadinessVerdict}
            />
          </div>
        </div>

        {/* Narrative Summary */}
        {tawthiqRecord.narrativeSummary && (
          <>
            <Separator />
            <div
              className="rounded-md border border-border bg-muted/40 dark:bg-muted/20 px-3 py-3"
              data-ocid="tawthiq_card.narrative_summary"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Tawthiq Analysis Summary
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {tawthiqRecord.narrativeSummary}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
