"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Send,
  User,
  Building,
  Shield,
  Eye,
  Upload,
  FileText,
  X,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
} from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { useCreateOnboarding, useSubmitOnboarding, useOnboardingList } from "@/lib/apiClient";
import type { DocumentRef } from "@/lib/apiClient";

// Ported from frontend/src/pages/business/OnboardingForm.tsx. Dropped for
// this Phase 1 slice (no backend support yet): Amend/PendingAmendment
// resubmission flow, Withdraw-on-failed-submit rollback, and live
// server-side document storage (routes/documents.ts doesn't exist in this
// slice) -- KycDocumentUpload below computes a real SHA-256 of the file
// client-side (Web Crypto) but never uploads the bytes anywhere, since
// Approve only needs a DocumentRef with a real hash to exist, not real
// file storage, to satisfy Onboarding.daml's "at least one document"
// assertMsg this slice ported.

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

const BUSINESS_ACTIVITY_MIN_WORDS = 5;
const BUSINESS_ACTIVITY_MAX_WORDS = 150;

const step1Schema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  address: z.string().min(5, "Please enter a complete address"),
  state: z.string().min(1, "Please select a state"),
  phoneNumber: z.string().regex(/^\+234\s?\d{3}\s?\d{3}\s?\d{4}$/, "Enter a valid Nigerian phone (+234...)"),
  email: z.string().email("Please enter a valid email"),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  businessType: z.enum(["SoleProprietorship", "LimitedCompany"]),
  incorporationDate: z.string().min(1, "Please enter incorporation date"),
  businessActivity: z
    .string()
    .min(3, "Please describe what your business does")
    .refine((val) => countWords(val) >= BUSINESS_ACTIVITY_MIN_WORDS, {
      message: `Please use at least ${BUSINESS_ACTIVITY_MIN_WORDS} words to describe your business activity`,
    })
    .refine((val) => countWords(val) <= BUSINESS_ACTIVITY_MAX_WORDS, {
      message: `Business activity description must be ${BUSINESS_ACTIVITY_MAX_WORDS} words or fewer`,
    }),
  businessSector: z.string().min(1, "Please select a sector"),
});

const directorSchema = z.object({
  directorName: z.string().min(2, "Full name required"),
  directorAddress: z.string().min(5, "Address required"),
  directorPhone: z.string().regex(/^\+234\s?\d{3}\s?\d{3}\s?\d{4}$/, "Enter a valid Nigerian phone (+234...)"),
  ninNumber: z.string().length(11, "NIN must be exactly 11 digits").regex(/^\d+$/, "NIN must contain only digits"),
  bvn: z.string().length(11, "BVN must be exactly 11 digits").regex(/^\d+$/, "BVN must contain only digits"),
  directorEmail: z.string().email("Please enter a valid email"),
});

const step2Schema = z.object({
  directors: z.array(directorSchema).min(1, "At least one director is required"),
});

function findDuplicateDirectorField(directors: Director[]): string | null {
  const nins = directors.map((d) => d.ninNumber);
  if (new Set(nins).size !== nins.length) return "Each director must have a unique NIN number.";
  const bvns = directors.map((d) => d.bvn);
  if (new Set(bvns).size !== bvns.length) return "Each director must have a unique BVN.";
  return null;
}

const step3Schema = z.object({
  cacRegNumber: z.string().min(5, "Enter a valid CAC registration number"),
  taxId: z.string().min(5, "Enter a valid Tax ID"),
});

function validateCacFormat(cacRegNumber: string, businessType: "SoleProprietorship" | "LimitedCompany"): string | null {
  const requiredPrefix = businessType === "LimitedCompany" ? "RC" : "BN";
  const entityLabel = businessType === "LimitedCompany" ? "Limited companies" : "Sole proprietorships";
  if (!cacRegNumber.startsWith(requiredPrefix)) {
    return `${entityLabel} must use a CAC number starting with "${requiredPrefix}" (e.g. ${requiredPrefix}1234567)`;
  }
  if (cacRegNumber.length < 4 || !/^\d+$/.test(cacRegNumber.slice(2))) {
    return `CAC number must be "${requiredPrefix}" followed only by digits — no hyphens or spaces (e.g. ${requiredPrefix}1234567)`;
  }
  return null;
}

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Director = z.infer<typeof directorSchema>;

