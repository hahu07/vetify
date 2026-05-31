import { t as createLucideIcon, g as useBackend, a as useRouter, r as reactExports, j as jsxRuntimeExports, P as PageHeader, C as Card, e as CardContent, h as Label, I as Input, b as Button, f as CircleCheck, k as LoadingSpinner, l as ue } from "./index-CPnZ4-ee.js";
import { L as Layout } from "./Layout-BDI6gK-F.js";
import { C as Checkbox } from "./checkbox-CicwDbDO.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-C-qTt0dW.js";
import { T as Textarea } from "./textarea-DWu_HpBl.js";
import { u as useUserRole } from "./use-user-role-gvzFlaTO.js";
import { d as validateCac, e as validateTin, b as validateBvn, c as validateNin } from "./validation-JH4EM2gO.js";
import { A as AnimatePresence } from "./index-B1ryDmk5.js";
import { m as motion } from "./proxy-CcVjNv5F.js";
import { I as Info } from "./info-BqIv1IIh.js";
import "./index-C6Eg3qxK.js";
import "./chevron-up-C9u-2erU.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  [
    "path",
    {
      d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
      key: "1gvzjb"
    }
  ],
  ["path", { d: "M9 18h6", key: "x1upvd" }],
  ["path", { d: "M10 22h4", key: "ceow96" }]
];
const Lightbulb = createLucideIcon("lightbulb", __iconNode);
const INSTRUMENTS = [
  {
    value: "Murabaha",
    nameEn: "Murabaha",
    nameAr: "المرابحة",
    description: "The financier buys an asset for you and sells it at an agreed marked-up price, paid in instalments — you know the profit margin upfront.",
    example: "A textile trader in Lagos needs a ₦5M loom. The financier buys it and sells it to the trader for ₦5.8M payable over 12 months."
  },
  {
    value: "Musharakah",
    nameEn: "Musharakah",
    nameAr: "المشاركة",
    description: "A joint partnership where both you and the financier contribute capital. Profits are shared by an agreed ratio; losses are borne proportionally.",
    example: "A food processing company and a financier each contribute ₦10M to expand production capacity. Profits are split 60/40."
  },
  {
    value: "Mudarabah",
    nameEn: "Mudarabah",
    nameAr: "المضاربة",
    description: "The financier provides all the capital while you provide expertise and management. Profits are shared; the financier bears capital loss if you manage honestly.",
    example: "A logistics startup in Abuja receives ₦8M from a financier. The founder manages all operations. Profits are split 70/30."
  },
  {
    value: "Ijarah",
    nameEn: "Ijarah",
    nameAr: "الإجارة",
    description: "The financier buys an asset and leases it to you at a fixed monthly rental. Ownership stays with the financier for the lease duration.",
    example: "A private clinic in Kano needs an MRI machine. The financier buys it and leases it at ₦200K/month for 3 years."
  },
  {
    value: "Istisna",
    nameEn: "Istisna’",
    nameAr: "الاستصناع",
    description: "Financing for manufacturing or construction — the financier pays you to produce something to a specification for later delivery.",
    example: "A construction company in Port Harcourt is contracted to build a warehouse. The financier pays in stages as construction progresses."
  },
  {
    value: "Salam",
    nameEn: "Salam",
    nameAr: "السلم",
    description: "Full advance payment for goods to be delivered at a later date — commonly used in agriculture.",
    example: "A rice farmer in Kebbi State receives full payment now for 50 tonnes of rice to be delivered at harvest."
  }
];
const STEPS = [
  { label: "Business Type" },
  { label: "Business Identity" },
  { label: "Business Description" },
  { label: "Directors / Proprietor" },
  { label: "Financial Information" },
  { label: "Review & Submit" }
];
const NATIONALITIES = [
  "Nigerian",
  "Ghanaian",
  "Kenyan",
  "South African",
  "British",
  "American",
  "Other"
];
function StepProgress({ current, total }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-8", "data-ocid": "register_business.progress", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-0 mb-3", children: STEPS.map((step, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center flex-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: `w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold transition-all duration-300 ${i < current ? "bg-primary text-primary-foreground" : i === current ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted text-muted-foreground"}`,
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
          className: `flex-1 h-0.5 mx-1 transition-colors duration-300 ${i < current ? "bg-primary" : "bg-border"}`
        }
      )
    ] }, step.label)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-between mt-1", children: STEPS.map((step, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "span",
      {
        className: `text-xs font-medium transition-colors min-w-0 truncate ${i === current ? "text-primary" : i < current ? "text-muted-foreground" : "text-muted-foreground/50"}`,
        style: {
          width: `${100 / total}%`,
          textAlign: i === 0 ? "left" : i === total - 1 ? "right" : "center"
        },
        children: step.label
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
      "data-ocid": `register_business.instrument_card.${index + 1}`,
      "aria-pressed": selected,
      className: `w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${selected ? "border-primary bg-primary/5 shadow-md dark:bg-primary/10" : "border-border bg-card hover:border-primary/40 hover:bg-muted/20"}`,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: `mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${selected ? "border-primary" : "border-muted-foreground/40"}`,
            children: selected && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-2 h-2 rounded-full bg-primary" })
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
              className: "text-xs text-primary font-medium hover:underline",
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
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground w-36 flex-shrink-0", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-foreground font-medium break-words min-w-0", children: value || "—" })
  ] });
}
function maskId(val) {
  if (!val || val.length <= 4) return val || "—";
  return `${".".repeat(val.length - 4)}${val.slice(-4)}`;
}
function FieldError({ msg, ocid }) {
  if (!msg) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-destructive mt-1", "data-ocid": ocid, children: msg });
}
const LS_KEY = "vetify_business_draft";
const OLD_LS_KEY = "halalvet_business_draft";
function RegisterBusinessPage() {
  const { actor } = useBackend();
  const { refetch } = useUserRole();
  const router = useRouter();
  const [step, setStep] = reactExports.useState(0);
  const [isSubmitting, setIsSubmitting] = reactExports.useState(false);
  const [returnToSummary, setReturnToSummary] = reactExports.useState(false);
  const [businessCategory, setBusinessCategory] = reactExports.useState("");
  const [catError, setCatError] = reactExports.useState("");
  const [businessName, setBusinessName] = reactExports.useState("");
  const [cacNumber, setCacNumber] = reactExports.useState("");
  const [tinNumber, setTinNumber] = reactExports.useState("");
  const [address, setAddress] = reactExports.useState("");
  const [yearOfIncorporation, setYearOfIncorporation] = reactExports.useState("");
  const [contactPerson, setContactPerson] = reactExports.useState("");
  const [phoneNumber, setPhoneNumber] = reactExports.useState("");
  const [step2Errors, setStep2Errors] = reactExports.useState({});
  const [businessDescription, setBusinessDescription] = reactExports.useState("");
  const [descError, setDescError] = reactExports.useState("");
  const [directors, setDirectors] = reactExports.useState([
    {
      directorName: "",
      bvn: "",
      nin: "",
      nationality: "Nigerian",
      ownershipPercentage: ""
    }
  ]);
  const [proprietorName, setProprietorName] = reactExports.useState("");
  const [proprietorBvn, setProprietorBvn] = reactExports.useState("");
  const [proprietorNin, setProprietorNin] = reactExports.useState("");
  const [step4Errors, setStep4Errors] = reactExports.useState({});
  const [annualRevenue, setAnnualRevenue] = reactExports.useState("");
  const [financingAmount, setFinancingAmount] = reactExports.useState("");
  const [purposeOfFinancing, setPurposeOfFinancing] = reactExports.useState("");
  const [preferredInstrument, setPreferredInstrument] = reactExports.useState("");
  const [step5Errors, setStep5Errors] = reactExports.useState({});
  const [termsAccepted, setTermsAccepted] = reactExports.useState(false);
  const [privacyAccepted, setPrivacyAccepted] = reactExports.useState(false);
  const [ndprAccepted, setNdprAccepted] = reactExports.useState(false);
  reactExports.useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY) || localStorage.getItem(OLD_LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d.businessCategory === "string")
        setBusinessCategory(d.businessCategory);
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
      if (Array.isArray(d.directors)) setDirectors(d.directors);
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
    }
  }, []);
  const debounceRef = reactExports.useRef(null);
  const saveDraft = reactExports.useCallback(() => {
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
            preferredInstrument
          })
        );
      } catch {
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
    preferredInstrument
  ]);
  reactExports.useEffect(() => {
    saveDraft();
  }, [saveDraft]);
  const validateStep1 = () => {
    if (!businessCategory) {
      setCatError("Please select a business type to continue");
      return false;
    }
    setCatError("");
    return true;
  };
  const validateStep2 = () => {
    const errs = {};
    if (!businessName.trim()) errs.businessName = "Business name is required";
    if (!cacNumber.trim()) {
      errs.cacNumber = "CAC number is required";
    } else if (validateCac(cacNumber)) {
      errs.cacNumber = validateCac(cacNumber);
    }
    if (!tinNumber.trim()) {
      errs.tinNumber = "TIN is required";
    } else if (validateTin(tinNumber)) {
      errs.tinNumber = validateTin(tinNumber);
    }
    if (!address.trim()) errs.address = "Address is required";
    if (!contactPerson.trim())
      errs.contactPerson = "Contact person is required";
    if (!phoneNumber.trim()) errs.phoneNumber = "Phone number is required";
    const yr = Number(yearOfIncorporation);
    if (!yearOfIncorporation.trim()) {
      errs.yearOfIncorporation = "Year of incorporation is required";
    } else if (!/^\d{4}$/.test(yearOfIncorporation) || yr < 1900 || yr > (/* @__PURE__ */ new Date()).getFullYear()) {
      errs.yearOfIncorporation = "Enter a valid 4-digit year";
    }
    setStep2Errors(errs);
    return Object.keys(errs).length === 0;
  };
  const validateStep3 = () => {
    if (businessDescription.trim().length < 50) {
      setDescError(
        "Description must be at least 50 characters to enable Shariah compliance screening"
      );
      return false;
    }
    setDescError("");
    return true;
  };
  const validateStep4 = () => {
    const errs = {};
    if (businessCategory === "LLC") {
      directors.forEach((d, i) => {
        if (!d.directorName.trim())
          errs[`dir_${i}_name`] = "Director name required";
        if (d.bvn && validateBvn(d.bvn))
          errs[`dir_${i}_bvn`] = validateBvn(d.bvn);
        if (d.nin && validateNin(d.nin))
          errs[`dir_${i}_nin`] = validateNin(d.nin);
        const pct = Number(d.ownershipPercentage);
        if (d.ownershipPercentage && (Number.isNaN(pct) || pct < 0 || pct > 100))
          errs[`dir_${i}_pct`] = "Must be 0–100";
      });
    } else {
      if (!proprietorName.trim())
        errs.proprietorName = "Proprietor name required";
      if (proprietorBvn && validateBvn(proprietorBvn))
        errs.proprietorBvn = validateBvn(proprietorBvn);
      if (proprietorNin && validateNin(proprietorNin))
        errs.proprietorNin = validateNin(proprietorNin);
    }
    setStep4Errors(errs);
    return Object.keys(errs).length === 0;
  };
  const validateStep5 = () => {
    const errs = {};
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
  const handleNext = () => {
    var _a;
    const validators = [
      validateStep1,
      validateStep2,
      validateStep3,
      validateStep4,
      validateStep5
    ];
    if ((_a = validators[step]) == null ? void 0 : _a.call(validators)) {
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
  const editStep = (targetStep) => {
    setReturnToSummary(true);
    setStep(targetStep);
  };
  const addDirector = () => setDirectors((prev) => [
    ...prev,
    {
      directorName: "",
      bvn: "",
      nin: "",
      nationality: "Nigerian",
      ownershipPercentage: ""
    }
  ]);
  const removeDirector = (i) => setDirectors((prev) => prev.filter((_, idx) => idx !== i));
  const updateDirector = (i, field, val) => setDirectors(
    (prev) => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d)
  );
  const handleSubmit = async () => {
    var _a, _b;
    if (!actor) return;
    setIsSubmitting(true);
    try {
      const directorsList = businessCategory === "LLC" ? directors.map((d) => ({
        directorName: d.directorName,
        bvn: d.bvn,
        nin: d.nin,
        nationality: d.nationality,
        ownershipPercentage: Number(d.ownershipPercentage) || 0
      })) : [];
      const proprietorDetails = businessCategory === "BusinessName" ? { proprietorName, bvn: proprietorBvn, nin: proprietorNin } : null;
      await actor.submitBusinessRegistrationWithKyc(
        businessName,
        cacNumber,
        businessCategory,
        BigInt(Math.round(Number(annualRevenue))),
        contactPerson,
        address,
        phoneNumber,
        businessCategory === "LLC" ? ((_a = directors[0]) == null ? void 0 : _a.bvn) ?? "" : proprietorBvn,
        businessCategory === "LLC" ? ((_b = directors[0]) == null ? void 0 : _b.nin) ?? "" : proprietorNin,
        tinNumber,
        businessDescription,
        yearOfIncorporation,
        BigInt(Math.round(Number(financingAmount))),
        purposeOfFinancing,
        preferredInstrument,
        directorsList,
        proprietorDetails
      );
      localStorage.removeItem(LS_KEY);
      await refetch();
      ue.success(
        "Business registration submitted! Tawthiq التوثيق is now verifying your details."
      );
      router.navigate({ to: "/business/dashboard" });
    } catch (err) {
      ue.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };
  const selectedInstrument = INSTRUMENTS.find(
    (i) => i.value === preferredInstrument
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Layout, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "container mx-auto max-w-2xl px-4 py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      PageHeader,
      {
        title: "Business Registration",
        subtitle: "التسجيل التجاري — Register for halal financing vetting via Tawthiq",
        breadcrumbs: [
          { label: "Home", href: "/" },
          { label: "Register Business" }
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { className: "shadow-lg", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "pt-8 pb-8 px-6 sm:px-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(StepProgress, { current: step, total: 6 }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(AnimatePresence, { mode: "wait", children: [
        step === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Business Type" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Select your legal business structure registered with the CAC." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  RadioCard,
                  {
                    selected: businessCategory === "LLC",
                    onClick: () => {
                      setBusinessCategory("LLC");
                      setCatError("");
                    },
                    title: "Limited Liability Company (LLC)",
                    subtitle: "A company with one or more directors and shareholders. CAC registered with an RC number.",
                    ocid: "register_business.type_llc"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  RadioCard,
                  {
                    selected: businessCategory === "BusinessName",
                    onClick: () => {
                      setBusinessCategory("BusinessName");
                      setCatError("");
                    },
                    title: "Business Name",
                    subtitle: "A sole proprietorship or trading name registered with the CAC under a BN number.",
                    ocid: "register_business.type_business_name"
                  }
                )
              ] }),
              catError && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "p",
                {
                  className: "text-xs text-destructive mt-3",
                  "data-ocid": "register_business.type_error",
                  children: catError
                }
              )
            ]
          },
          "step0"
        ),
        step === 1 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Business Identity" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Provide your CAC-registered business details." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "businessName", children: "Business Name *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "businessName",
                      placeholder: "Al-Noor Trading Ltd.",
                      value: businessName,
                      onChange: (e) => setBusinessName(e.target.value),
                      "data-ocid": "register_business.business_name_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step2Errors.businessName,
                      ocid: "register_business.business_name_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "cacNumber", children: "CAC Registration Number *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "cacNumber",
                      placeholder: "RC-1234567 or BN-1234567",
                      value: cacNumber,
                      onChange: (e) => setCacNumber(e.target.value),
                      "data-ocid": "register_business.cac_number_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step2Errors.cacNumber,
                      ocid: "register_business.cac_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "tinNumber", children: "TIN *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "tinNumber",
                      placeholder: "12345678-0001",
                      value: tinNumber,
                      onChange: (e) => setTinNumber(e.target.value),
                      "data-ocid": "register_business.tin_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step2Errors.tinNumber,
                      ocid: "register_business.tin_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "yearOfIncorporation", children: "Year of Incorporation *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "yearOfIncorporation",
                      placeholder: "2018",
                      maxLength: 4,
                      value: yearOfIncorporation,
                      onChange: (e) => setYearOfIncorporation(e.target.value),
                      "data-ocid": "register_business.year_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step2Errors.yearOfIncorporation,
                      ocid: "register_business.year_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "contactPerson", children: "Contact Person *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "contactPerson",
                      placeholder: "Musa Abdullahi",
                      value: contactPerson,
                      onChange: (e) => setContactPerson(e.target.value),
                      "data-ocid": "register_business.contact_person_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step2Errors.contactPerson,
                      ocid: "register_business.contact_person_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "phoneNumber", children: "Phone Number *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "phoneNumber",
                      placeholder: "+2348012345678",
                      value: phoneNumber,
                      onChange: (e) => setPhoneNumber(e.target.value),
                      "data-ocid": "register_business.phone_number_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step2Errors.phoneNumber,
                      ocid: "register_business.phone_number_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "address", children: "Business Address *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "address",
                      placeholder: "Plot 5, Industrial Layout, Kano",
                      value: address,
                      onChange: (e) => setAddress(e.target.value),
                      "data-ocid": "register_business.address_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step2Errors.address,
                      ocid: "register_business.address_error"
                    }
                  )
                ] })
              ] })
            ]
          },
          "step1"
        ),
        step === 2 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Business Description" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-2 mb-5 p-3 rounded-lg bg-primary/5 border border-primary/20", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-lg", children: "🔍" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-muted-foreground", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold text-foreground", children: "Tawthiq التوثيق" }),
                  " ",
                  "uses this description to screen your business activities for Shariah compliance. Be thorough and accurate."
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "businessDescription", children: "Describe your business *" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Textarea,
                  {
                    id: "businessDescription",
                    placeholder: "Describe your principal business activities, products or services, target market, and how your business generates revenue. Include any relevant industry sector information...",
                    value: businessDescription,
                    onChange: (e) => setBusinessDescription(e.target.value),
                    className: "min-h-[180px] resize-y",
                    "data-ocid": "register_business.description_input"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between items-center mt-1", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: descError,
                      ocid: "register_business.description_error"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "span",
                    {
                      className: `text-xs ml-auto ${businessDescription.trim().length >= 50 ? "text-primary" : "text-muted-foreground"}`,
                      children: [
                        businessDescription.trim().length,
                        " / 50 min"
                      ]
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "mt-4 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:border-amber-500/20 dark:bg-amber-500/5 p-4",
                  "data-ocid": "register_business.description_example",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 mb-2", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Lightbulb, { className: "w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400", children: "Example" })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-amber-900/80 dark:text-amber-200/70 leading-relaxed italic", children: "“GreenGro Nigeria Ltd is an agro-processing company based in Kano State. We purchase raw groundnuts from smallholder farmers, process them into groundnut oil and cake at our factory, and sell to distributors and retailers across northern Nigeria. Our revenue comes from product sales — we do not engage in any interest-based transactions. We are seeking financing to expand our processing capacity and purchase additional equipment.”" })
                  ]
                }
              )
            ]
          },
          "step2"
        ),
        step === 3 && /* @__PURE__ */ jsxRuntimeExports.jsx(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: businessCategory === "LLC" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between mb-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground", children: "Directors" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Button,
                  {
                    type: "button",
                    variant: "outline",
                    size: "sm",
                    onClick: addDirector,
                    "data-ocid": "register_business.add_director_button",
                    children: "+ Add Director"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-5", children: "Provide details for all company directors. At least one director is required." }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-5", children: directors.map((dir, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "p-4 rounded-xl border border-border bg-muted/20",
                  "data-ocid": `register_business.director.${i + 1}`,
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between mb-4", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-sm font-semibold text-foreground", children: [
                        "Director ",
                        i + 1
                      ] }),
                      directors.length > 1 && /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => removeDirector(i),
                          className: "text-xs text-destructive hover:underline",
                          "data-ocid": `register_business.remove_director.${i + 1}`,
                          children: "Remove"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Full Name *" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          Input,
                          {
                            placeholder: "Ibrahim Al-Siddiq",
                            value: dir.directorName,
                            onChange: (e) => updateDirector(
                              i,
                              "directorName",
                              e.target.value
                            ),
                            "data-ocid": `register_business.director_name.${i + 1}`
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          FieldError,
                          {
                            msg: step4Errors[`dir_${i}_name`],
                            ocid: `register_business.director_name_error.${i + 1}`
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "BVN" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          Input,
                          {
                            placeholder: "22123456789",
                            value: dir.bvn,
                            onChange: (e) => updateDirector(i, "bvn", e.target.value),
                            "data-ocid": `register_business.director_bvn.${i + 1}`
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          FieldError,
                          {
                            msg: step4Errors[`dir_${i}_bvn`],
                            ocid: `register_business.director_bvn_error.${i + 1}`
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "NIN" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          Input,
                          {
                            placeholder: "12345678901",
                            value: dir.nin,
                            onChange: (e) => updateDirector(i, "nin", e.target.value),
                            "data-ocid": `register_business.director_nin.${i + 1}`
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          FieldError,
                          {
                            msg: step4Errors[`dir_${i}_nin`],
                            ocid: `register_business.director_nin_error.${i + 1}`
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Nationality" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          Select,
                          {
                            value: dir.nationality,
                            onValueChange: (v) => updateDirector(i, "nationality", v),
                            children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx(
                                SelectTrigger,
                                {
                                  "data-ocid": `register_business.director_nationality.${i + 1}`,
                                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {})
                                }
                              ),
                              /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: NATIONALITIES.map((n) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: n, children: n }, n)) })
                            ]
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Ownership %" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          Input,
                          {
                            type: "number",
                            placeholder: "25",
                            min: "0",
                            max: "100",
                            value: dir.ownershipPercentage,
                            onChange: (e) => updateDirector(
                              i,
                              "ownershipPercentage",
                              e.target.value
                            ),
                            "data-ocid": `register_business.director_pct.${i + 1}`
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          FieldError,
                          {
                            msg: step4Errors[`dir_${i}_pct`],
                            ocid: `register_business.director_pct_error.${i + 1}`
                          }
                        )
                      ] })
                    ] })
                  ]
                },
                dir.bvn || String(i)
              )) })
            ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Proprietor Details" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-5", children: "Provide the details of the sole proprietor of this business." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "proprietorName", children: "Full Name *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "proprietorName",
                      placeholder: "Amina Yusuf",
                      value: proprietorName,
                      onChange: (e) => setProprietorName(e.target.value),
                      "data-ocid": "register_business.proprietor_name_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step4Errors.proprietorName,
                      ocid: "register_business.proprietor_name_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "proprietorBvn", children: "BVN" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Input,
                      {
                        id: "proprietorBvn",
                        placeholder: "22123456789",
                        value: proprietorBvn,
                        onChange: (e) => setProprietorBvn(e.target.value),
                        "data-ocid": "register_business.proprietor_bvn_input"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      FieldError,
                      {
                        msg: step4Errors.proprietorBvn,
                        ocid: "register_business.proprietor_bvn_error"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "proprietorNin", children: "NIN" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Input,
                      {
                        id: "proprietorNin",
                        placeholder: "12345678901",
                        value: proprietorNin,
                        onChange: (e) => setProprietorNin(e.target.value),
                        "data-ocid": "register_business.proprietor_nin_input"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      FieldError,
                      {
                        msg: step4Errors.proprietorNin,
                        ocid: "register_business.proprietor_nin_error"
                      }
                    )
                  ] })
                ] })
              ] })
            ] })
          },
          "step3"
        ),
        step === 4 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Financial Information" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Provide your financing needs and current financial standing." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "annualRevenue", children: "Annual Revenue (₦) *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "annualRevenue",
                      type: "number",
                      min: "0",
                      placeholder: "5000000",
                      value: annualRevenue,
                      onChange: (e) => setAnnualRevenue(e.target.value),
                      "data-ocid": "register_business.annual_revenue_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step5Errors.annualRevenue,
                      ocid: "register_business.annual_revenue_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "financingAmount", children: "Financing Amount Sought (₦) *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "financingAmount",
                      type: "number",
                      min: "0",
                      placeholder: "2000000",
                      value: financingAmount,
                      onChange: (e) => setFinancingAmount(e.target.value),
                      "data-ocid": "register_business.financing_amount_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step5Errors.financingAmount,
                      ocid: "register_business.financing_amount_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "purposeOfFinancing", children: "Purpose of Financing *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "purposeOfFinancing",
                      placeholder: "Purchase of commercial vehicles for logistics operations",
                      value: purposeOfFinancing,
                      onChange: (e) => setPurposeOfFinancing(e.target.value),
                      "data-ocid": "register_business.purpose_input"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step5Errors.purposeOfFinancing,
                      ocid: "register_business.purpose_error"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 sm:col-span-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Preferred Islamic Financing Instrument *" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground -mt-1", children: "Select the financing structure that best fits your business needs." }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "div",
                    {
                      className: "grid gap-3 mt-2",
                      "data-ocid": "register_business.instrument_list",
                      children: INSTRUMENTS.map((inst, idx) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                        InstrumentCard,
                        {
                          inst,
                          selected: preferredInstrument === inst.value,
                          onSelect: () => {
                            setPreferredInstrument(inst.value);
                            setStep5Errors((e) => ({
                              ...e,
                              preferredInstrument: ""
                            }));
                          },
                          index: idx
                        },
                        inst.value
                      ))
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FieldError,
                    {
                      msg: step5Errors.preferredInstrument,
                      ocid: "register_business.instrument_error"
                    }
                  )
                ] })
              ] })
            ]
          },
          "step4"
        ),
        step === 5 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 },
            transition: { duration: 0.25 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display text-lg font-semibold text-foreground mb-1", children: "Review Your Application" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mb-6", children: "Please confirm your details before submitting. You can edit any section." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  SummarySection,
                  {
                    title: "Business Type",
                    onEdit: () => editStep(0),
                    ocid: "register_business.summary_type",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      SummaryRow,
                      {
                        label: "Type",
                        value: businessCategory === "LLC" ? "Limited Liability Company (LLC)" : "Business Name"
                      }
                    )
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  SummarySection,
                  {
                    title: "Business Identity",
                    onEdit: () => editStep(1),
                    ocid: "register_business.summary_identity",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Business Name", value: businessName }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "CAC Number", value: cacNumber }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "TIN", value: tinNumber }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Address", value: address }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Year of Incorporation",
                          value: yearOfIncorporation
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Contact Person",
                          value: contactPerson
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Phone Number", value: phoneNumber })
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  SummarySection,
                  {
                    title: "Business Description",
                    onEdit: () => editStep(2),
                    ocid: "register_business.summary_description",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-foreground/80 leading-relaxed break-words", children: businessDescription || "—" })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  SummarySection,
                  {
                    title: businessCategory === "LLC" ? "Directors" : "Proprietor",
                    onEdit: () => editStep(3),
                    ocid: "register_business.summary_directors",
                    children: businessCategory === "LLC" ? directors.map((d, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "div",
                      {
                        className: i > 0 ? "pt-2 mt-2 border-t border-border" : "",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs font-semibold text-muted-foreground mb-1", children: [
                            "Director ",
                            i + 1
                          ] }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Name", value: d.directorName }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "BVN", value: maskId(d.bvn) }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "NIN", value: maskId(d.nin) }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            SummaryRow,
                            {
                              label: "Nationality",
                              value: d.nationality
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            SummaryRow,
                            {
                              label: "Ownership",
                              value: d.ownershipPercentage ? `${d.ownershipPercentage}%` : "—"
                            }
                          )
                        ]
                      },
                      d.bvn || d.directorName || String(i)
                    )) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Name", value: proprietorName }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "BVN",
                          value: maskId(proprietorBvn)
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "NIN",
                          value: maskId(proprietorNin)
                        }
                      )
                    ] })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  SummarySection,
                  {
                    title: "Financial Information",
                    onEdit: () => editStep(4),
                    ocid: "register_business.summary_financial",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Annual Revenue",
                          value: annualRevenue ? `₦${Number(annualRevenue).toLocaleString()}` : "—"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Financing Amount",
                          value: financingAmount ? `₦${Number(financingAmount).toLocaleString()}` : "—"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryRow, { label: "Purpose", value: purposeOfFinancing }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        SummaryRow,
                        {
                          label: "Instrument",
                          value: selectedInstrument ? `${selectedInstrument.nameEn} (${selectedInstrument.nameAr})` : "—"
                        }
                      )
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4",
                  "data-ocid": "register_business.tawthiq_checklist",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-3", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Info, { className: "w-4 h-4 text-primary flex-shrink-0" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold text-foreground", children: "What happens after you submit?" })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-2", children: [
                      "Tawthiq (التوثيق) verifies your identity and KYC via Mono",
                      "Shariah compliance screening of your business activities",
                      "Inconsistency check across your declared profile and verified data",
                      "Credit-readiness verdict: Ready, Conditional, or Not Ready"
                    ].map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-start gap-2", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: item })
                    ] }, item)) })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "mt-5 space-y-3",
                  "data-ocid": "register_business.compliance_section",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-muted-foreground", children: "Consent & Compliance" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "label",
                      {
                        htmlFor: "reg-biz-terms",
                        className: "flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors",
                        "data-ocid": "register_business.terms_checkbox_label",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Checkbox,
                            {
                              id: "reg-biz-terms",
                              checked: termsAccepted,
                              onCheckedChange: (v) => setTermsAccepted(!!v),
                              className: "mt-0.5",
                              "data-ocid": "register_business.terms_checkbox"
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
                        htmlFor: "reg-biz-privacy",
                        className: "flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors",
                        "data-ocid": "register_business.privacy_checkbox_label",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Checkbox,
                            {
                              id: "reg-biz-privacy",
                              checked: privacyAccepted,
                              onCheckedChange: (v) => setPrivacyAccepted(!!v),
                              className: "mt-0.5",
                              "data-ocid": "register_business.privacy_checkbox"
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
                        htmlFor: "reg-biz-ndpr",
                        className: "flex items-start gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors",
                        "data-ocid": "register_business.ndpr_checkbox_label",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Checkbox,
                            {
                              id: "reg-biz-ndpr",
                              checked: ndprAccepted,
                              onCheckedChange: (v) => setNdprAccepted(!!v),
                              className: "mt-0.5",
                              "data-ocid": "register_business.ndpr_checkbox"
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
          "step5"
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between gap-3 mt-8 pt-6 border-t border-border", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            type: "button",
            variant: "outline",
            onClick: step === 0 ? () => router.navigate({ to: "/" }) : handleBack,
            "data-ocid": "register_business.back_button",
            children: step === 0 ? "Cancel" : "← Back"
          }
        ),
        step < 5 ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            type: "button",
            onClick: handleNext,
            "data-ocid": "register_business.next_button",
            children: returnToSummary ? "Return to Summary →" : "Continue →"
          }
        ) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            type: "button",
            onClick: handleSubmit,
            disabled: isSubmitting || !actor || !termsAccepted || !privacyAccepted || !ndprAccepted,
            className: "gap-2 min-w-[160px]",
            "data-ocid": "register_business.submit_button",
            children: [
              isSubmitting && /* @__PURE__ */ jsxRuntimeExports.jsx(LoadingSpinner, { size: "sm", label: "" }),
              isSubmitting ? "Submitting…" : "Submit Application"
            ]
          }
        )
      ] })
    ] }) })
  ] }) });
}
export {
  RegisterBusinessPage as default
};
