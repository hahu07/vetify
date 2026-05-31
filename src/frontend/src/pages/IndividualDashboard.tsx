import {
  KycStatus,
  RegistrationStatus,
  Variant_conditionalReady_notReady_ready,
  Variant_full_preliminary,
} from "@/backend";
import { IndividualLayout } from "@/components/IndividualLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/use-backend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useRef } from "react";

function registrationLabel(status: RegistrationStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case RegistrationStatus.pending:
      return {
        label: "Pending Review",
        className:
          "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
      };
    case RegistrationStatus.underReview:
      return {
        label: "Under Review",
        className:
          "bg-blue-500/15 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
      };
    case RegistrationStatus.kycInProgress:
      return {
        label: "KYC In Progress",
        className:
          "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
      };
    case RegistrationStatus.financingReady:
      return {
        label: "Financing Ready",
        className:
          "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
      };
    case RegistrationStatus.approved:
      return {
        label: "Approved",
        className:
          "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
      };
    case RegistrationStatus.rejected:
      return { label: "Rejected", className: "" };
    default:
      return { label: "Pending", className: "" };
  }
}

function kycCheckRow(
  label: string,
  ok: boolean,
  ocid: string,
): React.ReactNode {
  return (
    <div className="flex items-center justify-between py-1.5" data-ocid={ocid}>
      <span className="text-sm text-foreground">{label}</span>
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

function verdictConfig(verdict: Variant_conditionalReady_notReady_ready): {
  label: string;
  className: string;
} {
  switch (verdict) {
    case Variant_conditionalReady_notReady_ready.ready:
      return {
        label: "Credit Ready",
        className:
          "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
      };
    case Variant_conditionalReady_notReady_ready.conditionalReady:
      return {
        label: "Conditional",
        className:
          "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
      };
    case Variant_conditionalReady_notReady_ready.notReady:
      return { label: "Not Ready", className: "" };
    default:
      return { label: "Pending", className: "" };
  }
}

export default function IndividualDashboard() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const kycStatus = profile?.kycRecord?.kycStatus;
  const tawthiqDone = !!profile?.tawthiqRecord?.completedAt;
  const needsPolling =
    kycStatus === KycStatus.InProgress ||
    kycStatus === KycStatus.Pending ||
    !tawthiqDone;

  useEffect(() => {
    if (needsPolling && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        void queryClient.invalidateQueries({
          queryKey: ["individual_profile"],
        });
      }, 3000);
    } else if (!needsPolling && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [needsPolling, queryClient]);

  const isLoading = profileQuery.isLoading;
  const isError = profileQuery.isError;
  const regStatusBadge = profile
    ? registrationLabel(profile.registrationStatus)
    : null;

  const kyc = profile?.kycRecord ?? null;
  const tawthiq = profile?.tawthiqRecord ?? null;
  const mizan = profile?.mizanRecord ?? null;

  const isFinancingReady =
    profile?.registrationStatus === RegistrationStatus.financingReady ||
    profile?.registrationStatus === RegistrationStatus.approved;
  const bankLinked = profile?.bankLinkStatus.__kind__ === "Linked";

  return (
    <IndividualLayout>
      <div
        className="p-6 space-y-6 max-w-4xl"
        data-ocid="individual_dashboard.page"
      >
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            My Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your financing readiness overview
          </p>
        </div>

        {isError && (
          <div
            className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
            data-ocid="individual_dashboard.error_state"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              Failed to load your profile.
            </p>
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
              data-ocid="individual_dashboard.retry_button"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Status header */}
        <Card data-ocid="individual_dashboard.status_card">
          <CardContent className="pt-5">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : profile ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">
                    {profile.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Registered{" "}
                    {new Date(
                      Number(profile.createdAt) / 1_000_000,
                    ).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {regStatusBadge && (
                  <Badge
                    className={regStatusBadge.className}
                    data-ocid="individual_dashboard.status_badge"
                  >
                    {regStatusBadge.label}
                  </Badge>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* KYC Summary */}
        <Card data-ocid="individual_dashboard.kyc_card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              KYC Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || (needsPolling && !kyc) ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying your information…
              </div>
            ) : kyc ? (
              <div className="divide-y divide-border">
                {kycCheckRow(
                  "BVN Verified",
                  kyc.bvnVerified,
                  "individual_dashboard.kyc_bvn",
                )}
                {kycCheckRow(
                  "NIN Verified",
                  kyc.ninVerified,
                  "individual_dashboard.kyc_nin",
                )}
                {kycCheckRow(
                  "Watchlist Clean",
                  kyc.watchlistClean,
                  "individual_dashboard.kyc_watchlist",
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                KYC checks have not started yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tawthiq Card */}
        <Card data-ocid="individual_dashboard.tawthiq_card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <BrainCircuit className="h-4 w-4 text-primary" />
              Tawthiq{" "}
              <span className="text-sm font-normal text-muted-foreground">
                (التوثيق)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : !tawthiq ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Assessment in progress…
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const vc = verdictConfig(tawthiq.creditReadiness);
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Credit Readiness:
                      </span>
                      <Badge
                        className={vc.className}
                        data-ocid="individual_dashboard.tawthiq_verdict_badge"
                      >
                        {vc.label}
                      </Badge>
                    </div>
                  );
                })()}
                {tawthiq.shariaFlags.length > 0 && (
                  <div
                    className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 space-y-1"
                    data-ocid="individual_dashboard.tawthiq_flags"
                  >
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      Shariah Flags
                    </p>
                    {tawthiq.shariaFlags.map((flag) => (
                      <div
                        key={flag}
                        className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {flag}
                      </div>
                    ))}
                  </div>
                )}
                {tawthiq.narrativeSummary && (
                  <p
                    className="text-sm text-muted-foreground leading-relaxed"
                    data-ocid="individual_dashboard.tawthiq_narrative"
                  >
                    {tawthiq.narrativeSummary}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mizan Preliminary Card */}
        <Card data-ocid="individual_dashboard.mizan_card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Scale className="h-4 w-4 text-primary" />
                Mizan{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  (الميزان)
                </span>
              </CardTitle>
              {mizan && (
                <Badge
                  className="bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 text-xs"
                  data-ocid="individual_dashboard.mizan_stage_badge"
                >
                  {mizan.stage === Variant_full_preliminary.preliminary
                    ? "Preliminary"
                    : "Full Assessment"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : !mizan ? (
              <p className="text-sm text-muted-foreground py-2">
                Mizan assessment will be available after KYC verification
                completes.
              </p>
            ) : (
              <div className="space-y-3">
                {(
                  [
                    [
                      "Income Stability",
                      Number(mizan.incomeStabilityScore),
                      "individual_dashboard.mizan_income",
                    ],
                    [
                      "Debt Behaviour",
                      Number(mizan.debtBehaviorScore),
                      "individual_dashboard.mizan_debt",
                    ],
                    [
                      "Repayment Capacity",
                      Number(mizan.repaymentCapacityScore),
                      "individual_dashboard.mizan_repayment",
                    ],
                  ] as [string, number, string][]
                ).map(([label, score, ocid]) => (
                  <div key={ocid} data-ocid={ocid}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">
                        {score}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--individual-accent,oklch(0.65_0.18_60))] transition-all duration-700"
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
                ))}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-muted-foreground">
                    Overall Score
                  </span>
                  <span className="font-bold text-lg text-foreground">
                    {Number(mizan.overallScore)}
                  </span>
                </div>
                {mizan.stage === Variant_full_preliminary.preliminary && (
                  <p
                    className="text-xs text-muted-foreground border-t border-border pt-2"
                    data-ocid="individual_dashboard.mizan_preliminary_note"
                  >
                    Full assessment available after bank account is linked.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bank Linking */}
        <Card data-ocid="individual_dashboard.bank_section">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <CreditCard className="h-4 w-4 text-primary" />
              Bank Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-48" />
            ) : bankLinked ? (
              <div
                className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"
                data-ocid="individual_dashboard.bank_linked_state"
              >
                <CheckCircle2 className="h-4 w-4" />
                Bank account linked successfully.
              </div>
            ) : isFinancingReady ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Link your bank account via Mono to unlock your full Mizan
                  assessment.
                </p>
                <Button
                  type="button"
                  className="gap-2 bg-[var(--individual-accent,oklch(0.65_0.18_60))] text-white hover:opacity-90"
                  onClick={() => {
                    window.location.href = "/individual/bank";
                  }}
                  data-ocid="individual_dashboard.bank_link_button"
                >
                  <CreditCard className="h-4 w-4" />
                  Link Bank Account
                </Button>
              </div>
            ) : (
              <p
                className="text-sm text-muted-foreground"
                data-ocid="individual_dashboard.bank_locked_state"
              >
                Your account must be marked financing-ready by our review team
                before you can link your bank.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </IndividualLayout>
  );
}
