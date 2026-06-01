import type {
  FinancierType,
  IndividualDetails,
  PreferredInstrument,
} from "@/backend";
import { Layout } from "@/components/Layout";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { TermsModal } from "@/components/TermsModal";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useBackend } from "@/hooks/use-backend";
import { useUserRole } from "@/hooks/use-user-role";
import { useRouter } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type FinancierTypeLocal = "institution" | "individual" | "group" | "";

const RISK_OPTIONS = [
  {
    value: "Conservative",
    label: "Conservative",
    desc: "Low-risk, capital preservation focus",
  },
  { value: "Moderate", label: "Moderate", desc: "Balanced risk and return" },
  {
    value: "Aggressive",
    label: "Aggressive",
    desc: "Higher risk for higher potential return",
  },
];
const LEGAL_BASIS = [
  "Cooperative",
  "Investment Club",
  "Family Office",
  "Partnership",
  "Other",
];
const INSTRUMENTS: {
  id: string;
  label: string;
  arabic: string;
  desc: string;
  example: string;
}[] = [
  {
    id: "Murabaha",
    label: "Murabaha",
    arabic: "مرابحة",
    desc: "Cost-plus sale — the financier buys an asset and resells it to you at a disclosed profit margin, payable in instalments.",
    example:
      "A textile trader needs a ₦5M loom. The financier buys it and sells it to the trader for ₦5.8M over 12 months.",
  },
  {
    id: "Musharakah",
    label: "Musharakah",
    arabic: "مشاركة",
    desc: "Partnership — both parties contribute capital. Profits are shared by agreed ratio; losses shared proportionally.",
    example:
      "A food processor and a financier each put in ₦10M to expand production. Profits split 60/40.",
  },
  {
    id: "Mudarabah",
    label: "Mudarabah",
    arabic: "مضاربة",
    desc: "Silent partnership — the financier provides all capital; the entrepreneur provides expertise. Profits shared; capital loss borne by financier.",
    example:
      "A logistics startup receives ₦8M from a financier. The founder manages operations. Profits split 70/30.",
  },
  {
    id: "Ijarah",
    label: "Ijarah",
    arabic: "إجارة",
    desc: "Lease — the financier buys an asset and leases it to you for a fixed rental. Ownership stays with the financier during the lease.",
    example:
      "A clinic needs an MRI machine. The financier buys it and leases it to the clinic at ₦200K/month for 3 years.",
  },
  {
    id: "Istisna",
    label: "Istisna",
    arabic: "استصناع",
    desc: "Manufacturing finance — the financier pays you to produce something to specification, with payment made in stages.",
    example:
      "A construction company is contracted to build a warehouse. The financier pays in stages as construction progresses.",
  },
  {
    id: "Salam",
    label: "Salam",
    arabic: "سلم",
    desc: "Advance purchase — full payment made now for goods to be delivered later. Commonly used in agriculture.",
    example:
      "A rice farmer receives full payment now for 50 tonnes of rice to be delivered at harvest.",
  },
];

