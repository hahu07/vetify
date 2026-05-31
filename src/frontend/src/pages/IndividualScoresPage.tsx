import {
  Variant_conditionalReady_notReady_ready,
  Variant_full_preliminary,
} from "@/backend";
import { IndividualLayout } from "@/components/IndividualLayout";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/use-backend";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BrainCircuit,
  Info,
  RefreshCw,
  Scale,
  Shield,
} from "lucide-react";

function verdictBadge(verdict: Variant_conditionalReady_notReady_ready) {
  switch (verdict) {
    case Variant_conditionalReady_notReady_ready.ready:
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
          Credit Ready
        </Badge>
      );
    case Variant_conditionalReady_notReady_ready.conditionalReady:
      return (
        <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30">
          Conditional
        </Badge>
      );
    case Variant_conditionalReady_notReady_ready.notReady:
      return <Badge variant="destructive">Not Ready</Badge>;
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}

interface ScoreBarProps {
  label: string;
  explanation: string;
  score: number;
  colorClass: string;
  ocid: string;
}

function ScoreBar({
  label,
  explanation,
  score,
  colorClass,
  ocid,
}: ScoreBarProps) {
  return (
    <div className="space-y-1.5" data-ocid={ocid}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{explanation}</p>
        </div>
        <span className="text-lg font-bold text-foreground ml-4">{score}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            colorClass,
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

function riskBadge(riskStr: string) {
  const lower = riskStr.toLowerCase();
  if (lower === "low")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
        Low Risk
      </Badge>
    );
  if (lower === "high") return <Badge variant="destructive">High Risk</Badge>;
  return (
    <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30">
      Medium Risk
    </Badge>
  );
}

function halalBarColor(score: number) {
  if (score >= 80) return "bg-emerald-500 dark:bg-emerald-400";
  if (score >= 60) return "bg-amber-500 dark:bg-amber-400";
  return "bg-red-500 dark:bg-red-400";
}

function mizanBarColor(score: number) {
  if (score >= 70) return "bg-emerald-500 dark:bg-emerald-400";
  if (score >= 45) return "bg-amber-500 dark:bg-amber-400";
  return "bg-red-500 dark:bg-red-400";
}

export default function IndividualScoresPage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["individual_profile"],
    queryFn: async () => {
      if (!actor) return null;
      const result = await actor.getMyIndividualProfile();
      if (result.__kind__ === "err") return null;
      return result.ok;
    },
    enabled: !!actor,
  });

  const profile = profileQuery.data ?? null;
  const tawthiq = profile?.tawthiqRecord ?? null;
  const mizan = profile?.mizanRecord ?? null;
  const isLoading = profileQuery.isLoading;

  const tawthiqShariaScore = tawthiq
    ? Number(tawthiq.shariaComplianceScore)
    : 0;
  const overallScore = mizan ? Number(mizan.overallScore) : 0;

  return (
    <IndividualLayout>
      <div
        className="p-6 space-y-8 max-w-3xl"
        data-ocid="individual_scores.page"
      >
        <PageHeader
          title="Tawthiq & Mizan Assessment"
          subtitle="Your full AI-powered financing readiness and risk profile."
          breadcrumbs={[{ label: "Assessment Scores" }]}
        />

        {profileQuery.isError && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">Failed to load scores.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5 text-destructive border-destructive/40"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["individual_profile"],
                })
              }
              data-ocid="individual_scores.retry_button"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Tawthiq Section */}
        <section data-ocid="individual_scores.tawthiq_section">
          <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            Tawthiq{" "}
            <span className="text-base font-normal text-muted-foreground">
              (التوثيق)
            </span>
          </h2>
          {isLoading ? (
            <Card>
              <CardContent className="pt-5 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ) : !tawthiq ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">
                  Tawthiq assessment has not been completed yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card data-ocid="individual_scores.tawthiq_verdict_card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Credit Readiness Verdict
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {verdictBadge(tawthiq.creditReadiness)}
                  </div>
                  <div
                    className="space-y-1.5"
                    data-ocid="individual_scores.sharia_score"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-primary" />
                        <p className="text-sm font-medium text-foreground">
                          Shariah Compliance Score
                        </p>
                      </div>
                      <span className="font-bold text-foreground">
                        {tawthiqShariaScore}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          halalBarColor(tawthiqShariaScore),
                        )}
                        style={{
                          width: `${Math.min(tawthiqShariaScore, 100)}%`,
                        }}
                        role="progressbar"
                        tabIndex={0}
                        aria-valuenow={tawthiqShariaScore}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Shariah compliance"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              {tawthiq.shariaFlags.length > 0 && (
                <Card
                  className="border-amber-300 dark:border-amber-700"
                  data-ocid="individual_scores.tawthiq_flags_card"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      Shariah Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {tawthiq.shariaFlags.map((flag) => (
                        <li
                          key={flag}
                          className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {tawthiq.narrativeSummary && (
                <Card data-ocid="individual_scores.tawthiq_narrative_card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Assessment Explanation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-foreground">
                      {tawthiq.narrativeSummary}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>

        {/* Mizan Section */}
        <section data-ocid="individual_scores.mizan_section">
          <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Mizan{" "}
            <span className="text-base font-normal text-muted-foreground">
              (الميزان)
            </span>
          </h2>
          {isLoading ? (
            <Card>
              <CardContent className="pt-5 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ) : !mizan ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">
                  Mizan assessment will be available after KYC verification
                  completes.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card data-ocid="individual_scores.mizan_overview_card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      Overall Mizan Score
                    </CardTitle>
                    <Badge
                      className="bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 text-xs"
                      data-ocid="individual_scores.mizan_stage_badge"
                    >
                      {mizan.stage === Variant_full_preliminary.preliminary
                        ? "Preliminary Assessment"
                        : "Full Assessment"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-3">
                    <span
                      className="font-display text-5xl font-bold text-foreground"
                      data-ocid="individual_scores.mizan_overall_score"
                    >
                      {overallScore}
                    </span>
                    <span className="text-muted-foreground text-sm">/ 100</span>
                    <div className="ml-auto">
                      {riskBadge(
                        typeof mizan.riskLevel === "string"
                          ? mizan.riskLevel
                          : (Object.keys(
                              mizan.riskLevel as Record<string, unknown>,
                            )[0] ?? "Medium"),
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-ocid="individual_scores.mizan_subscores_card">
                <CardContent className="pt-5 space-y-5">
                  <ScoreBar
                    label="Income Stability Score"
                    explanation="How consistent and regular is your income?"
                    score={Number(mizan.incomeStabilityScore)}
                    colorClass={mizanBarColor(
                      Number(mizan.incomeStabilityScore),
                    )}
                    ocid="individual_scores.income_stability"
                  />
                  <ScoreBar
                    label="Debt Behaviour Score"
                    explanation="How responsibly do you manage existing debt?"
                    score={Number(mizan.debtBehaviorScore)}
                    colorClass={mizanBarColor(Number(mizan.debtBehaviorScore))}
                    ocid="individual_scores.debt_behavior"
                  />
                  <ScoreBar
                    label="Repayment Capacity Score"
                    explanation="Can you comfortably repay the requested financing amount?"
                    score={Number(mizan.repaymentCapacityScore)}
                    colorClass={mizanBarColor(
                      Number(mizan.repaymentCapacityScore),
                    )}
                    ocid="individual_scores.repayment_capacity"
                  />
                </CardContent>
              </Card>
              {mizan.borderlineFlag && (
                <div
                  className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3"
                  data-ocid="individual_scores.mizan_borderline_alert"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      Manual Review Required
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                      This assessment has been flagged for manual review by our
                      underwriting team.
                    </p>
                  </div>
                </div>
              )}
              {mizan.narrativeSummary && (
                <Card data-ocid="individual_scores.mizan_narrative_card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Underwriting Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-foreground">
                      {mizan.narrativeSummary}
                    </p>
                  </CardContent>
                </Card>
              )}
              {mizan.stage === Variant_full_preliminary.preliminary && (
                <div
                  className="flex items-start gap-2 rounded-md bg-muted/30 border border-border px-3 py-2.5"
                  data-ocid="individual_scores.mizan_preliminary_note"
                >
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    This is a preliminary assessment based on your registration
                    data. A full Mizan assessment will run after you link your
                    bank account.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </IndividualLayout>
  );
}
