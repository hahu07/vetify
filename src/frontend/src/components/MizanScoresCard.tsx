import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MizanRecord } from "@/types";
import { RiskLevel__1 } from "@/types";
import { AlertTriangle, Clock, RefreshCw, Scale } from "lucide-react";
import { useEffect, useRef } from "react";

// ── Helpers ────────────────────────────────────────────────────────────────

function riskColor(risk: RiskLevel__1) {
  switch (risk) {
    case RiskLevel__1.Low:
      return {
        ring: "text-[oklch(var(--gauge-low))]",
        stroke: "oklch(var(--gauge-low))",
        badge:
          "bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
        bar: "bg-emerald-500 dark:bg-emerald-400",
        label: "Low Risk",
      };
    case RiskLevel__1.Medium:
      return {
        ring: "text-[oklch(var(--gauge-medium))]",
        stroke: "oklch(var(--gauge-medium))",
        badge:
          "bg-amber-500/15 text-amber-700 border-amber-300 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
        bar: "bg-amber-500 dark:bg-amber-400",
        label: "Medium Risk",
      };
    default:
      return {
        ring: "text-[oklch(var(--gauge-high))]",
        stroke: "oklch(var(--gauge-high))",
        badge:
          "bg-red-500/15 text-red-700 border-red-300 hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
        bar: "bg-red-500 dark:bg-red-400",
        label: "High Risk",
      };
  }
}

function halalColor(score: number) {
  if (score >= 80)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500 dark:bg-emerald-400",
      label: "Compliant",
    };
  if (score >= 60)
    return {
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500 dark:bg-amber-400",
      label: "Conditional",
    };
  return {
    text: "text-red-600 dark:text-red-400",
    bar: "bg-red-500 dark:bg-red-400",
    label: "Non-Compliant",
  };
}

// ── ScoreRing ──────────────────────────────────────────────────────────────

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeColor: string;
  label?: string;
}

function ScoreRing({ score, size = 96, strokeColor, label }: ScoreRingProps) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - Math.min(score, 100) / 100);
  const svgRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.style.strokeDashoffset = circumference.toString();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition =
          "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)";
        el.style.strokeDashoffset = dashoffset.toString();
      });
    });
  }, [circumference, dashoffset]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="oklch(var(--score-ring-bg))"
            strokeWidth={8}
          />
          {/* Progress */}
          <circle
            ref={svgRef}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-xl font-bold leading-none text-foreground"
            aria-label={label ?? `Score: ${score}`}
          >
            {score}
          </span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">
            0-100
          </span>
        </div>
      </div>
    </div>
  );
}

// ── SubScoreCard ───────────────────────────────────────────────────────────

function SubScoreCard({
  label,
  score,
  barClass,
  dataOcid,
}: {
  label: string;
  score: number;
  barClass: string;
  dataOcid: string;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-3 space-y-2"
      data-ocid={dataOcid}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-bold text-foreground">{score}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            barClass,
          )}
          style={{ width: `${Math.min(score, 100)}%` }}
          role="progressbar"
          tabIndex={0}
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  );
}

// ── MizanScoresCard ────────────────────────────────────────────────────────

export interface MizanScoresCardProps {
  mizan: MizanRecord | null;
  isLoading?: boolean;
  onRetrigger?: () => void;
  isAdmin?: boolean;
  mizanDivergenceAlert?: boolean;
}

