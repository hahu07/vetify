import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useBackend } from "@/hooks/use-backend";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

export default function AdminBootstrap() {
  const { actor } = useBackend();
  const { principal, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [isBootstrapped, setIsBootstrapped] = useState<boolean | null>(null);
  const [checkLoading, setCheckLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!actor) return;
    void (async () => {
      setCheckLoading(true);
      try {
        const bootstrapped = await (
          actor as unknown as { isAdminBootstrapped: () => Promise<boolean> }
        ).isAdminBootstrapped();
        setIsBootstrapped(bootstrapped);
      } catch {
        // Method not available yet — treat as not bootstrapped
        setIsBootstrapped(false);
      } finally {
        setCheckLoading(false);
      }
    })();
  }, [actor]);

  const handleBootstrap = async () => {
    if (!actor || !principal) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await (
        actor as unknown as { bootstrapAdmin: (p: unknown) => Promise<void> }
      ).bootstrapAdmin(principal);
      setSuccess(true);
      setTimeout(() => navigate({ to: "/admin/dashboard" }), 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to bootstrap admin",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = checkLoading || !actor;

  return (
    <Layout>
      <div className="container mx-auto max-w-lg px-4 py-16">
        <PageHeader
          title="Admin Bootstrap"
          subtitle="One-time setup to configure the first admin account."
          breadcrumbs={[{ label: "Admin Setup" }]}
        />

        <Card data-ocid="admin_bootstrap.card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Admin Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading && (
              <div
                className="flex items-center gap-2 text-sm text-muted-foreground"
                data-ocid="admin_bootstrap.loading_state"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking admin status…
              </div>
            )}

            {!isLoading && isBootstrapped && (
              <div
                className="flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-4"
                data-ocid="admin_bootstrap.already_configured"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="font-medium text-emerald-800 dark:text-emerald-300">
                    Admin Already Configured
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    This platform already has an admin account set up.
                  </p>
                </div>
              </div>
            )}

            {!isLoading && !isBootstrapped && !success && (
              <div
                className="space-y-4"
                data-ocid="admin_bootstrap.setup_panel"
              >
                <p className="text-sm text-muted-foreground">
                  No admin account has been configured yet. Click the button
                  below to designate your Internet Identity principal as the
                  platform administrator.
                </p>

                {!isAuthenticated && (
                  <p
                    className="text-sm text-destructive"
                    data-ocid="admin_bootstrap.not_authenticated"
                  >
                    You must be logged in to bootstrap admin access.
                  </p>
                )}

                {principal && (
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                      Your Principal
                    </p>
                    <p className="break-all font-mono text-xs text-foreground">
                      {principal.toText()}
                    </p>
                  </div>
                )}

                {error && (
                  <p
                    className="text-sm text-destructive"
                    data-ocid="admin_bootstrap.error_state"
                  >
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleBootstrap}
                  disabled={isSubmitting || !isAuthenticated || !principal}
                  className="w-full gap-2"
                  data-ocid="admin_bootstrap.submit_button"
                  type="button"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Configuring…
                    </>
                  ) : (
                    "Set Myself as Admin"
                  )}
                </Button>
              </div>
            )}

            {success && (
              <div
                className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-4"
                data-ocid="admin_bootstrap.success_state"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="font-medium text-emerald-800 dark:text-emerald-300">
                    Admin Configured!
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
    </Layout>
  );
}
