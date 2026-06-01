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
import {
  validateBvn,
  validateCac,
  validateNin,
  validateTin,
} from "@/utils/validation";
import { useRouter } from "@tanstack/react-router";
import { CheckCircle2, Info, Lightbulb } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TermsModal } from "../components/TermsModal";

// ── Types ────────────────────────────────────────────────────────────────────

type BusinessCategory = "LLC" | "BusinessName" | "";

interface Director {
  directorName: string;
  bvn: string;
  nin: string;
  nationality: string;
  ownershipPercentage: string;
}

interface InstrumentDef {
  value: string;
  nameEn: string;
  nameAr: string;
  description: string;
  example: string;
}

const INSTRUMENTS: InstrumentDef[] = [
  {
    value: "Murabaha",
    nameEn: "Murabaha",
    nameAr: "\u0627\u0644\u0645\u0631\u0627\u0628\u062d\u0629",
    description:
      "The financier buys an asset for you and sells it at an agreed marked-up price, paid in instalments \u2014 you know the profit margin upfront.",
    example:
      "A textile trader in Lagos needs a \u20a65M loom. The financier buys it and sells it to the trader for \u20a65.8M payable over 12 months.",
  },
  {
    value: "Musharakah",
    nameEn: "Musharakah",
    nameAr: "\u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629",
    description:
      "A joint partnership where both you and the financier contribute capital. Profits are shared by an agreed ratio; losses are borne proportionally.",
    example:
      "A food processing company and a financier each contribute \u20a610M to expand production capacity. Profits are split 60/40.",
  },
  {
    value: "Mudarabah",
    nameEn: "Mudarabah",
    nameAr: "\u0627\u0644\u0645\u0636\u0627\u0631\u0628\u0629",
    description:
      "The financier provides all the capital while you provide expertise and management. Profits are shared; the financier bears capital loss if you manage honestly.",
    example:
      "A logistics startup in Abuja receives \u20a68M from a financier. The founder manages all operations. Profits are split 70/30.",
  },
  {
    value: "Ijarah",
    nameEn: "Ijarah",
    nameAr: "\u0627\u0644\u0625\u062c\u0627\u0631\u0629",
    description:
      "The financier buys an asset and leases it to you at a fixed monthly rental. Ownership stays with the financier for the lease duration.",
    example:
      "A private clinic in Kano needs an MRI machine. The financier buys it and leases it at \u20a6200K/month for 3 years.",
  },
  {
    value: "Istisna",
    nameEn: "Istisna\u2019",
    nameAr: "\u0627\u0644\u0627\u0633\u062a\u0635\u0646\u0627\u0639",
    description:
      "Financing for manufacturing or construction \u2014 the financier pays you to produce something to a specification for later delivery.",
    example:
      "A construction company in Port Harcourt is contracted to build a warehouse. The financier pays in stages as construction progresses.",
  },
  {
    value: "Salam",
    nameEn: "Salam",
    nameAr: "\u0627\u0644\u0633\u0644\u0645",
    description:
      "Full advance payment for goods to be delivered at a later date \u2014 commonly used in agriculture.",
    example:
      "A rice farmer in Kebbi State receives full payment now for 50 tonnes of rice to be delivered at harvest.",
  },
];

const STEPS = [
  { label: "Business Type" },
  { label: "Business Identity" },
  { label: "Business Description" },
  { label: "Directors / Proprietor" },
  { label: "Financial Information" },
  { label: "Review & Submit" },
];

const NATIONALITIES = [
  "Nigerian",
  "Ghanaian",
  "Kenyan",
  "South African",
  "British",
  "American",
  "Other",
];

