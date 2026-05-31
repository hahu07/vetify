import {
  EmploymentStatus,
  FinancingPurpose,
  IncomeSource,
  RegistrationStatus,
} from "@/backend";
import { IndividualLayout } from "@/components/IndividualLayout";
import { PageHeader } from "@/components/PageHeader";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/use-backend";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, RefreshCw, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatEmploymentStatus(s: EmploymentStatus): string {
  switch (s) {
    case EmploymentStatus.employed:
      return "Employed";
    case EmploymentStatus.selfEmployed:
      return "Self-Employed";
    case EmploymentStatus.unemployed:
      return "Unemployed";
    case EmploymentStatus.student:
      return "Student";
    default:
      return String(s);
  }
}

function formatIncomeSource(s: IncomeSource): string {
  switch (s) {
    case IncomeSource.employment:
      return "Employment";
    case IncomeSource.selfEmployment:
      return "Self-Employment";
    case IncomeSource.business:
      return "Business";
    case IncomeSource.other:
      return "Other";
    default:
      return String(s);
  }
}

function formatFinancingPurpose(p: FinancingPurpose): string {
  switch (p) {
    case FinancingPurpose.homePurchase:
      return "Home Purchase";
    case FinancingPurpose.vehicle:
      return "Vehicle";
    case FinancingPurpose.education:
      return "Education";
    case FinancingPurpose.medical:
      return "Medical";
    case FinancingPurpose.startupCapital:
      return "Startup Capital";
    case FinancingPurpose.other:
      return "Other";
    default:
      return String(p);
  }
}

function formatInstrument(i: string): string {
  const map: Record<string, string> = {
    murabaha: "Murabaha",
    musharakah: "Musharakah",
    mudarabah: "Mudarabah",
    ijarah: "Ijarah",
    istisna: "Istisna",
    salam: "Salam",
    other: "Other",
  };
  const key =
    typeof i === "string"
      ? i.toLowerCase()
      : (Object.keys(i as Record<string, null>)[0] ?? "other");
  return map[key] ?? key;
}

function ProfileField({
  label,
  value,
}: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">
        {value}
      </span>
    </div>
  );
}

interface EditFormData {
  address: string;
  occupation: string;
  employerName: string;
  monthlyIncome: string;
  incomeSource: IncomeSource;
}

