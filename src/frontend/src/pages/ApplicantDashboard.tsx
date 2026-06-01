import {
  RegistrationStatus as BackendRegistrationStatus,
  KycStatus,
} from "@/backend";
import type { MizanRecord } from "@/types";
import { RiskLevel__1 } from "@/types";

// Normalise the Candid variant object { Low: null } | { Medium: null } | { High: null }
// returned by the backend into the local RiskLevel__1 string enum.
function normaliseRiskLevel(
  candid: Record<string, null> | string | undefined,
): RiskLevel__1 {
  if (!candid) return RiskLevel__1.Medium;
  const key =
    typeof candid === "string" ? candid : (Object.keys(candid)[0] ?? "Medium");
  if (key === "Low") return RiskLevel__1.Low;
  if (key === "High") return RiskLevel__1.High;
  return RiskLevel__1.Medium;
}

function normaliseMizanRecord(raw: Record<string, unknown>): MizanRecord {
  return {
    incomeStabilityScore: raw.incomeStabilityScore as bigint,
    debtBehaviorScore: raw.debtBehaviorScore as bigint,
    repaymentPatternScore: raw.repaymentPatternScore as bigint,
    revenueTrendScore: raw.revenueTrendScore as bigint,
    overallReadinessScore: raw.overallReadinessScore as bigint,
    halalComplianceScore: raw.halalComplianceScore as bigint,
    riskClassification: normaliseRiskLevel(
      raw.riskClassification as Record<string, null>,
    ),
    isBorderline: raw.isBorderline as boolean,
    borderlineReasons: raw.borderlineReasons as string[],
    narrativeSummary: raw.narrativeSummary as string,
    computedAt: raw.computedAt as bigint,
  };
}
import { AiScoresCard } from "@/components/AiScoresCard";
import { BankLinkSection } from "@/components/BankLinkSection";
import { BusinessLayout } from "@/components/BusinessLayout";
import { KycStatusCard } from "@/components/KycStatusCard";
import { FullPageLoader } from "@/components/LoadingSpinner";
import { MizanScoresCard } from "@/components/MizanScoresCard";
import { PageHeader } from "@/components/PageHeader";
import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";
import { TawthiqStatusCard } from "@/components/TawthiqStatusCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBackend } from "@/hooks/use-backend";
import { cn } from "@/lib/utils";
import { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BrainCircuit, Pencil, Scale, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function ApplicantDashboard() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | undefined>(
    undefined,
  );

  const profileQuery = useQuery({
    queryKey: ["applicant_profile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMyBusinessProfile();
    },
    enabled: !!actor,
  });

  // Fetch profile photo on mount
  useEffect(() => {
    if (!actor || !profileQuery.data?.userId) return;
    actor
      .getProfilePhoto(Principal.fromText(profileQuery.data.userId.toString()))
      .then((result) => {
        if (Array.isArray(result) && result.length > 0 && result[0]) {
          setProfilePhotoUrl(result[0]);
        }
      })
      .catch(() => {
        // Silently ignore missing photo
      });
  }, [actor, profileQuery.data?.userId]);

  const profileUserId = profileQuery.data?.userId ?? null;

  const tawthiqQuery = useQuery({
    queryKey: ["tawthiq_record", profileUserId?.toString()],
    queryFn: async () => {
      if (!actor || !profileUserId) return null;
      return actor.getTawthiqRecord(profileUserId);
    },
    enabled: !!actor && !!profileUserId,
  });

  const mizanQuery = useQuery({
    queryKey: ["mizan_record", profileUserId?.toString()],
    queryFn: async () => {
      if (!actor || !profileUserId) return null;
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof actorAny.getMizanResult !== "function") return null;
      const result = (await actorAny.getMizanResult(
        profileUserId.toString(),
      )) as { ok: Record<string, unknown> } | { err: string } | null;
      if (!result) return null;
      if ("ok" in result) return normaliseMizanRecord(result.ok);
      return null;
    },
    enabled: !!actor && !!profileUserId,
  });

  const preliminaryMizanQuery = useQuery({
    queryKey: ["preliminary_mizan_record", profileUserId?.toString()],
    queryFn: async () => {
      if (!actor) return null;
      const result = await actor.getPreliminaryMizanResult();
      if (!result) return null;
      return normaliseMizanRecord(result as unknown as Record<string, unknown>);
    },
    enabled: !!actor && !!profileUserId,
  });

  // Poll every 3s while KYC is in-progress/pending OR Tawthiq is incomplete
  useEffect(() => {
    const kycStatus = profileQuery.data?.kycRecord?.kycStatus;
    const tawthiqDone = tawthiqQuery.data?.completedAt != null;
    const mizanDone = !!mizanQuery.data;
    const kycNeedsPolling =
      kycStatus === KycStatus.InProgress || kycStatus === KycStatus.Pending;
    const shouldPoll = kycNeedsPolling || !tawthiqDone || !mizanDone;

    if (shouldPoll && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        void queryClient.invalidateQueries({ queryKey: ["applicant_profile"] });
        void queryClient.invalidateQueries({ queryKey: ["tawthiq_record"] });
        void queryClient.invalidateQueries({ queryKey: ["mizan_record"] });
        void queryClient.invalidateQueries({
          queryKey: ["preliminary_mizan_record"],
        });
      }, 3000);
    } else if (!shouldPoll && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [
    profileQuery.data?.kycRecord?.kycStatus,
    tawthiqQuery.data?.completedAt,
    mizanQuery.data,
    queryClient,
  ]);

  // Poll tawthiq every 5s to reflect appeal decision updates
  useEffect(() => {
    const id = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["tawthiq_record"] });
    }, 5000);
    return () => clearInterval(id);
  }, [queryClient]);

  const linkBankMutation = useMutation({
    mutationFn: async (accountId: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.linkBankAccount(accountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant_profile"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Bank link failed"),
  });

  const submitAppealMutation = useMutation({
    mutationFn: async ({
      flagId,
      appealText,
      documentUrl,
      documentName,
    }: {
      flagId: string;
      appealText: string;
      documentUrl: string | null;
      documentName: string | null;
    }) => {
      if (!actor) throw new Error("Not connected");
      const result = await actor.submitTawthiqAppeal(
        flagId,
        appealText,
        documentUrl,
        documentName,
      );
      if ("err" in result) throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tawthiq_record"] });
      toast.success(
        "Appeal submitted successfully. It is now under admin review.",
      );
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to submit appeal",
      ),
  });

  async function handleSubmitAppeal(
    flagId: string,
    appealText: string,
    documentUrl: string | null,
    documentName: string | null,
  ) {
    await submitAppealMutation.mutateAsync({
      flagId,
      appealText,
      documentUrl,
      documentName,
    });
  }

  if (profileQuery.isLoading) return <FullPageLoader />;

  const profile = profileQuery.data ?? null;
  const displayName = profile?.businessName ?? "Applicant";

  const regStatus: BackendRegistrationStatus =
    profile?.registrationStatus ?? BackendRegistrationStatus.pending;

  const isFinancingReady =
    regStatus === BackendRegistrationStatus.financingReady;
  const isApproved = regStatus === BackendRegistrationStatus.approved;

  const statusConfig: Record<
    BackendRegistrationStatus,
    { label: string; className: string }
  > = {
    [BackendRegistrationStatus.pending]: {
      label: "Pending",
      className: "bg-muted text-muted-foreground",
    },
    [BackendRegistrationStatus.kycInProgress]: {
      label: "KYC In Progress",
      className: "bg-chart-4/15 text-foreground border-chart-4/30",
    },
    [BackendRegistrationStatus.underReview]: {
      label: "Under Review",
      className:
        "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700",
    },
    [BackendRegistrationStatus.financingReady]: {
      label: "Financing Ready",
      className:
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700",
    },
    [BackendRegistrationStatus.approved]: {
      label: "Approved",
      className: "bg-primary/15 text-primary border-primary/30",
    },
    [BackendRegistrationStatus.rejected]: {
      label: "Rejected",
      className: "bg-destructive/15 text-destructive border-destructive/30",
    },
  };

  const { label: statusLabel, className: statusClass } =
    statusConfig[regStatus];

  const hasScores =
    profile?.scoringRecord && Number(profile.scoringRecord.scoredAt) > 0;

  // Determine which Mizan cards to show
  const fullMizan = mizanQuery.data ?? null;
  const prelimMizan = preliminaryMizanQuery.data ?? null;
  // Only show preliminary as a separate card if full Mizan doesn't exist OR
  // if both exist show both (preliminary first)
  const showPrelim = !!prelimMizan;
  const showFull = !!fullMizan;

  return (
    <BusinessLayout>
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <PageHeader
          title={`Welcome, ${displayName}`}
          subtitle={
            isApproved
              ? "Your profile is verified and active."
              : isFinancingReady
                ? "Your profile is financing-ready. Link your bank account to proceed."
                : "Complete your verification to become financing-ready."
          }
          breadcrumbs={[{ label: "Dashboard" }]}
          actions={
            <div className="flex items-center gap-3">
              <ProfilePhotoUpload
                userId={profileQuery.data?.userId?.toString() ?? ""}
                displayName={displayName}
                currentPhotoUrl={profilePhotoUrl}
                size="lg"
                onPhotoUpdated={(url) => setProfilePhotoUrl(url)}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => navigate({ to: "/business/profile" })}
                  data-ocid="applicant_dashboard.edit_profile_button"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Profile
                </Button>
                <Badge
                  className={cn("text-xs", statusClass)}
                  data-ocid="applicant_dashboard.registration_status_badge"
                >
                  {statusLabel}
                </Badge>
              </div>
            </div>
          }
        />

        {/* Financing-Ready / Approved Banner */}
        {(isFinancingReady || isApproved) && (
          <div
            className="mb-8 flex items-center gap-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-5 py-4"
            data-ocid="applicant_dashboard.financing_ready_banner"
          >
            <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                {isApproved
                  ? "Profile Approved!"
                  : "Your Profile is Financing-Ready!"}
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {isApproved
                  ? "Your profile is now visible to verified halal financiers on the platform."
                  : "Link your bank account below to complete your financial profile and trigger AI scoring."}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* KYC Verification */}
          {profile?.kycRecord && (
            <section data-ocid="applicant_dashboard.kyc_section">
              <KycStatusCard
                kycRecord={profile.kycRecord}
                isLoading={
                  profile.kycRecord.kycStatus === KycStatus.InProgress ||
                  profile.kycRecord.kycStatus === KycStatus.Pending
                }
                onRetry={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["applicant_profile"],
                  })
                }
              />
            </section>
          )}

          {/* Tawthiq — AI verification & compliance */}
          <section data-ocid="applicant_dashboard.tawthiq_section">
            <TawthiqStatusCard
              tawthiqRecord={tawthiqQuery.data ?? null}
              isLoading={tawthiqQuery.isLoading}
              onSubmitAppeal={handleSubmitAppeal}
            />
          </section>

          {/* Mizan — AI risk & underwriting (dual cards: preliminary + full) */}
          <section data-ocid="applicant_dashboard.mizan_section">
            {!showPrelim && !showFull ? (
              <Card
                className="border-border border-dashed"
                data-ocid="applicant_dashboard.mizan_pending"
              >
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Scale className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="font-semibold text-foreground">
                    Mizan (<span className="font-arabic">الميزان</span>)
                    Assessment Pending
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Mizan assessment will begin after Tawthiq verification
                    completes.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Preliminary Mizan card — amber accent */}
                {showPrelim && !showFull && (
                  <div
                    className="rounded-xl border border-amber-300/60 dark:border-amber-700/50 ring-1 ring-amber-200/60 dark:ring-amber-800/40"
                    data-ocid="applicant_dashboard.mizan_preliminary_card"
                  >
                    <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Preliminary Risk Assessment
                      </p>
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium border border-amber-300/60 dark:border-amber-700/50">
                        Preliminary
                      </span>
                    </div>
                    <p className="px-4 pb-2 text-[11px] text-amber-700 dark:text-amber-500">
                      Based on your registration data. A full assessment will be
                      available after you link your bank account.
                    </p>
                    <MizanScoresCard
                      mizan={prelimMizan}
                      isLoading={preliminaryMizanQuery.isLoading}
                      mizanDivergenceAlert={
                        profile?.mizanDivergenceAlert ?? false
                      }
                    />
                  </div>
                )}

                {/* When both exist, show preliminary first with a subdued style */}
                {showPrelim && showFull && (
                  <div
                    className="rounded-xl border border-amber-200/50 dark:border-amber-800/40 opacity-80"
                    data-ocid="applicant_dashboard.mizan_preliminary_card"
                  >
                    <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-amber-500 dark:text-amber-500 shrink-0" />
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                        Preliminary Risk Assessment
                      </p>
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500 font-medium border border-amber-200/60 dark:border-amber-700/40">
                        Superseded by Full Assessment
                      </span>
                    </div>
                    <p className="px-4 pb-2 text-[11px] text-muted-foreground">
                      Initial estimate based on registration data.
                    </p>
                    <MizanScoresCard
                      mizan={prelimMizan}
                      isLoading={preliminaryMizanQuery.isLoading}
                      mizanDivergenceAlert={
                        profile?.mizanDivergenceAlert ?? false
                      }
                    />
                  </div>
                )}

                {/* Full Mizan card — primary/green accent */}
                {showFull && (
                  <div
                    className="rounded-xl border border-primary/30 dark:border-primary/40 ring-1 ring-primary/15 dark:ring-primary/20"
                    data-ocid="applicant_dashboard.mizan_full_card"
                  >
                    <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-sm font-semibold text-foreground">
                        Bank-Verified Risk Assessment
                      </p>
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 dark:bg-primary/20 text-primary font-medium border border-primary/25">
                        Full Assessment
                      </span>
                    </div>
                    <p className="px-4 pb-2 text-[11px] text-muted-foreground">
                      Based on your verified Mono bank transaction data.
                    </p>
                    <MizanScoresCard
                      mizan={fullMizan}
                      isLoading={mizanQuery.isLoading}
                      mizanDivergenceAlert={
                        profile?.mizanDivergenceAlert ?? false
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Bank Account Linking */}
          {profile?.bankLinkRecord && (
            <section data-ocid="applicant_dashboard.bank_section">
              <BankLinkSection
                bankLinkRecord={profile.bankLinkRecord}
                isFinancingReady={isFinancingReady}
                onLinkBank={async (accountId) => {
                  await linkBankMutation.mutateAsync(accountId);
                }}
              />
            </section>
          )}

          {/* AI Scores — only when scored */}
          {hasScores && profile?.scoringRecord && (
            <section data-ocid="applicant_dashboard.ai_scores_section">
              <AiScoresCard scoringRecord={profile.scoringRecord} />
            </section>
          )}

          {/* Not yet scored placeholder */}
          {!hasScores && (
            <Card
              className="border-border border-dashed"
              data-ocid="applicant_dashboard.scores_pending"
            >
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <BrainCircuit className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-foreground">
                  AI Scoring Pending
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Your financing readiness, halal compliance, and risk scores
                  will appear here after your bank account is linked and AI
                  analysis is complete.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </BusinessLayout>
  );
}
