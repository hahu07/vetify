import type { TawthiqOverviewStats } from "@/backend";
import { AdminLayout } from "@/components/AdminLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/use-backend";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  XCircle,
} from "lucide-react";

interface StatCardProps {
  label: string;
  value: bigint | undefined;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  isLoading: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  isLoading,
}: StatCardProps) {
  return (
    <Card
      className="border-border/50 shadow-sm"
      data-ocid={`tawthiq_overview.stat_card.${label.toLowerCase().replace(/\s/g, "_")}`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {label}
            </p>
            {isLoading ? (
              <Skeleton className="mt-1.5 h-9 w-20" />
            ) : (
              <p
                className={`mt-1 text-3xl font-bold tabular-nums ${colorClass}`}
              >
                {value !== undefined ? Number(value).toLocaleString() : "—"}
              </p>
            )}
          </div>
          <div className={`rounded-xl p-3 ${bgClass}`}>
            <Icon className={`h-6 w-6 ${colorClass}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminTawthiqOverviewPage() {
  const { actor, isFetching } = useBackend();

  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery<TawthiqOverviewStats>({
    queryKey: ["tawthiq", "overview", "stats"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getTawthiqOverviewStats();
    },
    enabled: !!actor && !isFetching,
  });

  const statCards = [
    {
      label: "Total Processed",
      value: stats?.totalProcessed,
      icon: ShieldCheck,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    {
      label: "Passed",
      value: stats?.passedCount,
      icon: CheckCircle2,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-500/10",
    },
    {
      label: "Conditional Ready",
      value: stats?.conditionalCount,
      icon: AlertCircle,
      colorClass: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-amber-500/10",
    },
    {
      label: "Not Ready",
      value: stats?.notReadyCount,
      icon: XCircle,
      colorClass: "text-destructive",
      bgClass: "bg-destructive/10",
    },
    {
      label: "Pending",
      value: stats?.pendingCount,
      icon: Clock,
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-500/10",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Tawthiq Overview"
          subtitle="التوثيق — Borrower onboarding pipeline summary"
        />

        {isError && (
          <div
            className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            data-ocid="tawthiq_overview.error_state"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Failed to load stats.</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="ml-auto underline underline-offset-2 hover:no-underline"
              data-ocid="tawthiq_overview.retry_button"
            >
              Retry
            </button>
          </div>
        )}

        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          data-ocid="tawthiq_overview.stats_grid"
        >
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              colorClass={card.colorClass}
              bgClass={card.bgClass}
              isLoading={isLoading}
            />
          ))}
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              About Tawthiq (التوثيق)
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tawthiq is the AI-powered borrower onboarding agent that automates
              KYC, KYB, and Shariah compliance screening. It analyses each SME's
              profile against Mono-verified data, flags inconsistencies, and
              assigns a credit-readiness verdict:{" "}
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Ready
              </span>
              ,{" "}
              <span className="font-medium text-amber-600 dark:text-amber-400">
                Conditional Ready
              </span>
              , or{" "}
              <span className="font-medium text-destructive">Not Ready</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