export default function IndividualProfilePage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [editData, setEditData] = useState<EditFormData | null>(null);

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

  const editMutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      if (!actor) throw new Error("Not connected");
      const income = data.monthlyIncome ? BigInt(data.monthlyIncome) : null;
      const result = await actor.updateIndividualProfile(
        data.address || null,
        data.occupation || null,
        data.employerName || null,
        income,
        data.incomeSource || null,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["individual_profile"] });
      setEditOpen(false);
      toast.success("Profile updated successfully.");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Update failed."),
  });

  const closureMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const result = await actor.requestAccountClosure();
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["individual_profile"] });
      setClosureOpen(false);
      toast.success("Account closure request submitted.");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Request failed."),
  });

  function openEdit() {
    if (!profile) return;
    setEditData({
      address: profile.address,
      occupation: profile.occupation,
      employerName: profile.employerName ?? "",
      monthlyIncome: String(Number(profile.monthlyIncome)),
      incomeSource: profile.incomeSource,
    });
    setEditOpen(true);
  }

  return (
    <IndividualLayout>
      <div
        className="p-6 space-y-6 max-w-2xl"
        data-ocid="individual_profile.page"
      >
        <PageHeader
          title="My Profile"
          subtitle="Your registered details on Vetify."
          breadcrumbs={[{ label: "My Profile" }]}
          actions={
            !profile?.accountClosureRequested ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={openEdit}
                disabled={isLoading}
                data-ocid="individual_profile.edit_button"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
            ) : undefined
          }
        />

        {profileQuery.isError && (
          <div
            className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
            data-ocid="individual_profile.error_state"
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
              data-ocid="individual_profile.retry_button"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {profile?.accountClosureRequested && (
          <div
            className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3"
            data-ocid="individual_profile.closure_requested_banner"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Your account closure request has been submitted and is pending
              admin review.
            </p>
          </div>
        )}

        {/* Personal Information */}
        <Card data-ocid="individual_profile.personal_card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : profile ? (
              <div>
                <ProfileField label="Full Name" value={profile.fullName} />
                <ProfileField
                  label="Date of Birth"
                  value={profile.dateOfBirth}
                />
                <ProfileField label="Address" value={profile.address} />
                <ProfileField
                  label="Employment Status"
                  value={formatEmploymentStatus(profile.employmentStatus)}
                />
                {profile.employerName && (
                  <ProfileField label="Employer" value={profile.employerName} />
                )}
                <ProfileField label="Occupation" value={profile.occupation} />
                <ProfileField
                  label="Monthly Income"
                  value={`₦${Number(profile.monthlyIncome).toLocaleString()}`}
                />
                <ProfileField
                  label="Income Source"
                  value={formatIncomeSource(profile.incomeSource)}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Identity */}
        <Card data-ocid="individual_profile.identity_card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : profile ? (
              <div>
                <ProfileField
                  label="BVN"
                  value={
                    <span className="font-mono text-xs">
                      {profile.bvn.replace(/./g, (c, i) =>
                        i < 4 || i >= profile.bvn.length - 2 ? c : "•",
                      )}
                    </span>
                  }
                />
                <ProfileField
                  label="NIN"
                  value={
                    <span className="font-mono text-xs">
                      {profile.nin.replace(/./g, (c, i) =>
                        i < 4 || i >= profile.nin.length - 2 ? c : "•",
                      )}
                    </span>
                  }
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Financing Request */}
        <Card data-ocid="individual_profile.financing_card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Financing Request</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : profile ? (
              <div>
                <ProfileField
                  label="Purpose"
                  value={formatFinancingPurpose(profile.financingPurpose)}
                />
                {profile.financingPurposeOther && (
                  <ProfileField
                    label="Purpose Detail"
                    value={profile.financingPurposeOther}
                  />
                )}
                <ProfileField
                  label="Amount Sought"
                  value={`₦${Number(profile.amountSought).toLocaleString()}`}
                />
                <ProfileField
                  label="Preferred Instrument"
                  value={formatInstrument(
                    typeof profile.preferredInstrument === "string"
                      ? profile.preferredInstrument
                      : (Object.keys(
                          profile.preferredInstrument as Record<string, null>,
                        )[0] ?? "other"),
                  )}
                />
                <ProfileField
                  label="Status"
                  value={
                    <Badge
                      className={
                        profile.registrationStatus ===
                          RegistrationStatus.financingReady ||
                        profile.registrationStatus ===
                          RegistrationStatus.approved
                          ? "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                          : ""
                      }
                    >
                      {profile.registrationStatus}
                    </Badge>
                  }
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Account Closure */}
        {profile && !profile.accountClosureRequested && (
          <div className="pt-4 border-t border-border">
            <Dialog open={closureOpen} onOpenChange={setClosureOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                  data-ocid="individual_profile.request_closure_button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Request Account Closure
                </Button>
              </DialogTrigger>
              <DialogContent data-ocid="individual_profile.closure_dialog">
                <DialogHeader>
                  <DialogTitle>Request Account Closure</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to request account closure? Our team
                    will process your request and notify you via WhatsApp.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setClosureOpen(false)}
                    data-ocid="individual_profile.closure_cancel_button"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => closureMutation.mutate()}
                    disabled={closureMutation.isPending}
                    data-ocid="individual_profile.closure_confirm_button"
                  >
                    {closureMutation.isPending
                      ? "Submitting…"
                      : "Yes, Request Closure"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="max-w-md"
          data-ocid="individual_profile.edit_dialog"
        >
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your personal and financial details.
            </DialogDescription>
          </DialogHeader>
          {editData && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                editMutation.mutate(editData);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={editData.address}
                  onChange={(e) =>
                    setEditData((d) =>
                      d ? { ...d, address: e.target.value } : d,
                    )
                  }
                  data-ocid="individual_profile.edit_address_input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-occupation">Occupation</Label>
                <Input
                  id="edit-occupation"
                  value={editData.occupation}
                  onChange={(e) =>
                    setEditData((d) =>
                      d ? { ...d, occupation: e.target.value } : d,
                    )
                  }
                  data-ocid="individual_profile.edit_occupation_input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-employer">Employer Name</Label>
                <Input
                  id="edit-employer"
                  value={editData.employerName}
                  onChange={(e) =>
                    setEditData((d) =>
                      d ? { ...d, employerName: e.target.value } : d,
                    )
                  }
                  data-ocid="individual_profile.edit_employer_input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-income">Monthly Income (₦)</Label>
                <Input
                  id="edit-income"
                  type="number"
                  min="0"
                  value={editData.monthlyIncome}
                  onChange={(e) =>
                    setEditData((d) =>
                      d ? { ...d, monthlyIncome: e.target.value } : d,
                    )
                  }
                  data-ocid="individual_profile.edit_income_input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-income-source">Income Source</Label>
                <Select
                  value={editData.incomeSource}
                  onValueChange={(v) =>
                    setEditData((d) =>
                      d ? { ...d, incomeSource: v as IncomeSource } : d,
                    )
                  }
                >
                  <SelectTrigger
                    id="edit-income-source"
                    data-ocid="individual_profile.edit_income_source_select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={IncomeSource.employment}>
                      Employment
                    </SelectItem>
                    <SelectItem value={IncomeSource.selfEmployment}>
                      Self-Employment
                    </SelectItem>
                    <SelectItem value={IncomeSource.business}>
                      Business
                    </SelectItem>
                    <SelectItem value={IncomeSource.other}>Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  data-ocid="individual_profile.edit_cancel_button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="bg-[var(--individual-accent,oklch(0.65_0.18_60))] text-white hover:opacity-90"
                  data-ocid="individual_profile.edit_save_button"
                >
                  {editMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </IndividualLayout>
  );
}