const STEPS = [
  { num: 1, label: "Business Profile", icon: <Building size={16} /> },
  { num: 2, label: "Director", icon: <User size={16} /> },
  { num: 3, label: "KYC Documents", icon: <Shield size={16} /> },
  { num: 4, label: "Review & Submit", icon: <Eye size={16} /> },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function FormLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

const MAX_DOCUMENT_BYTES = 1 * 1024 * 1024;

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface KycDocumentUploadProps {
  id: string;
  label: string;
  docType: string;
  value: DocumentRef | null;
  onChange: (doc: DocumentRef | null) => void;
}

function KycDocumentUpload({ id, label, docType, value, onChange }: KycDocumentUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);

  const handleSelect = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError("File exceeds the 1MB limit.");
      return;
    }
    setHashing(true);
    try {
      const contentHash = await hashFile(file);
      onChange({ docType, contentHash, storageRef: `local://${file.name}`, fileSize: file.size });
    } finally {
      setHashing(false);
    }
  };

  return (
    <div>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface px-4 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{value.storageRef.split("/").pop()}</p>
              {value.fileSize && <p className="text-xs text-gray-400 mt-0.5">{(value.fileSize / 1024).toFixed(0)} KB</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 transition-colors"
            aria-label={`Remove ${label}`}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 cursor-pointer text-center transition-colors ${
            error ? "border-red-300 bg-red-50/50" : "border-gray-200 bg-surface hover:border-primary/50 hover:bg-primary-50/30"
          }`}
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${error ? "bg-red-100" : "bg-white border border-gray-200"}`}>
            {hashing ? <Loader2 size={16} className="animate-spin text-primary" /> : <Upload size={16} className={error ? "text-red-500" : "text-gray-400"} />}
          </div>
          <span className={`text-sm font-medium ${error ? "text-red-600" : "text-gray-600"}`}>
            {hashing ? "Processing…" : "Click to upload"}
          </span>
          <span className="text-xs text-gray-400">PDF, JPG, PNG — max 1MB</span>
          <input
            id={id}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            disabled={hashing}
            onChange={(e) => handleSelect(e.target.files?.[0])}
          />
        </label>
      )}
      <FieldError message={error ?? undefined} />
    </div>
  );
}

