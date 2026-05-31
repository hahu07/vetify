import { r as reactExports, g as useBackend, a as useRouter, j as jsxRuntimeExports, P as PageHeader, C as Card, e as CardContent, h as Label, I as Input, i as Separator, B as Badge, b as Button, k as LoadingSpinner, l as ue } from "./index-CPnZ4-ee.js";
import { L as Layout } from "./Layout-BDI6gK-F.js";
import { C as Checkbox } from "./checkbox-CicwDbDO.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-C-qTt0dW.js";
import { u as useUserRole } from "./use-user-role-gvzFlaTO.js";
import { A as AnimatePresence } from "./index-B1ryDmk5.js";
import { m as motion } from "./proxy-CcVjNv5F.js";
import "./index-C6Eg3qxK.js";
import "./chevron-up-C9u-2erU.js";
const RISK_OPTIONS = [
  {
    value: "Conservative",
    label: "Conservative",
    desc: "Low-risk, capital preservation focus"
  },
  { value: "Moderate", label: "Moderate", desc: "Balanced risk and return" },
  {
    value: "Aggressive",
    label: "Aggressive",
    desc: "Higher risk for higher potential return"
  }
];
const LEGAL_BASIS = [
  "Cooperative",
  "Investment Club",
  "Family Office",
  "Partnership",
  "Other"
];
const INSTRUMENTS = [
  {
    id: "Murabaha",
    label: "Murabaha",
    arabic: "مرابحة",
    desc: "Cost-plus sale — the financier buys an asset and resells it to you at a disclosed profit margin, payable in instalments.",
    example: "A textile trader needs a ₦5M loom. The financier buys it and sells it to the trader for ₦5.8M over 12 months."
  },
  {
    id: "Musharakah",
    label: "Musharakah",
    arabic: "مشاركة",
    desc: "Partnership — both parties contribute capital. Profits are shared by agreed ratio; losses shared proportionally.",
    example: "A food processor and a financier each put in ₦10M to expand production. Profits split 60/40."
  },
  {
    id: "Mudarabah",
    label: "Mudarabah",
    arabic: "مضاربة",
    desc: "Silent partnership — the financier provides all capital; the entrepreneur provides expertise. Profits shared; capital loss borne by financier.",
    example: "A logistics startup receives ₦8M from a financier. The founder manages operations. Profits split 70/30."
  },
  {
    id: "Ijarah",
    label: "Ijarah",
    arabic: "إجارة",
    desc: "Lease — the financier buys an asset and leases it to you for a fixed rental. Ownership stays with the financier during the lease.",
    example: "A clinic needs an MRI machine. The financier buys it and leases it to the clinic at ₦200K/month for 3 years."
  },
  {
    id: "Istisna",
    label: "Istisna",
    arabic: "استصناع",
    desc: "Manufacturing finance — the financier pays you to produce something to specification, with payment made in stages.",
    example: "A construction company is contracted to build a warehouse. The financier pays in stages as construction progresses."
  },
  {
    id: "Salam",
    label: "Salam",
    arabic: "سلم",
    desc: "Advance purchase — full payment made now for goods to be delivered later. Commonly used in agriculture.",
    example: "A rice farmer receives full payment now for 50 tonnes of rice to be delivered at harvest."
  }
];
function getSteps(financierType) {
  const detailLabel = financierType === "institution" ? "Organisation Details" : financierType === "individual" ? "Personal Details" : financierType === "group" ? "Group Details" : "Your Details";
  return [
    { label: "Financier Type", sublabel: "Who are you?" },
    { label: detailLabel, sublabel: "Profile information" },
    {
      label: "Preferred Financing Instruments",
      sublabel: "Select instruments"
    },
    { label: "Risk & Capacity", sublabel: "Risk appetite and sectors" },
    { label: "Review & Submit", sublabel: "Confirm and send" }
  ];
}
function formatNaira(raw) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-NG");
}
function parseNaira(formatted) {
  return formatted.replace(/,/g, "");
}
function StepProgress({
  current,
  financierType
}) {
  const steps = getSteps(financierType);
  const total = steps.length;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-8", "data-ocid": "register_financier.progress", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-0 mb-3", children: steps.map((step, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center flex-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: `w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold transition-all duration-300 ${i < current ? "bg-primary text-primary-foreground" : i === current ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted text-muted-foreground"}`,
          children: i < current ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            "svg",
            {
              role: "img",
              className: "w-4 h-4",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              strokeWidth: 2.5,
              "aria-label": "Step completed",
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
          className: `flex-1 h-0.5 mx-1 transition-colors duration-300 ${i < current ? "bg-primary" : "bg-border"}`
        }
      )
    ] }, step.label)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-between mt-1", children: steps.map((step, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "span",
      {
        className: `text-xs font-medium transition-colors min-w-0 ${i === current ? "text-primary" : i < current ? "text-muted-foreground" : "text-muted-foreground/50"}`,
        style: {
          width: `${100 / total}%`,
          textAlign: i === 0 ? "left" : i === total - 1 ? "right" : "center"
        },
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "block truncate", children: step.label })
      },
      step.label
    )) })
  ] });
}
function RadioCard({
  selected,
  onClick,
  title,
  subtitle,
  ocid
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "button",
    {
      type: "button",
      onClick,
      "data-ocid": ocid,
      className: `w-full text-left p-5 rounded-xl border-2 transition-all duration-200 ${selected ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"}`,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: `mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${selected ? "border-primary" : "border-muted-foreground/40"}`,
            children: selected && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-2.5 h-2.5 rounded-full bg-primary" })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-semibold text-foreground font-display", children: title }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: subtitle })
        ] })
      ] })
    }
  );
}
function FieldError({ msg, ocid }) {
  if (!msg) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-destructive mt-1", "data-ocid": ocid, children: msg });
}
function InstrumentCheckboxes({
  selected,
  onChange,
  prefix
}) {
  const [expanded, setExpanded] = reactExports.useState(null);
  const toggle = (id) => onChange(
    selected.includes(id) ? selected.filter((i) => i !== id) : [...selected, id]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2", children: INSTRUMENTS.map((inst) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: `rounded-lg border transition-all duration-200 ${selected.includes(inst.id) ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3 p-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Checkbox,
            {
              id: `${prefix}-instrument-${inst.id.toLowerCase()}`,
              checked: selected.includes(inst.id),
              onCheckedChange: () => toggle(inst.id),
              className: "mt-0.5",
              "data-ocid": `${prefix}.instrument_${inst.id.toLowerCase()}`
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "label",
              {
                htmlFor: `${prefix}-instrument-${inst.id.toLowerCase()}`,
                className: "flex items-center gap-2 cursor-pointer",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-sm text-foreground", children: inst.label }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: inst.arabic })
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-0.5 line-clamp-2", children: inst.desc })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: () => setExpanded(expanded === inst.id ? null : inst.id),
              className: "text-xs text-primary hover:underline flex-shrink-0 mt-0.5",
              "aria-label": `${expanded === inst.id ? "Hide" : "Show"} example for ${inst.label}`,
              children: expanded === inst.id ? "Hide" : "Example"
            }
          )
        ] }),
        expanded === inst.id && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-3 pb-3 ml-6", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3", children: inst.example }) })
      ]
    },
    inst.id
  )) });
}
function SummaryRow({
  label,
  value
}) {
  if (!value) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 py-1.5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground w-40 flex-shrink-0", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-foreground font-medium break-words min-w-0 flex-1", children: value })
  ] });
}
function SummarySection({
  title,
  step,
  onEdit,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-border bg-muted/30 overflow-hidden", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-foreground font-display", children: title }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          onClick: () => onEdit(step),
          className: "text-xs text-primary hover:underline font-medium",
          "data-ocid": `register_financier.summary_edit_step${step}`,
          children: "Edit"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-4 py-2", children })
  ] });
}
function RegisterFinancierPage() {
  const DRAFT_KEY = "vetify_financier_draft";
  const isRestored = reactExports.useRef(false);
  const { actor } = useBackend();
  const { refetch } = useUserRole();
  const router = useRouter();
  const [step, setStep] = reactExports.useState(0);
  const [isSubmitting, setIsSubmitting] = reactExports.useState(false);
  const [financierType, setFinancierType] = reactExports.useState("");
  const [typeError, setTypeError] = reactExports.useState("");
  const [termsAccepted, setTermsAccepted] = reactExports.useState(false);
  const [privacyAccepted, setPrivacyAccepted] = reactExports.useState(false);
  const [ndprAccepted, setNdprAccepted] = reactExports.useState(false);
  const [instName, setInstName] = reactExports.useState("");
  const [instLicense, setInstLicense] = reactExports.useState("");
  const [instContact, setInstContact] = reactExports.useState("");
  const [instEmail, setInstEmail] = reactExports.useState("");
  const [instPhone, setInstPhone] = reactExports.useState("");
  const [instRiskAppetite, setInstRiskAppetite] = reactExports.useState("");
  const [instTicketMin, setInstTicketMin] = reactExports.useState("");
  const [instTicketMax, setInstTicketMax] = reactExports.useState("");
  const [indivName, setIndivName] = reactExports.useState("");
  const [indivBvn, setIndivBvn] = reactExports.useState("");
  const [indivNin, setIndivNin] = reactExports.useState("");
  const [indivOccupation, setIndivOccupation] = reactExports.useState("");
  const [instPreferredSectors, setInstPreferredSectors] = reactExports.useState(
    []
  );
  const [indivPreferredSectors, setIndivPreferredSectors] = reactExports.useState(
    []
  );
  const [grpPreferredSectors, setGrpPreferredSectors] = reactExports.useState([]);
  const [instInstruments, setInstInstruments] = reactExports.useState([]);
  const [indivCapacity, setIndivCapacity] = reactExports.useState("");
  const [indivInstruments, setIndivInstruments] = reactExports.useState([]);
  const [indivRisk, setIndivRisk] = reactExports.useState("");
  const [grpName, setGrpName] = reactExports.useState("");
  const [grpMembers, setGrpMembers] = reactExports.useState("");
  const [grpLeadName, setGrpLeadName] = reactExports.useState("");
  const [grpLeadBvn, setGrpLeadBvn] = reactExports.useState("");
  const [grpLeadNin, setGrpLeadNin] = reactExports.useState("");
  const [grpCapacity, setGrpCapacity] = reactExports.useState("");
  const [grpLegalBasis, setGrpLegalBasis] = reactExports.useState("");
  const [grpInstruments, setGrpInstruments] = reactExports.useState([]);
  const [grpRisk, setGrpRisk] = reactExports.useState("");
  const [detailErrors, setDetailErrors] = reactExports.useState({});
  reactExports.useEffect(() => {
    if (isRestored.current) return;
    isRestored.current = true;
    try {
      const saved = localStorage.getItem(DRAFT_KEY) || localStorage.getItem("halalvet_financier_draft");
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
    } catch {
    }
  }, []);
  reactExports.useEffect(() => {
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
          grpRisk
        })
      );
    } catch {
    }
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
    grpRisk
  ]);
  const validateStep0 = () => {
    if (!financierType) {
      setTypeError("Please select a financier type to continue");
      return false;
    }
    setTypeError("");
    return true;
  };
  const validateDetails = () => {
    const errs = {};
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
  const handleSubmit = async () => {
    if (!validateDetails() || !actor) return;
    setIsSubmitting(true);
    try {
      const institutionDetails = financierType === "institution" ? {
        licenseNumber: instLicense,
        riskAppetite: instRiskAppetite,
        ticketSizeMin: BigInt(
          Math.round(Number(parseNaira(instTicketMin)) || 0)
        ),
        ticketSizeMax: BigInt(
          Math.round(Number(parseNaira(instTicketMax)) || 0)
        ),
        preferredInstruments: instInstruments
      } : null;
      const individualDetails = financierType === "individual" ? {
        fullName: indivName,
        bvn: indivBvn,
        nin: indivNin,
        occupation: indivOccupation,
        investmentCapacity: BigInt(
          Math.round(Number(parseNaira(indivCapacity)) || 0)
        ),
        preferredInstruments: indivInstruments,
        riskAppetite: indivRisk
      } : null;
      const groupDetails = financierType === "group" ? {
        groupName: grpName,
        numberOfMembers: BigInt(Math.round(Number(grpMembers) || 0)),
        leadContactName: grpLeadName,
        leadContactBvn: grpLeadBvn,
        leadContactNin: grpLeadNin,
        combinedInvestmentCapacity: BigInt(
          Math.round(Number(parseNaira(grpCapacity)) || 0)
        ),
        legalBasis: grpLegalBasis,
        preferredInstruments: grpInstruments,
        riskAppetite: grpRisk
      } : null;
      const displayName = financierType === "institution" ? instName : financierType === "individual" ? indivName : grpName;
      await actor.registerAsFinancier(
        displayName,
        financierType === "institution" ? instLicense : "",
        financierType === "institution" ? instContact : financierType === "group" ? grpLeadName : indivName,
        financierType === "institution" ? instEmail : "",
        financierType === "institution" ? instPhone : "",
        instPreferredSectors,
        financierType,
        institutionDetails,
        individualDetails,
        groupDetails
      );
      await refetch();
      ue.success(
        "Financier registration submitted! Your account is under review."
      );
      localStorage.removeItem(DRAFT_KEY);
      router.navigate({ to: "/financier/dashboard" });
    } catch (err) {
      ue.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };
  const [returnToSummary, setReturnToSummary] = reactExports.useState(false);
  const handleNext = () => {
    if (step === 0 && validateStep0()) setStep(1);
    else if (step === 1 && validateDetails()) {
      setReturnToSummary(false);
      setStep(2);
    } else if (step >= 2 && step < 4) {
      setReturnToSummary(false);
      setStep((s) => s + 1);
    }
  };
  const goToStep = (s, ret = false) => {
    setReturnToSummary(ret);
    setStep(s);
  };
  const typeLabel = financierType === "institution" ? "Institution" : financierType === "individual" ? "Individual" : financierType === "group" ? "Group of Individuals" : "";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Layout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-2xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Financier Registration",
        subtitle: "تسجيل الممول — Register to access verified halal financing profiles",
        breadcrumbs: [
          { label: "Home", href: "/" },
          { label: "Register Financier" }
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { className: "shadow-lg", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "pt-8 pb-8 px-6 sm:px-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(StepProgress, { current: step, financierType }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(AnimatePresence, { mode: "wait", children: [
        step === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Financier Type" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Select your financier category. This determines what information you'll provide next." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  RadioCard,
                  {
                    selected: financierType === "institution",
                    onClick: () => {
                      setFinancierType("institution");
                      setTypeError("");
                    },
                    title: "Institution",
                    subtitle: "Islamic bank, microfinance institution, development finance institution, or other licensed entity.",
                    ocid: "register_financier.type_institution"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  RadioCard,
                  {
                    selected: financierType === "individual",
                    onClick: () => {
                      setFinancierType("individual");
                      setTypeError("");
                    },
                    title: "Individual",
                    subtitle: "A high-net-worth individual or private investor seeking to provide halal financing.",
                    ocid: "register_financier.type_individual"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  RadioCard,
                  {
                    selected: financierType === "group",
                    onClick: () => {
                      setFinancierType("group");
                      setTypeError("");
                    },
                    title: "Group of Individuals",
                    subtitle: "Co-operative, investment club, family office, or a group of investors with a shared mandate.",
                    ocid: "register_financier.type_group"
                  }
                )
              ] }),
              typeError && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "p",
                {
                  className: "text-xs text-destructive mt-3",
                  "data-ocid": "register_financier.type_error",
                  children: typeError
                }
              )
            ]
          },
          "step0"
        ),
        step === 1 && financierType === "institution" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Institution Details" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Provide your licensed institution information." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "instName", children: "Institution Name *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "instName",
                      placeholder: "Al-Baraka Islamic Finance Ltd.",
                      value: instName,
                      onChange: (e) => setInstName(e.target.value),
                      "data-ocid": "register_financier.inst_name_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.instName,
                      ocid: "register_financier.inst_name_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "instLicense", children: "License Number" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "instLicense",
                      placeholder: "LIC/2024/001",
                      value: instLicense,
                      onChange: (e) => setInstLicense(e.target.value),
                      "data-ocid": "register_financier.inst_license_input"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "instContact", children: "Contact Person *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "instContact",
                      placeholder: "Dr. Fatimah Al-Hassan",
                      value: instContact,
                      onChange: (e) => setInstContact(e.target.value),
                      "data-ocid": "register_financier.inst_contact_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.instContact,
                      ocid: "register_financier.inst_contact_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "instEmail", children: "Official Email *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "instEmail",
                      type: "email",
                      placeholder: "contact@albaraka.ng",
                      value: instEmail,
                      onChange: (e) => setInstEmail(e.target.value),
                      "data-ocid": "register_financier.inst_email_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.instEmail,
                      ocid: "register_financier.inst_email_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "instPhone", children: "Phone Number *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "instPhone",
                      placeholder: "+2348012345678",
                      value: instPhone,
                      onChange: (e) => setInstPhone(e.target.value),
                      "data-ocid": "register_financier.inst_phone_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.instPhone,
                      ocid: "register_financier.inst_phone_error"
                    }
                  )
                ] })
              ] })
            ]
          },
          "inst"
        ),
        step === 2 && financierType === "institution" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Preferred Financing Instruments" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Select the instruments you are willing to offer. Click “Example” to see a practical use case." }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                InstrumentCheckboxes,
                {
                  selected: instInstruments,
                  onChange: setInstInstruments,
                  prefix: "register_financier.inst"
                }
              )
            ]
          },
          "inst-inst"
        ),
        step === 2 && financierType === "individual" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Preferred Financing Instruments" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Select the instruments you are willing to offer. Click “Example” to see a practical use case." }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                InstrumentCheckboxes,
                {
                  selected: indivInstruments,
                  onChange: setIndivInstruments,
                  prefix: "register_financier.indiv"
                }
              )
            ]
          },
          "indiv-inst"
        ),
        step === 2 && financierType === "group" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Preferred Financing Instruments" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Select the instruments your group is willing to offer. Click “Example” to see a practical use case." }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                InstrumentCheckboxes,
                {
                  selected: grpInstruments,
                  onChange: setGrpInstruments,
                  prefix: "register_financier.grp"
                }
              )
            ]
          },
          "grp-inst"
        ),
        step === 3 && financierType === "institution" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Risk & Capacity" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Define your risk appetite, ticket size, and preferred sectors." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Risk Appetite" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    Select,
                    {
                      value: instRiskAppetite,
                      onValueChange: setInstRiskAppetite,
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { "data-ocid": "register_financier.inst_risk_select", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Select…" }) }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: RISK_OPTIONS.map((r) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: r.value, children: r.label }, r.value)) })
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "instTicketMin", children: "Min Ticket Size (₦)" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "instTicketMin",
                      placeholder: "500,000",
                      value: instTicketMin,
                      onChange: (e) => setInstTicketMin(formatNaira(e.target.value)),
                      "data-ocid": "register_financier.inst_ticket_min_input"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "instTicketMax", children: "Max Ticket Size (₦)" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "instTicketMax",
                      placeholder: "10,000,000",
                      value: instTicketMax,
                      onChange: (e) => setInstTicketMax(formatNaira(e.target.value)),
                      "data-ocid": "register_financier.inst_ticket_max_input"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(Label, { className: "block text-sm font-medium text-foreground mb-1", children: [
                    "Preferred Sectors",
                    " ",
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-destructive", children: "*" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mb-3", children: "Select all sectors you are interested in financing" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-2 gap-2", children: [
                    "Agriculture",
                    "Manufacturing",
                    "Trade & Commerce",
                    "Real Estate",
                    "Education",
                    "Healthcare",
                    "Technology",
                    "Energy",
                    "Transportation",
                    "Other"
                  ].map((sector) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "div",
                    {
                      className: "flex items-center gap-2 cursor-pointer",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          Checkbox,
                          {
                            checked: instPreferredSectors.includes(sector),
                            onCheckedChange: (checked) => {
                              setInstPreferredSectors(
                                (prev) => checked ? [...prev, sector] : prev.filter((s) => s !== sector)
                              );
                            },
                            className: "h-4 w-4",
                            "data-ocid": `register_financier.inst_sector_${sector.toLowerCase().replace(/\s+/g, "_")}`
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-foreground", children: sector })
                      ]
                    },
                    sector
                  )) })
                ] })
              ] })
            ]
          },
          "inst-risk"
        ),
        step === 3 && financierType === "individual" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Risk & Capacity" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Define your risk appetite, investment capacity, and preferred sectors." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "indivCapacity", children: "Investment Capacity *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm", children: "₦" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Input,
                      {
                        id: "indivCapacity",
                        placeholder: "5,000,000",
                        className: "pl-7",
                        value: indivCapacity,
                        onChange: (e) => setIndivCapacity(formatNaira(e.target.value)),
                        "data-ocid": "register_financier.indiv_capacity_input"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.indivCapacity,
                      ocid: "register_financier.indiv_capacity_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Risk Appetite *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value: indivRisk, onValueChange: setIndivRisk, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { "data-ocid": "register_financier.indiv_risk_select", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Select..." }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: RISK_OPTIONS.map((r) => /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectItem, { value: r.value, children: [
                      r.label,
                      " — ",
                      r.desc
                    ] }, r.value)) })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.indivRisk,
                      ocid: "register_financier.indiv_risk_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(Label, { className: "block text-sm font-medium text-foreground mb-1", children: [
                    "Preferred Sectors",
                    " ",
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-destructive", children: "*" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mb-3", children: "Select all sectors you are interested in financing" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-2 gap-2", children: [
                    "Agriculture",
                    "Manufacturing",
                    "Trade & Commerce",
                    "Real Estate",
                    "Education",
                    "Healthcare",
                    "Technology",
                    "Energy",
                    "Transportation",
                    "Other"
                  ].map((sector) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "div",
                    {
                      className: "flex items-center gap-2 cursor-pointer",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          Checkbox,
                          {
                            checked: indivPreferredSectors.includes(sector),
                            onCheckedChange: (checked) => {
                              setIndivPreferredSectors(
                                (prev) => checked ? [...prev, sector] : prev.filter((s) => s !== sector)
                              );
                            },
                            className: "h-4 w-4",
                            "data-ocid": `register_financier.indiv_sector_${sector.toLowerCase().replace(/\s+/g, "_")}`
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-foreground", children: sector })
                      ]
                    },
                    sector
                  )) })
                ] })
              ] })
            ]
          },
          "indiv-risk"
        ),
        step === 3 && financierType === "group" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Risk & Capacity" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Define your group's risk appetite, combined capacity, and preferred sectors." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "grpCapacity", children: "Combined Investment Capacity *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm", children: "₦" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Input,
                      {
                        id: "grpCapacity",
                        placeholder: "25,000,000",
                        className: "pl-7",
                        value: grpCapacity,
                        onChange: (e) => setGrpCapacity(formatNaira(e.target.value)),
                        "data-ocid": "register_financier.grp_capacity_input"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.grpCapacity,
                      ocid: "register_financier.grp_capacity_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Risk Appetite *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value: grpRisk, onValueChange: setGrpRisk, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { "data-ocid": "register_financier.grp_risk_select", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Select..." }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: RISK_OPTIONS.map((r) => /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectItem, { value: r.value, children: [
                      r.label,
                      " — ",
                      r.desc
                    ] }, r.value)) })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.grpRisk,
                      ocid: "register_financier.grp_risk_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(Label, { className: "block text-sm font-medium text-foreground mb-1", children: [
                    "Preferred Sectors",
                    " ",
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-destructive", children: "*" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mb-3", children: "Select all sectors your group is interested in financing" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-2 gap-2", children: [
                    "Agriculture",
                    "Manufacturing",
                    "Trade & Commerce",
                    "Real Estate",
                    "Education",
                    "Healthcare",
                    "Technology",
                    "Energy",
                    "Transportation",
                    "Other"
                  ].map((sector) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "div",
                    {
                      className: "flex items-center gap-2 cursor-pointer",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          Checkbox,
                          {
                            checked: grpPreferredSectors.includes(sector),
                            onCheckedChange: (checked) => {
                              setGrpPreferredSectors(
                                (prev) => checked ? [...prev, sector] : prev.filter((s) => s !== sector)
                              );
                            },
                            className: "h-4 w-4",
                            "data-ocid": `register_financier.grp_sector_${sector.toLowerCase().replace(/\s+/g, "_")}`
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-foreground", children: sector })
                      ]
                    },
                    sector
                  )) })
                ] })
              ] })
            ]
          },
          "grp-risk"
        ),
        step === 1 && financierType === "individual" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Individual Investor Details" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Provide your personal and investment profile." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "indivName", children: "Full Name *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "indivName",
                      placeholder: "Alhaji Musa Ibrahim",
                      value: indivName,
                      onChange: (e) => setIndivName(e.target.value),
                      "data-ocid": "register_financier.indiv_name_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.indivName,
                      ocid: "register_financier.indiv_name_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "indivBvn", children: "BVN" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "indivBvn",
                      placeholder: "22123456789",
                      maxLength: 11,
                      value: indivBvn,
                      onKeyPress: (e) => {
                        if (!/[0-9]/.test(e.key)) e.preventDefault();
                      },
                      onChange: (e) => setIndivBvn(
                        e.target.value.replace(/\D/g, "").slice(0, 11)
                      ),
                      "data-ocid": "register_financier.indiv_bvn_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "11-digit Bank Verification Number" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.indivBvn,
                      ocid: "register_financier.indiv_bvn_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "indivNin", children: "NIN" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "indivNin",
                      placeholder: "12345678901",
                      maxLength: 11,
                      value: indivNin,
                      onKeyPress: (e) => {
                        if (!/[0-9]/.test(e.key)) e.preventDefault();
                      },
                      onChange: (e) => setIndivNin(
                        e.target.value.replace(/\D/g, "").slice(0, 11)
                      ),
                      "data-ocid": "register_financier.indiv_nin_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "11-digit National Identification Number" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.indivNin,
                      ocid: "register_financier.indiv_nin_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "indivOccupation", children: "Occupation" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "indivOccupation",
                      placeholder: "Business owner / Entrepreneur",
                      value: indivOccupation,
                      onChange: (e) => setIndivOccupation(e.target.value),
                      "data-ocid": "register_financier.indiv_occupation_input"
                    }
                  )
                ] })
              ] })
            ]
          },
          "indiv"
        ),
        step === 1 && financierType === "group" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Group Details" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Provide details about your investment group or co-operative." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "grpName", children: "Group Name *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "grpName",
                      placeholder: "Kano Halal Investment Club",
                      value: grpName,
                      onChange: (e) => setGrpName(e.target.value),
                      "data-ocid": "register_financier.grp_name_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.grpName,
                      ocid: "register_financier.grp_name_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "grpMembers", children: "Number of Members" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "grpMembers",
                      type: "number",
                      min: "2",
                      placeholder: "12",
                      value: grpMembers,
                      onChange: (e) => setGrpMembers(e.target.value),
                      "data-ocid": "register_financier.grp_members_input"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Legal Basis" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    Select,
                    {
                      value: grpLegalBasis,
                      onValueChange: setGrpLegalBasis,
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { "data-ocid": "register_financier.grp_legal_select", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Select..." }) }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: LEGAL_BASIS.map((b) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: b, children: b }, b)) })
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-foreground pt-1", children: "Lead Contact" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "grpLeadName", children: "Lead Contact Name *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "grpLeadName",
                      placeholder: "Umar Farouq",
                      value: grpLeadName,
                      onChange: (e) => setGrpLeadName(e.target.value),
                      "data-ocid": "register_financier.grp_lead_name_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.grpLeadName,
                      ocid: "register_financier.grp_lead_name_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "grpLeadBvn", children: "Lead BVN" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "grpLeadBvn",
                      placeholder: "22123456789",
                      maxLength: 11,
                      value: grpLeadBvn,
                      onKeyPress: (e) => {
                        if (!/[0-9]/.test(e.key)) e.preventDefault();
                      },
                      onChange: (e) => setGrpLeadBvn(
                        e.target.value.replace(/\D/g, "").slice(0, 11)
                      ),
                      "data-ocid": "register_financier.grp_lead_bvn_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "11-digit Bank Verification Number" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.grpLeadBvn,
                      ocid: "register_financier.grp_lead_bvn_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "grpLeadNin", children: "Lead NIN" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "grpLeadNin",
                      placeholder: "12345678901",
                      maxLength: 11,
                      value: grpLeadNin,
                      onKeyPress: (e) => {
                        if (!/[0-9]/.test(e.key)) e.preventDefault();
                      },
                      onChange: (e) => setGrpLeadNin(
                        e.target.value.replace(/\D/g, "").slice(0, 11)
                      ),
                      "data-ocid": "register_financier.grp_lead_nin_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "11-digit National Identification Number" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.grpLeadNin,
                      ocid: "register_financier.grp_lead_nin_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "grpCapacity", children: "Combined Investment Capacity *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm", children: "₦" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Input,
                      {
                        id: "grpCapacity",
                        placeholder: "25,000,000",
                        className: "pl-7",
                        value: grpCapacity,
                        onChange: (e) => setGrpCapacity(formatNaira(e.target.value)),
                        "data-ocid": "register_financier.grp_capacity_input"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: detailErrors.grpCapacity,
                      ocid: "register_financier.grp_capacity_error"
                    }
                  )
                ] })
              ] })
            ]
          },
          "grp"
        ),
        step === 4 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            "data-ocid": "register_financier.summary_panel",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Review Your Application" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-muted-foreground mb-6", children: [
                "Please review the information below before submitting. Click",
                " ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Edit" }),
                " on any section to make changes."
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  SummarySection,
                  {
                    title: "Financier Type",
                    step: 0,
                    onEdit: (s) => goToStep(s, true),
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Type", value: typeLabel })
                  }
                ),
                financierType === "institution" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    SummarySection,
                    {
                      title: "Institution Details",
                      step: 1,
                      onEdit: (s) => goToStep(s, true),
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Institution Name",
                            value: instName
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "License Number",
                            value: instLicense || void 0
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Contact Person",
                            value: instContact
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Email", value: instEmail }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Phone", value: instPhone })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    SummarySection,
                    {
                      title: "Preferred Financing Instruments",
                      step: 2,
                      onEdit: (s) => goToStep(s, true),
                      children: instInstruments.length > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-1", children: instInstruments.map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Badge,
                        {
                          variant: "secondary",
                          className: "text-xs",
                          children: i
                        },
                        i
                      )) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground italic", children: "None selected" })
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    SummarySection,
                    {
                      title: "Risk & Capacity",
                      step: 3,
                      onEdit: (s) => goToStep(s, true),
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Risk Appetite",
                            value: instRiskAppetite || void 0
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Min Ticket",
                            value: instTicketMin ? `₦${instTicketMin}` : void 0
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Max Ticket",
                            value: instTicketMax ? `₦${instTicketMax}` : void 0
                          }
                        ),
                        instPreferredSectors.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 py-1.5", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground w-40 flex-shrink-0", children: "Preferred Sectors" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-1 min-w-0 flex-1", children: instPreferredSectors.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Badge,
                            {
                              variant: "secondary",
                              className: "text-xs",
                              children: s
                            },
                            s
                          )) })
                        ] })
                      ]
                    }
                  )
                ] }),
                financierType === "individual" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    SummarySection,
                    {
                      title: "Individual Investor Details",
                      step: 1,
                      onEdit: (s) => goToStep(s, true),
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Full Name", value: indivName }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "BVN",
                            value: indivBvn ? `••••••• ${indivBvn.slice(-4)}` : void 0
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "NIN",
                            value: indivNin ? `••••••• ${indivNin.slice(-4)}` : void 0
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Occupation",
                            value: indivOccupation || void 0
                          }
                        )
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    SummarySection,
                    {
                      title: "Preferred Financing Instruments",
                      step: 2,
                      onEdit: (s) => goToStep(s, true),
                      children: indivInstruments.length > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-1", children: indivInstruments.map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Badge,
                        {
                          variant: "secondary",
                          className: "text-xs",
                          children: i
                        },
                        i
                      )) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground italic", children: "None selected" })
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    SummarySection,
                    {
                      title: "Risk & Capacity",
                      step: 3,
                      onEdit: (s) => goToStep(s, true),
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Investment Capacity",
                            value: indivCapacity ? `₦${indivCapacity}` : void 0
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Risk Appetite",
                            value: indivRisk || void 0
                          }
                        ),
                        indivPreferredSectors.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 py-1.5", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground w-40 flex-shrink-0", children: "Preferred Sectors" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-1 min-w-0 flex-1", children: indivPreferredSectors.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Badge,
                            {
                              variant: "secondary",
                              className: "text-xs",
                              children: s
                            },
                            s
                          )) })
                        ] })
                      ]
                    }
                  )
                ] }),
                financierType === "group" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    SummarySection,
                    {
                      title: "Group Details",
                      step: 1,
                      onEdit: (s) => goToStep(s, true),
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Group Name", value: grpName }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Number of Members",
                            value: grpMembers || void 0
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Legal Basis",
                            value: grpLegalBasis || void 0
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Lead Contact",
                            value: grpLeadName
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Lead BVN",
                            value: grpLeadBvn ? `••••••• ${grpLeadBvn.slice(-4)}` : void 0
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Lead NIN",
                            value: grpLeadNin ? `••••••• ${grpLeadNin.slice(-4)}` : void 0
                          }
                        )
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    SummarySection,
                    {
                      title: "Preferred Financing Instruments",
                      step: 2,
                      onEdit: (s) => goToStep(s, true),
                      children: grpInstruments.length > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-1", children: grpInstruments.map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Badge,
                        {
                          variant: "secondary",
                          className: "text-xs",
                          children: i
                        },
                        i
                      )) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground italic", children: "None selected" })
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    SummarySection,
                    {
                      title: "Risk & Capacity",
                      step: 3,
                      onEdit: (s) => goToStep(s, true),
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Combined Capacity",
                            value: grpCapacity ? `₦${grpCapacity}` : void 0
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          SummaryRow,
                          {
                            label: "Risk Appetite",
                            value: grpRisk || void 0
                          }
                        ),
                        grpPreferredSectors.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 py-1.5", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground w-40 flex-shrink-0", children: "Preferred Sectors" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-1 min-w-0 flex-1", children: grpPreferredSectors.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Badge,
                            {
                              variant: "secondary",
                              className: "text-xs",
                              children: s
                            },
                            s
                          )) })
                        ] })
                      ]
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6 rounded-xl bg-primary/5 border border-primary/20 p-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "By submitting, your application will be reviewed by our compliance team. You will be notified via WhatsApp when your status changes." }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "mt-4 space-y-3",
                  "data-ocid": "register_financier.compliance_section",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-muted-foreground", children: "Consent & Compliance" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "label",
                      {
                        htmlFor: "reg-fin-terms",
                        className: "flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors",
                        "data-ocid": "register_financier.terms_checkbox_label",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Checkbox,
                            {
                              id: "reg-fin-terms",
                              checked: termsAccepted,
                              onCheckedChange: (v) => setTermsAccepted(!!v),
                              className: "mt-0.5",
                              "data-ocid": "register_financier.terms_checkbox"
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-foreground leading-relaxed", children: [
                            "I have read and agree to the",
                            " ",
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "a",
                              {
                                href: "/terms",
                                target: "_blank",
                                rel: "noopener noreferrer",
                                className: "text-primary underline underline-offset-2",
                                children: "Terms and Conditions"
                              }
                            ),
                            ". ",
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-destructive", children: "*" })
                          ] })
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "label",
                      {
                        htmlFor: "reg-fin-privacy",
                        className: "flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors",
                        "data-ocid": "register_financier.privacy_checkbox_label",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Checkbox,
                            {
                              id: "reg-fin-privacy",
                              checked: privacyAccepted,
                              onCheckedChange: (v) => setPrivacyAccepted(!!v),
                              className: "mt-0.5",
                              "data-ocid": "register_financier.privacy_checkbox"
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-foreground leading-relaxed", children: [
                            "I have read and agree to the",
                            " ",
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "a",
                              {
                                href: "/privacy",
                                target: "_blank",
                                rel: "noopener noreferrer",
                                className: "text-primary underline underline-offset-2",
                                children: "Privacy Policy"
                              }
                            ),
                            ". ",
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-destructive", children: "*" })
                          ] })
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "label",
                      {
                        htmlFor: "reg-fin-ndpr",
                        className: "flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors",
                        "data-ocid": "register_financier.ndpr_checkbox_label",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Checkbox,
                            {
                              id: "reg-fin-ndpr",
                              checked: ndprAccepted,
                              onCheckedChange: (v) => setNdprAccepted(!!v),
                              className: "mt-0.5",
                              "data-ocid": "register_financier.ndpr_checkbox"
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-foreground leading-relaxed", children: [
                            "I consent to the processing of my personal data in compliance with the",
                            " ",
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "abbr",
                              {
                                title: "Nigeria Data Protection Regulation",
                                className: "cursor-help",
                                children: "NDPR"
                              }
                            ),
                            ". ",
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-destructive", children: "*" })
                          ] })
                        ]
                      }
                    )
                  ]
                }
              )
            ]
          },
          "summary"
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between gap-3 mt-8 pt-6 border-t border-border", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            type: "button",
            variant: "outline",
            onClick: () => {
              if (step === 0) router.navigate({ to: "/" });
              else setStep((s) => s - 1);
            },
            "data-ocid": "register_financier.back_button",
            children: step === 0 ? "Cancel" : "← Back"
          }
        ),
        step < 4 && /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            type: "button",
            onClick: handleNext,
            "data-ocid": "register_financier.next_button",
            children: returnToSummary ? "Return to Summary →" : "Continue →"
          }
        ),
        step === 4 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            type: "button",
            onClick: handleSubmit,
            disabled: isSubmitting || !actor || !termsAccepted || !privacyAccepted || !ndprAccepted,
            className: "gap-2 min-w-[160px]",
            "data-ocid": "register_financier.submit_button",
            children: [
              isSubmitting && /* @__PURE__ */ jsxRuntimeExports.jsx(LoadingSpinner, { size: "sm", label: "" }),
              isSubmitting ? "Submitting…" : "Submit Registration"
            ]
          }
        )
      ] })
    ] }) })
  ] }) });
}
export {
  RegisterFinancierPage as default
};
