import { KycStatus, RegistrationStatus } from "@/backend";
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
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useRef } from "react";

type CheckState = "verified" | "failed" | "pending";

interface KycCheckItem {
  label: string;
  state: CheckState;
  description: string;
  note: string;
  ocid: string;
}

function CheckStateIcon({ state }: { state: CheckState }) {
  switch (state) {
    case "verified":
      return (
        <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
      );
    case "failed":
      return <XCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />;
  }
}

function CheckStateBadge({ state }: { state: CheckState }) {
  switch (state) {
    case "verified":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 text-xs">
          Verified
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
        <Badge variant="secondary" className="text-xs">
          Pending
        </Badge>
      );
  }
}

function boolToState(val: boolean): CheckState {
  return val ? "verified" : "failed";
}

function creditScoreInterpretation(score: number): {
  label: string;
  className: string;
} {
  if (score >= 700)
    return {
      label: "Excellent",
      className: "text-emerald-600 dark:text-emerald-400",
    };
  if (score >= 580)
    return {
      label: "Good",
      className: "text-emerald-600 dark:text-emerald-400",
    };
  if (score >= 450)
    return { label: "Fair", className: "text-amber-600 dark:text-amber-400" };
  if (score > 0)
    return {
      label: "Below Average",
      className: "text-red-600 dark:text-red-400",
    };
  return { label: "Not Available", className: "text-muted-foreground" };
}

export default function IndividualKycPage() {
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
  const kyc = profile?.kycRecord ?? null;
  const kycStatus = kyc?.kycStatus ?? KycStatus.Pending;
  const needsPolling =
    profile?.registrationStatus === RegistrationStatus.kycInProgress ||
    kycStatus === KycStatus.InProgress ||
    kycStatus === KycStatus.Pending;

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
  const creditScore = kyc ? Number(kyc.creditScore) : 0;
  const creditInterp = creditScoreInterpretation(creditScore);

  const checks: KycCheckItem[] = kyc
    ? [
        {
          label: "BVN Verification",
          state: boolToState(kyc.bvnVerified),
          description: "Bank Verification Number",
          note: "Your BVN is confirmed with NIBSS to verify your banking identity and ensure no adverse financial records.",
          ocid: "individual_kyc.bvn_check",
        },
        {
          label: "NIN Verification",
          state: boolToState(kyc.ninVerified),
          description: "National Identification Number",
          note: "Your NIN is verified with NIMC to confirm your national identity, date of birth, and address.",
          ocid: "individual_kyc.nin_check",
        },
        {
          label: "Watchlist Screening",
          state: kyc.watchlistClean ? "verified" : "failed",
          description: "Financial sanctions & fraud check",
          note: "Your identity is screened against national and international financial crime watchlists for any adverse matches.",
          ocid: "individual_kyc.watchlist_check",
        },
      ]
    : [];

  return (
    <IndividualLayout>
      <div className="p-6 space-y-6 max-w-3xl" data-ocid="individual_kyc.page">
        <PageHeader
          title="KYC Verification"
          subtitle="Identity and compliance checks run automatically via Mono."
          breadcrumbs={[{ label: "KYC Status" }]}
        />

        <Card data-ocid="individual_kyc.status_card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Verification Status
              </CardTitle>
              {needsPolling && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Verifying…
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : (
              <div className="flex items-center gap-3">
                {kycStatus === KycStatus.Verified && (
                  <Badge
                    className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                    data-ocid="individual_kyc.status_badge"
                  >
                    KYC Verified
                  </Badge>
                )}
                {kycStatus === KycStatus.Failed && (
                  <Badge
                    variant="destructive"
                    data-ocid="individual_kyc.status_badge"
                  >
                    KYC Failed
                  </Badge>
                )}
                {(kycStatus === KycStatus.InProgress ||
                  kycStatus === KycStatus.Pending) && (
                  <Badge
                    className="bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
                    data-ocid="individual_kyc.status_badge"
                  >
                    In Progress
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {isLoading
            ? [1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-5">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))
            : checks.map((check) => (
                <Card key={check.ocid} data-ocid={check.ocid}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <CheckStateIcon state={check.state} />
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground">
                            {check.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {check.description}
                          </p>
                        </div>
                      </div>
                      <CheckStateBadge state={check.state} />
                    </div>
                    <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {check.note}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {kyc && creditScore > 0 && (
          <Card data-ocid="individual_kyc.credit_score_card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4 text-primary" />
                Credit Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-foreground">
                  {creditScore}
                </span>
                <span
                  className={cn("text-sm font-medium", creditInterp.className)}
                >
                  {creditInterp.label}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Your credit score is derived from your BVN-linked financial
                history. A higher score improves your financing readiness.
              </p>
            </CardContent>
          </Card>
        )}

        <div
          className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3"
          data-ocid="individual_kyc.info_note"
        >
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            KYC verification is automated via Mono. If any check fails, please
            contact our review team for assistance.
          </p>
        </div>

        {profileQuery.isError && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ["individual_profile"],
              })
            }
            data-ocid="individual_kyc.retry_button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </div>
    </IndividualLayout>
  );
}
