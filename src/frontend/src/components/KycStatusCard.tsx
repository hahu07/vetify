import type { KycCheckRecord } from "@/backend";
import { KycStatus } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

interface KycStatusCardProps {
  kycRecord: KycCheckRecord;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

type CheckStatus = "verified" | "failed" | "pending";

interface KycCheckItem {
  label: string;
  description: string;
  status: CheckStatus;
  dataOcid: string;
}

function CheckRow({ label, description, status, dataOcid }: KycCheckItem) {
  const cfg: Record<
    CheckStatus,
    { icon: React.ElementType; color: string; text: string }
  > = {
    verified: {
      icon: CheckCircle2,
      color: "text-emerald-500 dark:text-emerald-400",
      text: "Verified",
    },
    failed: { icon: XCircle, color: "text-destructive", text: "Failed" },
    pending: { icon: Circle, color: "text-muted-foreground", text: "Pending" },
  };
  const { icon: Icon, color, text } = cfg[status];

  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5"
      data-ocid={dataOcid}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className={cn("h-4 w-4 shrink-0", color)} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground truncate">
            {description}
          </p>
        </div>
      </div>
      <span className={cn("text-xs font-medium shrink-0", color)}>{text}</span>
    </div>
  );
}

function kycStatusToBadge(status: KycStatus): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  switch (status) {
    case KycStatus.Verified:
      return {
        label: "KYC Verified",
        variant: "default",
        className:
          "bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
      };
    case KycStatus.Failed:
      return {
        label: "KYC Failed",
        variant: "destructive",
        className: "",
      };
    case KycStatus.InProgress:
      return {
        label: "In Progress",
        variant: "secondary",
        className:
          "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
      };
    default:
      return {
        label: "Pending",
        variant: "secondary",
        className: "",
      };
  }
}

function boolToStatus(val: boolean): CheckStatus {
  return val ? "verified" : "failed";
}

export function KycStatusCard({
  kycRecord,
  isLoading = false,
  error = null,
  onRetry,
}: KycStatusCardProps) {
  const badge = kycStatusToBadge(kycRecord.kycStatus);

  const checks: KycCheckItem[] = [
    {
      label: "BVN Verification",
      description: "Bank Verification Number confirmed with NIBSS",
      status: boolToStatus(kycRecord.bvnVerified),
      dataOcid: "kyc_card.bvn_check",
    },
    {
      label: "NIN Verification",
      description: "National Identification Number confirmed with NIMC",
      status: boolToStatus(kycRecord.ninVerified),
      dataOcid: "kyc_card.nin_check",
    },
    {
      label: "CAC Business Registration",
      description: "Corporate Affairs Commission registration verified",
      status: boolToStatus(kycRecord.cacVerified),
      dataOcid: "kyc_card.cac_check",
    },
    {
      label: "TIN Verification",
      description: "Tax Identification Number verified with FIRS",
      status: boolToStatus(kycRecord.tinVerified),
      dataOcid: "kyc_card.tin_check",
    },
    {
      label: "Watchlist Screening",
      description: "No adverse matches on financial watchlists",
      status: kycRecord.watchlistClean ? "verified" : "failed",
      dataOcid: "kyc_card.watchlist_check",
    },
  ];

  const creditScore = Number(kycRecord.creditScore);

  return (
    <Card className="relative border-border" data-ocid="kyc_card">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying your information…
          </div>
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            KYC Verification
          </CardTitle>
          <Badge
            variant={badge.variant}
            className={cn("text-xs", badge.className)}
            data-ocid="kyc_card.status_badge"
          >
            {badge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {checks.map((check) => (
            <CheckRow key={check.label} {...check} />
          ))}
        </div>
        {creditScore > 0 && (
          <div
            className="mt-3 flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
            data-ocid="kyc_card.credit_score"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Credit Score
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {creditScore}
            </span>
          </div>
        )}
        {error && (
          <div
            className="mt-3 flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5"
            data-ocid="kyc_card.error_state"
          >
            <p className="text-sm text-destructive">{error}</p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={onRetry}
                data-ocid="kyc_card.retry_button"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            )}
          </div>
        )}
        {kycRecord.kycStatus === KycStatus.Failed && !error && onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={onRetry}
            data-ocid="kyc_card.retry_kyc_button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry KYC
          </Button>
        )}
        {kycRecord.verifiedAt !== undefined && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Verified{" "}
            {new Date(
              Number(kycRecord.verifiedAt) / 1_000_000,
            ).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
