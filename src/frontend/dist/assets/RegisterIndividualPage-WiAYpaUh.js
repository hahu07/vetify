import { g as useBackend, a as useRouter, r as reactExports, ap as PreferredInstrument, aq as EmploymentStatus, ar as FinancingPurpose, as as IncomeSource, j as jsxRuntimeExports, f as CircleCheck, b as Button, P as PageHeader, C as Card, e as CardContent, h as Label, I as Input, q as Shield, k as LoadingSpinner, l as ue } from "./index-DiwSGmNR.js";
import { L as Layout } from "./Layout-BNWWW4Ou.js";
import { C as Checkbox } from "./checkbox-Bc_5PGPA.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-0Pi_1wo9.js";
import { T as Textarea } from "./textarea-F9_yR95u.js";
import { u as useUserRole } from "./use-user-role-DlEe0uPV.js";
import { b as validateBvn, c as validateNin } from "./validation-JH4EM2gO.js";
import { A as AnimatePresence, T as TermsModal } from "./TermsModal-e4SeJQ8q.js";
import { m as motion } from "./proxy-Bis1-hmp.js";
import { I as Info } from "./info-xit6tx8b.js";
import { C as CircleAlert } from "./circle-alert-Dpw3PZDg.js";
import { U as User } from "./user-BQRpN4aJ.js";
import "./index-Hp8SMVjr.js";
import "./check-COltzNMb.js";
import "./index-IXOTxK3N.js";
import "./chevron-up-CzmXa_4A.js";
import "./scroll-area-Ddb7X2Or.js";
const DRAFT_KEY = "vetify_individual_draft";
const STEPS = [
  { label: "Applicant Type" },
  { label: "Personal Identity" },
  { label: "Identity Verification" },
  { label: "Financing Purpose" },
  { label: "Financial Profile" },
  { label: "Shariah & Terms" },
  { label: "Review & Submit" }
];
const INSTRUMENTS = [
  {
    value: PreferredInstrument.murabaha,
    nameEn: "Murabaha",
    nameAr: "المرابحة",
    description: "The financier buys an asset for you and sells it at an agreed marked-up price, paid in instalments — you know the profit margin upfront.",
    example: "You need a ₦5M family car. The financier buys it and sells it to you for ₦5.8M payable over 24 months."
  },
  {
    value: PreferredInstrument.musharakah,
    nameEn: "Musharakah",
    nameAr: "المشاركة",
    description: "A joint partnership where both you and the financier contribute capital. Profits are shared by an agreed ratio; losses are borne proportionally.",
    example: "You and a financier each contribute ₦5M to purchase a property together. Rental income and eventual sale proceeds are split 60/40."
  },
  {
    value: PreferredInstrument.mudarabah,
    nameEn: "Mudarabah",
    nameAr: "المضاربة",
    description: "The financier provides all the capital while you provide expertise and management. Profits are shared; the financier bears capital loss if you manage honestly.",
    example: "A tailor receives ₦3M from a financier to start a fashion business. The tailor manages operations; profits split 70/30."
  },
  {
    value: PreferredInstrument.ijarah,
    nameEn: "Ijarah",
    nameAr: "الإجارة",
    description: "The financier buys an asset and leases it to you at a fixed monthly rental. Ownership stays with the financier for the lease duration.",
    example: "You need office equipment worth ₦2M. The financier buys it and leases it to you at ₦60K/month for 3 years."
  },
  {
    value: PreferredInstrument.istisna,
    nameEn: "Istisna’",
    nameAr: "الاستصناع",
    description: "Financing for construction or manufacturing — the financier funds the production of something to your specification, delivered later.",
    example: "A developer contracts to build a 3-bedroom house for you. The financier pays in stages as construction progresses."
  },
  {
    value: PreferredInstrument.salam,
    nameEn: "Salam",
    nameAr: "السلم",
    description: "Full advance payment for goods to be delivered at a future date — commonly used in agriculture and commodities.",
    example: "A rice farmer receives full ₦1.5M payment now for 10 tonnes of rice to be delivered at harvest in 4 months."
  }
];
const EMPLOYMENT_OPTIONS = [
  { value: EmploymentStatus.employed, label: "Employed" },
  { value: EmploymentStatus.selfEmployed, label: "Self-Employed" },
  { value: EmploymentStatus.unemployed, label: "Unemployed" },
  { value: EmploymentStatus.student, label: "Student" }
];
const INCOME_SOURCE_OPTIONS = [
  { value: IncomeSource.employment, label: "Employment" },
  { value: IncomeSource.selfEmployment, label: "Self-Employment" },
  { value: IncomeSource.business, label: "Business" },
  { value: IncomeSource.other, label: "Other" }
];
const FINANCING_PURPOSE_OPTIONS = [
  { value: FinancingPurpose.homePurchase, label: "Home Purchase" },
  { value: FinancingPurpose.vehicle, label: "Vehicle" },
  { value: FinancingPurpose.education, label: "Education" },
  { value: FinancingPurpose.medical, label: "Medical" },
  { value: FinancingPurpose.startupCapital, label: "Startup Capital" },
  { value: FinancingPurpose.other, label: "Other" }
];
const EMPTY_DRAFT = {
  fullName: "",
  dateOfBirth: "",
  address: "",
  occupation: "",
  employmentStatus: "",
  employerName: "",
  bvn: "",
  nin: "",
  financingPurpose: "",
  otherPurpose: "",
  amountSought: "",
  monthlyIncome: "",
  incomeSource: "",
  preferredInstrument: "",
  termsAccepted: false,
  privacyAccepted: false,
  ndprAccepted: false
};
function StepProgress({
  current,
  total
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-8", "data-ocid": "register_individual.progress", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-0 mb-3", children: STEPS.map((step, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center flex-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: `w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold transition-all duration-300 ${i > current ? "bg-muted text-muted-foreground" : "text-white"}`,
          style: i <= current ? {
            background: "oklch(var(--individual-accent))",
            boxShadow: i === current ? "0 0 0 4px oklch(var(--individual-accent) / 0.2)" : "none"
          } : {},
          children: i < current ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            "svg",
            {
              role: "img",
              "aria-label": "Step completed",
              className: "w-4 h-4",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              strokeWidth: 2.5,
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                "path",
                {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  d: "M5 13l4 4L19 7"
                }
              )
            }
          ) : i + 1
        }
      ),
      i < total - 1 && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "flex-1 h-0.5 mx-1 transition-colors duration-300",
          style: i < current ? { background: "oklch(var(--individual-accent))" } : {}
        }
      )
    ] }, step.label)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-between mt-1", children: STEPS.map((step, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "span",
      {
        className: "text-xs font-medium transition-colors min-w-0 truncate",
        style: {
          width: `${100 / total}%`,
          textAlign: i === 0 ? "left" : i === total - 1 ? "right" : "center",
          color: i === current ? "oklch(var(--individual-accent))" : "oklch(var(--muted-foreground))"
        },
        children: step.label
      },
      step.label
    )) })
  ] });
}
function FieldError({ msg, ocid }) {
  if (!msg) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-destructive mt-1", "data-ocid": ocid, children: msg });
}
function InstrumentCard({
  inst,
  selected,
  onSelect,
  index
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "button",
    {
      type: "button",
      onClick: onSelect,
      "data-ocid": `register_individual.instrument_card.${index + 1}`,
      "aria-pressed": selected,
      className: "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2",
      style: {
        borderColor: selected ? "oklch(var(--individual-accent))" : "oklch(var(--border))",
        background: selected ? "oklch(var(--individual-accent) / 0.06)" : "oklch(var(--card))"
      },
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: "mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all",
            style: {
              borderColor: selected ? "oklch(var(--individual-accent))" : "oklch(var(--muted-foreground) / 0.4)"
            },
            children: selected && /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "w-2 h-2 rounded-full",
                style: { background: "oklch(var(--individual-accent))" }
              }
            )
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-baseline gap-2 flex-wrap", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold text-foreground font-display", children: inst.nameEn }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-muted-foreground", children: inst.nameAr })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-foreground/80 mt-1 leading-relaxed", children: inst.description }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex items-start gap-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5", children: "Example" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground italic leading-relaxed", children: inst.example })
          ] })
        ] })
      ] })
    }
  );
}
function SummarySection({
  title,
  onEdit,
  ocid,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "rounded-xl border border-border bg-muted/20 dark:bg-muted/10 overflow-hidden",
      "data-ocid": ocid,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between px-4 py-3 bg-muted/30 dark:bg-muted/20 border-b border-border", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-foreground", children: title }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: onEdit,
              className: "text-xs font-medium hover:underline",
              style: { color: "oklch(var(--individual-accent))" },
              "data-ocid": `${ocid}.edit_button`,
              children: "Edit"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-4 py-3 space-y-1.5", children })
      ]
    }
  );
}
function SummaryRow({ label, value }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground w-40 flex-shrink-0", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-foreground font-medium break-words min-w-0", children: value || "—" })
  ] });
}
function maskId(val) {
  if (!val || val.length <= 4) return val || "—";
  return `${".".repeat(val.length - 4)}${val.slice(-4)}`;
}
function RegisterIndividualPage() {
  var _a, _b, _c;
  const { actor } = useBackend();
  const { refetch } = useUserRole();
  const router = useRouter();
  const [step, setStep] = reactExports.useState(0);
  const [isSubmitting, setIsSubmitting] = reactExports.useState(false);
  const [submitError, setSubmitError] = reactExports.useState(null);
  const [submitSuccess, setSubmitSuccess] = reactExports.useState(false);
  const [returnToSummary, setReturnToSummary] = reactExports.useState(false);
  const [draft, setDraft] = reactExports.useState(EMPTY_DRAFT);
  const [errors, setErrors] = reactExports.useState({});
  const [displayAmountSought, setDisplayAmountSought] = reactExports.useState("");
  const [displayMonthlyIncome, setDisplayMonthlyIncome] = reactExports.useState("");
  const cardRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY) || localStorage.getItem("halalvet_individual_draft");
      if (saved) {
        const parsed = JSON.parse(saved);
        setDraft((prev) => ({ ...prev, ...parsed }));
        if (parsed.amountSought) {
          const num = Number(parsed.amountSought);
          if (!Number.isNaN(num))
            setDisplayAmountSought(num.toLocaleString("en-NG"));
        }
        if (parsed.monthlyIncome) {
          const num = Number(parsed.monthlyIncome);
          if (!Number.isNaN(num))
            setDisplayMonthlyIncome(num.toLocaleString("en-NG"));
        }
      }
    } catch {
    }
  }, []);
  reactExports.useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
    }
  }, [draft]);
  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setDraft(EMPTY_DRAFT);
    setDisplayAmountSought("");
    setDisplayMonthlyIncome("");
    setStep(0);
    setErrors({});
    setReturnToSummary(false);
    ue.info("Draft cleared.");
  }
  function set(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }
  reactExports.useEffect(() => {
    var _a2;
    (_a2 = cardRef.current) == null ? void 0 : _a2.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  function validateStep0() {
    const errs = {};
    if (!draft.fullName.trim()) errs.fullName = "Full name is required";
    if (!draft.dateOfBirth) errs.dateOfBirth = "Date of birth is required";
    if (!draft.address.trim()) errs.address = "Address is required";
    if (!draft.occupation.trim()) errs.occupation = "Occupation is required";
    if (!draft.employmentStatus)
      errs.employmentStatus = "Employment status is required";
    if (draft.employmentStatus === EmploymentStatus.employed && !draft.employerName.trim()) {
      errs.employerName = "Employer name is required when employed";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }
  function validateStep1() {
    const errs = {};
    const bvnErr = validateBvn(draft.bvn);
    if (bvnErr) errs.bvn = bvnErr;
    const ninErr = validateNin(draft.nin);
    if (ninErr) errs.nin = ninErr;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }
  function validateStep2() {
    const errs = {};
    if (!draft.financingPurpose)
      errs.financingPurpose = "Please select a financing purpose";
    if (draft.financingPurpose === FinancingPurpose.other && !draft.otherPurpose.trim()) {
      errs.otherPurpose = "Please describe your financing purpose";
    }
    const amt = Number(draft.amountSought);
    if (!draft.amountSought || Number.isNaN(amt) || amt < 1e4) {
      errs.amountSought = "Amount must be at least ₦10,000";
    }
    const inc = Number(draft.monthlyIncome);
    if (!draft.monthlyIncome || Number.isNaN(inc) || inc <= 0) {
      errs.monthlyIncome = "Monthly income is required and must be > 0";
    }
    if (!draft.incomeSource) errs.incomeSource = "Income source is required";
    if (!draft.preferredInstrument)
      errs.preferredInstrument = "Please select a preferred financing instrument";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }
  function validateStep3() {
    const errs = {};
    if (!draft.termsAccepted)
      errs.termsAccepted = "You must accept the Terms and Conditions";
    if (!draft.privacyAccepted)
      errs.privacyAccepted = "You must accept the Privacy Policy";
    if (!draft.ndprAccepted)
      errs.ndprAccepted = "You must consent to NDPR data processing to proceed.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }
  function handleNext() {
    const validators = [
      () => true,
      validateStep0,
      validateStep1,
      validateStep2,
      validateStep3
    ];
    const valid = step < 5 ? validators[step]() : true;
    if (!valid) return;
    if (returnToSummary && step < 5) {
      setStep(5);
      setReturnToSummary(false);
    } else {
      setStep((s) => Math.min(s + 1, 5));
    }
  }
  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
    setReturnToSummary(false);
  }
  function editStep(target) {
    setReturnToSummary(true);
    setStep(target);
  }
  async function handleSubmit() {
    if (!actor) {
      ue.error("Please connect your wallet before submitting.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await actor.submitIndividualRegistration(
        draft.fullName.trim(),
        draft.bvn.trim(),
        draft.nin.trim(),
        draft.dateOfBirth,
        draft.address.trim(),
        draft.occupation.trim(),
        draft.employmentStatus,
        draft.employmentStatus === EmploymentStatus.employed && draft.employerName.trim() ? draft.employerName.trim() : null,
        BigInt(Math.round(Number(draft.monthlyIncome))),
        draft.incomeSource,
        draft.financingPurpose,
        draft.financingPurpose === FinancingPurpose.other && draft.otherPurpose.trim() ? draft.otherPurpose.trim() : null,
        BigInt(Math.round(Number(draft.amountSought))),
        draft.preferredInstrument,
        draft.termsAccepted ? BigInt(Date.now()) : null
      );
      if ("err" in result) {
        setSubmitError(result.err);
        setIsSubmitting(false);
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      await refetch();
      setSubmitSuccess(true);
      ue.success("Application submitted successfully!");
      router.navigate({ to: "/individual/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
      setSubmitError(msg);
      ue.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }
  const selectedInstrument = INSTRUMENTS.find(
    (i) => i.value === draft.preferredInstrument
  );
  const employmentLabel = ((_a = EMPLOYMENT_OPTIONS.find((o) => o.value === draft.employmentStatus)) == null ? void 0 : _a.label) ?? "";
  const purposeLabel = ((_b = FINANCING_PURPOSE_OPTIONS.find((o) => o.value === draft.financingPurpose)) == null ? void 0 : _b.label) ?? "";
  const incomeSourceLabel = ((_c = INCOME_SOURCE_OPTIONS.find((o) => o.value === draft.incomeSource)) == null ? void 0 : _c.label) ?? "";
  if (submitSuccess) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Layout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "max-w-xl mx-auto py-16 px-4 text-center",
        "data-ocid": "register_individual.success_state",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full",
              style: { background: "oklch(var(--individual-accent) / 0.1)" },
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                CircleCheck,
                {
                  className: "h-10 w-10",
                  style: { color: "oklch(var(--individual-accent))" }
                }
              )
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-display text-3xl font-bold text-foreground mb-3", children: "Application Submitted" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-muted-foreground mb-2 leading-relaxed", children: [
            "Your application has been submitted.",
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "text-foreground", children: "Tawthiq (\\u0627\\u0644\\u062a\\u0648\\u062b\\u064a\\u0642)" }),
            " ",
            "verification will begin shortly."
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-8", children: "You will be notified via WhatsApp as your application progresses through identity verification, income analysis, and financing matching." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              type: "button",
              onClick: () => router.navigate({ to: "/individual/dashboard" }),
              className: "gap-2",
              style: {
                background: "oklch(var(--individual-accent))",
                color: "oklch(var(--individual-accent-foreground))"
              },
              "data-ocid": "register_individual.go_to_dashboard_button",
              children: "Go to My Dashboard"
            }
          )
        ]
      }
    ) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Layout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-2xl mx-auto py-8 px-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Apply as Individual",
        subtitle: "Personal halal financing application",
        breadcrumbs: [
          { label: "Home", href: "/" },
          { label: "Apply as Individual" }
        ],
        className: "mb-6"
      }
    ),
    (draft.fullName || draft.bvn) && step === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5 mb-4 text-sm",
        "data-ocid": "register_individual.draft_notice",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: "Draft restored from your last session." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: clearDraft,
              className: "text-xs font-medium hover:underline",
              style: { color: "oklch(var(--individual-accent))" },
              "data-ocid": "register_individual.clear_draft_button",
              children: "Clear draft"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { ref: cardRef, className: "shadow-md", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "pt-6 pb-8 px-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(StepProgress, { current: step, total: STEPS.length }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(AnimatePresence, { mode: "wait", children: [
        step === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
          motion.div,
          {
            initial: { opacity: 0, x: 24 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -24 },
            transition: { duration: 0.2 },
            children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold font-display text-foreground", children: "Individual Financing Applicant" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "You are registering as an individual seeking ethical financing." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-emerald-800 dark:text-emerald-200", children: "This pathway is for:" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("ul", { className: "text-sm text-emerald-700 dark:text-emerald-300 space-y-1 list-disc list-inside", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: "Home purchase financing" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: "Vehicle acquisition" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: "Education financing" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: "Medical expenses" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: "Business startup capital" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-blue-700 dark:text-blue-300", children: "Your application will be reviewed by our AI agents Tawthiq (identity verification) and Mizan (risk assessment) to determine your eligibility for ethical financing." }) })
            ] })
          },
          "step-type"
        ),
        step === 1 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 24 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -24 },
            transition: { duration: 0.2 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold font-display text-foreground", children: "Personal Identity" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Step 2 of 6 — Tell us about yourself" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "fullName", children: "Full Name *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "fullName",
                      placeholder: "e.g. Fatima Abubakar",
                      value: draft.fullName,
                      onChange: (e) => set("fullName", e.target.value),
                      className: "mt-1.5",
                      "data-ocid": "register_individual.full_name_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: errors.fullName,
                      ocid: "register_individual.full_name_input.field_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "dateOfBirth", children: "Date of Birth *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "dateOfBirth",
                      type: "date",
                      value: draft.dateOfBirth,
                      onChange: (e) => set("dateOfBirth", e.target.value),
                      max: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
                      className: "mt-1.5",
                      "data-ocid": "register_individual.dob_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: errors.dateOfBirth,
                      ocid: "register_individual.dob_input.field_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "address", children: "Residential Address *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Textarea,
                    {
                      id: "address",
                      placeholder: "e.g. 14 Aminu Kano Crescent, Wuse II, Abuja, FCT",
                      value: draft.address,
                      onChange: (e) => set("address", e.target.value),
                      className: "mt-1.5 resize-none",
                      rows: 2,
                      "data-ocid": "register_individual.address_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: errors.address,
                      ocid: "register_individual.address_input.field_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "occupation", children: "Occupation *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "occupation",
                      placeholder: "e.g. Secondary School Teacher, Software Engineer",
                      value: draft.occupation,
                      onChange: (e) => set("occupation", e.target.value),
                      className: "mt-1.5",
                      "data-ocid": "register_individual.occupation_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: errors.occupation,
                      ocid: "register_individual.occupation_input.field_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "employmentStatus", children: "Employment Status *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    Select,
                    {
                      value: draft.employmentStatus,
                      onValueChange: (v) => set("employmentStatus", v),
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SelectTrigger,
                          {
                            id: "employmentStatus",
                            className: "mt-1.5",
                            "data-ocid": "register_individual.employment_status_select",
                            children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Select employment status" })
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: EMPLOYMENT_OPTIONS.map((opt) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: opt.value, children: opt.label }, opt.value)) })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: errors.employmentStatus,
                      ocid: "register_individual.employment_status_select.field_error"
                    }
                  )
                ] }),
                draft.employmentStatus === EmploymentStatus.employed && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  motion.div,
                  {
                    initial: { opacity: 0, height: 0 },
                    animate: { opacity: 1, height: "auto" },
                    exit: { opacity: 0, height: 0 },
                    transition: { duration: 0.15 },
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "employerName", children: "Employer Name *" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Input,
                        {
                          id: "employerName",
                          placeholder: "e.g. Federal Ministry of Finance",
                          value: draft.employerName,
                          onChange: (e) => set("employerName", e.target.value),
                          className: "mt-1.5",
                          "data-ocid": "register_individual.employer_name_input"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        FieldError,
                        {
                          msg: errors.employerName,
                          ocid: "register_individual.employer_name_input.field_error"
                        }
                      )
                    ]
                  }
                )
              ] })
            ]
          },
          "step0"
        ),
        step === 2 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 24 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -24 },
            transition: { duration: 0.2 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold font-display text-foreground", children: "Identity Verification" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Step 3 of 6 — BVN and NIN for Tawthiq KYC screening" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "flex items-start gap-3 rounded-xl border px-4 py-3 mb-6",
                  style: {
                    borderColor: "oklch(var(--individual-accent) / 0.3)",
                    background: "oklch(var(--individual-accent) / 0.05)"
                  },
                  "data-ocid": "register_individual.kyc_security_note",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Shield,
                      {
                        className: "h-4 w-4 mt-0.5 flex-shrink-0",
                        style: { color: "oklch(var(--individual-accent))" }
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-foreground/80", children: [
                      "Your BVN and NIN are used for identity verification via",
                      " ",
                      /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Mono" }),
                      ". They are encrypted and never shared with third parties."
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "bvn", children: "Bank Verification Number (BVN) *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "bvn",
                      placeholder: "11-digit BVN e.g. 12345678901",
                      value: draft.bvn,
                      onChange: (e) => set(
                        "bvn",
                        e.target.value.replace(/\D/g, "").slice(0, 11)
                      ),
                      inputMode: "numeric",
                      maxLength: 11,
                      className: "mt-1.5 font-mono",
                      "data-ocid": "register_individual.bvn_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Your BVN is a unique 11-digit number that links your identity to all your bank accounts in Nigeria." }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: errors.bvn,
                      ocid: "register_individual.bvn_input.field_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "nin", children: "National Identification Number (NIN) *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "nin",
                      placeholder: "11-digit NIN e.g. 98765432101",
                      value: draft.nin,
                      onChange: (e) => set(
                        "nin",
                        e.target.value.replace(/\D/g, "").slice(0, 11)
                      ),
                      inputMode: "numeric",
                      maxLength: 11,
                      className: "mt-1.5 font-mono",
                      "data-ocid": "register_individual.nin_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Your NIN is assigned by NIMC and verifies your Nigerian citizenship or legal residency." }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: errors.nin,
                      ocid: "register_individual.nin_input.field_error"
                    }
                  )
                ] })
              ] })
            ]
          },
          "step1"
        ),
        step === 3 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 24 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -24 },
            transition: { duration: 0.2 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold font-display text-foreground", children: "Financing Purpose" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Step 4 of 6 — Your financing needs and preferred instrument" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "financingPurpose", children: "Financing Purpose *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    Select,
                    {
                      value: draft.financingPurpose,
                      onValueChange: (v) => set("financingPurpose", v),
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SelectTrigger,
                          {
                            id: "financingPurpose",
                            className: "mt-1.5",
                            "data-ocid": "register_individual.financing_purpose_select",
                            children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "What do you need financing for?" })
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: FINANCING_PURPOSE_OPTIONS.map((opt) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: opt.value, children: opt.label }, opt.value)) })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: errors.financingPurpose,
                      ocid: "register_individual.financing_purpose_select.field_error"
                    }
                  )
                ] }),
                draft.financingPurpose === FinancingPurpose.other && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  motion.div,
                  {
                    initial: { opacity: 0, height: 0 },
                    animate: { opacity: 1, height: "auto" },
                    transition: { duration: 0.15 },
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "otherPurpose", children: "Describe your financing purpose *" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Input,
                        {
                          id: "otherPurpose",
                          placeholder: "e.g. Purchase of agricultural equipment",
                          value: draft.otherPurpose,
                          onChange: (e) => set("otherPurpose", e.target.value),
                          className: "mt-1.5",
                          "data-ocid": "register_individual.other_purpose_input"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        FieldError,
                        {
                          msg: errors.otherPurpose,
                          ocid: "register_individual.other_purpose_input.field_error"
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "amountSought", children: "Amount Sought (NGN) *" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative mt-1.5", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none", children: "\\u20a6" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Input,
                        {
                          id: "amountSought",
                          type: "text",
                          inputMode: "numeric",
                          placeholder: "\\u20a60",
                          value: displayAmountSought,
                          onChange: (e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            const num = raw ? Number.parseInt(raw, 10) : 0;
                            set("amountSought", raw);
                            setDisplayAmountSought(
                              num > 0 ? num.toLocaleString("en-NG") : ""
                            );
                          },
                          className: "pl-10",
                          "data-ocid": "register_individual.amount_sought_input"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-1.5", children: "Enter amount in Nigerian Naira (NGN)" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      FieldError,
                      {
                        msg: errors.amountSought,
                        ocid: "register_individual.amount_sought_input.field_error"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "monthlyIncome", children: "Monthly Income (NGN) *" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative mt-1.5", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none", children: "\\u20a6" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Input,
                        {
                          id: "monthlyIncome",
                          type: "text",
                          inputMode: "numeric",
                          placeholder: "\\u20a60",
                          value: displayMonthlyIncome,
                          onChange: (e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            const num = raw ? Number.parseInt(raw, 10) : 0;
                            set("monthlyIncome", raw);
                            setDisplayMonthlyIncome(
                              num > 0 ? num.toLocaleString("en-NG") : ""
                            );
                          },
                          className: "pl-10",
                          "data-ocid": "register_individual.monthly_income_input"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-1.5", children: "Your average monthly take-home income" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      FieldError,
                      {
                        msg: errors.monthlyIncome,
                        ocid: "register_individual.monthly_income_input.field_error"
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "incomeSource", children: "Income Source *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    Select,
                    {
                      value: draft.incomeSource,
                      onValueChange: (v) => set("incomeSource", v),
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SelectTrigger,
                          {
                            id: "incomeSource",
                            className: "mt-1.5",
                            "data-ocid": "register_individual.income_source_select",
                            children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "How do you earn your income?" })
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: INCOME_SOURCE_OPTIONS.map((opt) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: opt.value, children: opt.label }, opt.value)) })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: errors.incomeSource,
                      ocid: "register_individual.income_source_select.field_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { className: "mb-2 block", children: "Preferred Islamic Financing Instrument *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mb-3", children: "Select the financing structure that best fits your needs. Each option includes a plain-language explanation and a Nigerian example." }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "div",
                    {
                      className: "space-y-3",
                      "data-ocid": "register_individual.instrument_list",
                      children: INSTRUMENTS.map((inst, idx) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                        InstrumentCard,
                        {
                          inst,
                          selected: draft.preferredInstrument === inst.value,
                          onSelect: () => set("preferredInstrument", inst.value),
                          index: idx
                        },
                        inst.value
                      ))
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: errors.preferredInstrument,
                      ocid: "register_individual.instrument_list.field_error"
                    }
                  )
                ] })
              ] })
            ]
          },
          "step2"
        ),
        step === 4 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 24 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -24 },
            transition: { duration: 0.2 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold font-display text-foreground", children: "Terms & Compliance" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Step 5 of 7 — Review what happens next and accept our terms" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "rounded-xl border px-4 py-4 mb-6",
                  style: {
                    borderColor: "oklch(var(--individual-accent) / 0.25)",
                    background: "oklch(var(--individual-accent) / 0.04)"
                  },
                  "data-ocid": "register_individual.next_steps_panel",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-3", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Info,
                        {
                          className: "w-4 h-4 flex-shrink-0",
                          style: { color: "oklch(var(--individual-accent))" }
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-foreground", children: "What happens after you submit?" })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-2", children: [
                      "Tawthiq (التوثيق) verifies your identity via BVN and NIN through Mono",
                      "Shariah compliance screening of your income sources and financing purpose",
                      "Credit-readiness verdict: Ready, Conditional Ready, or Not Ready",
                      "Once financing-ready, Mizan (الميزان) performs full income and risk analysis",
                      "Kashif (الكاشف) matches your profile with compatible halal financiers"
                    ].map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-start gap-2", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        CircleCheck,
                        {
                          className: "w-3.5 h-3.5 flex-shrink-0 mt-0.5",
                          style: { color: "oklch(var(--individual-accent))" }
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: item })
                    ] }, item)) })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 mb-6",
                  "data-ocid": "register_individual.ndpr_note",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground leading-relaxed", children: [
                      "By proceeding, you consent to the processing of your personal data in compliance with the",
                      " ",
                      /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "text-foreground", children: "Nigeria Data Protection Regulation (NDPR)" }),
                      ". Your data will only be used for identity verification and financing assessment."
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: "flex items-start gap-3",
                    "data-ocid": "register_individual.terms_checkbox_row",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Checkbox,
                        {
                          id: "termsAccepted",
                          checked: draft.termsAccepted,
                          onCheckedChange: (checked) => set("termsAccepted", Boolean(checked)),
                          "data-ocid": "register_individual.terms_checkbox",
                          className: "mt-0.5"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          "label",
                          {
                            htmlFor: "termsAccepted",
                            className: "text-sm text-foreground cursor-pointer",
                            children: [
                              "I have read and agree to the",
                              " ",
                              /* @__PURE__ */ jsxRuntimeExports.jsx(
                                TermsModal,
                                {
                                  type: "terms",
                                  triggerText: "Terms & Conditions",
                                  triggerClassName: "text-[oklch(var(--individual-accent))]",
                                  ocid: "register_individual.terms_link"
                                }
                              )
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          FieldError,
                          {
                            msg: errors.termsAccepted,
                            ocid: "register_individual.terms_checkbox.field_error"
                          }
                        )
                      ] })
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: "flex items-start gap-3",
                    "data-ocid": "register_individual.privacy_checkbox_row",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Checkbox,
                        {
                          id: "privacyAccepted",
                          checked: draft.privacyAccepted,
                          onCheckedChange: (checked) => set("privacyAccepted", Boolean(checked)),
                          "data-ocid": "register_individual.privacy_checkbox",
                          className: "mt-0.5"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          "label",
                          {
                            htmlFor: "privacyAccepted",
                            className: "text-sm text-foreground cursor-pointer",
                            children: [
                              "I have read and agree to the",
                              " ",
                              /* @__PURE__ */ jsxRuntimeExports.jsx(
                                TermsModal,
                                {
                                  type: "privacy",
                                  triggerText: "Privacy Policy",
                                  triggerClassName: "text-[oklch(var(--individual-accent))]",
                                  ocid: "register_individual.privacy_link"
                                }
                              )
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          FieldError,
                          {
                            msg: errors.privacyAccepted,
                            ocid: "register_individual.privacy_checkbox.field_error"
                          }
                        )
                      ] })
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: "flex items-start gap-3",
                    "data-ocid": "register_individual.ndpr_checkbox_row",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Checkbox,
                        {
                          id: "ndpr",
                          checked: draft.ndprAccepted,
                          onCheckedChange: (v) => set("ndprAccepted", !!v),
                          "data-ocid": "register_individual.ndpr_checkbox",
                          className: "mt-0.5"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          "label",
                          {
                            htmlFor: "ndpr",
                            className: "text-sm text-foreground cursor-pointer",
                            children: [
                              "I consent to the processing of my personal data in compliance with the",
                              " ",
                              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "font-medium", children: "Nigeria Data Protection Regulation (NDPR)" }),
                              "."
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          FieldError,
                          {
                            msg: errors.ndprAccepted,
                            ocid: "register_individual.ndpr_checkbox.field_error"
                          }
                        )
                      ] })
                    ]
                  }
                )
              ] })
            ]
          },
          "step3"
        ),
        step === 5 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 24 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -24 },
            transition: { duration: 0.2 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold font-display text-foreground", children: "Review & Submit" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Step 6 of 6 \\u2014 Confirm your details before submitting" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  SummarySection,
                  {
                    title: "Personal Identity",
                    onEdit: () => editStep(0),
                    ocid: "register_individual.summary_identity",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Full Name", value: draft.fullName }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Date of Birth",
                          value: draft.dateOfBirth
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Address", value: draft.address }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Occupation", value: draft.occupation }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Employment Status",
                          value: employmentLabel
                        }
                      ),
                      draft.employmentStatus === EmploymentStatus.employed && /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Employer Name",
                          value: draft.employerName
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  SummarySection,
                  {
                    title: "Identity Verification",
                    onEdit: () => editStep(1),
                    ocid: "register_individual.summary_verification",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "BVN", value: maskId(draft.bvn) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "NIN", value: maskId(draft.nin) })
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  SummarySection,
                  {
                    title: "Financing Details",
                    onEdit: () => editStep(2),
                    ocid: "register_individual.summary_financing",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Purpose",
                          value: draft.financingPurpose === FinancingPurpose.other ? `Other: ${draft.otherPurpose}` : purposeLabel
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Amount Sought",
                          value: draft.amountSought ? `₦${Number(draft.amountSought).toLocaleString()}` : ""
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Monthly Income",
                          value: draft.monthlyIncome ? `₦${Number(draft.monthlyIncome).toLocaleString()}` : ""
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Income Source",
                          value: incomeSourceLabel
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Instrument",
                          value: selectedInstrument ? `${selectedInstrument.nameEn} (${selectedInstrument.nameAr})` : ""
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  SummarySection,
                  {
                    title: "Terms & Compliance",
                    onEdit: () => editStep(3),
                    ocid: "register_individual.summary_terms",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Terms & Conditions",
                          value: draft.termsAccepted ? "Accepted" : "Not accepted"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Privacy Policy",
                          value: draft.privacyAccepted ? "Accepted" : "Not accepted"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "NDPR Consent",
                          value: draft.ndprAccepted ? "Consented" : "Not consented"
                        }
                      )
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "mt-5 rounded-xl border px-4 py-4",
                  style: {
                    borderColor: "oklch(var(--individual-accent) / 0.2)",
                    background: "oklch(var(--individual-accent) / 0.04)"
                  },
                  "data-ocid": "register_individual.tawthiq_checklist",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-3", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Info,
                        {
                          className: "w-4 h-4 flex-shrink-0",
                          style: { color: "oklch(var(--individual-accent))" }
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-foreground", children: "Tawthiq (\\u0627\\u0644\\u062a\\u0648\\u062b\\u064a\\u0642) will verify:" })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-1.5", children: [
                      "BVN identity check via Mono",
                      "NIN verification with NIMC via Mono",
                      "Watchlist screening for financial crime",
                      "Shariah compliance of income sources and financing purpose",
                      "Credit readiness assessment"
                    ].map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-start gap-2", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        CircleCheck,
                        {
                          className: "w-3.5 h-3.5 flex-shrink-0 mt-0.5",
                          style: {
                            color: "oklch(var(--individual-accent))"
                          }
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: item })
                    ] }, item)) })
                  ]
                }
              ),
              submitError && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3",
                  "data-ocid": "register_individual.error_state",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { className: "h-4 w-4 text-destructive flex-shrink-0 mt-0.5" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive font-medium", children: "Submission failed" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-destructive/80 mt-0.5", children: submitError })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        type: "button",
                        onClick: handleSubmit,
                        className: "text-xs text-destructive font-medium hover:underline flex-shrink-0",
                        "data-ocid": "register_individual.retry_button",
                        children: "Retry"
                      }
                    )
                  ]
                }
              )
            ]
          },
          "step4"
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between gap-3 mt-8 pt-6 border-t border-border", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            type: "button",
            variant: "outline",
            onClick: step === 0 ? () => router.navigate({ to: "/" }) : handleBack,
            "data-ocid": "register_individual.back_button",
            children: step === 0 ? "Cancel" : "← Back"
          }
        ),
        step < 5 ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            type: "button",
            onClick: handleNext,
            disabled: step === 4 && (!draft.termsAccepted || !draft.privacyAccepted || !draft.ndprAccepted),
            style: {
              background: "oklch(var(--individual-accent))",
              color: "oklch(var(--individual-accent-foreground))"
            },
            "data-ocid": "register_individual.next_button",
            children: returnToSummary ? "Return to Summary →" : step === 4 ? "Next →" : "Continue →"
          }
        ) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            type: "button",
            onClick: handleSubmit,
            disabled: isSubmitting || !actor,
            className: "gap-2 min-w-[160px]",
            style: {
              background: "oklch(var(--individual-accent))",
              color: "oklch(var(--individual-accent-foreground))"
            },
            "data-ocid": "register_individual.submit_button",
            children: [
              isSubmitting && /* @__PURE__ */ jsxRuntimeExports.jsx(LoadingSpinner, { size: "sm", label: "" }),
              isSubmitting ? "Submitting…" : "Submit Application"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-center text-xs text-muted-foreground mt-4", children: [
        "Step ",
        step + 1,
        " of ",
        STEPS.length,
        " \\u2014",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "oklch(var(--individual-accent))" }, children: STEPS[step].label })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        User,
        {
          className: "h-3.5 w-3.5",
          style: { color: "oklch(var(--individual-accent))" }
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Individual financing applicant pathway" })
    ] })
  ] }) });
}
export {
  RegisterIndividualPage as default
};
