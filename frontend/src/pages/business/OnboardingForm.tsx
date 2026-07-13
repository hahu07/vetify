import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import {
  CheckCircle2, ChevronRight, ChevronLeft, Save, Send, User, Building, Shield, Eye,
  Upload, FileText, X, Loader2, Plus, Trash2, FileEdit,
} from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import {
  useCreateOnboarding, useSubmitOnboarding, useWithdrawOnboarding, useOnboardingList, useAmendOnboarding,
  useUploadDocument,
} from '../../api/client'
import type { DocumentRef } from '../../api/client'
import { BUSINESS_PARTY_ID, VETIFY_PARTY_ID, VERIFIER_PARTY_ID } from '../../api/parties'

// ─── Validation Schemas ────────────────────────────────────────────────────────

// Counts words, not characters — a business activity description needs enough
// substance for Shariah compliance screening to actually classify the sector
// (found live: a bare "yyyyy" or single word passed the old min(3)-characters
// check), but shouldn't become a free-form essay either.
function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}

const BUSINESS_ACTIVITY_MIN_WORDS = 5
const BUSINESS_ACTIVITY_MAX_WORDS = 150

const step1Schema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  address: z.string().min(5, 'Please enter a complete address'),
  state: z.string().min(1, 'Please select a state'),
  phoneNumber: z.string().regex(/^\+234\s?\d{3}\s?\d{3}\s?\d{4}$/, 'Enter a valid Nigerian phone (+234...)'),
  email: z.string().email('Please enter a valid email'),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  businessType: z.enum(['SoleProprietorship', 'LimitedCompany']),
  incorporationDate: z.string().min(1, 'Please enter incorporation date'),
  businessActivity: z.string()
    .min(3, 'Please describe what your business does')
    .refine((val) => countWords(val) >= BUSINESS_ACTIVITY_MIN_WORDS, {
      message: `Please use at least ${BUSINESS_ACTIVITY_MIN_WORDS} words to describe your business activity`,
    })
    .refine((val) => countWords(val) <= BUSINESS_ACTIVITY_MAX_WORDS, {
      message: `Business activity description must be ${BUSINESS_ACTIVITY_MAX_WORDS} words or fewer`,
    }),
  businessSector: z.string().min(1, 'Please select a sector'),
})

const directorSchema = z.object({
  directorName: z.string().min(2, 'Full name required'),
  directorAddress: z.string().min(5, 'Address required'),
  directorPhone: z.string().regex(/^\+234\s?\d{3}\s?\d{3}\s?\d{4}$/, 'Enter a valid Nigerian phone (+234...)'),
  ninNumber: z.string().length(11, 'NIN must be exactly 11 digits').regex(/^\d+$/, 'NIN must contain only digits'),
  bvn: z.string().length(11, 'BVN must be exactly 11 digits').regex(/^\d+$/, 'BVN must contain only digits'),
  directorEmail: z.string().email('Please enter a valid email'),
})

// Onboarding.daml's `ensure` requires at least 1 director (CAMA 2020 s271(1))
// — this form previously only ever collected one.
const step2Schema = z.object({
  directors: z.array(directorSchema).min(1, 'At least one director is required'),
})

// Mirrors Onboarding.daml's `uniqueOn ninNumber`/`uniqueOn bvn` across
// profile.directors — checked manually (like validateCacFormat below) rather
// than via a zod .refine, since a whole-array refine's error doesn't compose
// cleanly with react-hook-form's per-item field errors here.
function findDuplicateDirectorField(directors: Director[]): string | null {
  const nins = directors.map((d) => d.ninNumber)
  if (new Set(nins).size !== nins.length) return 'Each director must have a unique NIN number.'
  const bvns = directors.map((d) => d.bvn)
  if (new Set(bvns).size !== bvns.length) return 'Each director must have a unique BVN.'
  return null
}

const step3Schema = z.object({
  cacRegNumber: z.string().min(5, 'Enter a valid CAC registration number'),
  taxId: z.string().min(5, 'Enter a valid Tax ID'),
})

