import { type BusinessProfile, RegistrationStatus } from "@/backend";
import { BusinessLayout } from "@/components/BusinessLayout";
import { FullPageLoader } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackend } from "@/hooks/use-backend";
import { validateEmail, validatePhone } from "@/utils/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Building2, Lock, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProfileFormState {
  businessName: string;
  phoneNumber: string;
  email: string;
  address: string;
  contactPerson: string;
}

interface FieldErrors {
  phoneNumber?: string;
  email?: string;
}

export default function EditProfilePage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ["applicant_profile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMyBusinessProfile();
    },
    enabled: !!actor,
  });

  const profile = profileQuery.data as BusinessProfile | null | undefined;

  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Initialise form once profile loads
  if (profile && !form) {
    setForm({
      businessName: profile.businessName,
      phoneNumber: profile.phoneNumber,
      email: (profile as BusinessProfile & { email?: string }).email ?? "",
      address: profile.address,
      contactPerson: profile.contactPerson,
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (updates: ProfileFormState) => {
      if (!actor) throw new Error("Not connected");
      // updateMyProfile is a new backend endpoint — call it if available
      const actorAny = actor as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof actorAny.updateMyProfile === "function") {
        return actorAny.updateMyProfile(updates);
      }
      throw new Error("Profile update not yet available on this deployment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant_profile"] });
      toast.success("Profile updated successfully");
      router.navigate({ to: "/business/dashboard" });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to save profile",
      ),
  });

  if (profileQuery.isLoading || !form) return <FullPageLoader />;

  if (!profile) {
    return (
      <BusinessLayout>
        <div className="container mx-auto max-w-2xl px-4 py-10">
          <PageHeader title="Edit Profile" />
          <p className="text-muted-foreground">No profile found.</p>
        </div>
      </BusinessLayout>
    );
  }

  const isFinancingReady =
    profile.registrationStatus === RegistrationStatus.financingReady ||
    profile.registrationStatus === RegistrationStatus.approved;

  function validate(): boolean {
    const errs: FieldErrors = {};
    const phoneErr = validatePhone(form!.phoneNumber);
    if (phoneErr) errs.phoneNumber = phoneErr;
    const emailErr = validateEmail(form!.email);
    if (emailErr) errs.email = emailErr;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
    // Clear error on change
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !validate()) return;
    saveMutation.mutate(form);
  }

  return (
    <BusinessLayout>
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <PageHeader
          title="Edit Profile"
          subtitle="Update your business contact details."
          breadcrumbs={[
            { label: "Dashboard", href: "/business/dashboard" },
            { label: "Edit Profile" },
          ]}
        />

        <form onSubmit={handleSubmit} noValidate>
          {/* Editable fields */}
          <Card
            className="mb-6 dark:bg-card"
            data-ocid="edit_profile.editable_card"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Building2 className="h-4 w-4 text-primary" />
                Contact & Location
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  required
                  data-ocid="edit_profile.business_name_input"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  name="contactPerson"
                  value={form.contactPerson}
                  onChange={handleChange}
                  required
                  data-ocid="edit_profile.contact_person_input"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={handleChange}
                  aria-invalid={!!errors.phoneNumber}
                  data-ocid="edit_profile.phone_input"
                />
                {errors.phoneNumber && (
                  <p
                    className="text-xs text-destructive"
                    data-ocid="edit_profile.phone_field_error"
                  >
                    {errors.phoneNumber}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  aria-invalid={!!errors.email}
                  data-ocid="edit_profile.email_input"
                />
                {errors.email && (
                  <p
                    className="text-xs text-destructive"
                    data-ocid="edit_profile.email_field_error"
                  >
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  data-ocid="edit_profile.address_input"
                />
              </div>
            </CardContent>
          </Card>

          {/* Read-only identity fields */}
          <Card
            className="mb-8 border-dashed border-muted-foreground/30 dark:bg-card/60"
            data-ocid="edit_profile.readonly_card"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base text-muted-foreground">
                <Lock className="h-4 w-4" />
                Identity & Registration (Read-only)
              </CardTitle>
              {isFinancingReady && (
                <p className="text-xs text-muted-foreground">
                  These fields are locked because your profile is
                  financing-ready.
                </p>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["CAC Number", profile.cacNumber],
                  [
                    "Annual Revenue",
                    `₦${Number(profile.annualRevenue).toLocaleString()}`,
                  ],
                  ["Business Type", profile.businessType],
                ] as [string, string][]
              ).map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {val}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.navigate({ to: "/business/dashboard" })}
              data-ocid="edit_profile.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="gap-2"
              data-ocid="edit_profile.save_button"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </BusinessLayout>
  );
}
