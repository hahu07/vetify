import { g as useBackend, A as useQueryClient, r as reactExports, n as useQuery, D as useMutation, j as jsxRuntimeExports, P as PageHeader, b as Button, aa as TriangleAlert, C as Card, c as CardHeader, d as CardTitle, e as CardContent, v as Skeleton, B as Badge, O as RegistrationStatus, G as Dialog, as as DialogTrigger, T as Trash2, J as DialogContent, K as DialogHeader, M as DialogTitle, at as DialogDescription, N as DialogFooter, h as Label, I as Input, ap as IncomeSource, l as ue, an as EmploymentStatus, ao as FinancingPurpose } from "./index-CPnZ4-ee.js";
import { I as IndividualLayout } from "./IndividualLayout-8MgciXM0.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-C-qTt0dW.js";
import { P as Pencil } from "./pencil-ClwGYYG1.js";
import { R as RefreshCw } from "./refresh-cw-LvkTVX9-.js";
import { U as User } from "./user--fZ_EEDP.js";
import "./use-user-role-gvzFlaTO.js";
import "./credit-card-DL9b9S-9.js";
import "./index-C6Eg3qxK.js";
import "./chevron-up-C9u-2erU.js";
function formatEmploymentStatus(s) {
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
function formatIncomeSource(s) {
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
function formatFinancingPurpose(p) {
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
function formatInstrument(i) {
  const map = {
    murabaha: "Murabaha",
    musharakah: "Musharakah",
    mudarabah: "Mudarabah",
    ijarah: "Ijarah",
    istisna: "Istisna",
    salam: "Salam",
    other: "Other"
  };
  const key = typeof i === "string" ? i.toLowerCase() : Object.keys(i)[0] ?? "other";
  return map[key] ?? key;
}
function ProfileField({
  label,
  value
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-2 py-2 border-b border-border last:border-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-muted-foreground", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-medium text-foreground text-right", children: value })
  ] });
}
function IndividualProfilePage() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = reactExports.useState(false);
  const [closureOpen, setClosureOpen] = reactExports.useState(false);
  const [editData, setEditData] = reactExports.useState(null);
  const profileQuery = useQuery({
    queryKey: ["individual_profile"],
    queryFn: async () => {
      if (!actor) return null;
      const result = await actor.getMyIndividualProfile();
      if (result.__kind__ === "err") return null;
      return result.ok;
    },
    enabled: !!actor
  });
  const profile = profileQuery.data ?? null;
  const isLoading = profileQuery.isLoading;
  const editMutation = useMutation({
    mutationFn: async (data) => {
      if (!actor) throw new Error("Not connected");
      const income = data.monthlyIncome ? BigInt(data.monthlyIncome) : null;
      const result = await actor.updateIndividualProfile(
        data.address || null,
        data.occupation || null,
        data.employerName || null,
        income,
        data.incomeSource || null
      );
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["individual_profile"] });
      setEditOpen(false);
      ue.success("Profile updated successfully.");
    },
    onError: (err) => ue.error(err instanceof Error ? err.message : "Update failed.")
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
      ue.success("Account closure request submitted.");
    },
    onError: (err) => ue.error(err instanceof Error ? err.message : "Request failed.")
  });
  function openEdit() {
    if (!profile) return;
    setEditData({
      address: profile.address,
      occupation: profile.occupation,
      employerName: profile.employerName ?? "",
      monthlyIncome: String(Number(profile.monthlyIncome)),
      incomeSource: profile.incomeSource
    });
    setEditOpen(true);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(IndividualLayout, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "p-6 space-y-6 max-w-2xl",
        "data-ocid": "individual_profile.page",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            PageHeader,
            {
              title: "My Profile",
              subtitle: "Your registered details on Vetify.",
              breadcrumbs: [{ label: "My Profile" }],
              actions: !(profile == null ? void 0 : profile.accountClosureRequested) ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Button,
                {
                  type: "button",
                  variant: "outline",
                  size: "sm",
                  className: "gap-1.5",
                  onClick: openEdit,
                  disabled: isLoading,
                  "data-ocid": "individual_profile.edit_button",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Pencil, { className: "h-3.5 w-3.5" }),
                    "Edit Profile"
                  ]
                }
              ) : void 0
            }
          ),
          profileQuery.isError && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3",
              "data-ocid": "individual_profile.error_state",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 shrink-0 text-destructive" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: "Failed to load profile." }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Button,
                  {
                    type: "button",
                    variant: "outline",
                    size: "sm",
                    className: "ml-auto gap-1.5 text-destructive border-destructive/40",
                    onClick: () => queryClient.invalidateQueries({
                      queryKey: ["individual_profile"]
                    }),
                    "data-ocid": "individual_profile.retry_button",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
                      "Retry"
                    ]
                  }
                )
              ]
            }
          ),
          (profile == null ? void 0 : profile.accountClosureRequested) && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3",
              "data-ocid": "individual_profile.closure_requested_banner",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-amber-800 dark:text-amber-300", children: "Your account closure request has been submitted and is pending admin review." })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_profile.personal_card", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "flex items-center gap-2 text-base", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "h-4 w-4 text-primary" }),
              "Personal Information"
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2", children: [1, 2, 3, 4].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-8 w-full" }, i)) }) : profile ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(ProfileField, { label: "Full Name", value: profile.fullName }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "Date of Birth",
                  value: profile.dateOfBirth
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(ProfileField, { label: "Address", value: profile.address }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "Employment Status",
                  value: formatEmploymentStatus(profile.employmentStatus)
                }
              ),
              profile.employerName && /* @__PURE__ */ jsxRuntimeExports.jsx(ProfileField, { label: "Employer", value: profile.employerName }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(ProfileField, { label: "Occupation", value: profile.occupation }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "Monthly Income",
                  value: `₦${Number(profile.monthlyIncome).toLocaleString()}`
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "Income Source",
                  value: formatIncomeSource(profile.incomeSource)
                }
              )
            ] }) : null })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_profile.identity_card", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardTitle, { className: "text-base", children: "Identity" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-8 w-full" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-8 w-full" })
            ] }) : profile ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "BVN",
                  value: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-xs", children: profile.bvn.replace(
                    /./g,
                    (c, i) => i < 4 || i >= profile.bvn.length - 2 ? c : "•"
                  ) })
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "NIN",
                  value: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-xs", children: profile.nin.replace(
                    /./g,
                    (c, i) => i < 4 || i >= profile.nin.length - 2 ? c : "•"
                  ) })
                }
              )
            ] }) : null })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "individual_profile.financing_card", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CardTitle, { className: "text-base", children: "Financing Request" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { children: isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2", children: [1, 2, 3].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-8 w-full" }, i)) }) : profile ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "Purpose",
                  value: formatFinancingPurpose(profile.financingPurpose)
                }
              ),
              profile.financingPurposeOther && /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "Purpose Detail",
                  value: profile.financingPurposeOther
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "Amount Sought",
                  value: `₦${Number(profile.amountSought).toLocaleString()}`
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "Preferred Instrument",
                  value: formatInstrument(
                    typeof profile.preferredInstrument === "string" ? profile.preferredInstrument : Object.keys(
                      profile.preferredInstrument
                    )[0] ?? "other"
                  )
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ProfileField,
                {
                  label: "Status",
                  value: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Badge,
                    {
                      className: profile.registrationStatus === RegistrationStatus.financingReady || profile.registrationStatus === RegistrationStatus.approved ? "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30" : "",
                      children: profile.registrationStatus
                    }
                  )
                }
              )
            ] }) : null })
          ] }),
          profile && !profile.accountClosureRequested && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pt-4 border-t border-border", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Dialog, { open: closureOpen, onOpenChange: setClosureOpen, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                type: "button",
                variant: "outline",
                size: "sm",
                className: "gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10",
                "data-ocid": "individual_profile.request_closure_button",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "h-3.5 w-3.5" }),
                  "Request Account Closure"
                ]
              }
            ) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { "data-ocid": "individual_profile.closure_dialog", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: "Request Account Closure" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { children: "Are you sure you want to request account closure? Our team will process your request and notify you via WhatsApp." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogFooter, { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Button,
                  {
                    type: "button",
                    variant: "outline",
                    onClick: () => setClosureOpen(false),
                    "data-ocid": "individual_profile.closure_cancel_button",
                    children: "Cancel"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Button,
                  {
                    type: "button",
                    variant: "destructive",
                    onClick: () => closureMutation.mutate(),
                    disabled: closureMutation.isPending,
                    "data-ocid": "individual_profile.closure_confirm_button",
                    children: closureMutation.isPending ? "Submitting…" : "Yes, Request Closure"
                  }
                )
              ] })
            ] })
          ] }) })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open: editOpen, onOpenChange: setEditOpen, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      DialogContent,
      {
        className: "max-w-md",
        "data-ocid": "individual_profile.edit_dialog",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: "Edit Profile" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { children: "Update your personal and financial details." })
          ] }),
          editData && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "form",
            {
              onSubmit: (e) => {
                e.preventDefault();
                editMutation.mutate(editData);
              },
              className: "space-y-4",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "edit-address", children: "Address" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "edit-address",
                      value: editData.address,
                      onChange: (e) => setEditData(
                        (d) => d ? { ...d, address: e.target.value } : d
                      ),
                      "data-ocid": "individual_profile.edit_address_input"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "edit-occupation", children: "Occupation" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "edit-occupation",
                      value: editData.occupation,
                      onChange: (e) => setEditData(
                        (d) => d ? { ...d, occupation: e.target.value } : d
                      ),
                      "data-ocid": "individual_profile.edit_occupation_input"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "edit-employer", children: "Employer Name" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "edit-employer",
                      value: editData.employerName,
                      onChange: (e) => setEditData(
                        (d) => d ? { ...d, employerName: e.target.value } : d
                      ),
                      "data-ocid": "individual_profile.edit_employer_input"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "edit-income", children: "Monthly Income (₦)" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "edit-income",
                      type: "number",
                      min: "0",
                      value: editData.monthlyIncome,
                      onChange: (e) => setEditData(
                        (d) => d ? { ...d, monthlyIncome: e.target.value } : d
                      ),
                      "data-ocid": "individual_profile.edit_income_input"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "edit-income-source", children: "Income Source" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    Select,
                    {
                      value: editData.incomeSource,
                      onValueChange: (v) => setEditData(
                        (d) => d ? { ...d, incomeSource: v } : d
                      ),
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SelectTrigger,
                          {
                            id: "edit-income-source",
                            "data-ocid": "individual_profile.edit_income_source_select",
                            children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {})
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: IncomeSource.employment, children: "Employment" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: IncomeSource.selfEmployment, children: "Self-Employment" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: IncomeSource.business, children: "Business" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: IncomeSource.other, children: "Other" })
                        ] })
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogFooter, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Button,
                    {
                      type: "button",
                      variant: "outline",
                      onClick: () => setEditOpen(false),
                      "data-ocid": "individual_profile.edit_cancel_button",
                      children: "Cancel"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Button,
                    {
                      type: "submit",
                      disabled: editMutation.isPending,
                      className: "bg-[var(--individual-accent,oklch(0.65_0.18_60))] text-white hover:opacity-90",
                      "data-ocid": "individual_profile.edit_save_button",
                      children: editMutation.isPending ? "Saving…" : "Save Changes"
                    }
                  )
                ] })
              ]
            }
          )
        ]
      }
    ) })
  ] });
}
export {
  IndividualProfilePage as default
};