// Mirrors Onboarding.daml's BusinessOnboarding `ensure` clause exactly (CAC
// prefix must match business type, 2-char prefix + digits only, length >= 4)
// — checked client-side so a mismatch is caught immediately on this step
// instead of surfacing as an opaque ledger rejection on final submit, four
// steps later (found live: a Sole Proprietorship submitted with an "RC..."
// number sailed through every form step and only failed at Review & Submit
// with a raw "Request failed with status code 422").
function validateCacFormat(cacRegNumber: string, businessType: 'SoleProprietorship' | 'LimitedCompany'): string | null {
  const requiredPrefix = businessType === 'LimitedCompany' ? 'RC' : 'BN'
  const entityLabel = businessType === 'LimitedCompany' ? 'Limited companies' : 'Sole proprietorships'
  if (!cacRegNumber.startsWith(requiredPrefix)) {
    return `${entityLabel} must use a CAC number starting with "${requiredPrefix}" (e.g. ${requiredPrefix}1234567)`
  }
  if (cacRegNumber.length < 4 || !/^\d+$/.test(cacRegNumber.slice(2))) {
    return `CAC number must be "${requiredPrefix}" followed only by digits — no hyphens or spaces (e.g. ${requiredPrefix}1234567)`
  }
  return null
}

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

type Step1Data = z.infer<typeof step1Schema>
type Step2Data = z.infer<typeof step2Schema>
type Step3Data = z.infer<typeof step3Schema>
type Director = z.infer<typeof directorSchema>

const STEPS = [
  { num: 1, label: 'Business Profile', icon: <Building size={16} /> },
  { num: 2, label: 'Director', icon: <User size={16} /> },
  { num: 3, label: 'KYC Documents', icon: <Shield size={16} /> },
  { num: 4, label: 'Review & Submit', icon: <Eye size={16} /> },
]

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

function FormLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

const MAX_DOCUMENT_BYTES = 1 * 1024 * 1024 // 1MB per KYC document

interface KycDocumentUploadProps {
  id: string
  label: string
  docType: string
  required?: boolean
  value: DocumentRef | null
  onChange: (doc: DocumentRef | null) => void
}

// A single labeled file-upload slot — reused for each of the four KYC
// document types below (CAC Certificate, CAC Status Report, MEMART,
// Director ID/NIN card), each uploaded and stored independently.
function KycDocumentUpload({ id, label, docType, required, value, onChange }: KycDocumentUploadProps) {
  const uploadDocument = useUploadDocument()
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError('File exceeds the 1MB limit.')
      return
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const base64Content = dataUrl.slice(dataUrl.indexOf(',') + 1)
      const uploaded = await uploadDocument.mutateAsync({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        docType,
        base64Content,
      })
      onChange(uploaded)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload document')
    }
  }

  return (
    <div>
      <FormLabel htmlFor={id} required={required}>{label}</FormLabel>
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-surface px-4 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{value.storageRef.split('/').pop()}</p>
              {value.fileSize && (
                <p className="text-xs text-gray-400 mt-0.5">{(value.fileSize / 1024).toFixed(0)} KB</p>
              )}
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
            error
              ? 'border-red-300 bg-red-50/50'
              : 'border-gray-200 bg-surface hover:border-primary/50 hover:bg-primary-50/30'
          }`}
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${error ? 'bg-red-100' : 'bg-white border border-gray-200'}`}>
            {uploadDocument.isPending ? (
              <Loader2 size={16} className="animate-spin text-primary" />
            ) : (
              <Upload size={16} className={error ? 'text-red-500' : 'text-gray-400'} />
            )}
          </div>
          <span className={`text-sm font-medium ${error ? 'text-red-600' : 'text-gray-600'}`}>
            {uploadDocument.isPending ? 'Uploading…' : 'Click to upload'}
          </span>
          <span className="text-xs text-gray-400">PDF, JPG, PNG — max 1MB</span>
          <input
            id={id}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            disabled={uploadDocument.isPending}
            onChange={(e) => handleSelect(e.target.files?.[0])}
          />
        </label>
      )}
      <FieldError message={error ?? undefined} />
    </div>
  )
}

