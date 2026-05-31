import type { ScoringRecord } from "@/backend";
import { RiskLevel } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, BrainCircuit, Loader2, RefreshCw } from "lucide-react";

interface AiScoresCardProps {
  scoringRecord: ScoringRecord;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function ScoreBar({
  label,
  score,
  dataOcid,
}: {
  label: string;
  score: number;
  dataOcid: string;
}) {
  const color =
    score >= 75
      ? "bg-emerald-500 dark:bg-emerald-400"
      : score >= 50
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-destructive";

  return (
    <div className="space-y-1.5" data-ocid={dataOcid}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span
          className={cn(
            "text-sm font-bold",
            score >= 75
              ? "text-emerald-600 dark:text-emerald-400"
              : score >= 50
                ? "text-amber-600 dark:text-amber-400"
                : "text-destructive",
          )}
        >
          {score}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            color,
          )}
          style={{ width: `${Math.min(score, 100)}%` }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
          tabIndex={0}
        />
      </div>
    </div>
  );
}

function riskBadge(risk: RiskLevel) {
  switch (risk) {
    case RiskLevel.Low:
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
          Low Risk
        </Badge>
      );
    case RiskLevel.Medium:
      return (
        <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30">
          Medium Risk
        </Badge>
      );
    case RiskLevel.High:
      return <Badge variant="destructive">High Risk</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
}

export function AiScoresCard({
  scoringRecord,
  isLoading = false,
  error = null,
  onRetry,
}: AiScoresCardProps) {
  const readiness = Number(scoringRecord.financingReadinessScore);
  const halal = Number(scoringRecord.halalComplianceScore);
  const scoredDate = new Date(
    Number(scoringRecord.scoredAt) / 1_000_000,
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <Card className="border-border" data-ocid="ai_scores_card">
        <CardContent className="flex items-center justify-center py-10 gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading AI scores…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border" data-ocid="ai_scores_card">
        <CardContent className="py-8 space-y-3">
          <div
            className="flex items-center gap-2 text-destructive"
            data-ocid="ai_scores_card.error_state"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Unable to load scores</span>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onRetry}
              data-ocid="ai_scores_card.retry_button"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border" data-ocid="ai_scores_card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <BrainCircuit className="h-4 w-4 text-primary" />
            AI Scoring Results
          </CardTitle>
          <div data-ocid="ai_scores_card.risk_badge">
            {riskBadge(scoringRecord.riskLevel)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Scored on {scoredDate}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreBar
          label="Financing Readiness"
          score={readiness}
          dataOcid="ai_scores_card.readiness_bar"
        />
        <ScoreBar
          label="Halal Compliance"
          score={halal}
          dataOcid="ai_scores_card.halal_bar"
        />
        {scoringRecord.scoringNotes && (
          <div
            className="rounded-md border border-border bg-muted/40 px-3 py-2.5"
            data-ocid="ai_scores_card.scoring_notes"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Scoring Notes
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {scoringRecord.scoringNotes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