export function MizanScoresCard({
  mizan,
  isLoading = false,
  onRetrigger,
  isAdmin = false,
  mizanDivergenceAlert = false,
}: MizanScoresCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border" data-ocid="mizan_scores_card">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-24 w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-16 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!mizan) {
    return (
      <Card
        className="border-border border-dashed"
        data-ocid="mizan_scores_card.pending_state"
      >
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Scale className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-display font-semibold text-foreground">
            Mizan (<span className="font-arabic">الميزان</span>) Pending
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Mizan analysis will run after bank account is linked and verified
            financial data is available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const overall = Number(mizan.overallReadinessScore);
  const halal = Number(mizan.halalComplianceScore);
  const colors = riskColor(mizan.riskClassification);
  const halalColors = halalColor(halal);

  const computedDate = mizan.computedAt
    ? new Date(Number(mizan.computedAt) / 1_000_000).toLocaleDateString(
        "en-GB",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        },
      )
    : null;

  const subscores = [
    {
      label: "Income Stability",
      score: Number(mizan.incomeStabilityScore),
      ocid: "mizan_scores_card.income_stability",
    },
    {
      label: "Debt Behavior",
      score: Number(mizan.debtBehaviorScore),
      ocid: "mizan_scores_card.debt_behavior",
    },
    {
      label: "Repayment Pattern",
      score: Number(mizan.repaymentPatternScore),
      ocid: "mizan_scores_card.repayment_pattern",
    },
    {
      label: "Revenue Trend",
      score: Number(mizan.revenueTrendScore),
      ocid: "mizan_scores_card.revenue_trend",
    },
  ];

  return (
    <Card className="border-border" data-ocid="mizan_scores_card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Scale className="h-4 w-4 text-primary shrink-0" />
              Mizan{" "}
              <span className="text-sm font-normal text-muted-foreground">
                (الميزان)
              </span>
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              AI-Powered Risk &amp; Underwriting Assessment
            </p>
          </div>
          <Badge
            className={cn("shrink-0", colors.badge)}
            data-ocid="mizan_scores_card.risk_badge"
          >
            {colors.label}
          </Badge>
        </div>
        {computedDate && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last analysed: {computedDate}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Score divergence warning */}
        {mizanDivergenceAlert && (
          <div
            className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3"
            data-ocid="mizan_scores_card.divergence_alert"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Score Divergence Detected
              </p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                The preliminary assessment and full bank-verified assessment
                differ significantly. Please review both scores carefully.
              </p>
            </div>
          </div>
        )}

        {/* Overall score ring */}
        <div
          className="flex flex-col items-center gap-2"
          data-ocid="mizan_scores_card.overall_ring"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Overall Readiness
          </p>
          <ScoreRing
            score={overall}
            size={112}
            strokeColor={colors.stroke}
            label={`Overall readiness: ${overall}`}
          />
        </div>

        {/* Subscores grid */}
        <div
          className="grid grid-cols-2 gap-3"
          data-ocid="mizan_scores_card.subscores_grid"
        >
          {subscores.map((s) => (
            <SubScoreCard
              key={s.ocid}
              label={s.label}
              score={s.score}
              barClass={colors.bar}
              dataOcid={s.ocid}
            />
          ))}
        </div>

        {/* Halal compliance */}
        <div
          className="rounded-lg border border-border bg-card p-3"
          data-ocid="mizan_scores_card.halal_compliance"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Halal Compliance
            </span>
            <span className={cn("text-sm font-bold", halalColors.text)}>
              {halal} — {halalColors.label}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                halalColors.bar,
              )}
              style={{ width: `${Math.min(halal, 100)}%` }}
              role="progressbar"
              tabIndex={0}
              aria-valuenow={halal}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Halal compliance"
            />
          </div>
        </div>

        {/* Borderline alert */}
        {mizan.isBorderline && mizan.borderlineReasons.length > 0 && (
          <div
            className="rounded-lg border border-amber-300 dark:border-amber-700 px-4 py-3"
            style={{ background: "oklch(var(--borderline-bg))" }}
            data-ocid="mizan_scores_card.borderline_alert"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Flagged for Human Review
              </p>
            </div>
            <ul className="space-y-1 pl-1">
              {mizan.borderlineReasons.map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Narrative summary */}
        {mizan.narrativeSummary && (
          <div
            className="rounded-lg px-4 py-3"
            style={{ background: "oklch(var(--narrative-bg))" }}
            data-ocid="mizan_scores_card.narrative_summary"
          >
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Narrative Underwriting Summary
            </p>
            <p className="text-sm italic leading-relaxed text-foreground">
              {mizan.narrativeSummary}
            </p>
          </div>
        )}

        {/* Admin retrigger */}
        {isAdmin && onRetrigger && (
          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onRetrigger}
              data-ocid="mizan_scores_card.retrigger_button"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-run Mizan Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