// ── Progress Bar ─────────────────────────────────────────────────────────────

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8" data-ocid="register_business.progress">
      <div className="flex items-center gap-0 mb-3">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                i < current
                  ? "bg-primary text-primary-foreground"
                  : i === current
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
              }`}
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
                className={`flex-1 h-0.5 mx-1 transition-colors duration-300 ${i < current ? "bg-primary" : "bg-border"}`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {STEPS.map((step, i) => (
          <span
            key={step.label}
            className={`text-xs font-medium transition-colors min-w-0 truncate ${
              i === current
                ? "text-primary"
                : i < current
                  ? "text-muted-foreground"
                  : "text-muted-foreground/50"
            }`}
            style={{
              width: `${100 / total}%`,
              textAlign:
                i === 0 ? "left" : i === total - 1 ? "right" : "center",
            }}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Radio Card ────────────────────────────────────────────────────────────────

function RadioCard({
  selected,
  onClick,
  title,
  subtitle,
  ocid,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  ocid: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-ocid={ocid}
      className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-200 ${
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            selected ? "border-primary" : "border-muted-foreground/40"
          }`}
        >
          {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
        </div>
        <div>
          <p className="font-semibold text-foreground font-display">{title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

// ── Field Error ────────────────────────────────────────────────────────────────

// ── Instrument Card ───────────────────────────────────────────────────────────

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
      data-ocid={`register_business.instrument_card.${index + 1}`}
      aria-pressed={selected}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
        selected
          ? "border-primary bg-primary/5 shadow-md dark:bg-primary/10"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            selected ? "border-primary" : "border-muted-foreground/40"
          }`}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
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

// ── Summary Helpers ──────────────────────────────────────────────────────────

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
          className="text-xs text-primary font-medium hover:underline"
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
      <span className="text-xs text-muted-foreground w-36 flex-shrink-0">
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

function FieldError({ msg, ocid }: { msg: string | undefined; ocid: string }) {
  if (!msg) return null;
  return (
    <p className="text-xs text-destructive mt-1" data-ocid={ocid}>
      {msg}
    </p>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const LS_KEY = "vetify_business_draft";
const OLD_LS_KEY = "halalvet_business_draft";

export default function RegisterBusinessPage() {
  const { actor } = useBackend();
  const { refetch } = useUserRole();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returnToSummary, setReturnToSummary] = useState(false);

  // Step 0
  const [businessCategory, setBusinessCategory] =
    useState<BusinessCategory>("");
  const [catError, setCatError] = useState("");

  // Step 1
  const [businessName, setBusinessName] = useState("");
  const [cacNumber, setCacNumber] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [address, setAddress] = useState("");
  const [yearOfIncorporation, setYearOfIncorporation] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});

  // Step 2
  const [businessDescription, setBusinessDescription] = useState("");
  const [descError, setDescError] = useState("");

  // Step 3
  const [directors, setDirectors] = useState<Director[]>([
    {
      directorName: "",
      bvn: "",
      nin: "",
      nationality: "Nigerian",
      ownershipPercentage: "",
    },
  ]);
  const [proprietorName, setProprietorName] = useState("");
  const [proprietorBvn, setProprietorBvn] = useState("");
  const [proprietorNin, setProprietorNin] = useState("");
  const [step4Errors, setStep4Errors] = useState<Record<string, string>>({});

  // Step 4
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [displayAnnualRevenue, setDisplayAnnualRevenue] = useState("");
  const [financingAmount, setFinancingAmount] = useState("");
  const [displayFinancingAmount, setDisplayFinancingAmount] = useState("");
  const [purposeOfFinancing, setPurposeOfFinancing] = useState("");
  const [preferredInstrument, setPreferredInstrument] = useState("");
  const [step5Errors, setStep5Errors] = useState<Record<string, string>>({});

  // Step 5 — compliance
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ndprAccepted, setNdprAccepted] = useState(false);
  const [complianceError, setComplianceError] = useState("");

  // ── localStorage restore on mount ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(LS_KEY) || localStorage.getItem(OLD_LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.businessCategory === "string")
        setBusinessCategory(d.businessCategory as BusinessCategory);
      if (typeof d.businessName === "string") setBusinessName(d.businessName);
      if (typeof d.cacNumber === "string") setCacNumber(d.cacNumber);
      if (typeof d.tinNumber === "string") setTinNumber(d.tinNumber);
      if (typeof d.address === "string") setAddress(d.address);
      if (typeof d.yearOfIncorporation === "string")
        setYearOfIncorporation(d.yearOfIncorporation);
      if (typeof d.contactPerson === "string")
        setContactPerson(d.contactPerson);
      if (typeof d.phoneNumber === "string") setPhoneNumber(d.phoneNumber);
      if (typeof d.businessDescription === "string")
        setBusinessDescription(d.businessDescription);
      if (Array.isArray(d.directors)) setDirectors(d.directors as Director[]);
      if (typeof d.proprietorName === "string")
        setProprietorName(d.proprietorName);
      if (typeof d.proprietorBvn === "string")
        setProprietorBvn(d.proprietorBvn);
      if (typeof d.proprietorNin === "string")
        setProprietorNin(d.proprietorNin);
      if (typeof d.annualRevenue === "string")
        setAnnualRevenue(d.annualRevenue);
      if (typeof d.financingAmount === "string")
        setFinancingAmount(d.financingAmount);
      if (typeof d.purposeOfFinancing === "string")
        setPurposeOfFinancing(d.purposeOfFinancing);
      if (typeof d.preferredInstrument === "string")
        setPreferredInstrument(d.preferredInstrument);
    } catch {
      /* ignore parse errors */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced auto-save ───────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraft = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({
            businessCategory,
            businessName,
            cacNumber,
            tinNumber,
            address,
            yearOfIncorporation,
            contactPerson,
            phoneNumber,
            businessDescription,
            directors,
            proprietorName,
            proprietorBvn,
            proprietorNin,
            annualRevenue,
            financingAmount,
            purposeOfFinancing,
            preferredInstrument,
          }),
        );
      } catch {
        /* quota exceeded — ignore */
      }
    }, 500);
  }, [
    businessCategory,
    businessName,
    cacNumber,
    tinNumber,
    address,
    yearOfIncorporation,
    contactPerson,
    phoneNumber,
    businessDescription,
    directors,
    proprietorName,
    proprietorBvn,
    proprietorNin,
    annualRevenue,
    financingAmount,
    purposeOfFinancing,
    preferredInstrument,
  ]);

  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  // ── Validation ────────────────────────────────────────────────────────────

  const validateStep1 = () => {
    if (!businessCategory) {
      setCatError("Please select a business type to continue");
      return false;
    }
    setCatError("");
    return true;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    if (!businessName.trim()) errs.businessName = "Business name is required";
    if (!cacNumber.trim()) {
      errs.cacNumber = "CAC number is required";
    } else if (validateCac(cacNumber)) {
      errs.cacNumber = validateCac(cacNumber) as string;
    }
    if (!tinNumber.trim()) {
      errs.tinNumber = "TIN is required";
    } else if (validateTin(tinNumber)) {
      errs.tinNumber = validateTin(tinNumber) as string;
    }
    if (!address.trim()) errs.address = "Address is required";
    if (!contactPerson.trim())
      errs.contactPerson = "Contact person is required";
    if (!phoneNumber.trim()) errs.phoneNumber = "Phone number is required";
    const yr = Number(yearOfIncorporation);
    if (!yearOfIncorporation.trim()) {
      errs.yearOfIncorporation = "Year of incorporation is required";
    } else if (
      !/^\d{4}$/.test(yearOfIncorporation) ||
      yr < 1900 ||
      yr > new Date().getFullYear()
    ) {
      errs.yearOfIncorporation = "Enter a valid 4-digit year";
    }
    setStep2Errors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = () => {
    if (businessDescription.trim().length < 50) {
      setDescError(
        "Description must be at least 50 characters to enable Shariah compliance screening",
      );
      return false;
    }
    setDescError("");
    return true;
  };

  const validateStep4 = () => {
    const errs: Record<string, string> = {};
    if (businessCategory === "LLC") {
      directors.forEach((d, i) => {
        if (!d.directorName.trim())
          errs[`dir_${i}_name`] = "Director name required";
        if (d.bvn && validateBvn(d.bvn))
          errs[`dir_${i}_bvn`] = validateBvn(d.bvn) as string;
        if (d.nin && validateNin(d.nin))
          errs[`dir_${i}_nin`] = validateNin(d.nin) as string;
        const pct = Number(d.ownershipPercentage);
        if (
          d.ownershipPercentage &&
          (Number.isNaN(pct) || pct < 0 || pct > 100)
        )
          errs[`dir_${i}_pct`] = "Must be 0–100";
      });
    } else {
      if (!proprietorName.trim())
        errs.proprietorName = "Proprietor name required";
      if (proprietorBvn && validateBvn(proprietorBvn))
        errs.proprietorBvn = validateBvn(proprietorBvn) as string;
      if (proprietorNin && validateNin(proprietorNin))
        errs.proprietorNin = validateNin(proprietorNin) as string;
    }
    setStep4Errors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep5 = () => {
    const errs: Record<string, string> = {};
    if (!annualRevenue.trim() || Number.isNaN(Number(annualRevenue)))
      errs.annualRevenue = "Annual revenue is required";
    if (!financingAmount.trim() || Number.isNaN(Number(financingAmount)))
      errs.financingAmount = "Financing amount is required";
    if (!purposeOfFinancing.trim())
      errs.purposeOfFinancing = "Purpose of financing is required";
    if (!preferredInstrument)
      errs.preferredInstrument = "Please select a financing instrument";
    setStep5Errors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleNext = () => {
    const validators = [
      validateStep1,
      validateStep2,
      validateStep3,
      validateStep4,
      validateStep5,
    ];
    if (validators[step]?.()) {
      if (returnToSummary) {
        setReturnToSummary(false);
        setStep(5);
      } else {
        setStep((s) => s + 1);
      }
    }
  };

  const handleBack = () => {
    if (returnToSummary) {
      setReturnToSummary(false);
      setStep(5);
    } else {
      setStep((s) => Math.max(0, s - 1));
    }
  };

  const editStep = (targetStep: number) => {
    setReturnToSummary(true);
    setStep(targetStep);
  };

  const addDirector = () =>
    setDirectors((prev) => [
      ...prev,
      {
        directorName: "",
        bvn: "",
        nin: "",
        nationality: "Nigerian",
        ownershipPercentage: "",
      },
    ]);

  const removeDirector = (i: number) =>
    setDirectors((prev) => prev.filter((_, idx) => idx !== i));

  const updateDirector = (i: number, field: keyof Director, val: string) =>
    setDirectors((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, [field]: val } : d)),
    );

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!actor) {
      toast.error("Please connect your wallet before submitting.");
      return;
    }
    if (!termsAccepted || !privacyAccepted || !ndprAccepted) {
      setComplianceError("Please accept all terms and conditions to proceed");
      return;
    }
    setComplianceError("");
    setIsSubmitting(true);
    try {
      const directorsList =
        businessCategory === "LLC"
          ? directors.map((d) => ({
              directorName: d.directorName,
              bvn: d.bvn,
              nin: d.nin,
              nationality: d.nationality,
              ownershipPercentage: Number(d.ownershipPercentage) || 0,
            }))
          : [];

      const proprietorDetails: {
        proprietorName: string;
        bvn: string;
        nin: string;
      } | null =
        businessCategory === "BusinessName"
          ? { proprietorName, bvn: proprietorBvn, nin: proprietorNin }
          : null;

      const result = await actor.submitBusinessRegistrationWithKyc(
        businessName,
        cacNumber,
        businessCategory,
        BigInt(Math.round(Number(annualRevenue))),
        contactPerson,
        address,
        phoneNumber,
        businessCategory === "LLC" ? (directors[0]?.bvn ?? "") : proprietorBvn,
        businessCategory === "LLC" ? (directors[0]?.nin ?? "") : proprietorNin,
        tinNumber,
        businessDescription,
        yearOfIncorporation,
        BigInt(Math.round(Number(financingAmount))),
        purposeOfFinancing,
        preferredInstrument,
        directorsList,
        proprietorDetails,
      );
      if ("err" in result) {
        toast.error(
          result.err instanceof Error ? result.err.message : String(result.err),
        );
        setIsSubmitting(false);
        return;
      }
      localStorage.removeItem(LS_KEY);
      await refetch();
      toast.success(
        "Business registration submitted! Tawthiq is now verifying your details.",
      );
      router.navigate({ to: "/business/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedInstrument = INSTRUMENTS.find(
    (i) => i.value === preferredInstrument,
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <PageHeader
          title="Business Registration"
          subtitle="التسجيل التجاري — Register for halal financing vetting via Tawthiq"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Register Business" },
          ]}
        />

        <Card className="shadow-lg">
          <CardContent className="pt-8 pb-8 px-6 sm:px-8">
            <StepProgress current={step} total={6} />

            <AnimatePresence mode="wait">
              {/* ── Step 0: Business Type ── */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Business Type
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Select your legal business structure registered with the
                    CAC.
                  </p>
                  <div className="space-y-3">
                    <RadioCard
                      selected={businessCategory === "LLC"}
                      onClick={() => {
                        setBusinessCategory("LLC");
                        setCatError("");
                      }}
                      title="Limited Liability Company (LLC)"
                      subtitle="A company with one or more directors and shareholders. CAC registered with an RC number."
                      ocid="register_business.type_llc"
                    />
                    <RadioCard
                      selected={businessCategory === "BusinessName"}
                      onClick={() => {
                        setBusinessCategory("BusinessName");
                        setCatError("");
                      }}
                      title="Business Name"
                      subtitle="A sole proprietorship or trading name registered with the CAC under a BN number."
                      ocid="register_business.type_business_name"
                    />
                  </div>
                  {catError && (
                    <p
                      className="text-xs text-destructive mt-3"
                      data-ocid="register_business.type_error"
                    >
                      {catError}
                    </p>
                  )}
                </motion.div>
              )}

              {/* ── Step 1: Business Identity ── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Business Identity
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Provide your CAC-registered business details.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="businessName">Business Name *</Label>
                      <Input
                        id="businessName"
                        placeholder="Al-Noor Trading Ltd."
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        data-ocid="register_business.business_name_input"
                      />
                      <FieldError
                        msg={step2Errors.businessName}
                        ocid="register_business.business_name_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cacNumber">
                        CAC Registration Number *
                      </Label>
                      <Input
                        id="cacNumber"
                        placeholder="RC-1234567 or BN-1234567"
                        value={cacNumber}
                        onChange={(e) => setCacNumber(e.target.value)}
                        data-ocid="register_business.cac_number_input"
                      />
                      <FieldError
                        msg={step2Errors.cacNumber}
                        ocid="register_business.cac_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tinNumber">TIN *</Label>
                      <Input
                        id="tinNumber"
                        placeholder="12345678-0001"
                        value={tinNumber}
                        onChange={(e) => setTinNumber(e.target.value)}
                        data-ocid="register_business.tin_input"
                      />
                      <FieldError
                        msg={step2Errors.tinNumber}
                        ocid="register_business.tin_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="yearOfIncorporation">
                        Year of Incorporation *
                      </Label>
                      <Input
                        id="yearOfIncorporation"
                        placeholder="2018"
                        maxLength={4}
                        value={yearOfIncorporation}
                        onChange={(e) => setYearOfIncorporation(e.target.value)}
                        data-ocid="register_business.year_input"
                      />
                      <FieldError
                        msg={step2Errors.yearOfIncorporation}
                        ocid="register_business.year_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contactPerson">Contact Person *</Label>
                      <Input
                        id="contactPerson"
                        placeholder="Musa Abdullahi"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        data-ocid="register_business.contact_person_input"
                      />
                      <FieldError
                        msg={step2Errors.contactPerson}
                        ocid="register_business.contact_person_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phoneNumber">Phone Number *</Label>
                      <Input
                        id="phoneNumber"
                        placeholder="+2348012345678"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        data-ocid="register_business.phone_number_input"
                      />
                      <FieldError
                        msg={step2Errors.phoneNumber}
                        ocid="register_business.phone_number_error"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="address">Business Address *</Label>
                      <Input
                        id="address"
                        placeholder="Plot 5, Industrial Layout, Kano"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        data-ocid="register_business.address_input"
                      />
                      <FieldError
                        msg={step2Errors.address}
                        ocid="register_business.address_error"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Business Description ── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Business Description
                  </h2>
                  <div className="flex items-start gap-2 mb-5 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <span className="text-lg">🔍</span>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        Tawthiq التوثيق
                      </span>{" "}
                      uses this description to screen your business activities
                      for Shariah compliance. Be thorough and accurate.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="businessDescription">
                      Describe your business *
                    </Label>
                    <Textarea
                      id="businessDescription"
                      placeholder="Describe your principal business activities, products or services, target market, and how your business generates revenue. Include any relevant industry sector information..."
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      className="min-h-[180px] resize-y"
                      data-ocid="register_business.description_input"
                    />
                    <div className="flex justify-between items-center mt-1">
                      <FieldError
                        msg={descError}
                        ocid="register_business.description_error"
                      />
                      <span
                        className={`text-xs ml-auto ${businessDescription.trim().length >= 50 ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {businessDescription.trim().length} / 50 min
                      </span>
                    </div>
                  </div>

                  {/* Example block */}
                  <div
                    className="mt-4 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:border-amber-500/20 dark:bg-amber-500/5 p-4"
                    data-ocid="register_business.description_example"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Example
                      </span>
                    </div>
                    <p className="text-xs text-amber-900/80 dark:text-amber-200/70 leading-relaxed italic">
                      &ldquo;GreenGro Nigeria Ltd is an agro-processing company
                      based in Kano State. We purchase raw groundnuts from
                      smallholder farmers, process them into groundnut oil and
                      cake at our factory, and sell to distributors and
                      retailers across northern Nigeria. Our revenue comes from
                      product sales — we do not engage in any interest-based
                      transactions. We are seeking financing to expand our
                      processing capacity and purchase additional
                      equipment.&rdquo;
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Directors / Proprietor ── */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  {businessCategory === "LLC" ? (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <h2 className="font-display text-lg font-semibold text-foreground">
                          Directors
                        </h2>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addDirector}
                          data-ocid="register_business.add_director_button"
                        >
                          + Add Director
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-5">
                        Provide details for all company directors. At least one
                        director is required.
                      </p>
                      <div className="space-y-5">
                        {directors.map((dir, i) => (
                          <div
                            key={dir.bvn || String(i)}
                            className="p-4 rounded-xl border border-border bg-muted/20"
                            data-ocid={`register_business.director.${i + 1}`}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-sm font-semibold text-foreground">
                                Director {i + 1}
                              </span>
                              {directors.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeDirector(i)}
                                  className="text-xs text-destructive hover:underline"
                                  data-ocid={`register_business.remove_director.${i + 1}`}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-1.5 sm:col-span-2">
                                <Label>Full Name *</Label>
                                <Input
                                  placeholder="Ibrahim Al-Siddiq"
                                  value={dir.directorName}
                                  onChange={(e) =>
                                    updateDirector(
                                      i,
                                      "directorName",
                                      e.target.value,
                                    )
                                  }
                                  data-ocid={`register_business.director_name.${i + 1}`}
                                />
                                <FieldError
                                  msg={step4Errors[`dir_${i}_name`]}
                                  ocid={`register_business.director_name_error.${i + 1}`}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>BVN</Label>
                                <Input
                                  placeholder="22123456789"
                                  value={dir.bvn}
                                  onChange={(e) =>
                                    updateDirector(i, "bvn", e.target.value)
                                  }
                                  data-ocid={`register_business.director_bvn.${i + 1}`}
                                />
                                <FieldError
                                  msg={step4Errors[`dir_${i}_bvn`]}
                                  ocid={`register_business.director_bvn_error.${i + 1}`}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>NIN</Label>
                                <Input
                                  placeholder="12345678901"
                                  value={dir.nin}
                                  onChange={(e) =>
                                    updateDirector(i, "nin", e.target.value)
                                  }
                                  data-ocid={`register_business.director_nin.${i + 1}`}
                                />
                                <FieldError
                                  msg={step4Errors[`dir_${i}_nin`]}
                                  ocid={`register_business.director_nin_error.${i + 1}`}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Nationality</Label>
                                <Select
                                  value={dir.nationality}
                                  onValueChange={(v) =>
                                    updateDirector(i, "nationality", v)
                                  }
                                >
                                  <SelectTrigger
                                    data-ocid={`register_business.director_nationality.${i + 1}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {NATIONALITIES.map((n) => (
                                      <SelectItem key={n} value={n}>
                                        {n}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Ownership %</Label>
                                <Input
                                  type="number"
                                  placeholder="25"
                                  min="0"
                                  max="100"
                                  value={dir.ownershipPercentage}
                                  onChange={(e) =>
                                    updateDirector(
                                      i,
                                      "ownershipPercentage",
                                      e.target.value,
                                    )
                                  }
                                  data-ocid={`register_business.director_pct.${i + 1}`}
                                />
                                <FieldError
                                  msg={step4Errors[`dir_${i}_pct`]}
                                  ocid={`register_business.director_pct_error.${i + 1}`}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                        Proprietor Details
                      </h2>
                      <p className="text-sm text-muted-foreground mb-5">
                        Provide the details of the sole proprietor of this
                        business.
                      </p>
                      <div className="grid gap-5">
                        <div className="space-y-1.5">
                          <Label htmlFor="proprietorName">Full Name *</Label>
                          <Input
                            id="proprietorName"
                            placeholder="Amina Yusuf"
                            value={proprietorName}
                            onChange={(e) => setProprietorName(e.target.value)}
                            data-ocid="register_business.proprietor_name_input"
                          />
                          <FieldError
                            msg={step4Errors.proprietorName}
                            ocid="register_business.proprietor_name_error"
                          />
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="proprietorBvn">BVN</Label>
                            <Input
                              id="proprietorBvn"
                              placeholder="22123456789"
                              value={proprietorBvn}
                              onChange={(e) => setProprietorBvn(e.target.value)}
                              data-ocid="register_business.proprietor_bvn_input"
                            />
                            <FieldError
                              msg={step4Errors.proprietorBvn}
                              ocid="register_business.proprietor_bvn_error"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="proprietorNin">NIN</Label>
                            <Input
                              id="proprietorNin"
                              placeholder="12345678901"
                              value={proprietorNin}
                              onChange={(e) => setProprietorNin(e.target.value)}
                              data-ocid="register_business.proprietor_nin_input"
                            />
                            <FieldError
                              msg={step4Errors.proprietorNin}
                              ocid="register_business.proprietor_nin_error"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* ── Step 4: Financial Information ── */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Financial Information
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Provide your financing needs and current financial standing.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="annualRevenue">
                        Annual Revenue (NGN) *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                          ₦
                        </span>
                        <Input
                          id="annualRevenue"
                          inputMode="numeric"
                          placeholder="5,000,000"
                          className="pl-7"
                          value={displayAnnualRevenue}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            setAnnualRevenue(raw);
                            setDisplayAnnualRevenue(
                              raw ? Number(raw).toLocaleString("en-NG") : "",
                            );
                          }}
                          data-ocid="register_business.annual_revenue_input"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enter your annual business revenue
                      </p>
                      <FieldError
                        msg={step5Errors.annualRevenue}
                        ocid="register_business.annual_revenue_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="financingAmount">
                        Financing Amount (NGN) *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                          ₦
                        </span>
                        <Input
                          id="financingAmount"
                          inputMode="numeric"
                          placeholder="2,000,000"
                          className="pl-7"
                          value={displayFinancingAmount}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            setFinancingAmount(raw);
                            setDisplayFinancingAmount(
                              raw ? Number(raw).toLocaleString("en-NG") : "",
                            );
                          }}
                          data-ocid="register_business.financing_amount_input"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enter the total financing amount you need
                      </p>
                      <FieldError
                        msg={step5Errors.financingAmount}
                        ocid="register_business.financing_amount_error"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="purposeOfFinancing">
                        Purpose of Financing *
                      </Label>
                      <Input
                        id="purposeOfFinancing"
                        placeholder="Purchase of commercial vehicles for logistics operations"
                        value={purposeOfFinancing}
                        onChange={(e) => setPurposeOfFinancing(e.target.value)}
                        data-ocid="register_business.purpose_input"
                      />
                      <FieldError
                        msg={step5Errors.purposeOfFinancing}
                        ocid="register_business.purpose_error"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Preferred Islamic Financing Instrument *</Label>
                      <p className="text-xs text-muted-foreground -mt-1">
                        Select the financing structure that best fits your
                        business needs.
                      </p>
                      <div
                        className="grid gap-3 mt-2"
                        data-ocid="register_business.instrument_list"
                      >
                        {INSTRUMENTS.map((inst, idx) => (
                          <InstrumentCard
                            key={inst.value}
                            inst={inst}
                            selected={preferredInstrument === inst.value}
                            onSelect={() => {
                              setPreferredInstrument(inst.value);
                              setStep5Errors((e) => ({
                                ...e,
                                preferredInstrument: "",
                              }));
                            }}
                            index={idx}
                          />
                        ))}
                      </div>
                      <FieldError
                        msg={step5Errors.preferredInstrument}
                        ocid="register_business.instrument_error"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 5: Review & Submit ── */}
              {step === 5 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Review Your Application
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Please confirm your details before submitting. You can edit
                    any section.
                  </p>

                  <div className="space-y-3">
                    <SummarySection
                      title="Business Type"
                      onEdit={() => editStep(0)}
                      ocid="register_business.summary_type"
                    >
                      <SummaryRow
                        label="Type"
                        value={
                          businessCategory === "LLC"
                            ? "Limited Liability Company (LLC)"
                            : "Business Name"
                        }
                      />
                    </SummarySection>

                    <SummarySection
                      title="Business Identity"
                      onEdit={() => editStep(1)}
                      ocid="register_business.summary_identity"
                    >
                      <SummaryRow label="Business Name" value={businessName} />
                      <SummaryRow label="CAC Number" value={cacNumber} />
                      <SummaryRow label="TIN" value={tinNumber} />
                      <SummaryRow label="Address" value={address} />
                      <SummaryRow
                        label="Year of Incorporation"
                        value={yearOfIncorporation}
                      />
                      <SummaryRow
                        label="Contact Person"
                        value={contactPerson}
                      />
                      <SummaryRow label="Phone Number" value={phoneNumber} />
                    </SummarySection>

                    <SummarySection
                      title="Business Description"
                      onEdit={() => editStep(2)}
                      ocid="register_business.summary_description"
                    >
                      <p className="text-xs text-foreground/80 leading-relaxed break-words">
                        {businessDescription || "\u2014"}
                      </p>
                    </SummarySection>

                    <SummarySection
                      title={
                        businessCategory === "LLC" ? "Directors" : "Proprietor"
                      }
                      onEdit={() => editStep(3)}
                      ocid="register_business.summary_directors"
                    >
                      {businessCategory === "LLC" ? (
                        directors.map((d, i) => (
                          <div
                            key={d.bvn || d.directorName || String(i)}
                            className={
                              i > 0 ? "pt-2 mt-2 border-t border-border" : ""
                            }
                          >
                            <p className="text-xs font-semibold text-muted-foreground mb-1">
                              Director {i + 1}
                            </p>
                            <SummaryRow label="Name" value={d.directorName} />
                            <SummaryRow label="BVN" value={maskId(d.bvn)} />
                            <SummaryRow label="NIN" value={maskId(d.nin)} />
                            <SummaryRow
                              label="Nationality"
                              value={d.nationality}
                            />
                            <SummaryRow
                              label="Ownership"
                              value={
                                d.ownershipPercentage
                                  ? `${d.ownershipPercentage}%`
                                  : "\u2014"
                              }
                            />
                          </div>
                        ))
                      ) : (
                        <>
                          <SummaryRow label="Name" value={proprietorName} />
                          <SummaryRow
                            label="BVN"
                            value={maskId(proprietorBvn)}
                          />
                          <SummaryRow
                            label="NIN"
                            value={maskId(proprietorNin)}
                          />
                        </>
                      )}
                    </SummarySection>

                    <SummarySection
                      title="Financial Information"
                      onEdit={() => editStep(4)}
                      ocid="register_business.summary_financial"
                    >
                      <SummaryRow
                        label="Annual Revenue"
                        value={
                          annualRevenue
                            ? `\u20a6${Number(annualRevenue).toLocaleString()}`
                            : "\u2014"
                        }
                      />
                      <SummaryRow
                        label="Financing Amount"
                        value={
                          financingAmount
                            ? `\u20a6${Number(financingAmount).toLocaleString()}`
                            : "\u2014"
                        }
                      />
                      <SummaryRow label="Purpose" value={purposeOfFinancing} />
                      <SummaryRow
                        label="Instrument"
                        value={
                          selectedInstrument
                            ? `${selectedInstrument.nameEn} (${selectedInstrument.nameAr})`
                            : "\u2014"
                        }
                      />
                    </SummarySection>
                  </div>

                  {/* What happens next */}
                  <div
                    className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4"
                    data-ocid="register_business.tawthiq_checklist"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-semibold text-foreground">
                        What happens after you submit?
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {[
                        "Tawthiq (\u0627\u0644\u062a\u0648\u062b\u064a\u0642) verifies your identity and KYC via Mono",
                        "Shariah compliance screening of your business activities",
                        "Inconsistency check across your declared profile and verified data",
                        "Credit-readiness verdict: Ready, Conditional, or Not Ready",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-muted-foreground">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Compliance checkboxes */}
                  <div
                    className="mt-5 space-y-3"
                    data-ocid="register_business.compliance_section"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Consent &amp; Compliance
                    </p>
                    <label
                      htmlFor="reg-biz-terms"
                      className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors"
                      data-ocid="register_business.terms_checkbox_label"
                    >
                      <Checkbox
                        id="reg-biz-terms"
                        checked={termsAccepted}
                        onCheckedChange={(v) => setTermsAccepted(!!v)}
                        className="mt-0.5"
                        data-ocid="register_business.terms_checkbox"
                      />
                      <span className="text-xs text-foreground leading-relaxed">
                        I have read and agree to the{" "}
                        <TermsModal
                          type="terms"
                          triggerText="Terms and Conditions"
                          ocid="register_business.terms_modal_trigger"
                        />
                        . <span className="text-destructive">*</span>
                      </span>
                    </label>
                    <label
                      htmlFor="reg-biz-privacy"
                      className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors"
                      data-ocid="register_business.privacy_checkbox_label"
                    >
                      <Checkbox
                        id="reg-biz-privacy"
                        checked={privacyAccepted}
                        onCheckedChange={(v) => setPrivacyAccepted(!!v)}
                        className="mt-0.5"
                        data-ocid="register_business.privacy_checkbox"
                      />
                      <span className="text-xs text-foreground leading-relaxed">
                        I have read and agree to the{" "}
                        <TermsModal
                          type="privacy"
                          triggerText="Privacy Policy"
                          ocid="register_business.privacy_modal_trigger"
                        />
                        . <span className="text-destructive">*</span>
                      </span>
                    </label>
                    <label
                      htmlFor="reg-biz-ndpr"
                      className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors"
                      data-ocid="register_business.ndpr_checkbox_label"
                    >
                      <Checkbox
                        id="reg-biz-ndpr"
                        checked={ndprAccepted}
                        onCheckedChange={(v) => setNdprAccepted(!!v)}
                        className="mt-0.5"
                        data-ocid="register_business.ndpr_checkbox"
                      />
                      <span className="text-xs text-foreground leading-relaxed">
                        I consent to the processing of my personal data in
                        compliance with the{" "}
                        <abbr
                          title="Nigeria Data Protection Regulation"
                          className="cursor-help"
                        >
                          NDPR
                        </abbr>
                        . <span className="text-destructive">*</span>
                      </span>
                    </label>
                    {complianceError && (
                      <p
                        className="text-destructive text-sm mt-2"
                        data-ocid="register_business.compliance_error"
                      >
                        {complianceError}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Nav buttons ── */}
            <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={
                  step === 0 ? () => router.navigate({ to: "/" }) : handleBack
                }
                data-ocid="register_business.back_button"
              >
                {step === 0 ? "Cancel" : "← Back"}
              </Button>
              {step < 5 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  data-ocid="register_business.next_button"
                >
                  {returnToSummary ? "Return to Summary →" : "Continue →"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    !actor ||
                    !termsAccepted ||
                    !privacyAccepted ||
                    !ndprAccepted
                  }
                  className="gap-2 min-w-[160px]"
                  data-ocid="register_business.submit_button"
                >
                  {isSubmitting && <LoadingSpinner size="sm" label="" />}
                  {isSubmitting ? "Submitting…" : "Submit Application"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