function getSteps(financierType: FinancierTypeLocal) {
  const detailLabel =
    financierType === "institution"
      ? "Organisation Details"
      : financierType === "individual"
        ? "Personal Details"
        : financierType === "group"
          ? "Group Details"
          : "Your Details";
  return [
    { label: "Financier Type", sublabel: "Who are you?" },
    { label: detailLabel, sublabel: "Profile information" },
    {
      label: "Preferred Financing Instruments",
      sublabel: "Select instruments",
    },
    { label: "Risk & Capacity", sublabel: "Risk appetite and sectors" },
    { label: "Review & Submit", sublabel: "Confirm and send" },
  ];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatNaira(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-NG");
}

function parseNaira(formatted: string): string {
  return formatted.replace(/,/g, "");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepProgress({
  current,
  financierType,
}: { current: number; financierType: FinancierTypeLocal }) {
  const steps = getSteps(financierType);
  const total = steps.length;
  return (
    <div className="mb-8" data-ocid="register_financier.progress">
      <div className="flex items-center gap-0 mb-3">
        {steps.map((step, i) => (
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
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-label="Step completed"
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
                className={`flex-1 h-0.5 mx-1 transition-colors duration-300 ${
                  i < current ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {steps.map((step, i) => (
          <span
            key={step.label}
            className={`text-xs font-medium transition-colors min-w-0 ${
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
            <span className="block truncate">{step.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

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

function FieldError({ msg, ocid }: { msg: string | undefined; ocid: string }) {
  if (!msg) return null;
  return (
    <p className="text-xs text-destructive mt-1" data-ocid={ocid}>
      {msg}
    </p>
  );
}

function InstrumentCheckboxes({
  selected,
  onChange,
  prefix,
}: {
  selected: string[];
  onChange: (val: string[]) => void;
  prefix: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((i) => i !== id)
        : [...selected, id],
    );

  return (
    <div className="space-y-2">
      {INSTRUMENTS.map((inst) => (
        <div
          key={inst.id}
          className={`rounded-lg border transition-all duration-200 ${
            selected.includes(inst.id)
              ? "border-primary/50 bg-primary/5"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-start gap-3 p-3">
            <Checkbox
              id={`${prefix}-instrument-${inst.id.toLowerCase()}`}
              checked={selected.includes(inst.id)}
              onCheckedChange={() => toggle(inst.id)}
              className="mt-0.5"
              data-ocid={`${prefix}.instrument_${inst.id.toLowerCase()}`}
            />
            <div className="flex-1 min-w-0">
              <label
                htmlFor={`${prefix}-instrument-${inst.id.toLowerCase()}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className="font-medium text-sm text-foreground">
                  {inst.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {inst.arabic}
                </span>
              </label>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {inst.desc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(expanded === inst.id ? null : inst.id)}
              className="text-xs text-primary hover:underline flex-shrink-0 mt-0.5"
              aria-label={`${expanded === inst.id ? "Hide" : "Show"} example for ${inst.label}`}
            >
              {expanded === inst.id ? "Hide" : "Example"}
            </button>
          </div>
          {expanded === inst.id && (
            <div className="px-3 pb-3 ml-6">
              <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                {inst.example}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Summary helpers ───────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
}: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1.5">
      <span className="text-xs text-muted-foreground w-40 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm text-foreground font-medium break-words min-w-0 flex-1">
        {value}
      </span>
    </div>
  );
}

function SummarySection({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: (s: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
        <span className="text-sm font-semibold text-foreground font-display">
          {title}
        </span>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="text-xs text-primary hover:underline font-medium"
          data-ocid={`register_financier.summary_edit_step${step}`}
        >
          Edit
        </button>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RegisterFinancierPage() {
  const DRAFT_KEY = "vetify_financier_draft";
  const isRestored = useRef(false);
  const { actor } = useBackend();
  const { refetch } = useUserRole();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [financierType, setFinancierType] = useState<FinancierTypeLocal>("");
  const [typeError, setTypeError] = useState("");

  // Compliance
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ndprAccepted, setNdprAccepted] = useState(false);

  // Institution fields
  const [instName, setInstName] = useState("");
  const [instLicense, setInstLicense] = useState("");
  const [instContact, setInstContact] = useState("");
  const [instEmail, setInstEmail] = useState("");
  const [instPhone, setInstPhone] = useState("");
  const [instRiskAppetite, setInstRiskAppetite] = useState("");
  const [instTicketMin, setInstTicketMin] = useState("");
  const [instTicketMax, setInstTicketMax] = useState("");

  // Individual fields
  const [indivName, setIndivName] = useState("");
  const [indivBvn, setIndivBvn] = useState("");
  const [indivNin, setIndivNin] = useState("");
  const [indivOccupation, setIndivOccupation] = useState("");
  const [instPreferredSectors, setInstPreferredSectors] = useState<string[]>(
    [],
  );
  const [indivPreferredSectors, setIndivPreferredSectors] = useState<string[]>(
    [],
  );
  const [grpPreferredSectors, setGrpPreferredSectors] = useState<string[]>([]);
  const [instInstruments, setInstInstruments] = useState<string[]>([]);
  const [indivCapacity, setIndivCapacity] = useState("");
  const [indivInstruments, setIndivInstruments] = useState<string[]>([]);
  const [indivRisk, setIndivRisk] = useState("");

  // Group fields
  const [grpName, setGrpName] = useState("");
  const [grpMembers, setGrpMembers] = useState("");
  const [grpLeadName, setGrpLeadName] = useState("");
  const [grpLeadBvn, setGrpLeadBvn] = useState("");
  const [grpLeadNin, setGrpLeadNin] = useState("");
  const [grpCapacity, setGrpCapacity] = useState("");
  const [grpLegalBasis, setGrpLegalBasis] = useState("");
  const [grpInstruments, setGrpInstruments] = useState<string[]>([]);
  const [grpRisk, setGrpRisk] = useState("");

  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [complianceError, setComplianceError] = useState("");
  // ── localStorage restore on mount ─────────────────────────────────────────
  useEffect(() => {
    if (isRestored.current) return;
    isRestored.current = true;
    try {
      const saved =
        localStorage.getItem(DRAFT_KEY) ||
        localStorage.getItem("halalvet_financier_draft");
      if (saved) {
        const d = JSON.parse(saved);
        if (d.financierType) setFinancierType(d.financierType);
        if (d.instName) setInstName(d.instName);
        if (d.instLicense) setInstLicense(d.instLicense);
        if (d.instContact) setInstContact(d.instContact);
        if (d.instEmail) setInstEmail(d.instEmail);
        if (d.instPhone) setInstPhone(d.instPhone);
        if (d.instRiskAppetite) setInstRiskAppetite(d.instRiskAppetite);
        if (d.instTicketMin) setInstTicketMin(d.instTicketMin);
        if (d.instTicketMax) setInstTicketMax(d.instTicketMax);
        if (d.instInstruments) setInstInstruments(d.instInstruments);
        if (d.indivName) setIndivName(d.indivName);
        if (d.indivBvn) setIndivBvn(d.indivBvn);
        if (d.indivNin) setIndivNin(d.indivNin);
        if (d.indivOccupation) setIndivOccupation(d.indivOccupation);
        if (d.instPreferredSectors)
          setInstPreferredSectors(d.instPreferredSectors);
        if (d.indivPreferredSectors)
          setIndivPreferredSectors(d.indivPreferredSectors);
        if (d.grpPreferredSectors)
          setGrpPreferredSectors(d.grpPreferredSectors);
        if (d.indivCapacity) setIndivCapacity(d.indivCapacity);
        if (d.indivInstruments) setIndivInstruments(d.indivInstruments);
        if (d.indivRisk) setIndivRisk(d.indivRisk);
        if (d.grpName) setGrpName(d.grpName);
        if (d.grpMembers) setGrpMembers(d.grpMembers);
        if (d.grpLeadName) setGrpLeadName(d.grpLeadName);
        if (d.grpLeadBvn) setGrpLeadBvn(d.grpLeadBvn);
        if (d.grpLeadNin) setGrpLeadNin(d.grpLeadNin);
        if (d.grpCapacity) setGrpCapacity(d.grpCapacity);
        if (d.grpLegalBasis) setGrpLegalBasis(d.grpLegalBasis);
        if (d.grpInstruments) setGrpInstruments(d.grpInstruments);
        if (d.grpRisk) setGrpRisk(d.grpRisk);
      }
    } catch {}
  }, []);

  // ── localStorage save on state change ───────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          financierType,
          instName,
          instLicense,
          instContact,
          instEmail,
          instPhone,
          instRiskAppetite,
          instTicketMin,
          instTicketMax,
          instInstruments,
          indivName,
          indivBvn,
          indivNin,
          indivOccupation,
          instPreferredSectors,
          indivPreferredSectors,
          grpPreferredSectors,
          indivCapacity,
          indivInstruments,
          indivRisk,
          grpName,
          grpMembers,
          grpLeadName,
          grpLeadBvn,
          grpLeadNin,
          grpCapacity,
          grpLegalBasis,
          grpInstruments,
          grpRisk,
        }),
      );
    } catch {}
  }, [
    financierType,
    instName,
    instLicense,
    instContact,
    instEmail,
    instPhone,
    instRiskAppetite,
    instTicketMin,
    instTicketMax,
    instInstruments,
    indivName,
    indivBvn,
    indivNin,
    indivOccupation,
    instPreferredSectors,
    indivPreferredSectors,
    grpPreferredSectors,
    indivCapacity,
    indivInstruments,
    indivRisk,
    grpName,
    grpMembers,
    grpLeadName,
    grpLeadBvn,
    grpLeadNin,
    grpCapacity,
    grpLegalBasis,
    grpInstruments,
    grpRisk,
  ]);

  // ── Validation ────────────────────────────────────────────────────────────

  const validateStep0 = () => {
    if (!financierType) {
      setTypeError("Please select a financier type to continue");
      return false;
    }
    setTypeError("");
    return true;
  };

  const validateDetails = () => {
    const errs: Record<string, string> = {};
    if (financierType === "institution") {
      if (!instName.trim()) errs.instName = "Institution name is required";
      if (!instContact.trim()) errs.instContact = "Contact person is required";
      if (!instEmail.trim()) errs.instEmail = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(instEmail))
        errs.instEmail = "Enter a valid email address";
      if (!instPhone.trim()) errs.instPhone = "Phone is required";
    } else if (financierType === "individual") {
      if (!indivName.trim()) errs.indivName = "Full name is required";
      if (indivBvn && !/^\d{11}$/.test(indivBvn.trim()))
        errs.indivBvn = "BVN must be exactly 11 digits";
      if (indivNin && !/^\d{11}$/.test(indivNin.trim()))
        errs.indivNin = "NIN must be exactly 11 digits";
    } else if (financierType === "group") {
      if (!grpName.trim()) errs.grpName = "Group name is required";
      if (!grpLeadName.trim())
        errs.grpLeadName = "Lead contact name is required";
      if (grpLeadBvn && !/^\d{11}$/.test(grpLeadBvn.trim()))
        errs.grpLeadBvn = "BVN must be exactly 11 digits";
      if (grpLeadNin && !/^\d{11}$/.test(grpLeadNin.trim()))
        errs.grpLeadNin = "NIN must be exactly 11 digits";
      if (!grpCapacity)
        errs.grpCapacity = "Combined investment capacity is required";
    }
    setDetailErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validateDetails() || !actor) {
      if (!actor) toast.error("Please connect your wallet before submitting.");
      return;
    }
    if (!termsAccepted || !privacyAccepted || !ndprAccepted) {
      setComplianceError("Please accept all terms and conditions to proceed");
      return;
    }
    setComplianceError("");
    setIsSubmitting(true);
    try {
      const institutionDetails =
        financierType === "institution"
          ? {
              licenseNumber: instLicense,
              riskAppetite: instRiskAppetite,
              ticketSizeMin: BigInt(
                Math.round(Number(parseNaira(instTicketMin)) || 0),
              ),
              ticketSizeMax: BigInt(
                Math.round(Number(parseNaira(instTicketMax)) || 0),
              ),
              preferredInstruments: instInstruments as PreferredInstrument[],
            }
          : null;

      const individualDetails =
        financierType === "individual"
          ? {
              fullName: indivName,
              bvn: indivBvn,
              nin: indivNin,
              occupation: indivOccupation,
              investmentCapacity: BigInt(
                Math.round(Number(parseNaira(indivCapacity)) || 0),
              ),
              preferredInstruments: indivInstruments as PreferredInstrument[],
              riskAppetite: indivRisk,
            }
          : null;

      const groupDetails =
        financierType === "group"
          ? {
              groupName: grpName,
              numberOfMembers: BigInt(Math.round(Number(grpMembers) || 0)),
              leadContactName: grpLeadName,
              leadContactBvn: grpLeadBvn,
              leadContactNin: grpLeadNin,
              combinedInvestmentCapacity: BigInt(
                Math.round(Number(parseNaira(grpCapacity)) || 0),
              ),
              legalBasis: grpLegalBasis,
              preferredInstruments: grpInstruments as PreferredInstrument[],
              riskAppetite: grpRisk,
            }
          : null;

      const displayName =
        financierType === "institution"
          ? instName
          : financierType === "individual"
            ? indivName
            : grpName;

      const result = await actor.registerAsFinancier(
        displayName,
        financierType === "institution" ? instLicense : "",
        financierType === "institution"
          ? instContact
          : financierType === "group"
            ? grpLeadName
            : indivName,
        financierType === "institution" ? instEmail : "",
        financierType === "institution" ? instPhone : "",
        instPreferredSectors,
        financierType as FinancierType,
        institutionDetails,
        individualDetails,
        groupDetails,
      );
      if ("err" in result) {
        toast.error(
          result.err instanceof Error ? result.err.message : String(result.err),
        );
        setIsSubmitting(false);
        return;
      }
      await refetch();
      toast.success(
        "Financier registration submitted! Your account is under review.",
      );
      localStorage.removeItem(DRAFT_KEY);
      router.navigate({ to: "/financier/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [returnToSummary, setReturnToSummary] = useState(false);

  const handleNext = () => {
    if (step === 0 && validateStep0()) setStep(1);
    else if (step === 1 && validateDetails()) {
      setReturnToSummary(false);
      setStep(2);
    } else if (step === 2) {
      const instruments =
        financierType === "institution"
          ? instInstruments
          : financierType === "individual"
            ? indivInstruments
            : grpInstruments;
      if (!instruments || instruments.length === 0) {
        setDetailErrors((prev) => ({
          ...prev,
          instruments:
            "Please select at least one preferred financing instrument",
        }));
        return;
      }
      setDetailErrors((prev) => ({ ...prev, instruments: "" }));
      setReturnToSummary(false);
      setStep((s) => s + 1);
    } else if (step === 3) {
      if (financierType === "individual" && !indivRisk) {
        setDetailErrors((prev) => ({
          ...prev,
          riskAppetite: "Please select your risk appetite",
        }));
        return;
      }
      if (financierType === "group" && !grpRisk) {
        setDetailErrors((prev) => ({
          ...prev,
          riskAppetite: "Please select your risk appetite",
        }));
        return;
      }
      setDetailErrors((prev) => ({ ...prev, riskAppetite: "" }));
      setReturnToSummary(false);
      setStep((s) => s + 1);
    }
  };

  const goToStep = (s: number, ret = false) => {
    setReturnToSummary(ret);
    setStep(s);
  };

  const typeLabel =
    financierType === "institution"
      ? "Institution"
      : financierType === "individual"
        ? "Individual"
        : financierType === "group"
          ? "Group of Individuals"
          : "";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <PageHeader
          title="Financier Registration"
          subtitle="تسجيل الممول — Register to access verified halal financing profiles"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Register Financier" },
          ]}
        />

        <Card className="shadow-lg">
          <CardContent className="pt-8 pb-8 px-6 sm:px-8">
            <StepProgress current={step} financierType={financierType} />

            <AnimatePresence mode="wait">
              {/* ── Step 0: Financier Type ── */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Financier Type
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Select your financier category. This determines what
                    information you'll provide next.
                  </p>
                  <div className="space-y-3">
                    <RadioCard
                      selected={financierType === "institution"}
                      onClick={() => {
                        setFinancierType("institution");
                        setTypeError("");
                      }}
                      title="Institution"
                      subtitle="Islamic bank, microfinance institution, development finance institution, or other licensed entity."
                      ocid="register_financier.type_institution"
                    />
                    <RadioCard
                      selected={financierType === "individual"}
                      onClick={() => {
                        setFinancierType("individual");
                        setTypeError("");
                      }}
                      title="Individual"
                      subtitle="A high-net-worth individual or private investor seeking to provide halal financing."
                      ocid="register_financier.type_individual"
                    />
                    <RadioCard
                      selected={financierType === "group"}
                      onClick={() => {
                        setFinancierType("group");
                        setTypeError("");
                      }}
                      title="Group of Individuals"
                      subtitle="Co-operative, investment club, family office, or a group of investors with a shared mandate."
                      ocid="register_financier.type_group"
                    />
                  </div>
                  {typeError && (
                    <p
                      className="text-xs text-destructive mt-3"
                      data-ocid="register_financier.type_error"
                    >
                      {typeError}
                    </p>
                  )}
                </motion.div>
              )}

              {/* ── Institution details ── */}
              {step === 1 && financierType === "institution" && (
                <motion.div
                  key="inst"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Institution Details
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Provide your licensed institution information.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="instName">Institution Name *</Label>
                      <Input
                        id="instName"
                        placeholder="Al-Baraka Islamic Finance Ltd."
                        value={instName}
                        onChange={(e) => setInstName(e.target.value)}
                        data-ocid="register_financier.inst_name_input"
                      />
                      <FieldError
                        msg={detailErrors.instName}
                        ocid="register_financier.inst_name_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="instLicense">License Number</Label>
                      <Input
                        id="instLicense"
                        placeholder="LIC/2024/001"
                        value={instLicense}
                        onChange={(e) => setInstLicense(e.target.value)}
                        data-ocid="register_financier.inst_license_input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="instContact">Contact Person *</Label>
                      <Input
                        id="instContact"
                        placeholder="Dr. Fatimah Al-Hassan"
                        value={instContact}
                        onChange={(e) => setInstContact(e.target.value)}
                        data-ocid="register_financier.inst_contact_input"
                      />
                      <FieldError
                        msg={detailErrors.instContact}
                        ocid="register_financier.inst_contact_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="instEmail">Official Email *</Label>
                      <Input
                        id="instEmail"
                        type="email"
                        placeholder="contact@albaraka.ng"
                        value={instEmail}
                        onChange={(e) => setInstEmail(e.target.value)}
                        data-ocid="register_financier.inst_email_input"
                      />
                      <FieldError
                        msg={detailErrors.instEmail}
                        ocid="register_financier.inst_email_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="instPhone">Phone Number *</Label>
                      <Input
                        id="instPhone"
                        placeholder="+2348012345678"
                        value={instPhone}
                        onChange={(e) => setInstPhone(e.target.value)}
                        data-ocid="register_financier.inst_phone_input"
                      />
                      <FieldError
                        msg={detailErrors.instPhone}
                        ocid="register_financier.inst_phone_error"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Institution Instruments ── */}
              {step === 2 && financierType === "institution" && (
                <motion.div
                  key="inst-inst"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Preferred Financing Instruments
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Select the instruments you are willing to offer. Click
                    “Example” to see a practical use case.
                  </p>
                  <InstrumentCheckboxes
                    selected={instInstruments}
                    onChange={setInstInstruments}
                    prefix="register_financier.inst"
                  />
                  {detailErrors?.instruments &&
                    financierType === "institution" && (
                      <p
                        className="text-destructive text-sm mt-2"
                        data-ocid="register_financier.inst_instruments_error"
                      >
                        {detailErrors.instruments}
                      </p>
                    )}
                </motion.div>
              )}

              {/* ── Step 2: Individual Instruments ── */}
              {step === 2 && financierType === "individual" && (
                <motion.div
                  key="indiv-inst"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Preferred Financing Instruments
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Select the instruments you are willing to offer. Click
                    “Example” to see a practical use case.
                  </p>
                  <InstrumentCheckboxes
                    selected={indivInstruments}
                    onChange={setIndivInstruments}
                    prefix="register_financier.indiv"
                  />
                  {detailErrors?.instruments &&
                    financierType === "individual" && (
                      <p
                        className="text-destructive text-sm mt-2"
                        data-ocid="register_financier.indiv_instruments_error"
                      >
                        {detailErrors.instruments}
                      </p>
                    )}
                </motion.div>
              )}

              {/* ── Step 2: Group Instruments ── */}
              {step === 2 && financierType === "group" && (
                <motion.div
                  key="grp-inst"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Preferred Financing Instruments
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Select the instruments your group is willing to offer. Click
                    “Example” to see a practical use case.
                  </p>
                  <InstrumentCheckboxes
                    selected={grpInstruments}
                    onChange={setGrpInstruments}
                    prefix="register_financier.grp"
                  />
                  {detailErrors?.instruments && financierType === "group" && (
                    <p
                      className="text-destructive text-sm mt-2"
                      data-ocid="register_financier.grp_instruments_error"
                    >
                      {detailErrors.instruments}
                    </p>
                  )}
                </motion.div>
              )}

              {/* ── Step 3: Risk & Capacity + Preferred Sectors ── */}
              {step === 3 && financierType === "institution" && (
                <motion.div
                  key="inst-risk"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Risk & Capacity
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Define your risk appetite, ticket size, and preferred
                    sectors.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Risk Appetite</Label>
                      <Select
                        value={instRiskAppetite}
                        onValueChange={setInstRiskAppetite}
                      >
                        <SelectTrigger data-ocid="register_financier.inst_risk_select">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {RISK_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="instTicketMin">Min Ticket Size (₦)</Label>
                      <Input
                        id="instTicketMin"
                        placeholder="500,000"
                        value={instTicketMin}
                        onChange={(e) =>
                          setInstTicketMin(formatNaira(e.target.value))
                        }
                        data-ocid="register_financier.inst_ticket_min_input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="instTicketMax">Max Ticket Size (₦)</Label>
                      <Input
                        id="instTicketMax"
                        placeholder="10,000,000"
                        value={instTicketMax}
                        onChange={(e) =>
                          setInstTicketMax(formatNaira(e.target.value))
                        }
                        data-ocid="register_financier.inst_ticket_max_input"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="block text-sm font-medium text-foreground mb-1">
                        Preferred Sectors{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Select all sectors you are interested in financing
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "Agriculture",
                          "Manufacturing",
                          "Trade & Commerce",
                          "Real Estate",
                          "Education",
                          "Healthcare",
                          "Technology",
                          "Energy",
                          "Transportation",
                          "Other",
                        ].map((sector) => (
                          <div
                            key={sector}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={instPreferredSectors.includes(sector)}
                              onCheckedChange={(checked) => {
                                setInstPreferredSectors((prev) =>
                                  checked
                                    ? [...prev, sector]
                                    : prev.filter((s) => s !== sector),
                                );
                              }}
                              className="h-4 w-4"
                              data-ocid={`register_financier.inst_sector_${sector.toLowerCase().replace(/\s+/g, "_")}`}
                            />
                            <span className="text-sm text-foreground">
                              {sector}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && financierType === "individual" && (
                <motion.div
                  key="indiv-risk"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Risk & Capacity
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Define your risk appetite, investment capacity, and
                    preferred sectors.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="indivCapacity">
                        Investment Capacity *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          &#8358;
                        </span>
                        <Input
                          id="indivCapacity"
                          placeholder="5,000,000"
                          className="pl-7"
                          value={indivCapacity}
                          onChange={(e) =>
                            setIndivCapacity(formatNaira(e.target.value))
                          }
                          data-ocid="register_financier.indiv_capacity_input"
                        />
                      </div>
                      <FieldError
                        msg={detailErrors.indivCapacity}
                        ocid="register_financier.indiv_capacity_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Risk Appetite *</Label>
                      <Select value={indivRisk} onValueChange={setIndivRisk}>
                        <SelectTrigger data-ocid="register_financier.indiv_risk_select">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {RISK_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label} — {r.desc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError
                        msg={detailErrors.indivRisk}
                        ocid="register_financier.indiv_risk_error"
                      />
                      {detailErrors?.riskAppetite &&
                        financierType === "individual" && (
                          <p
                            className="text-destructive text-sm mt-1"
                            data-ocid="register_financier.indiv_risk_appetite_error"
                          >
                            {detailErrors.riskAppetite}
                          </p>
                        )}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="block text-sm font-medium text-foreground mb-1">
                        Preferred Sectors{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Select all sectors you are interested in financing
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "Agriculture",
                          "Manufacturing",
                          "Trade & Commerce",
                          "Real Estate",
                          "Education",
                          "Healthcare",
                          "Technology",
                          "Energy",
                          "Transportation",
                          "Other",
                        ].map((sector) => (
                          <div
                            key={sector}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={indivPreferredSectors.includes(sector)}
                              onCheckedChange={(checked) => {
                                setIndivPreferredSectors((prev) =>
                                  checked
                                    ? [...prev, sector]
                                    : prev.filter((s) => s !== sector),
                                );
                              }}
                              className="h-4 w-4"
                              data-ocid={`register_financier.indiv_sector_${sector.toLowerCase().replace(/\s+/g, "_")}`}
                            />
                            <span className="text-sm text-foreground">
                              {sector}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && financierType === "group" && (
                <motion.div
                  key="grp-risk"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Risk & Capacity
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Define your group's risk appetite, combined capacity, and
                    preferred sectors.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="grpCapacity">
                        Combined Investment Capacity *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          &#8358;
                        </span>
                        <Input
                          id="grpCapacity"
                          placeholder="25,000,000"
                          className="pl-7"
                          value={grpCapacity}
                          onChange={(e) =>
                            setGrpCapacity(formatNaira(e.target.value))
                          }
                          data-ocid="register_financier.grp_capacity_input"
                        />
                      </div>
                      <FieldError
                        msg={detailErrors.grpCapacity}
                        ocid="register_financier.grp_capacity_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Risk Appetite *</Label>
                      <Select value={grpRisk} onValueChange={setGrpRisk}>
                        <SelectTrigger data-ocid="register_financier.grp_risk_select">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {RISK_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label} — {r.desc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError
                        msg={detailErrors.grpRisk}
                        ocid="register_financier.grp_risk_error"
                      />
                      {detailErrors?.riskAppetite &&
                        financierType === "group" && (
                          <p
                            className="text-destructive text-sm mt-1"
                            data-ocid="register_financier.grp_risk_appetite_error"
                          >
                            {detailErrors.riskAppetite}
                          </p>
                        )}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="block text-sm font-medium text-foreground mb-1">
                        Preferred Sectors{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Select all sectors your group is interested in financing
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "Agriculture",
                          "Manufacturing",
                          "Trade & Commerce",
                          "Real Estate",
                          "Education",
                          "Healthcare",
                          "Technology",
                          "Energy",
                          "Transportation",
                          "Other",
                        ].map((sector) => (
                          <div
                            key={sector}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={grpPreferredSectors.includes(sector)}
                              onCheckedChange={(checked) => {
                                setGrpPreferredSectors((prev) =>
                                  checked
                                    ? [...prev, sector]
                                    : prev.filter((s) => s !== sector),
                                );
                              }}
                              className="h-4 w-4"
                              data-ocid={`register_financier.grp_sector_${sector.toLowerCase().replace(/\s+/g, "_")}`}
                            />
                            <span className="text-sm text-foreground">
                              {sector}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Individual details ── */}
              {step === 1 && financierType === "individual" && (
                <motion.div
                  key="indiv"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Individual Investor Details
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Provide your personal and investment profile.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="indivName">Full Name *</Label>
                      <Input
                        id="indivName"
                        placeholder="Alhaji Musa Ibrahim"
                        value={indivName}
                        onChange={(e) => setIndivName(e.target.value)}
                        data-ocid="register_financier.indiv_name_input"
                      />
                      <FieldError
                        msg={detailErrors.indivName}
                        ocid="register_financier.indiv_name_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="indivBvn">BVN</Label>
                      <Input
                        id="indivBvn"
                        placeholder="22123456789"
                        maxLength={11}
                        value={indivBvn}
                        onKeyPress={(e) => {
                          if (!/[0-9]/.test(e.key)) e.preventDefault();
                        }}
                        onChange={(e) =>
                          setIndivBvn(
                            e.target.value.replace(/\D/g, "").slice(0, 11),
                          )
                        }
                        data-ocid="register_financier.indiv_bvn_input"
                      />
                      <p className="text-xs text-muted-foreground">
                        11-digit Bank Verification Number
                      </p>
                      <FieldError
                        msg={detailErrors.indivBvn}
                        ocid="register_financier.indiv_bvn_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="indivNin">NIN</Label>
                      <Input
                        id="indivNin"
                        placeholder="12345678901"
                        maxLength={11}
                        value={indivNin}
                        onKeyPress={(e) => {
                          if (!/[0-9]/.test(e.key)) e.preventDefault();
                        }}
                        onChange={(e) =>
                          setIndivNin(
                            e.target.value.replace(/\D/g, "").slice(0, 11),
                          )
                        }
                        data-ocid="register_financier.indiv_nin_input"
                      />
                      <p className="text-xs text-muted-foreground">
                        11-digit National Identification Number
                      </p>
                      <FieldError
                        msg={detailErrors.indivNin}
                        ocid="register_financier.indiv_nin_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="indivOccupation">Occupation</Label>
                      <Input
                        id="indivOccupation"
                        placeholder="Business owner / Entrepreneur"
                        value={indivOccupation}
                        onChange={(e) => setIndivOccupation(e.target.value)}
                        data-ocid="register_financier.indiv_occupation_input"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Group details ── */}
              {step === 1 && financierType === "group" && (
                <motion.div
                  key="grp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Group Details
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Provide details about your investment group or co-operative.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="grpName">Group Name *</Label>
                      <Input
                        id="grpName"
                        placeholder="Kano Halal Investment Club"
                        value={grpName}
                        onChange={(e) => setGrpName(e.target.value)}
                        data-ocid="register_financier.grp_name_input"
                      />
                      <FieldError
                        msg={detailErrors.grpName}
                        ocid="register_financier.grp_name_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="grpMembers">Number of Members</Label>
                      <Input
                        id="grpMembers"
                        type="number"
                        min="2"
                        placeholder="12"
                        value={grpMembers}
                        onChange={(e) => setGrpMembers(e.target.value)}
                        data-ocid="register_financier.grp_members_input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Legal Basis</Label>
                      <Select
                        value={grpLegalBasis}
                        onValueChange={setGrpLegalBasis}
                      >
                        <SelectTrigger data-ocid="register_financier.grp_legal_select">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {LEGAL_BASIS.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Separator />
                      <p className="text-sm font-semibold text-foreground pt-1">
                        Lead Contact
                      </p>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="grpLeadName">Lead Contact Name *</Label>
                      <Input
                        id="grpLeadName"
                        placeholder="Umar Farouq"
                        value={grpLeadName}
                        onChange={(e) => setGrpLeadName(e.target.value)}
                        data-ocid="register_financier.grp_lead_name_input"
                      />
                      <FieldError
                        msg={detailErrors.grpLeadName}
                        ocid="register_financier.grp_lead_name_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="grpLeadBvn">Lead BVN</Label>
                      <Input
                        id="grpLeadBvn"
                        placeholder="22123456789"
                        maxLength={11}
                        value={grpLeadBvn}
                        onKeyPress={(e) => {
                          if (!/[0-9]/.test(e.key)) e.preventDefault();
                        }}
                        onChange={(e) =>
                          setGrpLeadBvn(
                            e.target.value.replace(/\D/g, "").slice(0, 11),
                          )
                        }
                        data-ocid="register_financier.grp_lead_bvn_input"
                      />
                      <p className="text-xs text-muted-foreground">
                        11-digit Bank Verification Number
                      </p>
                      <FieldError
                        msg={detailErrors.grpLeadBvn}
                        ocid="register_financier.grp_lead_bvn_error"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="grpLeadNin">Lead NIN</Label>
                      <Input
                        id="grpLeadNin"
                        placeholder="12345678901"
                        maxLength={11}
                        value={grpLeadNin}
                        onKeyPress={(e) => {
                          if (!/[0-9]/.test(e.key)) e.preventDefault();
                        }}
                        onChange={(e) =>
                          setGrpLeadNin(
                            e.target.value.replace(/\D/g, "").slice(0, 11),
                          )
                        }
                        data-ocid="register_financier.grp_lead_nin_input"
                      />
                      <p className="text-xs text-muted-foreground">
                        11-digit National Identification Number
                      </p>
                      <FieldError
                        msg={detailErrors.grpLeadNin}
                        ocid="register_financier.grp_lead_nin_error"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="grpCapacity">
                        Combined Investment Capacity *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          &#8358;
                        </span>
                        <Input
                          id="grpCapacity"
                          placeholder="25,000,000"
                          className="pl-7"
                          value={grpCapacity}
                          onChange={(e) =>
                            setGrpCapacity(formatNaira(e.target.value))
                          }
                          data-ocid="register_financier.grp_capacity_input"
                        />
                      </div>
                      <FieldError
                        msg={detailErrors.grpCapacity}
                        ocid="register_financier.grp_capacity_error"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 4: Summary & Review ── */}
              {step === 4 && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  data-ocid="register_financier.summary_panel"
                >
                  <h2 className="font-display text-lg font-semibold text-foreground mb-1">
                    Review Your Application
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Please review the information below before submitting. Click{" "}
                    <strong>Edit</strong> on any section to make changes.
                  </p>
                  <div className="space-y-4">
                    <SummarySection
                      title="Financier Type"
                      step={0}
                      onEdit={(s) => goToStep(s, true)}
                    >
                      <SummaryRow label="Type" value={typeLabel} />
                    </SummarySection>

                    {financierType === "institution" && (
                      <>
                        <SummarySection
                          title="Institution Details"
                          step={1}
                          onEdit={(s) => goToStep(s, true)}
                        >
                          <SummaryRow
                            label="Institution Name"
                            value={instName}
                          />
                          <SummaryRow
                            label="License Number"
                            value={instLicense || undefined}
                          />
                          <SummaryRow
                            label="Contact Person"
                            value={instContact}
                          />
                          <SummaryRow label="Email" value={instEmail} />
                          <SummaryRow label="Phone" value={instPhone} />
                        </SummarySection>
                        <SummarySection
                          title="Preferred Financing Instruments"
                          step={2}
                          onEdit={(s) => goToStep(s, true)}
                        >
                          {instInstruments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {instInstruments.map((i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {i}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              None selected
                            </span>
                          )}
                        </SummarySection>
                        <SummarySection
                          title="Risk & Capacity"
                          step={3}
                          onEdit={(s) => goToStep(s, true)}
                        >
                          <SummaryRow
                            label="Risk Appetite"
                            value={instRiskAppetite || undefined}
                          />
                          <SummaryRow
                            label="Min Ticket"
                            value={
                              instTicketMin ? `₦${instTicketMin}` : undefined
                            }
                          />
                          <SummaryRow
                            label="Max Ticket"
                            value={
                              instTicketMax ? `₦${instTicketMax}` : undefined
                            }
                          />
                          {instPreferredSectors.length > 0 && (
                            <div className="flex gap-3 py-1.5">
                              <span className="text-xs text-muted-foreground w-40 flex-shrink-0">
                                Preferred Sectors
                              </span>
                              <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                                {instPreferredSectors.map((s) => (
                                  <Badge
                                    key={s}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </SummarySection>
                      </>
                    )}

                    {financierType === "individual" && (
                      <>
                        <SummarySection
                          title="Individual Investor Details"
                          step={1}
                          onEdit={(s) => goToStep(s, true)}
                        >
                          <SummaryRow label="Full Name" value={indivName} />
                          <SummaryRow
                            label="BVN"
                            value={
                              indivBvn
                                ? `••••••• ${indivBvn.slice(-4)}`
                                : undefined
                            }
                          />
                          <SummaryRow
                            label="NIN"
                            value={
                              indivNin
                                ? `••••••• ${indivNin.slice(-4)}`
                                : undefined
                            }
                          />
                          <SummaryRow
                            label="Occupation"
                            value={indivOccupation || undefined}
                          />
                        </SummarySection>
                        <SummarySection
                          title="Preferred Financing Instruments"
                          step={2}
                          onEdit={(s) => goToStep(s, true)}
                        >
                          {indivInstruments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {indivInstruments.map((i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {i}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              None selected
                            </span>
                          )}
                        </SummarySection>
                        <SummarySection
                          title="Risk & Capacity"
                          step={3}
                          onEdit={(s) => goToStep(s, true)}
                        >
                          <SummaryRow
                            label="Investment Capacity"
                            value={
                              indivCapacity ? `₦${indivCapacity}` : undefined
                            }
                          />
                          <SummaryRow
                            label="Risk Appetite"
                            value={indivRisk || undefined}
                          />
                          {indivPreferredSectors.length > 0 && (
                            <div className="flex gap-3 py-1.5">
                              <span className="text-xs text-muted-foreground w-40 flex-shrink-0">
                                Preferred Sectors
                              </span>
                              <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                                {indivPreferredSectors.map((s) => (
                                  <Badge
                                    key={s}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </SummarySection>
                      </>
                    )}

                    {financierType === "group" && (
                      <>
                        <SummarySection
                          title="Group Details"
                          step={1}
                          onEdit={(s) => goToStep(s, true)}
                        >
                          <SummaryRow label="Group Name" value={grpName} />
                          <SummaryRow
                            label="Number of Members"
                            value={grpMembers || undefined}
                          />
                          <SummaryRow
                            label="Legal Basis"
                            value={grpLegalBasis || undefined}
                          />
                          <SummaryRow
                            label="Lead Contact"
                            value={grpLeadName}
                          />
                          <SummaryRow
                            label="Lead BVN"
                            value={
                              grpLeadBvn
                                ? `••••••• ${grpLeadBvn.slice(-4)}`
                                : undefined
                            }
                          />
                          <SummaryRow
                            label="Lead NIN"
                            value={
                              grpLeadNin
                                ? `••••••• ${grpLeadNin.slice(-4)}`
                                : undefined
                            }
                          />
                        </SummarySection>
                        <SummarySection
                          title="Preferred Financing Instruments"
                          step={2}
                          onEdit={(s) => goToStep(s, true)}
                        >
                          {grpInstruments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {grpInstruments.map((i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {i}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              None selected
                            </span>
                          )}
                        </SummarySection>
                        <SummarySection
                          title="Risk & Capacity"
                          step={3}
                          onEdit={(s) => goToStep(s, true)}
                        >
                          <SummaryRow
                            label="Combined Capacity"
                            value={grpCapacity ? `₦${grpCapacity}` : undefined}
                          />
                          <SummaryRow
                            label="Risk Appetite"
                            value={grpRisk || undefined}
                          />
                          {grpPreferredSectors.length > 0 && (
                            <div className="flex gap-3 py-1.5">
                              <span className="text-xs text-muted-foreground w-40 flex-shrink-0">
                                Preferred Sectors
                              </span>
                              <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                                {grpPreferredSectors.map((s) => (
                                  <Badge
                                    key={s}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </SummarySection>
                      </>
                    )}
                  </div>

                  <div className="mt-6 rounded-xl bg-primary/5 border border-primary/20 p-4">
                    <p className="text-xs text-muted-foreground">
                      By submitting, your application will be reviewed by our
                      compliance team. You will be notified via WhatsApp when
                      your status changes.
                    </p>
                  </div>

                  {/* Compliance checkboxes */}
                  <div
                    className="mt-4 space-y-3"
                    data-ocid="register_financier.compliance_section"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Consent &amp; Compliance
                    </p>
                    <label
                      htmlFor="reg-fin-terms"
                      className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors"
                      data-ocid="register_financier.terms_checkbox_label"
                    >
                      <Checkbox
                        id="reg-fin-terms"
                        checked={termsAccepted}
                        onCheckedChange={(v) => setTermsAccepted(!!v)}
                        className="mt-0.5"
                        data-ocid="register_financier.terms_checkbox"
                      />
                      <span className="text-xs text-foreground leading-relaxed">
                        I have read and agree to the{" "}
                        <TermsModal
                          type="terms"
                          triggerText="Terms and Conditions"
                          triggerClassName="text-primary underline underline-offset-2"
                        />
                        . <span className="text-destructive">*</span>
                      </span>
                    </label>
                    <label
                      htmlFor="reg-fin-privacy"
                      className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors"
                      data-ocid="register_financier.privacy_checkbox_label"
                    >
                      <Checkbox
                        id="reg-fin-privacy"
                        checked={privacyAccepted}
                        onCheckedChange={(v) => setPrivacyAccepted(!!v)}
                        className="mt-0.5"
                        data-ocid="register_financier.privacy_checkbox"
                      />
                      <span className="text-xs text-foreground leading-relaxed">
                        I have read and agree to the{" "}
                        <TermsModal
                          type="privacy"
                          triggerText="Privacy Policy"
                          triggerClassName="text-primary underline underline-offset-2"
                        />
                        . <span className="text-destructive">*</span>
                      </span>
                    </label>
                    <label
                      htmlFor="reg-fin-ndpr"
                      className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors"
                      data-ocid="register_financier.ndpr_checkbox_label"
                    >
                      <Checkbox
                        id="reg-fin-ndpr"
                        checked={ndprAccepted}
                        onCheckedChange={(v) => setNdprAccepted(!!v)}
                        className="mt-0.5"
                        data-ocid="register_financier.ndpr_checkbox"
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
                        data-ocid="register_financier.compliance_error"
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
                onClick={() => {
                  if (step === 0) router.navigate({ to: "/" });
                  else setStep((s) => s - 1);
                }}
                data-ocid="register_financier.back_button"
              >
                {step === 0 ? "Cancel" : "← Back"}
              </Button>

              {step < 4 && (
                <Button
                  type="button"
                  onClick={handleNext}
                  data-ocid="register_financier.next_button"
                >
                  {returnToSummary ? "Return to Summary →" : "Continue →"}
                </Button>
              )}

              {step === 4 && (
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
                  data-ocid="register_financier.submit_button"
                >
                  {isSubmitting && <LoadingSpinner size="sm" label="" />}
                  {isSubmitting ? "Submitting…" : "Submit Registration"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
