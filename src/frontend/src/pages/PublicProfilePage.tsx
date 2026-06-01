import { createActor } from "@/backend";
import type { PublicApplicantProfile } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useActor } from "@caffeineai/core-infrastructure";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";

const purposeLabels: Record<string, string> = {
  homePurchase: "Home Purchase",
  vehicle: "Vehicle",
  education: "Education",
  medical: "Medical",
  startupCapital: "Startup Capital",
  other: "Other",
};

const instrumentLabels: Record<string, string> = {
  murabaha: "Murabaha",
  musharakah: "Musharakah",
  mudarabah: "Mudarabah",
  ijarah: "Ijarah",
  istisna: "Istisna",
  salam: "Salam",
  other: "Other",
};

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  financingReady: { label: "Financing Ready", variant: "default" },
  underReview: { label: "Under Review", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  pending: { label: "Pending", variant: "outline" },
  rejected: { label: "Not Eligible", variant: "destructive" },
  kycInProgress: { label: "KYC In Progress", variant: "secondary" },
};

function formatNGN(amount: bigint): string {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}

function RiskIcon({ score }: { score: bigint }) {
  const n = Number(score);
  if (n >= 70) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (n >= 40) return <Minus className="h-4 w-4 text-yellow-600" />;
  return <TrendingDown className="h-4 w-4 text-red-600" />;
}

function riskLabel(score: bigint): string {
  const n = Number(score);
  if (n >= 70) return "Low Risk";
  if (n >= 40) return "Moderate Risk";
  return "Higher Risk";
}

export default function PublicProfilePage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { actor, isFetching } = useActor(createActor);
  const [profile, setProfile] = useState<
    PublicApplicantProfile | null | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor || isFetching) return;
    let cancelled = false;
    setLoading(true);
    actor
      .get_public_profile(id)
      .then((result) => {
        if (!cancelled) {
          setProfile(result ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [actor, isFetching, id]);

  const statusCfg = profile
    ? (statusConfig[profile.registrationStatus] ?? {
        label: profile.registrationStatus,
        variant: "outline" as const,
      })
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            data-ocid="public_profile.back_home_link"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
          <span className="font-display text-lg font-bold tracking-tight text-primary">
            Vetify
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {loading ? (
          <div className="space-y-4" data-ocid="public_profile.loading_state">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : profile === null ? (
          <div
            className="flex flex-col items-center py-24 text-center"
            data-ocid="public_profile.empty_state"
          >
            <div className="mb-4 rounded-full bg-muted p-4">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Profile Not Found
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              This profile is not yet public or does not exist. If you believe
              this is an error, please contact the applicant directly.
            </p>
            <Link
              to="/"
              className="mt-6 text-sm text-primary hover:underline"
              data-ocid="public_profile.go_home_link"
            >
              Return to Vetify home
            </Link>
          </div>
        ) : profile ? (
          <div className="space-y-6">
            {/* Header card */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">
                    {profile.fullName}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {purposeLabels[profile.financingPurpose] ??
                      profile.financingPurpose}{" "}
                    Financing
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {statusCfg && (
                    <Badge
                      variant={statusCfg.variant}
                      data-ocid="public_profile.status_badge"
                    >
                      {statusCfg.label}
                    </Badge>
                  )}
                  {profile.registrationStatus === "financingReady" && (
                    <div
                      className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      data-ocid="public_profile.verified_badge"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Verified by Vetify
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Preferred Instrument
                </p>
                <p className="mt-1 text-base font-medium text-foreground">
                  {instrumentLabels[profile.preferredInstrument] ??
                    profile.preferredInstrument}
                </p>
              </div>

              {profile.amountSought != null && (
                <div
                  className="rounded-xl border border-border bg-card p-4"
                  data-ocid="public_profile.amount_sought_card"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Amount Sought
                  </p>
                  <p className="mt-1 text-base font-medium text-foreground">
                    {formatNGN(profile.amountSought)}
                  </p>
                </div>
              )}

              {profile.monthlyIncome != null && (
                <div
                  className="rounded-xl border border-border bg-card p-4"
                  data-ocid="public_profile.monthly_income_card"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Monthly Income
                  </p>
                  <p className="mt-1 text-base font-medium text-foreground">
                    {formatNGN(profile.monthlyIncome)}
                  </p>
                </div>
              )}

              {profile.mizanScore != null && (
                <div
                  className="rounded-xl border border-border bg-card p-4"
                  data-ocid="public_profile.mizan_score_card"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Mizan Risk Score
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <RiskIcon score={profile.mizanScore} />
                    <span className="text-base font-medium text-foreground">
                      {Number(profile.mizanScore)}/100
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({riskLabel(profile.mizanScore)})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Vetify trust note */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <strong className="text-foreground">About this profile:</strong>{" "}
              This profile has been verified by Vetify's AI-powered vetting
              process. Displayed fields are controlled by the applicant's
              privacy settings.
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border bg-muted/40 py-6">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "vetify")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
