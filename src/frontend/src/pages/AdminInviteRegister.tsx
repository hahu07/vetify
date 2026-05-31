import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useBackend } from "@/hooks/use-backend";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CheckCircle2,
  Loader2,
  Lock,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AdminInviteRegister() {
  const { actor } = useBackend();
  const { isAuthenticated, login, principal } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/admin/register" });
  const code = (search as Record<string, unknown>).code as string | undefined;

  const [redeemed, setRedeemed] = useState(false);

  // Redirect if no code
  useEffect(() => {
    if (!code) {
      toast.error("No invite code provided");
      navigate({ to: "/" });
    }
  }, [code, navigate]);

  // Validate invite link
  const validateQuery = useQuery({
    queryKey: ["validate_invite", code],
    queryFn: async () => {
      if (!actor || !code) return false;
      return actor.validateAdminInviteLink(code);
    },
    enabled: !!actor && !!code,
    retry: false,
  });

  const isValid = validateQuery.data === true;
  const isInvalid = validateQuery.data === false;
  const isChecking = validateQuery.isLoading;

  // Redeem mutation
  const redeemMutation = useMutation({
    mutationFn: async () => {
      if (!actor || !code) throw new Error("Missing code or actor");
      return actor.redeemAdminInviteLink(code);
    },
    onSuccess: (result) => {
      if (result.__kind__ === "ok") {
        setRedeemed(true);
        toast.success("You are now registered as an admin");
        setTimeout(() => navigate({ to: "/admin/dashboard" }), 1500);
      } else {
        toast.error(result.err);
      }
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to redeem invite link",
      ),
  });

  const handleRegister = () => {
    if (!isAuthenticated) {
      login();
      return;
    }
    redeemMutation.mutate();
  };

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-lg px-4 py-16">
        <Card data-ocid="admin_invite_register.card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Admin Invitation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isChecking && (
              <div
                className="flex items-center gap-2 text-sm text-muted-foreground"
                data-ocid="admin_invite_register.loading_state"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating invite link…
              </div>
            )}

            {isInvalid && !isChecking && (
              <div
                className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4"
                data-ocid="admin_invite_register.invalid_state"
              >
                <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-foreground">
                    Invalid or Expired Link
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This invite link has already been used, expired, or does not
                    exist. Contact the super-admin for a new invite.
                  </p>
                </div>
              </div>
            )}

            {isValid && !redeemed && !isChecking && (
              <div className="space-y-5" data-ocid="admin_invite_register.form">
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-sm text-primary">
                    <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
                    Invite link is valid. Complete registration below.
                  </p>
                </div>

                {!isAuthenticated && (
                  <p className="text-sm text-muted-foreground">
                    You need to authenticate with Internet Identity to complete
                    admin registration.
                  </p>
                )}

                {isAuthenticated && principal && (
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <p className="mb-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                      Your Principal
                    </p>
                    <p className="break-all font-mono text-xs text-foreground">
                      {principal.toText()}
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleRegister}
                  disabled={redeemMutation.isPending}
                  className="w-full gap-2"
                  data-ocid="admin_invite_register.submit_button"
                >
                  {redeemMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registering…
                    </>
                  ) : !isAuthenticated ? (
                    <>
                      <Lock className="h-4 w-4" />
                      Sign In with Internet Identity
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Register as Admin
                    </>
                  )}
                </Button>
              </div>
            )}

            {redeemed && (
              <div
                className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-4 dark:bg-emerald-950/20"
                data-ocid="admin_invite_register.success_state"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="font-medium text-emerald-800 dark:text-emerald-300">
                    Registration Complete
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Redirecting to admin dashboard…
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
