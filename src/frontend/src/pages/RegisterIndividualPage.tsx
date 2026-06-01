import {
  EmploymentStatus,
  FinancingPurpose,
  IncomeSource,
  PreferredInstrument,
} from "@/backend";
import { Layout } from "@/components/Layout";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBackend } from "@/hooks/use-backend";
import { useUserRole } from "@/hooks/use-user-role";
import { validateBvn, validateNin } from "@/utils/validation";
import { useRouter } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Info, Shield, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TermsModal } from "../components/TermsModal";

// ── Constants ────────────────────────────────────────────────────────────────

const DRAFT_KEY = "vetify_individual_draft";

const STEPS = [
  { label: "Applicant Type" },
  { label: "Personal Identity" },
  { label: "Identity Verification" },
  { label: "Financing Purpose" },
  { label: "Financial Profile" },
  { label: "Shariah & Terms" },
  { label: "Review & Submit" },
];

interface InstrumentDef {
  value: PreferredInstrument;
  nameEn: string;
  nameAr: string;
  description: string;
  example: string;
}

const INSTRUMENTS: InstrumentDef[] = [
  {
    value: PreferredInstrument.murabaha,
    nameEn: "Murabaha",
    nameAr: "\u0627\u0644\u0645\u0631\u0627\u0628\u062d\u0629",
    description:
      "The financier buys an asset for you and sells it at an agreed marked-up price, paid in instalments \u2014 you know the profit margin upfront.",
    example:
      "You need a \u20a65M family car. The financier buys it and sells it to you for \u20a65.8M payable over 24 months.",
  },
  {
    value: PreferredInstrument.musharakah,
    nameEn: "Musharakah",
    nameAr: "\u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629",
    description:
      "A joint partnership where both you and the financier contribute capital. Profits are shared by an agreed ratio; losses are borne proportionally.",
    example:
      "You and a financier each contribute \u20a65M to purchase a property together. Rental income and eventual sale proceeds are split 60/40.",
  },
  {
    value: PreferredInstrument.mudarabah,
    nameEn: "Mudarabah",
    nameAr: "\u0627\u0644\u0645\u0636\u0627\u0631\u0628\u0629",
    description:
      "The financier provides all the capital while you provide expertise and management. Profits are shared; the financier bears capital loss if you manage honestly.",
    example:
      "A tailor receives \u20a63M from a financier to start a fashion business. The tailor manages operations; profits split 70/30.",
  },
  {
    value: PreferredInstrument.ijarah,
    nameEn: "Ijarah",
    nameAr: "\u0627\u0644\u0625\u062c\u0627\u0631\u0629",
    description:
      "The financier buys an asset and leases it to you at a fixed monthly rental. Ownership stays with the financier for the lease duration.",
    example:
      "You need office equipment worth \u20a62M. The financier buys it and leases it to you at \u20a660K/month for 3 years.",
  },
  {
    value: PreferredInstrument.istisna,
    nameEn: "Istisna\u2019",
    nameAr: "\u0627\u0644\u0627\u0633\u062a\u0635\u0646\u0627\u0639",
    description:
      "Financing for construction or manufacturing \u2014 the financier funds the production of something to your specification, delivered later.",
    example:
      "A developer contracts to build a 3-bedroom house for you. The financier pays in stages as construction progresses.",
  },
  {
    value: PreferredInstrument.salam,
    nameEn: "Salam",
    nameAr: "\u0627\u0644\u0633\u0644\u0645",
    description:
      "Full advance payment for goods to be delivered at a future date \u2014 commonly used in agriculture and commodities.",
    example:
      "A rice farmer receives full \u20a61.5M payment now for 10 tonnes of rice to be delivered at harvest in 4 months.",
  },
];

const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: EmploymentStatus.employed, label: "Employed" },
  { value: EmploymentStatus.selfEmployed, label: "Self-Employed" },
  { value: EmploymentStatus.unemployed, label: "Unemployed" },
  { value: EmploymentStatus.student, label: "Student" },
];

const INCOME_SOURCE_OPTIONS: { value: IncomeSource; label: string }[] = [
  { value: IncomeSource.employment, label: "Employment" },
  { value: IncomeSource.selfEmployment, label: "Self-Employment" },
  { value: IncomeSource.business, label: "Business" },
  { value: IncomeSource.other, label: "Other" },
];

const FINANCING_PURPOSE_OPTIONS: {
  value: FinancingPurpose;
  label: string;
}[] = [
  { value: FinancingPurpose.homePurchase, label: "Home Purchase" },
  { value: FinancingPurpose.vehicle, label: "Vehicle" },
  { value: FinancingPurpose.education, label: "Education" },
  { value: FinancingPurpose.medical, label: "Medical" },
  { value: FinancingPurpose.startupCapital, label: "Startup Capital" },
  { value: FinancingPurpose.other, label: "Other" },
];

