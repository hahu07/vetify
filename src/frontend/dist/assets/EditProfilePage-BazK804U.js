import { g as useBackend, D as useQueryClient, a as useRouter, n as useQuery, r as reactExports, E as useMutation, j as jsxRuntimeExports, F as FullPageLoader, P as PageHeader, V as RegistrationStatus, C as Card, c as CardHeader, d as CardTitle, e as CardContent, h as Label, I as Input, L as Lock, b as Button, W as Save, l as ue } from "./index-DiwSGmNR.js";
import { B as BusinessLayout } from "./BusinessLayout-Dc018t5Q.js";
import { v as validatePhone, a as validateEmail } from "./validation-JH4EM2gO.js";
import { B as Building2 } from "./building-2-CCds38tC.js";
import "./use-user-role-DlEe0uPV.js";
import "./credit-card-CXB9DyZH.js";
import "./user-BQRpN4aJ.js";
import "./message-circle-C1jDekiM.js";
function EditProfilePage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const router = useRouter();
  const profileQuery = useQuery({
    queryKey: ["applicant_profile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMyBusinessProfile();
    },
    enabled: !!actor
  });
  const profile = profileQuery.data;
  const [form, setForm] = reactExports.useState(null);
  const [errors, setErrors] = reactExports.useState({});
  if (profile && !form) {
    setForm({
      businessName: profile.businessName,
      phoneNumber: profile.phoneNumber,
      email: profile.email ?? "",
      address: profile.address,
      contactPerson: profile.contactPerson
    });
  }
  const saveMutation = useMutation({
    mutationFn: async (updates) => {
      if (!actor) throw new Error("Not connected");
      const actorAny = actor;
      if (typeof actorAny.updateMyProfile === "function") {
        return actorAny.updateMyProfile(updates);
      }
      throw new Error("Profile update not yet available on this deployment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant_profile"] });
      ue.success("Profile updated successfully");
      router.navigate({ to: "/business/dashboard" });
    },
    onError: (err) => ue.error(
      err instanceof Error ? err.message : "Failed to save profile"
    )
  });
  if (profileQuery.isLoading || !form) return /* @__PURE__ */ jsxRuntimeExports.jsx(FullPageLoader, {});
  if (!profile) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(BusinessLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-2xl px-4 py-10", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(PageHeader, { title: "Edit Profile" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-muted-foreground", children: "No profile found." })
    ] }) });
  }
  const isFinancingReady = profile.registrationStatus === RegistrationStatus.financingReady || profile.registrationStatus === RegistrationStatus.approved;
  function validate() {
    const errs = {};
    const phoneErr = validatePhone(form.phoneNumber);
    if (phoneErr) errs.phoneNumber = phoneErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) errs.email = emailErr;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => prev ? { ...prev, [name]: value } : prev);
    setErrors((prev) => ({ ...prev, [name]: void 0 }));
  }
  function handleSubmit(e) {
    e.preventDefault();
    if (!form || !validate()) return;
    saveMutation.mutate(form);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(BusinessLayout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-2xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Edit Profile",
        subtitle: "Update your business contact details.",
        breadcrumbs: [
          { label: "Dashboard", href: "/business/dashboard" },
          { label: "Edit Profile" }
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleSubmit, noValidate: true, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Card,
        {
          className: "mb-6 dark:bg-card",
          "data-ocid": "edit_profile.editable_card",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "h-4 w-4 text-primary" }),
              "Contact & Location"
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "grid gap-5 sm:grid-cols-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "businessName", children: "Business Name" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Input,
                  {
                    id: "businessName",
                    name: "businessName",
                    value: form.businessName,
                    onChange: handleChange,
                    required: true,
                    "data-ocid": "edit_profile.business_name_input"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "contactPerson", children: "Contact Person" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Input,
                  {
                    id: "contactPerson",
                    name: "contactPerson",
                    value: form.contactPerson,
                    onChange: handleChange,
                    required: true,
                    "data-ocid": "edit_profile.contact_person_input"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "phoneNumber", children: "Phone Number" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Input,
                  {
                    id: "phoneNumber",
                    name: "phoneNumber",
                    type: "tel",
                    value: form.phoneNumber,
                    onChange: handleChange,
                    "aria-invalid": !!errors.phoneNumber,
                    "data-ocid": "edit_profile.phone_input"
                  }
                ),
                errors.phoneNumber && /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "p",
                  {
                    className: "text-xs text-destructive",
                    "data-ocid": "edit_profile.phone_field_error",
                    children: errors.phoneNumber
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "email", children: "Email Address" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Input,
                  {
                    id: "email",
                    name: "email",
                    type: "email",
                    value: form.email,
                    onChange: handleChange,
                    "aria-invalid": !!errors.email,
                    "data-ocid": "edit_profile.email_input"
                  }
                ),
                errors.email && /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "p",
                  {
                    className: "text-xs text-destructive",
                    "data-ocid": "edit_profile.email_field_error",
                    children: errors.email
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "address", children: "Address" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Input,
                  {
                    id: "address",
                    name: "address",
                    value: form.address,
                    onChange: handleChange,
                    "data-ocid": "edit_profile.address_input"
                  }
                )
              ] })
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Card,
        {
          className: "mb-8 border-dashed border-muted-foreground/30 dark:bg-card/60",
          "data-ocid": "edit_profile.readonly_card",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(CardHeader, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 font-display text-base text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "h-4 w-4" }),
                "Identity & Registration (Read-only)"
              ] }),
              isFinancingReady && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "These fields are locked because your profile is financing-ready." })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "grid gap-4 sm:grid-cols-2", children: [
              ["CAC Number", profile.cacNumber],
              [
                "Annual Revenue",
                `₦${Number(profile.annualRevenue).toLocaleString()}`
              ],
              ["Business Type", profile.businessType]
            ].map(([label, val]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: label }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-sm font-medium text-foreground", children: val })
            ] }, label)) })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-end gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            type: "button",
            variant: "outline",
            onClick: () => router.navigate({ to: "/business/dashboard" }),
            "data-ocid": "edit_profile.cancel_button",
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            type: "submit",
            disabled: saveMutation.isPending,
            className: "gap-2",
            "data-ocid": "edit_profile.save_button",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Save, { className: "h-4 w-4" }),
              saveMutation.isPending ? "Saving…" : "Save Changes"
            ]
          }
        )
      ] })
    ] })
  ] }) });
}
export {
  EditProfilePage as default
};
