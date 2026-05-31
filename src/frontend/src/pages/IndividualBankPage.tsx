import { BankLinkStatus, RegistrationStatus } from "@/backend";
import { IndividualLayout } from "@/components/IndividualLayout";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/use-backend";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BanknoteIcon,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function IndividualBankPage() {
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
  const isLoading = profileQuery.isLoading;

  const isFinancingReady =
    profile?.registrationStatus === RegistrationStatus.financingReady ||
    profile?.registrationStatus === RegistrationStatus.approved;

  const bankStatus = profile?.bankLinkStatus;
  const isLinked = bankStatus?.__kind__ === "Linked";

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const result = await actor.requestIndividualBankLink();
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: (url) => {
      queryClient.invalidateQueries({ queryKey: ["individual_profile"] });
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to initiate bank link.",
      ),
  });

  return (
    <IndividualLayout>
      <div className="p-6 space-y-6 max-w-2xl" data-ocid="individual_bank.page">
        <PageHeader
          title="Bank Account Linking"
          subtitle="Link your bank account via Mono to unlock your full Mizan assessment."
          breadcrumbs={[{ label: "Bank Linking" }]}
        />

        {profileQuery.isError && (
          <div
            className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
            data-ocid="individual_bank.error_state"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">Failed to load profile.</p>
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
              data-ocid="individual_bank.retry_button"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        <Card
          className="border-[var(--individual-accent,oklch(0.65_0.18_60))]/20 bg-[var(--individual-accent,oklch(0.65_0.18_60))]/5"
          data-ocid="individual_bank.info_card"
        >
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <BanknoteIcon className="h-5 w-5 shrink-0 mt-0.5 text-[var(--individual-accent,oklch(0.65_0.18_60))]" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Why link your bank account?
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Linking your bank account via Mono allows Mizan (الميزان) to
                  run a full underwriting assessment using your real transaction
                  history — analysing income stability, debt behaviour, and
                  repayment capacity.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="pt-5 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-9 w-52" />
            </CardContent>
          </Card>
        ) : isLinked ? (
          <Card data-ocid="individual_bank.linked_state">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Bank Account Linked
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-300 dark:border-emerald-700 px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Your bank account is successfully linked.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Mizan will now run a full assessment using your verified
                transaction history. Check your Assessment Scores page for
                updated results.
              </p>
            </CardContent>
          </Card>
        ) : bankStatus?.__kind__ === "LinkFailed" ? (
          <Card
            className="border-destructive/30"
            data-ocid="individual_bank.link_failed_state"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Bank Linking Failed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-destructive">
                {
                  (bankStatus as { __kind__: "LinkFailed"; LinkFailed: string })
                    .LinkFailed
                }
              </p>
              <Button
                type="button"
                className="gap-2 bg-[var(--individual-accent,oklch(0.65_0.18_60))] text-white hover:opacity-90"
                onClick={() => linkMutation.mutate()}
                disabled={linkMutation.isPending}
                data-ocid="individual_bank.retry_link_button"
              >
                {linkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : isFinancingReady ? (
          <Card data-ocid="individual_bank.link_prompt_card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-primary" />
                Link Your Bank Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
                  Financing Ready
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Your account has been cleared for bank linking.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Click below to securely connect your bank account through Mono.
                You will be redirected to your bank's authentication page.
              </p>
              <Button
                type="button"
                className="gap-2 bg-[var(--individual-accent,oklch(0.65_0.18_60))] text-white hover:opacity-90"
                onClick={() => linkMutation.mutate()}
                disabled={linkMutation.isPending}
                data-ocid="individual_bank.link_button"
              >
                {linkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {linkMutation.isPending
                  ? "Opening Mono Connect…"
                  : "Link Your Bank Account"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card
            className="border-dashed"
            data-ocid="individual_bank.locked_state"
          >
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="rounded-full bg-muted p-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Bank Linking Locked
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    Your account must be marked financing-ready by our review
                    team before you can link your bank account.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div
          className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3"
          data-ocid="individual_bank.security_note"
        >
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Your bank credentials are never stored on Vetify. Mono provides
            secure, consent-based read-only access to your financial data.
          </p>
        </div>
      </div>
    </IndividualLayout>
  );
}