// ── Form draft shape ─────────────────────────────────────────────────────────

interface FormDraft {
  fullName: string;
  dateOfBirth: string;
  address: string;
  occupation: string;
  employmentStatus: EmploymentStatus | "";
  employerName: string;
  bvn: string;
  nin: string;
  financingPurpose: FinancingPurpose | "";
  otherPurpose: string;
  amountSought: string;
  monthlyIncome: string;
  incomeSource: IncomeSource | "";
  preferredInstrument: PreferredInstrument | "";
  termsAccepted: boolean;
  privacyAccepted: boolean;
  ndprAccepted: boolean;
}

const EMPTY_DRAFT: FormDraft = {
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
  ndprAccepted: false,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StepProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="mb-8" data-ocid="register_individual.progress">
      <div className="flex items-center gap-0 mb-3">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                i > current ? "bg-muted text-muted-foreground" : "text-white"
              }`}
              style={
                i <= current
                  ? {
                      background: "oklch(var(--individual-accent))",
                      boxShadow:
                        i === current
                          ? "0 0 0 4px oklch(var(--individual-accent) / 0.2)"
                          : "none",
                    }
                  : {}
              }
            >
              {i < current ? (
                <svg
                  role="img"
                  aria-label="Step completed"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            {i < total - 1 && (
              <div
                className="flex-1 h-0.5 mx-1 transition-colors duration-300"
                style={
                  i < current
                    ? { background: "oklch(var(--individual-accent))" }
                    : {}
                }
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {STEPS.map((step, i) => (
          <span
            key={step.label}
            className="text-xs font-medium transition-colors min-w-0 truncate"
            style={{
              width: `${100 / total}%`,
              textAlign:
                i === 0 ? "left" : i === total - 1 ? "right" : "center",
              color:
                i === current
                  ? "oklch(var(--individual-accent))"
                  : "oklch(var(--muted-foreground))",
            }}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function FieldError({ msg, ocid }: { msg?: string; ocid: string }) {
  if (!msg) return null;
  return (
    <p className="text-xs text-destructive mt-1" data-ocid={ocid}>
      {msg}
    </p>
  );
}

function InstrumentCard({
  inst,
  selected,
  onSelect,
  index,
}: {
  inst: InstrumentDef;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-ocid={`register_individual.instrument_card.${index + 1}`}
      aria-pressed={selected}
      className="w-full text-left p-4 rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2"
      style={{
        borderColor: selected
          ? "oklch(var(--individual-accent))"
          : "oklch(var(--border))",
        background: selected
          ? "oklch(var(--individual-accent) / 0.06)"
          : "oklch(var(--card))",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
          style={{
            borderColor: selected
              ? "oklch(var(--individual-accent))"
              : "oklch(var(--muted-foreground) / 0.4)",
          }}
        >
          {selected && (
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: "oklch(var(--individual-accent))" }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-foreground font-display">
              {inst.nameEn}
            </span>
            <span className="text-sm text-muted-foreground">{inst.nameAr}</span>
          </div>
          <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
            {inst.description}
          </p>
          <div className="mt-2 flex items-start gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
              Example
            </span>
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              {inst.example}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

function SummarySection({
  title,
  onEdit,
  ocid,
  children,
}: {
  title: string;
  onEdit: () => void;
  ocid: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-muted/20 dark:bg-muted/10 overflow-hidden"
      data-ocid={ocid}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 dark:bg-muted/20 border-b border-border">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium hover:underline"
          style={{ color: "oklch(var(--individual-accent))" }}
          data-ocid={`${ocid}.edit_button`}
        >
          Edit
        </button>
      </div>
      <div className="px-4 py-3 space-y-1.5">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-muted-foreground w-40 flex-shrink-0">
        {label}
      </span>
      <span className="text-xs text-foreground font-medium break-words min-w-0">
        {value || "\u2014"}
      </span>
    </div>
  );
}

function maskId(val: string) {
  if (!val || val.length <= 4) return val || "\u2014";
  return `${".".repeat(val.length - 4)}${val.slice(-4)}`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RegisterIndividualPage() {
  const { actor } = useBackend();
  const { refetch } = useUserRole();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [returnToSummary, setReturnToSummary] = useState(false);

  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Formatted display values for currency inputs (with commas)
  const [displayAmountSought, setDisplayAmountSought] = useState("");
  const [displayMonthlyIncome, setDisplayMonthlyIncome] = useState("");

  const cardRef = useRef<HTMLDivElement>(null);

  // ── LocalStorage draft ──────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(DRAFT_KEY) ||
        localStorage.getItem("halalvet_individual_draft");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormDraft>;
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
      // ignore corrupt draft
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage errors
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
    toast.info("Draft cleared.");
  }

  function set<K extends keyof FormDraft>(key: K, value: FormDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  // ── Scroll on step change ───────────────────────────────────────────────────

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateStep0(): boolean {
    const errs: Record<string, string> = {};
    if (!draft.fullName.trim()) errs.fullName = "Full name is required";
    if (!draft.dateOfBirth) errs.dateOfBirth = "Date of birth is required";
    if (!draft.address.trim()) errs.address = "Address is required";
    if (!draft.occupation.trim()) errs.occupation = "Occupation is required";
    if (!draft.employmentStatus)
      errs.employmentStatus = "Employment status is required";
    if (
      draft.employmentStatus === EmploymentStatus.employed &&
      !draft.employerName.trim()
    ) {
      errs.employerName = "Employer name is required when employed";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    const bvnErr = validateBvn(draft.bvn);
    if (bvnErr) errs.bvn = bvnErr;
    const ninErr = validateNin(draft.nin);
    if (ninErr) errs.nin = ninErr;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (!draft.financingPurpose)
      errs.financingPurpose = "Please select a financing purpose";
    if (
      draft.financingPurpose === FinancingPurpose.other &&
      !draft.otherPurpose.trim()
    ) {
      errs.otherPurpose = "Please describe your financing purpose";
    }
    const amt = Number(draft.amountSought);
    if (!draft.amountSought || Number.isNaN(amt) || amt < 10000) {
      errs.amountSought = "Amount must be at least \u20a610,000";
    }
    const inc = Number(draft.monthlyIncome);
    if (!draft.monthlyIncome || Number.isNaN(inc) || inc <= 0) {
      errs.monthlyIncome = "Monthly income is required and must be > 0";
    }
    if (!draft.incomeSource) errs.incomeSource = "Income source is required";
    if (!draft.preferredInstrument)
      errs.preferredInstrument =
        "Please select a preferred financing instrument";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep3(): boolean {
    const errs: Record<string, string> = {};
    if (!draft.termsAccepted)
      errs.termsAccepted = "You must accept the Terms and Conditions";
    if (!draft.privacyAccepted)
      errs.privacyAccepted = "You must accept the Privacy Policy";
    if (!draft.ndprAccepted)
      errs.ndprAccepted =
        "You must consent to NDPR data processing to proceed.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function handleNext() {
    const validators = [
      () => true,
      validateStep0,
      validateStep1,
      validateStep2,
      validateStep3,
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

  function editStep(target: number) {
    setReturnToSummary(true);
    setStep(target);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!actor) {
      toast.error("Please connect your wallet before submitting.");
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
        draft.employmentStatus as EmploymentStatus,
        draft.employmentStatus === EmploymentStatus.employed &&
          draft.employerName.trim()
          ? draft.employerName.trim()
          : null,
        BigInt(Math.round(Number(draft.monthlyIncome))),
        draft.incomeSource as IncomeSource,
        draft.financingPurpose as FinancingPurpose,
        draft.financingPurpose === FinancingPurpose.other &&
          draft.otherPurpose.trim()
          ? draft.otherPurpose.trim()
          : null,
        BigInt(Math.round(Number(draft.amountSought))),
        draft.preferredInstrument as PreferredInstrument,
        draft.termsAccepted ? BigInt(Date.now()) : null,
      );
      if ("err" in result) {
        setSubmitError(result.err);
        setIsSubmitting(false);
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      await refetch();
      setSubmitSuccess(true);
      toast.success("Application submitted successfully!");
      router.navigate({ to: "/individual/dashboard" });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Submission failed. Please try again.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Derived helpers ─────────────────────────────────────────────────────────

  const selectedInstrument = INSTRUMENTS.find(
    (i) => i.value === draft.preferredInstrument,
  );

  const employmentLabel =
    EMPLOYMENT_OPTIONS.find((o) => o.value === draft.employmentStatus)?.label ??
    "";
  const purposeLabel =
    FINANCING_PURPOSE_OPTIONS.find((o) => o.value === draft.financingPurpose)
      ?.label ?? "";
  const incomeSourceLabel =
    INCOME_SOURCE_OPTIONS.find((o) => o.value === draft.incomeSource)?.label ??
    "";

  // ── Success screen ──────────────────────────────────────────────────────────

  if (submitSuccess) {
    return (
      <Layout>
        <div
          className="max-w-xl mx-auto py-16 px-4 text-center"
          data-ocid="register_individual.success_state"
        >
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: "oklch(var(--individual-accent) / 0.1)" }}
          >
            <CheckCircle2
              className="h-10 w-10"
              style={{ color: "oklch(var(--individual-accent))" }}
            />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-3">
            Application Submitted
          </h1>
          <p className="text-muted-foreground mb-2 leading-relaxed">
            Your application has been submitted.{" "}
            <strong className="text-foreground">
              Tawthiq (\u0627\u0644\u062a\u0648\u062b\u064a\u0642)
            </strong>{" "}
            verification will begin shortly.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            You will be notified via WhatsApp as your application progresses
            through identity verification, income analysis, and financing
            matching.
          </p>
          <Button
            type="button"
            onClick={() => router.navigate({ to: "/individual/dashboard" })}
            className="gap-2"
            style={{
              background: "oklch(var(--individual-accent))",
              color: "oklch(var(--individual-accent-foreground))",
            }}
            data-ocid="register_individual.go_to_dashboard_button"
          >
            Go to My Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <PageHeader
          title="Apply as Individual"
          subtitle="Personal halal financing application"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Apply as Individual" },
          ]}
          className="mb-6"
        />

        {/* Draft restore notice */}
        {(draft.fullName || draft.bvn) && step === 0 && (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5 mb-4 text-sm"
            data-ocid="register_individual.draft_notice"
          >
            <span className="text-muted-foreground">
              Draft restored from your last session.
            </span>
            <button
              type="button"
              onClick={clearDraft}
              className="text-xs font-medium hover:underline"
              style={{ color: "oklch(var(--individual-accent))" }}
              data-ocid="register_individual.clear_draft_button"
            >
              Clear draft
            </button>
          </div>
        )}

        <Card ref={cardRef} className="shadow-md">
          <CardContent className="pt-6 pb-8 px-6">
            <StepProgress current={step} total={STEPS.length} />

            <AnimatePresence mode="wait">
              {/* ── STEP 0: Applicant Type Intro ─────────────────────────── */}
              {step === 0 && (
                <motion.div
                  key="step-type"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold font-display text-foreground">
                        Individual Financing Applicant
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        You are registering as an individual seeking ethical
                        financing.
                      </p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        This pathway is for:
                      </p>
                      <ul className="text-sm text-emerald-700 dark:text-emerald-300 space-y-1 list-disc list-inside">
                        <li>Home purchase financing</li>
                        <li>Vehicle acquisition</li>
                        <li>Education financing</li>
                        <li>Medical expenses</li>
                        <li>Business startup capital</li>
                      </ul>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Your application will be reviewed by our AI agents
                        Tawthiq (identity verification) and Mizan (risk
                        assessment) to determine your eligibility for ethical
                        financing.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 1: Personal Identity ──────────────────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold font-display text-foreground">
                      Personal Identity
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Step 2 of 6 — Tell us about yourself
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        placeholder="e.g. Fatima Abubakar"
                        value={draft.fullName}
                        onChange={(e) => set("fullName", e.target.value)}
                        className="mt-1.5"
                        data-ocid="register_individual.full_name_input"
                      />
                      <FieldError
                        msg={errors.fullName}
                        ocid="register_individual.full_name_input.field_error"
                      />
                    </div>

                    <div>
                      <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={draft.dateOfBirth}
                        onChange={(e) => set("dateOfBirth", e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        className="mt-1.5"
                        data-ocid="register_individual.dob_input"
                      />
                      <FieldError
                        msg={errors.dateOfBirth}
                        ocid="register_individual.dob_input.field_error"
                      />
                    </div>

                    <div>
                      <Label htmlFor="address">Residential Address *</Label>
                      <Textarea
                        id="address"
                        placeholder="e.g. 14 Aminu Kano Crescent, Wuse II, Abuja, FCT"
                        value={draft.address}
                        onChange={(e) => set("address", e.target.value)}
                        className="mt-1.5 resize-none"
                        rows={2}
                        data-ocid="register_individual.address_input"
                      />
                      <FieldError
                        msg={errors.address}
                        ocid="register_individual.address_input.field_error"
                      />
                    </div>

                    <div>
                      <Label htmlFor="occupation">Occupation *</Label>
                      <Input
                        id="occupation"
                        placeholder="e.g. Secondary School Teacher, Software Engineer"
                        value={draft.occupation}
                        onChange={(e) => set("occupation", e.target.value)}
                        className="mt-1.5"
                        data-ocid="register_individual.occupation_input"
                      />
                      <FieldError
                        msg={errors.occupation}
                        ocid="register_individual.occupation_input.field_error"
                      />
                    </div>

                    <div>
                      <Label htmlFor="employmentStatus">
                        Employment Status *
                      </Label>
                      <Select
                        value={draft.employmentStatus}
                        onValueChange={(v) =>
                          set("employmentStatus", v as EmploymentStatus)
                        }
                      >
                        <SelectTrigger
                          id="employmentStatus"
                          className="mt-1.5"
                          data-ocid="register_individual.employment_status_select"
                        >
                          <SelectValue placeholder="Select employment status" />
                        </SelectTrigger>
                        <SelectContent>
                          {EMPLOYMENT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError
                        msg={errors.employmentStatus}
                        ocid="register_individual.employment_status_select.field_error"
                      />
                    </div>

                    {draft.employmentStatus === EmploymentStatus.employed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Label htmlFor="employerName">Employer Name *</Label>
                        <Input
                          id="employerName"
                          placeholder="e.g. Federal Ministry of Finance"
                          value={draft.employerName}
                          onChange={(e) => set("employerName", e.target.value)}
                          className="mt-1.5"
                          data-ocid="register_individual.employer_name_input"
                        />
                        <FieldError
                          msg={errors.employerName}
                          ocid="register_individual.employer_name_input.field_error"
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── STEP 1: Identity Verification ─────────────────────────── */}
              {step === 2 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold font-display text-foreground">
                      Identity Verification
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Step 3 of 6 — BVN and NIN for Tawthiq KYC screening
                    </p>
                  </div>

                  {/* Security note */}
                  <div
                    className="flex items-start gap-3 rounded-xl border px-4 py-3 mb-6"
                    style={{
                      borderColor: "oklch(var(--individual-accent) / 0.3)",
                      background: "oklch(var(--individual-accent) / 0.05)",
                    }}
                    data-ocid="register_individual.kyc_security_note"
                  >
                    <Shield
                      className="h-4 w-4 mt-0.5 flex-shrink-0"
                      style={{ color: "oklch(var(--individual-accent))" }}
                    />
                    <p className="text-sm text-foreground/80">
                      Your BVN and NIN are used for identity verification via{" "}
                      <strong>Mono</strong>. They are encrypted and never shared
                      with third parties.
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <Label htmlFor="bvn">
                        Bank Verification Number (BVN) *
                      </Label>
                      <Input
                        id="bvn"
                        placeholder="11-digit BVN e.g. 12345678901"
                        value={draft.bvn}
                        onChange={(e) =>
                          set(
                            "bvn",
                            e.target.value.replace(/\D/g, "").slice(0, 11),
                          )
                        }
                        inputMode="numeric"
                        maxLength={11}
                        className="mt-1.5 font-mono"
                        data-ocid="register_individual.bvn_input"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Your BVN is a unique 11-digit number that links your
                        identity to all your bank accounts in Nigeria.
                      </p>
                      <FieldError
                        msg={errors.bvn}
                        ocid="register_individual.bvn_input.field_error"
                      />
                    </div>

                    <div>
                      <Label htmlFor="nin">
                        National Identification Number (NIN) *
                      </Label>
                      <Input
                        id="nin"
                        placeholder="11-digit NIN e.g. 98765432101"
                        value={draft.nin}
                        onChange={(e) =>
                          set(
                            "nin",
                            e.target.value.replace(/\D/g, "").slice(0, 11),
                          )
                        }
                        inputMode="numeric"
                        maxLength={11}
                        className="mt-1.5 font-mono"
                        data-ocid="register_individual.nin_input"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Your NIN is assigned by NIMC and verifies your Nigerian
                        citizenship or legal residency.
                      </p>
                      <FieldError
                        msg={errors.nin}
                        ocid="register_individual.nin_input.field_error"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: Financing Purpose ──────────────────────────────── */}
              {step === 3 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold font-display text-foreground">
                      Financing Purpose
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Step 4 of 6 — Your financing needs and preferred
                      instrument
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <Label htmlFor="financingPurpose">
                        Financing Purpose *
                      </Label>
                      <Select
                        value={draft.financingPurpose}
                        onValueChange={(v) =>
                          set("financingPurpose", v as FinancingPurpose)
                        }
                      >
                        <SelectTrigger
                          id="financingPurpose"
                          className="mt-1.5"
                          data-ocid="register_individual.financing_purpose_select"
                        >
                          <SelectValue placeholder="What do you need financing for?" />
                        </SelectTrigger>
                        <SelectContent>
                          {FINANCING_PURPOSE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError
                        msg={errors.financingPurpose}
                        ocid="register_individual.financing_purpose_select.field_error"
                      />
                    </div>

                    {draft.financingPurpose === FinancingPurpose.other && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ duration: 0.15 }}
                      >
                        <Label htmlFor="otherPurpose">
                          Describe your financing purpose *
                        </Label>
                        <Input
                          id="otherPurpose"
                          placeholder="e.g. Purchase of agricultural equipment"
                          value={draft.otherPurpose}
                          onChange={(e) => set("otherPurpose", e.target.value)}
                          className="mt-1.5"
                          data-ocid="register_individual.other_purpose_input"
                        />
                        <FieldError
                          msg={errors.otherPurpose}
                          ocid="register_individual.other_purpose_input.field_error"
                        />
                      </motion.div>
                    )}

                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="amountSought">
                          Amount Sought (NGN) *
                        </Label>
                        <div className="relative mt-1.5">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                            \u20a6
                          </span>
                          <Input
                            id="amountSought"
                            type="text"
                            inputMode="numeric"
                            placeholder="\u20a60"
                            value={displayAmountSought}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              const num = raw ? Number.parseInt(raw, 10) : 0;
                              set("amountSought", raw);
                              setDisplayAmountSought(
                                num > 0 ? num.toLocaleString("en-NG") : "",
                              );
                            }}
                            className="pl-10"
                            data-ocid="register_individual.amount_sought_input"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Enter amount in Nigerian Naira (NGN)
                        </p>
                        <FieldError
                          msg={errors.amountSought}
                          ocid="register_individual.amount_sought_input.field_error"
                        />
                      </div>

                      <div>
                        <Label htmlFor="monthlyIncome">
                          Monthly Income (NGN) *
                        </Label>
                        <div className="relative mt-1.5">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                            \u20a6
                          </span>
                          <Input
                            id="monthlyIncome"
                            type="text"
                            inputMode="numeric"
                            placeholder="\u20a60"
                            value={displayMonthlyIncome}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              const num = raw ? Number.parseInt(raw, 10) : 0;
                              set("monthlyIncome", raw);
                              setDisplayMonthlyIncome(
                                num > 0 ? num.toLocaleString("en-NG") : "",
                              );
                            }}
                            className="pl-10"
                            data-ocid="register_individual.monthly_income_input"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Your average monthly take-home income
                        </p>
                        <FieldError
                          msg={errors.monthlyIncome}
                          ocid="register_individual.monthly_income_input.field_error"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="incomeSource">Income Source *</Label>
                      <Select
                        value={draft.incomeSource}
                        onValueChange={(v) =>
                          set("incomeSource", v as IncomeSource)
                        }
                      >
                        <SelectTrigger
                          id="incomeSource"
                          className="mt-1.5"
                          data-ocid="register_individual.income_source_select"
                        >
                          <SelectValue placeholder="How do you earn your income?" />
                        </SelectTrigger>
                        <SelectContent>
                          {INCOME_SOURCE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError
                        msg={errors.incomeSource}
                        ocid="register_individual.income_source_select.field_error"
                      />
                    </div>

                    {/* Instrument picker */}
                    <div>
                      <Label className="mb-2 block">
                        Preferred Islamic Financing Instrument *
                      </Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Select the financing structure that best fits your
                        needs. Each option includes a plain-language explanation
                        and a Nigerian example.
                      </p>
                      <div
                        className="space-y-3"
                        data-ocid="register_individual.instrument_list"
                      >
                        {INSTRUMENTS.map((inst, idx) => (
                          <InstrumentCard
                            key={inst.value}
                            inst={inst}
                            selected={draft.preferredInstrument === inst.value}
                            onSelect={() =>
                              set("preferredInstrument", inst.value)
                            }
                            index={idx}
                          />
                        ))}
                      </div>
                      <FieldError
                        msg={errors.preferredInstrument}
                        ocid="register_individual.instrument_list.field_error"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: Terms & Compliance ────────────────────────────── */}
              {step === 4 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold font-display text-foreground">
                      Terms &amp; Compliance
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Step 5 of 7 — Review what happens next and accept our
                      terms
                    </p>
                  </div>

                  {/* What happens next */}
                  <div
                    className="rounded-xl border px-4 py-4 mb-6"
                    style={{
                      borderColor: "oklch(var(--individual-accent) / 0.25)",
                      background: "oklch(var(--individual-accent) / 0.04)",
                    }}
                    data-ocid="register_individual.next_steps_panel"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Info
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: "oklch(var(--individual-accent))" }}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        What happens after you submit?
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {[
                        "Tawthiq (\u0627\u0644\u062a\u0648\u062b\u064a\u0642) verifies your identity via BVN and NIN through Mono",
                        "Shariah compliance screening of your income sources and financing purpose",
                        "Credit-readiness verdict: Ready, Conditional Ready, or Not Ready",
                        "Once financing-ready, Mizan (\u0627\u0644\u0645\u064a\u0632\u0627\u0646) performs full income and risk analysis",
                        "Kashif (\u0627\u0644\u0643\u0627\u0634\u0641) matches your profile with compatible halal financiers",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2
                            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                            style={{ color: "oklch(var(--individual-accent))" }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* NDPR note */}
                  <div
                    className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 mb-6"
                    data-ocid="register_individual.ndpr_note"
                  >
                    <Shield className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      By proceeding, you consent to the processing of your
                      personal data in compliance with the{" "}
                      <strong className="text-foreground">
                        Nigeria Data Protection Regulation (NDPR)
                      </strong>
                      . Your data will only be used for identity verification
                      and financing assessment.
                    </p>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-4">
                    <div
                      className="flex items-start gap-3"
                      data-ocid="register_individual.terms_checkbox_row"
                    >
                      <Checkbox
                        id="termsAccepted"
                        checked={draft.termsAccepted}
                        onCheckedChange={(checked) =>
                          set("termsAccepted", Boolean(checked))
                        }
                        data-ocid="register_individual.terms_checkbox"
                        className="mt-0.5"
                      />
                      <div>
                        <label
                          htmlFor="termsAccepted"
                          className="text-sm text-foreground cursor-pointer"
                        >
                          I have read and agree to the{" "}
                          <TermsModal
                            type="terms"
                            triggerText="Terms & Conditions"
                            triggerClassName="text-[oklch(var(--individual-accent))]"
                            ocid="register_individual.terms_link"
                          />
                        </label>
                        <FieldError
                          msg={errors.termsAccepted}
                          ocid="register_individual.terms_checkbox.field_error"
                        />
                      </div>
                    </div>

                    <div
                      className="flex items-start gap-3"
                      data-ocid="register_individual.privacy_checkbox_row"
                    >
                      <Checkbox
                        id="privacyAccepted"
                        checked={draft.privacyAccepted}
                        onCheckedChange={(checked) =>
                          set("privacyAccepted", Boolean(checked))
                        }
                        data-ocid="register_individual.privacy_checkbox"
                        className="mt-0.5"
                      />
                      <div>
                        <label
                          htmlFor="privacyAccepted"
                          className="text-sm text-foreground cursor-pointer"
                        >
                          I have read and agree to the{" "}
                          <TermsModal
                            type="privacy"
                            triggerText="Privacy Policy"
                            triggerClassName="text-[oklch(var(--individual-accent))]"
                            ocid="register_individual.privacy_link"
                          />
                        </label>
                        <FieldError
                          msg={errors.privacyAccepted}
                          ocid="register_individual.privacy_checkbox.field_error"
                        />
                      </div>
                    </div>
                    <div
                      className="flex items-start gap-3"
                      data-ocid="register_individual.ndpr_checkbox_row"
                    >
                      <Checkbox
                        id="ndpr"
                        checked={draft.ndprAccepted}
                        onCheckedChange={(v) => set("ndprAccepted", !!v)}
                        data-ocid="register_individual.ndpr_checkbox"
                        className="mt-0.5"
                      />
                      <div>
                        <label
                          htmlFor="ndpr"
                          className="text-sm text-foreground cursor-pointer"
                        >
                          I consent to the processing of my personal data in
                          compliance with the{" "}
                          <strong className="font-medium">
                            Nigeria Data Protection Regulation (NDPR)
                          </strong>
                          .
                        </label>
                        <FieldError
                          msg={errors.ndprAccepted}
                          ocid="register_individual.ndpr_checkbox.field_error"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 4: Review & Submit ────────────────────────────────── */}
              {step === 5 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold font-display text-foreground">
                      Review &amp; Submit
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Step 6 of 6 \u2014 Confirm your details before submitting
                    </p>
                  </div>

                  <div className="space-y-3">
                    <SummarySection
                      title="Personal Identity"
                      onEdit={() => editStep(0)}
                      ocid="register_individual.summary_identity"
                    >
                      <SummaryRow label="Full Name" value={draft.fullName} />
                      <SummaryRow
                        label="Date of Birth"
                        value={draft.dateOfBirth}
                      />
                      <SummaryRow label="Address" value={draft.address} />
                      <SummaryRow label="Occupation" value={draft.occupation} />
                      <SummaryRow
                        label="Employment Status"
                        value={employmentLabel}
                      />
                      {draft.employmentStatus === EmploymentStatus.employed && (
                        <SummaryRow
                          label="Employer Name"
                          value={draft.employerName}
                        />
                      )}
                    </SummarySection>

                    <SummarySection
                      title="Identity Verification"
                      onEdit={() => editStep(1)}
                      ocid="register_individual.summary_verification"
                    >
                      <SummaryRow label="BVN" value={maskId(draft.bvn)} />
                      <SummaryRow label="NIN" value={maskId(draft.nin)} />
                    </SummarySection>

                    <SummarySection
                      title="Financing Details"
                      onEdit={() => editStep(2)}
                      ocid="register_individual.summary_financing"
                    >
                      <SummaryRow
                        label="Purpose"
                        value={
                          draft.financingPurpose === FinancingPurpose.other
                            ? `Other: ${draft.otherPurpose}`
                            : purposeLabel
                        }
                      />
                      <SummaryRow
                        label="Amount Sought"
                        value={
                          draft.amountSought
                            ? `\u20a6${Number(draft.amountSought).toLocaleString()}`
                            : ""
                        }
                      />
                      <SummaryRow
                        label="Monthly Income"
                        value={
                          draft.monthlyIncome
                            ? `\u20a6${Number(draft.monthlyIncome).toLocaleString()}`
                            : ""
                        }
                      />
                      <SummaryRow
                        label="Income Source"
                        value={incomeSourceLabel}
                      />
                      <SummaryRow
                        label="Instrument"
                        value={
                          selectedInstrument
                            ? `${selectedInstrument.nameEn} (${selectedInstrument.nameAr})`
                            : ""
                        }
                      />
                    </SummarySection>

                    <SummarySection
                      title="Terms &amp; Compliance"
                      onEdit={() => editStep(3)}
                      ocid="register_individual.summary_terms"
                    >
                      <SummaryRow
                        label="Terms &amp; Conditions"
                        value={
                          draft.termsAccepted ? "Accepted" : "Not accepted"
                        }
                      />
                      <SummaryRow
                        label="Privacy Policy"
                        value={
                          draft.privacyAccepted ? "Accepted" : "Not accepted"
                        }
                      />
                      <SummaryRow
                        label="NDPR Consent"
                        value={
                          draft.ndprAccepted ? "Consented" : "Not consented"
                        }
                      />
                    </SummarySection>
                  </div>

                  {/* What Tawthiq will verify */}
                  <div
                    className="mt-5 rounded-xl border px-4 py-4"
                    style={{
                      borderColor: "oklch(var(--individual-accent) / 0.2)",
                      background: "oklch(var(--individual-accent) / 0.04)",
                    }}
                    data-ocid="register_individual.tawthiq_checklist"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Info
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: "oklch(var(--individual-accent))" }}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        Tawthiq (\u0627\u0644\u062a\u0648\u062b\u064a\u0642)
                        will verify:
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {[
                        "BVN identity check via Mono",
                        "NIN verification with NIMC via Mono",
                        "Watchlist screening for financial crime",
                        "Shariah compliance of income sources and financing purpose",
                        "Credit readiness assessment",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2
                            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                            style={{
                              color: "oklch(var(--individual-accent))",
                            }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Submit error */}
                  {submitError && (
                    <div
                      className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
                      data-ocid="register_individual.error_state"
                    >
                      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-destructive font-medium">
                          Submission failed
                        </p>
                        <p className="text-xs text-destructive/80 mt-0.5">
                          {submitError}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        className="text-xs text-destructive font-medium hover:underline flex-shrink-0"
                        data-ocid="register_individual.retry_button"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Navigation buttons ─────────────────────────────────────── */}
            <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={
                  step === 0 ? () => router.navigate({ to: "/" }) : handleBack
                }
                data-ocid="register_individual.back_button"
              >
                {step === 0 ? "Cancel" : "\u2190 Back"}
              </Button>

              {step < 5 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={
                    step === 4 &&
                    (!draft.termsAccepted ||
                      !draft.privacyAccepted ||
                      !draft.ndprAccepted)
                  }
                  style={{
                    background: "oklch(var(--individual-accent))",
                    color: "oklch(var(--individual-accent-foreground))",
                  }}
                  data-ocid="register_individual.next_button"
                >
                  {returnToSummary
                    ? "Return to Summary \u2192"
                    : step === 4
                      ? "Next \u2192"
                      : "Continue \u2192"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !actor}
                  className="gap-2 min-w-[160px]"
                  style={{
                    background: "oklch(var(--individual-accent))",
                    color: "oklch(var(--individual-accent-foreground))",
                  }}
                  data-ocid="register_individual.submit_button"
                >
                  {isSubmitting && <LoadingSpinner size="sm" label="" />}
                  {isSubmitting ? "Submitting\u2026" : "Submit Application"}
                </Button>
              )}
            </div>

            {/* Step counter */}
            <p className="text-center text-xs text-muted-foreground mt-4">
              Step {step + 1} of {STEPS.length} \u2014{" "}
              <span style={{ color: "oklch(var(--individual-accent))" }}>
                {STEPS[step].label}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Applicant icon accent */}
        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
          <User
            className="h-3.5 w-3.5"
            style={{ color: "oklch(var(--individual-accent))" }}
          />
          <span>Individual financing applicant pathway</span>
        </div>
      </div>
    </Layout>
  );
}
