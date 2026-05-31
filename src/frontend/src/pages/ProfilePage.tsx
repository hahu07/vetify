import { AdminLayout } from "@/components/AdminLayout";
import { DocumentUpload } from "@/components/DocumentUpload";
import { FullPageLoader } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { StatusCard } from "@/components/StatusCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBackend } from "@/hooks/use-backend";
import {
  DocumentType,
  HalalComplianceStatus,
  RegistrationStatus,
  RiskLevel,
  UploadStatus,
} from "@/types";
import type { BusinessProfile, StatusVariant } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  FileText,
  Pencil,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function scoreToVariant(score: bigint): StatusVariant {
  const n = Number(score);
  if (n >= 75) return "success";
  if (n >= 50) return "warning";
  return "pending";
}

function riskToVariant(risk: RiskLevel): StatusVariant {
  if (risk === RiskLevel.low) return "success";
  if (risk === RiskLevel.medium) return "warning";
  if (risk === RiskLevel.high) return "danger";
  return "pending";
}

function halalToVariant(status: HalalComplianceStatus): StatusVariant {
  if (status === HalalComplianceStatus.compliant) return "success";
  if (status === HalalComplianceStatus.flagged) return "danger";
  return "pending";
}

export default function ProfilePage() {
  const { userId } = useParams({ from: "/admin/profile/$userId" });
  const { actor } = useBackend();
  const router = useRouter();
  const [showClosureDialog, setShowClosureDialog] = useState(false);
  const [closureRequested, setClosureRequested] = useState(false);

  const businessQuery = useQuery({
    queryKey: ["admin_business", userId],
    queryFn: async () => {
      if (!actor) return null;
      const { Principal } = await import("@icp-sdk/core/principal");
      return actor.adminGetBusiness(Principal.fromText(userId));
    },
    enabled: !!actor && !!userId,
  });

  const docsQuery = useQuery({
    queryKey: ["user_documents", userId],
    queryFn: async () => {
      if (!actor) return [];
      const { Principal } = await import("@icp-sdk/core/principal");
      return actor.getDocumentsForUser(Principal.fromText(userId));
    },
    enabled: !!actor && !!userId,
  });

  const isLoading = businessQuery.isLoading || docsQuery.isLoading;

  if (isLoading) return <FullPageLoader />;

  const profile = businessQuery.data as BusinessProfile | null;
  const docs = docsQuery.data ?? [];

  if (!profile) {
    return (
      <AdminLayout>
        <div
          className="container mx-auto max-w-3xl px-4 py-10"
          data-ocid="profile.not_found_section"
        >
          <PageHeader title="Applicant Profile" />
          <p className="text-muted-foreground">
            Profile not found for this user ID.
          </p>
        </div>
      </AdminLayout>
    );
  }

  const displayName = profile.businessName;

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <PageHeader
          title={displayName}
          subtitle="Business Applicant"
          breadcrumbs={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Profile" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.navigate({ to: "/business/profile" })}
                className="gap-1.5"
                data-ocid="profile.edit_profile_button"
              >
                <Pencil className="h-4 w-4" />
                Edit Profile
              </Button>
              <Badge
                variant="secondary"
                className={
                  profile.financingReady
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700"
                    : ""
                }
                data-ocid="profile.financing_ready_badge"
              >
                {profile.financingReady ? "Financing Ready" : "Not Ready"}
              </Badge>
            </div>
          }
        />

        {/* Status Cards */}
        <section className="mb-8" data-ocid="profile.status_section">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatusCard
              icon={TrendingUp}
              label="Readiness Score"
              value={`${Number(profile.financingReadyScore)}%`}
              variant={scoreToVariant(profile.financingReadyScore)}
              data-ocid="profile.financing_score_card"
            />
            <StatusCard
              icon={ShieldCheck}
              label="Risk Level"
              value={
                profile.riskLevel.charAt(0).toUpperCase() +
                profile.riskLevel.slice(1)
              }
              variant={riskToVariant(profile.riskLevel)}
              data-ocid="profile.risk_card"
            />
            <StatusCard
              icon={ShieldCheck}
              label="Halal Compliance"
              value={
                profile.halalComplianceStatus.charAt(0).toUpperCase() +
                profile.halalComplianceStatus.slice(1)
              }
              variant={halalToVariant(profile.halalComplianceStatus)}
              data-ocid="profile.halal_card"
            />
          </div>
        </section>

        {/* Profile Details */}
        <Card className="mb-8" data-ocid="profile.details_card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Building2 className="h-5 w-5" />
              Business Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Business Name
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {profile.businessName}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  CAC Number
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {profile.cacNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Business Type
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {profile.businessType}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Annual Revenue
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  ₦{Number(profile.annualRevenue).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contact Person
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {profile.contactPerson}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Address
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {profile.address}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Account Closure Banner */}
        {closureRequested && (
          <div
            className="mb-8 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30"
            data-ocid="profile.closure_requested_banner"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Account closure requested. Our team will review your request
              within <strong>14 days</strong>.
            </p>
          </div>
        )}

        {/* Documents */}
        <section data-ocid="profile.documents_section">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Submitted Documents
          </h2>
          {docs.length === 0 ? (
            <Card>
              <CardContent
                className="py-8 text-center text-sm text-muted-foreground"
                data-ocid="profile.documents_empty_state"
              >
                No documents submitted yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {docs.map((doc, idx) => (
                <div
                  key={`${doc.docType}-${idx}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                  data-ocid={`profile.document.item.${idx + 1}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">
                        {doc.docType.replace(/([A-Z])/g, " $1").trim()}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {doc.uploadStatus}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      doc.uploadStatus === UploadStatus.uploaded
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700"
                        : ""
                    }
                  >
                    {doc.uploadStatus === UploadStatus.uploaded
                      ? "Uploaded"
                      : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
        {/* Account Closure */}
        {!closureRequested && (
          <section
            className="mt-10 border-t border-border pt-8"
            data-ocid="profile.closure_section"
          >
            <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
              Danger Zone
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Request account closure and permanent deletion of your data after
              a 14-day audit retention period.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowClosureDialog(true)}
              data-ocid="profile.request_closure_button"
            >
              Request Account Closure
            </Button>
          </section>
        )}

        {/* Closure Confirmation Dialog */}
        <AlertDialog
          open={showClosureDialog}
          onOpenChange={setShowClosureDialog}
        >
          <AlertDialogContent data-ocid="profile.closure_dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Request Account Closure?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to request account closure? Your data will
                be retained for <strong>14 days</strong> for audit purposes
                before permanent deletion. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-ocid="profile.closure_cancel_button">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  try {
                    if (actor) await actor.requestAccountClosure();
                    setClosureRequested(true);
                    setShowClosureDialog(false);
                    toast.success("Account closure request submitted.");
                  } catch {
                    toast.error(
                      "Failed to submit closure request. Please try again.",
                    );
                  }
                }}
                data-ocid="profile.closure_confirm_button"
              >
                Yes, Request Closure
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