export default function OnboardingForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    step1: {} as Partial<Step1Data>,
    step2: {} as Partial<Step2Data>,
    step3: {} as Partial<Step3Data>,
  });

  const createOnboarding = useCreateOnboarding();
  const submitOnboarding = useSubmitOnboarding();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [directorsError, setDirectorsError] = useState<string | null>(null);

  const [cacCertificate, setCacCertificate] = useState<DocumentRef | null>(null);
  const [idCard, setIdCard] = useState<DocumentRef | null>(null);
  const [documentsError] = useState<string | null>(null);

  const { data: onboardingList } = useOnboardingList();
  const hasActiveApplication = (onboardingList?.length ?? 0) > 0;

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: "", address: "", state: "", phoneNumber: "", email: "", website: "",
      businessType: "SoleProprietorship", incorporationDate: "", businessActivity: "", businessSector: "",
    },
  });

  const businessActivityWordCount = countWords(step1Form.watch("businessActivity") || "");

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      directors: [{ directorName: "", directorAddress: "", directorPhone: "", ninNumber: "", bvn: "", directorEmail: "" }],
    },
  });

  const { fields: directorFields, append: appendDirector, remove: removeDirector } = useFieldArray({
    control: step2Form.control,
    name: "directors",
  });

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: { cacRegNumber: "", taxId: "" },
  });

  const [fillingDemoData, setFillingDemoData] = useState(false);
  const fillDemoData = () => {
    setFillingDemoData(true);
    const suffix = Math.floor(100000 + Math.random() * 900000);
    step1Form.reset({
      name: "Adaeze Fashion House Ltd", address: "15 Allen Avenue, Ikeja", state: "Lagos",
      phoneNumber: "+234 803 555 0101", email: `info@adaezefashion${suffix}.ng`, website: "",
      businessType: "LimitedCompany", incorporationDate: "2020-05-15",
      businessActivity: "Retail and wholesale distribution of ready-made fashion garments and accessories",
      businessSector: "Retail Trade",
    });
    step2Form.reset({
      directors: [{
        directorName: "Ngozi Adaeze Eze", directorAddress: "15 Allen Avenue, Ikeja",
        directorPhone: "+234 803 555 0102", ninNumber: "12345678901", bvn: "22334455667",
        directorEmail: `ngozi${suffix}@adaezefashion.ng`,
      }],
    });
    step3Form.reset({ cacRegNumber: `RC${suffix}`, taxId: `TIN-${suffix}` });
    setCacCertificate({ docType: "CAC_CERTIFICATE", contentHash: "0".repeat(64), storageRef: "local://demo-cac-certificate.pdf" });
    setIdCard({ docType: "NIN_ID_CARD", contentHash: "1".repeat(64), storageRef: "local://demo-director-id.pdf" });
    setFillingDemoData(false);
  };

  const handleStep1Next = step1Form.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, step1: data }));
    setCurrentStep(2);
  });

  const handleStep2Next = step2Form.handleSubmit((data) => {
    const dupError = findDuplicateDirectorField(data.directors);
    if (dupError) {
      setDirectorsError(dupError);
      return;
    }
    setDirectorsError(null);
    setFormData((prev) => ({ ...prev, step2: data }));
    setCurrentStep(3);
  });

  const handleStep3Next = step3Form.handleSubmit((data) => {
    const cacError = validateCacFormat(data.cacRegNumber, formData.step1.businessType!);
    if (cacError) {
      step3Form.setError("cacRegNumber", { message: cacError });
      return;
    }
    setFormData((prev) => ({ ...prev, step3: data }));
    setCurrentStep(4);
  });

  const handleSubmit = async () => {
    setSubmitError(null);
    const { step1, step2, step3 } = formData;
    const cacError = validateCacFormat(step3.cacRegNumber!, step1.businessType!);
    if (cacError) {
      setSubmitError(cacError);
      return;
    }
    const dupError = findDuplicateDirectorField(step2.directors!);
    if (dupError) {
      setSubmitError(dupError);
      return;
    }
    const uploadedDocuments = [cacCertificate, idCard].filter((d): d is DocumentRef => d !== null);
    const documents = uploadedDocuments.length > 0 ? uploadedDocuments : [{
      docType: "PLACEHOLDER", contentHash: "0".repeat(64), storageRef: "placeholder://no-document-uploaded",
    }];
    const profile = {
      name: step1.name!, address: step1.address!, state: step1.state!, phoneNumber: step1.phoneNumber!,
      email: step1.email!, website: step1.website || undefined, businessType: step1.businessType!,
      incorporationDate: step1.incorporationDate!,
      directors: step2.directors!.map((d) => ({
        name: d.directorName, address: d.directorAddress, phoneNumber: d.directorPhone,
        ninNumber: d.ninNumber, bvn: d.bvn, email: d.directorEmail,
      })),
      businessActivity: step1.businessActivity!, businessSector: step1.businessSector!,
    };
    try {
      const created = await createOnboarding.mutateAsync({
        profile, kyc: { cacRegNumber: step3.cacRegNumber!, taxId: step3.taxId! },
        documents, onboardingRef: `ONB-${Date.now()}`,
      });
      await submitOnboarding.mutateAsync(created.id);
      setSubmitted(true);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response) {
        setSubmitError((e.response.data as { error?: string }).error ?? "Failed to submit application");
      } else {
        setSubmitError(e instanceof Error ? e.message : "Failed to submit application");
      }
    }
  };

  if (submitted || hasActiveApplication) {
    return (
      <Layout breadcrumb={[{ label: "Business Portal", path: "/business/onboarding" }, { label: "Onboarding" }]}>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={36} className="text-emerald-600" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-gray-900 mb-3">Application Submitted!</h2>
          <p className="text-gray-600 text-sm mb-2 leading-relaxed">
            Your onboarding application has been submitted for review. Our AI Verification Agent will process it shortly.
          </p>
          <p className="text-gray-400 text-xs mb-7">You&apos;ll be notified once the review is complete.</p>
          <StatusBadge status={onboardingList?.[0]?.status ?? "UnderReview"} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumb={[{ label: "Business Portal", path: "/business/onboarding" }, { label: "Onboarding" }]}>
      <div className="max-w-3xl mx-auto">
        <div className="card p-6 mb-7">
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={fillDemoData}
              disabled={fillingDemoData}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary-50 hover:bg-primary-100 disabled:opacity-60 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Sparkles size={13} />
              Fill Demo Data
            </button>
          </div>
          <div className="relative flex items-start">
            <div className="absolute top-6 left-6 right-6 h-0.5 bg-gray-200" />
            <div
              className="absolute top-6 left-6 h-0.5 bg-primary transition-all duration-500"
              style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
            />
            {STEPS.map((step) => {
              const isCompleted = step.num < currentStep;
              const isCurrent = step.num === currentStep;
              return (
                <div key={step.num} className="relative flex-1 flex flex-col items-center gap-2.5">
                  <div
                    className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted ? "bg-primary text-white shadow-md" : isCurrent ? "bg-primary text-white shadow-lg ring-4 ring-primary-50" : "bg-white text-gray-400 border-2 border-gray-200"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={18} /> : step.icon}
                  </div>
                  <span className={`text-center leading-tight px-1 ${isCurrent ? "text-primary text-xs font-semibold" : isCompleted ? "text-gray-600 text-xs font-medium" : "text-gray-400 text-xs"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500 text-center">
            Step {currentStep} of {STEPS.length}: <strong className="text-gray-700">{STEPS[currentStep - 1]?.label}</strong>
          </div>
        </div>

        {currentStep === 1 && (
          <div className="card p-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Building size={19} className="text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-gray-900 tracking-tight">Business Profile</h2>
                <p className="text-sm text-gray-500 mt-0.5">Tell us about your business</p>
              </div>
            </div>
            <form onSubmit={handleStep1Next} className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <FormLabel htmlFor="name" required>Business Name</FormLabel>
                  <input id="name" className={`input py-2.5 ${step1Form.formState.errors.name ? "input-error" : ""}`} placeholder="e.g. Adekunle Foods & Beverages Ltd" {...step1Form.register("name")} />
                  <FieldError message={step1Form.formState.errors.name?.message} />
                </div>
                <div className="col-span-2">
                  <FormLabel htmlFor="address" required>Business Address</FormLabel>
                  <input id="address" className={`input py-2.5 ${step1Form.formState.errors.address ? "input-error" : ""}`} placeholder="Street address, area" {...step1Form.register("address")} />
                  <FieldError message={step1Form.formState.errors.address?.message} />
                </div>
                <div>
                  <FormLabel htmlFor="state" required>State</FormLabel>
                  <select id="state" className={`input py-2.5 ${step1Form.formState.errors.state ? "input-error" : ""}`} {...step1Form.register("state")}>
                    <option value="">Select state...</option>
                    {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <FieldError message={step1Form.formState.errors.state?.message} />
                </div>
                <div>
                  <FormLabel htmlFor="businessType" required>Business Type</FormLabel>
                  <div className="grid grid-cols-2 gap-2.5">
                    {([["SoleProprietorship", "Sole Proprietorship"], ["LimitedCompany", "Limited Company"]] as const).map(([value, labelText]) => {
                      const isSelected = step1Form.watch("businessType") === value;
                      return (
                        <label key={value} className="cursor-pointer">
                          <input type="radio" value={value} className="sr-only" {...step1Form.register("businessType")} />
                          <div className={`text-center py-2.5 px-2 rounded-xl border-2 text-sm font-medium transition-all ${isSelected ? "border-primary bg-primary text-white" : "border-gray-200 text-gray-600 hover:border-primary/40"}`}>
                            {labelText}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <FieldError message={step1Form.formState.errors.businessType?.message} />
                </div>
                <div>
                  <FormLabel htmlFor="phoneNumber" required>Phone Number</FormLabel>
                  <input id="phoneNumber" className={`input py-2.5 ${step1Form.formState.errors.phoneNumber ? "input-error" : ""}`} placeholder="+234 801 234 5678" {...step1Form.register("phoneNumber")} />
                  <FieldError message={step1Form.formState.errors.phoneNumber?.message} />
                </div>
                <div>
                  <FormLabel htmlFor="email" required>Business Email</FormLabel>
                  <input id="email" type="email" className={`input py-2.5 ${step1Form.formState.errors.email ? "input-error" : ""}`} placeholder="admin@yourbusiness.ng" {...step1Form.register("email")} />
                  <FieldError message={step1Form.formState.errors.email?.message} />
                </div>
                <div>
                  <FormLabel htmlFor="incorporationDate" required>Incorporation Date</FormLabel>
                  <input id="incorporationDate" type="date" className={`input py-2.5 ${step1Form.formState.errors.incorporationDate ? "input-error" : ""}`} {...step1Form.register("incorporationDate")} />
                  <FieldError message={step1Form.formState.errors.incorporationDate?.message} />
                </div>
                <div>
                  <FormLabel htmlFor="businessSector" required>Business Sector</FormLabel>
                  <input id="businessSector" className={`input py-2.5 ${step1Form.formState.errors.businessSector ? "input-error" : ""}`} placeholder="e.g. Retail Trade" {...step1Form.register("businessSector")} />
                  <FieldError message={step1Form.formState.errors.businessSector?.message} />
                </div>
                <div className="col-span-2">
                  <FormLabel htmlFor="businessActivity" required>Business Activity</FormLabel>
                  <textarea id="businessActivity" rows={4} className={`input py-2.5 resize-none ${step1Form.formState.errors.businessActivity ? "input-error" : ""}`} placeholder="Describe what your business actually does..." {...step1Form.register("businessActivity")} />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400">Used by our Shariah compliance screening.</p>
                    <span className={`text-xs flex-shrink-0 ml-2 ${businessActivityWordCount > 0 && (businessActivityWordCount < BUSINESS_ACTIVITY_MIN_WORDS || businessActivityWordCount > BUSINESS_ACTIVITY_MAX_WORDS) ? "text-red-500" : "text-gray-400"}`}>
                      {businessActivityWordCount} / {BUSINESS_ACTIVITY_MAX_WORDS} words
                    </span>
                  </div>
                  <FieldError message={step1Form.formState.errors.businessActivity?.message} />
                </div>
              </div>
              <div className="flex gap-3 pt-6 mt-1 border-t border-gray-100">
                <button type="submit" className="btn-primary ml-auto flex items-center gap-2 px-5 py-2.5">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        )}

        {currentStep === 2 && (
          <div className="card p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-7">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <User size={19} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-gray-900 tracking-tight">Business Director{directorFields.length > 1 ? "s" : ""}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">CAMA 2020 requires at least one director on record</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => appendDirector({ directorName: "", directorAddress: "", directorPhone: "", ninNumber: "", bvn: "", directorEmail: "" })}
                className="text-xs font-medium text-primary hover:bg-primary-50 flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-lg transition-colors"
              >
                <Plus size={14} /> Add Director
              </button>
            </div>
            <form onSubmit={handleStep2Next} className="space-y-5">
              {directorFields.map((field, index) => (
                <div key={field.id} className="rounded-xl border border-gray-200 p-5 space-y-4 bg-surface/60">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide bg-primary-50 px-2.5 py-1 rounded-full">
                      Director {index + 1}
                    </span>
                    {directorFields.length > 1 && (
                      <button type="button" onClick={() => removeDirector(index)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" aria-label={`Remove Director ${index + 1}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2">
                      <FormLabel htmlFor={`directorName-${index}`} required>Full Name</FormLabel>
                      <input id={`directorName-${index}`} className={`input py-2.5 ${step2Form.formState.errors.directors?.[index]?.directorName ? "input-error" : ""}`} placeholder="Full legal name as on NIN" {...step2Form.register(`directors.${index}.directorName`)} />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.directorName?.message} />
                    </div>
                    <div className="col-span-2">
                      <FormLabel htmlFor={`directorAddress-${index}`} required>Residential Address</FormLabel>
                      <input id={`directorAddress-${index}`} className={`input py-2.5 ${step2Form.formState.errors.directors?.[index]?.directorAddress ? "input-error" : ""}`} placeholder="Residential address" {...step2Form.register(`directors.${index}.directorAddress`)} />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.directorAddress?.message} />
                    </div>
                    <div>
                      <FormLabel htmlFor={`directorPhone-${index}`} required>Phone Number</FormLabel>
                      <input id={`directorPhone-${index}`} className={`input py-2.5 ${step2Form.formState.errors.directors?.[index]?.directorPhone ? "input-error" : ""}`} placeholder="+234 801 234 5678" {...step2Form.register(`directors.${index}.directorPhone`)} />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.directorPhone?.message} />
                    </div>
                    <div>
                      <FormLabel htmlFor={`directorEmail-${index}`} required>Email Address</FormLabel>
                      <input id={`directorEmail-${index}`} type="email" className={`input py-2.5 ${step2Form.formState.errors.directors?.[index]?.directorEmail ? "input-error" : ""}`} placeholder="director@email.com" {...step2Form.register(`directors.${index}.directorEmail`)} />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.directorEmail?.message} />
                    </div>
                    <div>
                      <FormLabel htmlFor={`ninNumber-${index}`} required>NIN Number</FormLabel>
                      <input id={`ninNumber-${index}`} className={`input py-2.5 font-mono ${step2Form.formState.errors.directors?.[index]?.ninNumber ? "input-error" : ""}`} placeholder="12345678901" maxLength={11} {...step2Form.register(`directors.${index}.ninNumber`)} />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.ninNumber?.message} />
                    </div>
                    <div>
                      <FormLabel htmlFor={`bvn-${index}`} required>BVN</FormLabel>
                      <input id={`bvn-${index}`} className={`input py-2.5 font-mono ${step2Form.formState.errors.directors?.[index]?.bvn ? "input-error" : ""}`} placeholder="22345678901" maxLength={11} {...step2Form.register(`directors.${index}.bvn`)} />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.bvn?.message} />
                    </div>
                  </div>
                </div>
              ))}
              <FieldError message={directorsError ?? undefined} />
              <div className="flex gap-3 pt-6 mt-1 border-t border-gray-100">
                <button type="button" onClick={() => setCurrentStep(1)} className="btn-secondary flex items-center gap-2 px-5 py-2.5">
                  <ChevronLeft size={14} /> Back
                </button>
                <button type="submit" className="btn-primary ml-auto flex items-center gap-2 px-5 py-2.5">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        )}

        {currentStep === 3 && (
          <div className="card p-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Shield size={19} className="text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-gray-900 tracking-tight">KYC Documents</h2>
                <p className="text-sm text-gray-500 mt-0.5">Provide your business registration details.</p>
              </div>
            </div>
            <form onSubmit={handleStep3Next} className="space-y-5">
              <div>
                <FormLabel htmlFor="cacRegNumber" required>CAC Registration Number</FormLabel>
                <input id="cacRegNumber" className={`input py-2.5 font-mono ${step3Form.formState.errors.cacRegNumber ? "input-error" : ""}`} placeholder={formData.step1.businessType === "SoleProprietorship" ? "BN1234567" : "RC1234567"} {...step3Form.register("cacRegNumber")} />
                <p className="text-xs text-gray-400 mt-1">
                  For limited companies: RC followed by digits. For sole proprietorships: BN followed by digits.
                </p>
                <FieldError message={step3Form.formState.errors.cacRegNumber?.message} />
              </div>
              <div>
                <FormLabel htmlFor="taxId" required>Tax Identification Number (TIN)</FormLabel>
                <input id="taxId" className={`input py-2.5 font-mono ${step3Form.formState.errors.taxId ? "input-error" : ""}`} placeholder="TIN-XXXXXXXXX" {...step3Form.register("taxId")} />
                <FieldError message={step3Form.formState.errors.taxId?.message} />
              </div>
              <KycDocumentUpload id="cacCertificate" label="CAC Registration Certificate (Optional for now)" docType="CAC_CERTIFICATE" value={cacCertificate} onChange={setCacCertificate} />
              <KycDocumentUpload id="idCard" label="Director's ID Card (NIN) (Optional for now)" docType="NIN_ID_CARD" value={idCard} onChange={setIdCard} />
              <FieldError message={documentsError ?? undefined} />
              <div className="flex gap-3 pt-6 mt-1 border-t border-gray-100">
                <button type="button" onClick={() => setCurrentStep(2)} className="btn-secondary flex items-center gap-2 px-5 py-2.5">
                  <ChevronLeft size={14} /> Back
                </button>
                <button type="submit" className="btn-primary ml-auto flex items-center gap-2 px-5 py-2.5">
                  Review <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        )}

        {currentStep === 4 && (
          <div className="card p-8 animate-fade-in space-y-7">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Eye size={19} className="text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-gray-900 tracking-tight">Review & Submit</h2>
                <p className="text-sm text-gray-500 mt-0.5">Check everything below before you submit</p>
              </div>
            </div>
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Business Profile</span>
                  <button onClick={() => setCurrentStep(1)} className="text-xs font-medium text-primary hover:bg-primary-50 px-2.5 py-1 rounded-lg transition-colors">Edit</button>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500 text-xs">Name</span><p className="font-medium text-gray-900">{formData.step1.name}</p></div>
                  <div><span className="text-gray-500 text-xs">State</span><p className="font-medium text-gray-900">{formData.step1.state}</p></div>
                  <div><span className="text-gray-500 text-xs">Type</span><p className="font-medium text-gray-900">{formData.step1.businessType === "LimitedCompany" ? "Limited Company" : "Sole Proprietorship"}</p></div>
                  <div><span className="text-gray-500 text-xs">Email</span><p className="font-medium text-gray-900">{formData.step1.email}</p></div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Business Director{(formData.step2.directors?.length ?? 0) > 1 ? "s" : ""}</span>
                  <button onClick={() => setCurrentStep(2)} className="text-xs font-medium text-primary hover:bg-primary-50 px-2.5 py-1 rounded-lg transition-colors">Edit</button>
                </div>
                <div className="divide-y divide-gray-100">
                  {formData.step2.directors?.map((d, i) => (
                    <div key={i} className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500 text-xs">Name</span><p className="font-medium text-gray-900">{d.directorName}</p></div>
                      <div><span className="text-gray-500 text-xs">NIN</span><p className="font-medium font-mono text-gray-900">{d.ninNumber}</p></div>
                      <div><span className="text-gray-500 text-xs">BVN</span><p className="font-medium font-mono text-gray-900">{d.bvn}</p></div>
                      <div><span className="text-gray-500 text-xs">Email</span><p className="font-medium text-gray-900">{d.directorEmail}</p></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">KYC Documents</span>
                  <button onClick={() => setCurrentStep(3)} className="text-xs font-medium text-primary hover:bg-primary-50 px-2.5 py-1 rounded-lg transition-colors">Edit</button>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500 text-xs">CAC Number</span><p className="font-medium font-mono text-gray-900">{formData.step3.cacRegNumber}</p></div>
                  <div><span className="text-gray-500 text-xs">Tax ID</span><p className="font-medium font-mono text-gray-900">{formData.step3.taxId}</p></div>
                  {[{ label: "CAC Certificate", doc: cacCertificate }, { label: "Director's ID Card", doc: idCard }].map(({ label, doc }) => (
                    <div key={label} className="col-span-2">
                      <span className="text-gray-500 text-xs">{label}</span>
                      <p className="font-medium text-gray-900 flex items-center gap-1.5">
                        <FileText size={13} className="text-primary" />
                        {doc ? doc.storageRef.split("/").pop() : "Not uploaded"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-primary-50 border border-primary/10 flex items-start gap-3">
              <Shield size={15} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-primary leading-relaxed">
                By submitting, you confirm that all information provided is accurate and complete.
              </p>
            </div>
            <div className="flex gap-3 pt-6 mt-1 border-t border-gray-100">
              <button type="button" onClick={() => setCurrentStep(3)} className="btn-secondary flex items-center gap-2 px-5 py-2.5">
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={createOnboarding.isPending || submitOnboarding.isPending}
                className="btn-primary ml-auto flex items-center gap-2 px-5 py-2.5 disabled:opacity-50"
              >
                <Send size={14} />
                {createOnboarding.isPending || submitOnboarding.isPending ? "Submitting…" : "Submit Application"}
              </button>
            </div>
            {submitError && <p className="text-xs text-red-600 text-right">{submitError}</p>}
          </div>
        )}
      </div>
    </Layout>
  );
}