export default function OnboardingForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    step1: {} as Partial<Step1Data>,
    step2: {} as Partial<Step2Data>,
    step3: {} as Partial<Step3Data>,
  })

  const createOnboarding = useCreateOnboarding()
  const submitOnboarding = useSubmitOnboarding()
  const withdrawOnboarding = useWithdrawOnboarding()
  const amendOnboarding = useAmendOnboarding()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [directorsError, setDirectorsError] = useState<string | null>(null)

  // BusinessOnboarding.Approve hard-requires at least one document on-ledger
  // (Onboarding.daml's Gap 5 assertion) — found live: this form had no upload
  // step at all, so every real submission carried documents: [] and could
  // never be approved. Four separate documents are captured here and
  // attached at create/amend time; each KycDocumentUpload sends its file to
  // the backend's local storage (routes/documents.ts) and gets back a real
  // DocumentRef (server-computed SHA-256), not a fabricated one. MEMART only
  // applies to LimitedCompany — Sole Proprietorships don't have one under
  // CAMA 2020.
  const [cacCertificate, setCacCertificate] = useState<DocumentRef | null>(null)
  const [statusReport, setStatusReport] = useState<DocumentRef | null>(null)
  const [memart, setMemart] = useState<DocumentRef | null>(null)
  const [idCard, setIdCard] = useState<DocumentRef | null>(null)
  // Optional — not asserted anywhere in Onboarding.daml's `ensure`, just a slot
  // for supporting evidence (e.g. a utility bill, a lease, a permit) that
  // doesn't fit the four fixed KYC categories above.
  const [otherDocument, setOtherDocument] = useState<DocumentRef | null>(null)
  const [documentsError, setDocumentsError] = useState<string | null>(null)

  // RequestAmendment (vetify) returns a flagged application to the business as
  // PendingAmendment — this reuses the same wizard to collect the correction and
  // calls Amend instead of create+submit when that's the case (Onboarding.daml's
  // Amend requires the business to resubmit the *entire* profile/kyc, not a patch).
  const { data: onboardingList } = useOnboardingList()
  const existing = onboardingList?.[0]
  const isAmending = existing?.status === 'PendingAmendment'

  // Pre-fill from the existing onboarding's already-uploaded documents when
  // amending, so a business correcting an unrelated field doesn't have to
  // re-upload everything — they can still replace any of them below.
  useEffect(() => {
    if (isAmending && existing?.documents) {
      const find = (t: string) => existing.documents.find((d) => d.docType === t) ?? null
      if (!cacCertificate) setCacCertificate(find('CAC_CERTIFICATE'))
      if (!statusReport) setStatusReport(find('CAC_STATUS_REPORT'))
      if (!memart) setMemart(find('MEMART'))
      if (!idCard) setIdCard(find('NIN_ID_CARD'))
      if (!otherDocument) setOtherDocument(find('OTHER'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAmending, existing])

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    values: isAmending && existing ? {
      name: existing.profile.name,
      address: existing.profile.address,
      state: existing.profile.state,
      phoneNumber: existing.profile.phoneNumber,
      email: existing.profile.email,
      website: existing.profile.website || '',
      businessType: existing.profile.businessType,
      incorporationDate: existing.profile.incorporationDate,
      businessActivity: existing.profile.businessActivity,
      businessSector: existing.profile.businessSector,
    } : undefined,
    defaultValues: {
      name: '',
      address: '',
      state: '',
      phoneNumber: '',
      email: '',
      website: '',
      businessType: 'SoleProprietorship',
      incorporationDate: '',
      businessActivity: '',
      businessSector: '',
    },
  })

  const businessActivityWordCount = countWords(step1Form.watch('businessActivity') || '')

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    values: isAmending && existing?.profile.directors?.length ? {
      directors: existing.profile.directors.map((d) => ({
        directorName: d.name,
        directorAddress: d.address,
        directorPhone: d.phoneNumber,
        ninNumber: d.ninNumber,
        bvn: d.bvn,
        directorEmail: d.email,
      })),
    } : undefined,
    defaultValues: {
      directors: [{ directorName: '', directorAddress: '', directorPhone: '', ninNumber: '', bvn: '', directorEmail: '' }],
    },
  })

  const { fields: directorFields, append: appendDirector, remove: removeDirector } = useFieldArray({
    control: step2Form.control,
    name: 'directors',
  })

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    // CAC number is immutable on amendment (Onboarding.daml asserts it) — pre-filled and,
    // per the review step below, not editable in amend mode.
    values: isAmending && existing ? {
      cacRegNumber: existing.kyc.cacRegNumber,
      taxId: existing.kyc.taxId,
    } : undefined,
    defaultValues: {
      cacRegNumber: '',
      taxId: '',
    },
  })

  const handleStep1Next = step1Form.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, step1: data }))
    setCurrentStep(2)
  })

  const handleStep2Next = step2Form.handleSubmit((data) => {
    const dupError = findDuplicateDirectorField(data.directors)
    if (dupError) {
      setDirectorsError(dupError)
      return
    }
    setDirectorsError(null)
    setFormData((prev) => ({ ...prev, step2: data }))
    setCurrentStep(3)
  })

  const handleStep3Next = step3Form.handleSubmit((data) => {
    const cacError = validateCacFormat(data.cacRegNumber, formData.step1.businessType!)
    if (cacError) {
      step3Form.setError('cacRegNumber', { message: cacError })
      return
    }
    const isLimitedCompany = formData.step1.businessType === 'LimitedCompany'
    if (!cacCertificate || !statusReport || !idCard || (isLimitedCompany && !memart)) {
      setDocumentsError('Please upload all required documents before continuing.')
      return
    }
    setDocumentsError(null)
    setFormData((prev) => ({ ...prev, step3: data }))
    setCurrentStep(4)
  })

  const handleSubmit = async () => {
    setSubmitError(null)
    const { step1, step2, step3 } = formData
    // Defensive re-check: the Step 2/3 "Next" transitions already validate
    // these, but if an earlier step was edited via "Edit" after Step 3 was
    // completed, re-check here rather than round-tripping to the ledger
    // only to get the same rejection back from Onboarding.daml's `ensure`.
    const cacError = validateCacFormat(step3.cacRegNumber!, step1.businessType!)
    if (cacError) {
      setSubmitError(cacError)
      return
    }
    const dupError = findDuplicateDirectorField(step2.directors!)
    if (dupError) {
      setSubmitError(dupError)
      return
    }
    const isLimitedCompany = step1.businessType === 'LimitedCompany'
    if (!cacCertificate || !statusReport || !idCard || (isLimitedCompany && !memart)) {
      setSubmitError('Please go back to Step 3 and upload all required documents.')
      return
    }
    const documents = [
      cacCertificate,
      statusReport,
      idCard,
      ...(isLimitedCompany ? [memart!] : []),
      ...(otherDocument ? [otherDocument] : []),
    ]
    const profile = {
      name: step1.name!,
      address: step1.address!,
      state: step1.state!,
      phoneNumber: step1.phoneNumber!,
      email: step1.email!,
      website: step1.website || undefined,
      businessType: step1.businessType!,
      incorporationDate: step1.incorporationDate!,
      directors: step2.directors!.map((d) => ({
        name: d.directorName,
        address: d.directorAddress,
        phoneNumber: d.directorPhone,
        ninNumber: d.ninNumber,
        bvn: d.bvn,
        email: d.directorEmail,
      })),
      businessActivity: step1.businessActivity!,
      businessSector: step1.businessSector!,
    }
    try {
      if (isAmending && existing) {
        // Amend returns the application to Draft (a fresh contract, new ID) — resubmit
        // immediately so the business's corrected application actually reaches the
        // verifier again, rather than leaving it sitting in Draft unsubmitted.
        const amended = await amendOnboarding.mutateAsync({
          id: existing.id,
          updatedProfile: profile,
          updatedKyc: { cacRegNumber: existing.kyc.cacRegNumber, taxId: step3.taxId! },
          updatedDocuments: documents,
        })
        await submitOnboarding.mutateAsync((amended as { contractId: string }).contractId)
        setSubmitted(true)
        return
      }
      // create+submit run as two ledger writes for one click. If submit fails
      // after create already succeeded, withdraw (archive) the just-created
      // Draft rather than leaving it behind — found live: without this, every
      // retry created ANOTHER duplicate Draft on the ledger, since the next
      // attempt always calls createOnboarding again with no memory of the
      // orphan the previous attempt left, and (for a genuinely unresolvable
      // conflict like a CAC already claimed elsewhere) every retry fails the
      // same way, so the duplicates only ever accumulated.
      const created = await createOnboarding.mutateAsync({
        business: BUSINESS_PARTY_ID,
        vetify: VETIFY_PARTY_ID,
        verifier: VERIFIER_PARTY_ID,
        profile,
        kyc: {
          cacRegNumber: step3.cacRegNumber!,
          taxId: step3.taxId!,
        },
        documents,
      })
      try {
        await submitOnboarding.mutateAsync(created.contractId)
      } catch (submitErr) {
        await withdrawOnboarding.mutateAsync(created.contractId).catch(() => {})
        throw submitErr
      }
      setSubmitted(true)
    } catch (e) {
      // Surface the backend's actual publicMessage (errorHandler.ts sends
      // { error: <message> }) rather than axios's own generic "Request
      // failed with status code NNN", which told the user nothing about
      // what actually went wrong.
      if (axios.isAxiosError(e) && e.response) {
        setSubmitError((e.response.data as { error?: string }).error ?? 'Failed to submit application')
      } else {
        setSubmitError(e instanceof Error ? e.message : 'Failed to submit application')
      }
    }
  }

  if (submitted) {
    return (
      <Layout
        breadcrumb={[
          { label: 'Business Portal', path: '/business/dashboard' },
          { label: 'Onboarding', path: '/business/onboarding' },
        ]}
      >
        <div className="max-w-lg mx-auto mt-20 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={36} className="text-emerald-600" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-gray-900 mb-3">
            {isAmending ? 'Corrected Application Resubmitted!' : 'Application Submitted!'}
          </h2>
          <p className="text-gray-600 text-sm mb-2 leading-relaxed">
            {isAmending
              ? 'Your corrected application has been resubmitted for review.'
              : 'Your onboarding application has been submitted for review.'}
            {' '}Our AI Verification Agent will process it within 1–2 business days.
          </p>
          <p className="text-gray-400 text-xs mb-7">
            You'll be notified once the review is complete.
          </p>
          <StatusBadge status="UnderReview" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      breadcrumb={[
        { label: 'Business Portal', path: '/business/dashboard' },
        { label: 'Onboarding' },
      ]}
    >
      <div className="max-w-3xl mx-auto">
        {isAmending && (
          <div className="rounded-2xl p-5 mb-6 bg-indigo-50 border border-indigo-100 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <FileEdit size={17} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-800 mb-1">Amendment Requested</p>
              <p className="text-sm text-indigo-700 leading-relaxed">
                Vetify has returned your application for correction. Review each step below — your
                previous details are pre-filled — make the necessary changes, and resubmit.
              </p>
            </div>
          </div>
        )}
        {/* Step Progress */}
        <div className="card p-6 mb-7">
          <div className="relative flex items-start">
            {/* Full-width track behind the circles */}
            <div className="absolute top-6 left-6 right-6 h-0.5 bg-gray-200" />
            <div
              className="absolute top-6 left-6 h-0.5 bg-primary transition-all duration-500"
              style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
            />
            {STEPS.map((step) => {
              const isCompleted = step.num < currentStep
              const isCurrent = step.num === currentStep

              return (
                <div key={step.num} className="relative flex-1 flex flex-col items-center gap-2.5">
                  <div
                    className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? 'bg-primary text-white shadow-md'
                        : isCurrent
                        ? 'bg-primary text-white shadow-lg ring-4 ring-primary-50'
                        : 'bg-white text-gray-400 border-2 border-gray-200'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={18} /> : step.icon}
                  </div>
                  <span
                    className={`text-center leading-tight px-1 ${
                      isCurrent ? 'text-primary text-xs font-semibold' : isCompleted ? 'text-gray-600 text-xs font-medium' : 'text-gray-400 text-xs'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500 text-center">
            Step {currentStep} of {STEPS.length}: <strong className="text-gray-700">{STEPS[currentStep - 1]?.label}</strong>
          </div>
        </div>

        {/* Step 1 — Business Profile */}
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
                  <input
                    id="name"
                    className={`input py-2.5 ${step1Form.formState.errors.name ? 'input-error' : ''}`}
                    placeholder="e.g. Adekunle Foods & Beverages Ltd"
                    {...step1Form.register('name')}
                  />
                  <FieldError message={step1Form.formState.errors.name?.message} />
                </div>

                <div className="col-span-2">
                  <FormLabel htmlFor="address" required>Business Address</FormLabel>
                  <input
                    id="address"
                    className={`input py-2.5 ${step1Form.formState.errors.address ? 'input-error' : ''}`}
                    placeholder="Street address, area"
                    {...step1Form.register('address')}
                  />
                  <FieldError message={step1Form.formState.errors.address?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="state" required>State</FormLabel>
                  <select
                    id="state"
                    className={`input py-2.5 ${step1Form.formState.errors.state ? 'input-error' : ''}`}
                    {...step1Form.register('state')}
                  >
                    <option value="">Select state...</option>
                    {NIGERIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <FieldError message={step1Form.formState.errors.state?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="businessType" required>Business Type</FormLabel>
                  <div className="grid grid-cols-2 gap-2.5">
                    {([
                      ['SoleProprietorship', 'Sole Proprietorship'],
                      ['LimitedCompany', 'Limited Company'],
                    ] as const).map(([value, labelText]) => {
                      const isSelected = step1Form.watch('businessType') === value
                      return (
                        <label key={value} className="cursor-pointer">
                          <input
                            type="radio"
                            value={value}
                            className="sr-only"
                            {...step1Form.register('businessType')}
                          />
                          <div
                            className={`text-center py-2.5 px-2 rounded-xl border-2 text-sm font-medium transition-all ${
                              isSelected
                                ? 'border-primary bg-primary text-white'
                                : 'border-gray-200 text-gray-600 hover:border-primary/40'
                            }`}
                          >
                            {labelText}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  <FieldError message={step1Form.formState.errors.businessType?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="phoneNumber" required>Phone Number</FormLabel>
                  <input
                    id="phoneNumber"
                    className={`input py-2.5 ${step1Form.formState.errors.phoneNumber ? 'input-error' : ''}`}
                    placeholder="+234 801 234 5678"
                    {...step1Form.register('phoneNumber')}
                  />
                  <FieldError message={step1Form.formState.errors.phoneNumber?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="email" required>Business Email</FormLabel>
                  <input
                    id="email"
                    type="email"
                    className={`input py-2.5 ${step1Form.formState.errors.email ? 'input-error' : ''}`}
                    placeholder="admin@yourbusiness.ng"
                    {...step1Form.register('email')}
                  />
                  <FieldError message={step1Form.formState.errors.email?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="website">Website (Optional)</FormLabel>
                  <input
                    id="website"
                    type="url"
                    className={`input py-2.5 ${step1Form.formState.errors.website ? 'input-error' : ''}`}
                    placeholder="https://yourbusiness.ng"
                    {...step1Form.register('website')}
                  />
                  <FieldError message={step1Form.formState.errors.website?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="incorporationDate" required>Incorporation Date</FormLabel>
                  <input
                    id="incorporationDate"
                    type="date"
                    className={`input py-2.5 ${step1Form.formState.errors.incorporationDate ? 'input-error' : ''}`}
                    {...step1Form.register('incorporationDate')}
                  />
                  <FieldError message={step1Form.formState.errors.incorporationDate?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="businessSector" required>Business Sector</FormLabel>
                  <input
                    id="businessSector"
                    className={`input py-2.5 ${step1Form.formState.errors.businessSector ? 'input-error' : ''}`}
                    placeholder="e.g. Retail Trade"
                    {...step1Form.register('businessSector')}
                  />
                  <FieldError message={step1Form.formState.errors.businessSector?.message} />
                </div>

                <div className="col-span-2">
                  <FormLabel htmlFor="businessActivity" required>Business Activity</FormLabel>
                  <textarea
                    id="businessActivity"
                    rows={4}
                    className={`input py-2.5 resize-none ${step1Form.formState.errors.businessActivity ? 'input-error' : ''}`}
                    placeholder="Describe what your business actually does — e.g. retail sale of electronics, wholesale distribution of agricultural produce, manufacturing of packaging materials..."
                    {...step1Form.register('businessActivity')}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400">
                      Used by our Shariah compliance screening — describe what your business actually does.
                    </p>
                    <span
                      className={`text-xs flex-shrink-0 ml-2 ${
                        businessActivityWordCount > 0 &&
                        (businessActivityWordCount < BUSINESS_ACTIVITY_MIN_WORDS ||
                          businessActivityWordCount > BUSINESS_ACTIVITY_MAX_WORDS)
                          ? 'text-red-500'
                          : 'text-gray-400'
                      }`}
                    >
                      {businessActivityWordCount} / {BUSINESS_ACTIVITY_MAX_WORDS} words
                    </span>
                  </div>
                  <FieldError message={step1Form.formState.errors.businessActivity?.message} />
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-1 border-t border-gray-100">
                <button type="button" className="btn-secondary flex items-center gap-2 px-5 py-2.5">
                  <Save size={14} />
                  Save Draft
                </button>
                <button type="submit" className="btn-primary ml-auto flex items-center gap-2 px-5 py-2.5">
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2 — Director(s) */}
        {currentStep === 2 && (
          <div className="card p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-7">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <User size={19} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-gray-900 tracking-tight">
                    Business Director{directorFields.length > 1 ? 's' : ''}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">CAMA 2020 requires at least one director on record</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => appendDirector({
                  directorName: '', directorAddress: '', directorPhone: '', ninNumber: '', bvn: '', directorEmail: '',
                })}
                className="text-xs font-medium text-primary hover:bg-primary-50 flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-lg transition-colors"
              >
                <Plus size={14} />
                Add Director
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
                      <button
                        type="button"
                        onClick={() => removeDirector(index)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label={`Remove Director ${index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2">
                      <FormLabel htmlFor={`directorName-${index}`} required>Full Name</FormLabel>
                      <input
                        id={`directorName-${index}`}
                        className={`input py-2.5 ${step2Form.formState.errors.directors?.[index]?.directorName ? 'input-error' : ''}`}
                        placeholder="Full legal name as on NIN"
                        {...step2Form.register(`directors.${index}.directorName`)}
                      />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.directorName?.message} />
                    </div>

                    <div className="col-span-2">
                      <FormLabel htmlFor={`directorAddress-${index}`} required>Residential Address</FormLabel>
                      <input
                        id={`directorAddress-${index}`}
                        className={`input py-2.5 ${step2Form.formState.errors.directors?.[index]?.directorAddress ? 'input-error' : ''}`}
                        placeholder="Residential address"
                        {...step2Form.register(`directors.${index}.directorAddress`)}
                      />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.directorAddress?.message} />
                    </div>

                    <div>
                      <FormLabel htmlFor={`directorPhone-${index}`} required>Phone Number</FormLabel>
                      <input
                        id={`directorPhone-${index}`}
                        className={`input py-2.5 ${step2Form.formState.errors.directors?.[index]?.directorPhone ? 'input-error' : ''}`}
                        placeholder="+234 801 234 5678"
                        {...step2Form.register(`directors.${index}.directorPhone`)}
                      />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.directorPhone?.message} />
                    </div>

                    <div>
                      <FormLabel htmlFor={`directorEmail-${index}`} required>Email Address</FormLabel>
                      <input
                        id={`directorEmail-${index}`}
                        type="email"
                        className={`input py-2.5 ${step2Form.formState.errors.directors?.[index]?.directorEmail ? 'input-error' : ''}`}
                        placeholder="director@email.com"
                        {...step2Form.register(`directors.${index}.directorEmail`)}
                      />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.directorEmail?.message} />
                    </div>

                    <div>
                      <FormLabel htmlFor={`ninNumber-${index}`} required>NIN Number</FormLabel>
                      <input
                        id={`ninNumber-${index}`}
                        className={`input py-2.5 font-mono ${step2Form.formState.errors.directors?.[index]?.ninNumber ? 'input-error' : ''}`}
                        placeholder="12345678901"
                        maxLength={11}
                        {...step2Form.register(`directors.${index}.ninNumber`)}
                      />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.ninNumber?.message} />
                    </div>

                    <div>
                      <FormLabel htmlFor={`bvn-${index}`} required>BVN</FormLabel>
                      <input
                        id={`bvn-${index}`}
                        className={`input py-2.5 font-mono ${step2Form.formState.errors.directors?.[index]?.bvn ? 'input-error' : ''}`}
                        placeholder="22345678901"
                        maxLength={11}
                        {...step2Form.register(`directors.${index}.bvn`)}
                      />
                      <FieldError message={step2Form.formState.errors.directors?.[index]?.bvn?.message} />
                    </div>
                  </div>
                </div>
              ))}

              <FieldError message={directorsError ?? undefined} />

              <div className="flex gap-3 pt-6 mt-1 border-t border-gray-100">
                <button type="button" onClick={() => setCurrentStep(1)} className="btn-secondary flex items-center gap-2 px-5 py-2.5">
                  <ChevronLeft size={14} />
                  Back
                </button>
                <button type="submit" className="btn-primary ml-auto flex items-center gap-2 px-5 py-2.5">
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3 — KYC */}
        {currentStep === 3 && (
          <div className="card p-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Shield size={19} className="text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-gray-900 tracking-tight">KYC Documents</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Provide your business registration details — our AI agent will verify these with the CAC registry.
                </p>
              </div>
            </div>
            <form onSubmit={handleStep3Next} className="space-y-5">
              <div>
                <FormLabel htmlFor="cacRegNumber" required>CAC Registration Number</FormLabel>
                <input
                  id="cacRegNumber"
                  disabled={isAmending}
                  className={`input py-2.5 font-mono ${isAmending ? 'bg-gray-50 text-gray-500' : ''} ${step3Form.formState.errors.cacRegNumber ? 'input-error' : ''}`}
                  placeholder={formData.step1.businessType === 'SoleProprietorship' ? 'BN1234567' : 'RC1234567'}
                  {...step3Form.register('cacRegNumber')}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {isAmending
                    ? 'CAC number cannot change during an amendment.'
                    : 'For limited companies: RC followed by digits (e.g. RC1234567). For sole proprietorships: BN followed by digits (e.g. BN1234567).'}
                </p>
                <FieldError message={step3Form.formState.errors.cacRegNumber?.message} />
              </div>

              <div>
                <FormLabel htmlFor="taxId" required>Tax Identification Number (TIN)</FormLabel>
                <input
                  id="taxId"
                  className={`input py-2.5 font-mono ${step3Form.formState.errors.taxId ? 'input-error' : ''}`}
                  placeholder="TIN-XXXXXXXXX"
                  {...step3Form.register('taxId')}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Your Federal Inland Revenue Service (FIRS) TIN number.
                </p>
                <FieldError message={step3Form.formState.errors.taxId?.message} />
              </div>

              <KycDocumentUpload
                id="cacCertificate"
                label="CAC Registration Certificate"
                docType="CAC_CERTIFICATE"
                required
                value={cacCertificate}
                onChange={setCacCertificate}
              />

              <KycDocumentUpload
                id="statusReport"
                label="CAC Status Report"
                docType="CAC_STATUS_REPORT"
                required
                value={statusReport}
                onChange={setStatusReport}
              />

              {formData.step1.businessType === 'LimitedCompany' && (
                <KycDocumentUpload
                  id="memart"
                  label="Memorandum & Articles of Association (MEMART)"
                  docType="MEMART"
                  required
                  value={memart}
                  onChange={setMemart}
                />
              )}

              <KycDocumentUpload
                id="idCard"
                label="Director's ID Card (NIN)"
                docType="NIN_ID_CARD"
                required
                value={idCard}
                onChange={setIdCard}
              />

              <KycDocumentUpload
                id="otherDocument"
                label="Other Supporting Document (Optional)"
                docType="OTHER"
                value={otherDocument}
                onChange={setOtherDocument}
              />

              <FieldError message={documentsError ?? undefined} />

              <div className="flex gap-3 pt-6 mt-1 border-t border-gray-100">
                <button type="button" onClick={() => setCurrentStep(2)} className="btn-secondary flex items-center gap-2 px-5 py-2.5">
                  <ChevronLeft size={14} />
                  Back
                </button>
                <button type="submit" className="btn-primary ml-auto flex items-center gap-2 px-5 py-2.5">
                  Review
                  <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 4 — Review */}
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
              {/* Business Profile summary */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Business Profile</span>
                  <button onClick={() => setCurrentStep(1)} className="text-xs font-medium text-primary hover:bg-primary-50 px-2.5 py-1 rounded-lg transition-colors">Edit</button>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">Name</span>
                    <p className="font-medium text-gray-900">{formData.step1.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">State</span>
                    <p className="font-medium text-gray-900">{formData.step1.state}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Type</span>
                    <p className="font-medium text-gray-900">{formData.step1.businessType === 'LimitedCompany' ? 'Limited Company' : 'Sole Proprietorship'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Email</span>
                    <p className="font-medium text-gray-900">{formData.step1.email}</p>
                  </div>
                </div>
              </div>

              {/* Director summary */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Business Director{(formData.step2.directors?.length ?? 0) > 1 ? 's' : ''}
                  </span>
                  <button onClick={() => setCurrentStep(2)} className="text-xs font-medium text-primary hover:bg-primary-50 px-2.5 py-1 rounded-lg transition-colors">Edit</button>
                </div>
                <div className="divide-y divide-gray-100">
                  {formData.step2.directors?.map((d, i) => (
                    <div key={i} className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs">Name</span>
                        <p className="font-medium text-gray-900">{d.directorName}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">NIN</span>
                        <p className="font-medium font-mono text-gray-900">{d.ninNumber}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">BVN</span>
                        <p className="font-medium font-mono text-gray-900">{d.bvn}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Email</span>
                        <p className="font-medium text-gray-900">{d.directorEmail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KYC summary */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">KYC Documents</span>
                  <button onClick={() => setCurrentStep(3)} className="text-xs font-medium text-primary hover:bg-primary-50 px-2.5 py-1 rounded-lg transition-colors">Edit</button>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">CAC Number</span>
                    <p className="font-medium font-mono text-gray-900">{formData.step3.cacRegNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Tax ID</span>
                    <p className="font-medium font-mono text-gray-900">{formData.step3.taxId}</p>
                  </div>
                  {[
                    { label: 'CAC Certificate', doc: cacCertificate },
                    { label: 'CAC Status Report', doc: statusReport },
                    ...(formData.step1.businessType === 'LimitedCompany' ? [{ label: 'MEMART', doc: memart }] : []),
                    { label: "Director's ID Card", doc: idCard },
                    ...(otherDocument ? [{ label: 'Other Supporting Document', doc: otherDocument }] : []),
                  ].map(({ label, doc }) => (
                    <div key={label} className="col-span-2">
                      <span className="text-gray-500 text-xs">{label}</span>
                      <p className="font-medium text-gray-900 flex items-center gap-1.5">
                        <FileText size={13} className="text-primary" />
                        {doc ? doc.storageRef.split('/').pop() : 'Not uploaded'}
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
                Submission initiates the AI verification process under Vetify's terms of service.
              </p>
            </div>

            <div className="flex gap-3 pt-6 mt-1 border-t border-gray-100">
              <button type="button" onClick={() => setCurrentStep(3)} className="btn-secondary flex items-center gap-2 px-5 py-2.5">
                <ChevronLeft size={14} />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={createOnboarding.isPending || submitOnboarding.isPending}
                className="btn-primary ml-auto flex items-center gap-2 px-5 py-2.5 disabled:opacity-50"
              >
                <Send size={14} />
                {createOnboarding.isPending || submitOnboarding.isPending ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
            {submitError && <p className="text-xs text-red-600 text-right">{submitError}</p>}
          </div>
        )}
      </div>
    </Layout>
  )
}
