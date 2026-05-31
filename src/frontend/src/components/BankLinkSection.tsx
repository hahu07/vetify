import type { BankLinkRecord } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BankLinkSectionProps {
  bankLinkRecord: BankLinkRecord;
  isFinancingReady: boolean;
  onLinkBank: (accountId: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function formatCurrency(amount: bigint, currency = "NGN") {
  const n = Number(amount);
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function maskBalance(balance: bigint, currency = "NGN") {
  const formatted = formatCurrency(balance, currency);
  if (formatted === "—") return "—";
  // Show first 2 chars then mask middle, keep last 3
  const digits = formatted.replace(/[^0-9]/g, "");
  if (digits.length <= 4) return formatted;
  return formatted.replace(digits.slice(2, -3), "•••");
}

export function BankLinkSection({
  bankLinkRecord,
  isFinancingReady,
  onLinkBank,
  isLoading = false,
  error = null,
  onRetry,
}: BankLinkSectionProps) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLinked = bankLinkRecord.status.__kind__ === "Linked";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId.trim()) return;
    setIsSubmitting(true);
    try {
      await onLinkBank(accountId.trim());
      toast.success("Bank account linked. AI scoring is now in progress.");
      setOpen(false);
      setAccountId("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to link bank account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="relative border-border" data-ocid="bank_link_section">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading bank data…
            </div>
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Bank Account (Mono)
            </CardTitle>
            <Badge
              variant={isLinked ? "default" : "secondary"}
              className={cn(
                "text-xs",
                isLinked
                  ? "bg-emerald-500/15 text-emerald-700 border-emerald-300"
                  : "",
              )}
              data-ocid="bank_link_section.status_badge"
            >
              {isLinked ? "Linked" : "Not Linked"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div
              className="mb-4 flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5"
              data-ocid="bank_link_section.error_state"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
              {onRetry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={onRetry}
                  data-ocid="bank_link_section.retry_button"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              )}
            </div>
          )}
          {isLinked ? (
            <div
              className="space-y-4"
              data-ocid="bank_link_section.linked_info"
            >
              {/* Institution & Balance */}
              <div className="grid grid-cols-2 gap-3">
                {bankLinkRecord.institutionName && (
                  <div className="rounded-md border border-border bg-muted/40 dark:bg-muted/20 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                      Institution
                    </p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {bankLinkRecord.institutionName}
                    </p>
                  </div>
                )}
                {bankLinkRecord.balance !== undefined && (
                  <div className="rounded-md border border-border bg-muted/40 dark:bg-muted/20 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                      Balance
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {maskBalance(
                        bankLinkRecord.balance,
                        bankLinkRecord.currency,
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Transaction Summary */}
              {bankLinkRecord.transactionSummary && (
                <div
                  className="space-y-2"
                  data-ocid="bank_link_section.transaction_summary"
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Transaction Summary
                    {bankLinkRecord.transactionSummary.months > 0n && (
                      <span className="ml-1 normal-case">
                        ({Number(bankLinkRecord.transactionSummary.months)}{" "}
                        months)
                      </span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="flex items-center gap-2 rounded-md border border-border bg-emerald-500/5 px-3 py-2">
                      <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Income</p>
                        <p className="text-xs font-semibold text-emerald-700">
                          {formatCurrency(
                            bankLinkRecord.transactionSummary.income,
                            bankLinkRecord.currency,
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-primary/5 px-3 py-2">
                      <Banknote className="h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Credits</p>
                        <p className="text-xs font-semibold text-foreground">
                          {formatCurrency(
                            bankLinkRecord.transactionSummary.totalCredits,
                            bankLinkRecord.currency,
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-destructive/5 px-3 py-2">
                      <TrendingDown className="h-4 w-4 shrink-0 text-destructive" />
                      <div>
                        <p className="text-xs text-muted-foreground">Debits</p>
                        <p className="text-xs font-semibold text-destructive">
                          {formatCurrency(
                            bankLinkRecord.transactionSummary.totalDebits,
                            bankLinkRecord.currency,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Linked At */}
              {bankLinkRecord.linkedAt !== undefined && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Linked on{" "}
                  {new Date(
                    Number(bankLinkRecord.linkedAt) / 1_000_000,
                  ).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>
          ) : isFinancingReady ? (
            <div
              className="space-y-3"
              data-ocid="bank_link_section.link_prompt"
            >
              <p className="text-sm text-muted-foreground">
                Your profile has been marked as financing-ready. Link your bank
                account via Mono to fetch verified financial data and trigger AI
                scoring.
              </p>
              <Button
                className="gap-2"
                onClick={() => setOpen(true)}
                data-ocid="bank_link_section.open_modal_button"
              >
                <Wallet className="h-4 w-4" />
                Link Bank Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              className="space-y-2"
              data-ocid="bank_link_section.locked_prompt"
            >
              <p className="text-sm text-muted-foreground">
                Bank account linking via Mono becomes available once your
                profile reaches financing-ready status.
              </p>
              <Button
                variant="outline"
                disabled
                className="gap-2 cursor-not-allowed opacity-60"
                data-ocid="bank_link_section.locked_button"
              >
                <Wallet className="h-4 w-4" />
                Link Bank Account (Locked)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Bank Account Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-md"
          data-ocid="bank_link_section.dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              Link Bank Account
            </DialogTitle>
            <DialogDescription>
              Enter your Mono account ID to securely link your bank account.
              Your transaction data will be fetched and used to generate your AI
              financing score.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mono-account-id">Mono Account ID</Label>
              <Input
                id="mono-account-id"
                placeholder="e.g. 5f4d8b2c3a1e9f7b6d0c4a8e"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
                data-ocid="bank_link_section.input"
              />
              <p className="text-xs text-muted-foreground">
                You can find your Mono account ID from your Mono Connect session
                or your Mono dashboard.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
                data-ocid="bank_link_section.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !accountId.trim()}
                className="gap-2"
                data-ocid="bank_link_section.submit_button"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Linking…
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4" />
                    Link Account
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
