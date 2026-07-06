import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, ChevronRight, ChevronLeft, Save, Send, User, Building, Shield, Eye } from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { useCreateOnboarding, useSubmitOnboarding } from '../../api/client'
import { BORROWER_PARTY_ID, VETIFY_PARTY_ID, VERIFIER_PARTY_ID } from '../../api/parties'

// ─── Validation Schemas ────────────────────────────────────────────────────────

const step1Schema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  address: z.string().min(5, 'Please enter a complete address'),
  state: z.string().min(1, 'Please select a state'),
  phoneNumber: z.string().regex(/^\+234\s?\d{3}\s?\d{3}\s?\d{4}$/, 'Enter a valid Nigerian phone (+234...)'),
  email: z.string().email('Please enter a valid email'),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  businessType: z.enum(['SoleProprietorship', 'LimitedCompany']),
  incorporationDate: z.string().min(1, 'Please enter incorporation date'),
  businessActivity: z.string().min(3, 'Please describe what your business does'),
  businessSector: z.string().min(1, 'Please select a sector'),
})

const step2Schema = z.object({
  directorName: z.string().min(2, 'Full name required'),
  directorAddress: z.string().min(5, 'Address required'),
  directorPhone: z.string().regex(/^\+234\s?\d{3}\s?\d{3}\s?\d{4}$/, 'Enter a valid Nigerian phone (+234...)'),
  ninNumber: z.string().length(11, 'NIN must be exactly 11 digits').regex(/^\d+$/, 'NIN must contain only digits'),
  bvn: z.string().length(11, 'BVN must be exactly 11 digits').regex(/^\d+$/, 'BVN must contain only digits'),
  directorEmail: z.string().email('Please enter a valid email'),
})

const step3Schema = z.object({
  cacRegNumber: z.string().min(5, 'Enter a valid CAC registration number'),
  taxId: z.string().min(5, 'Enter a valid Tax ID'),
})

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

type Step1Data = z.infer<typeof step1Schema>
type Step2Data = z.infer<typeof step2Schema>
type Step3Data = z.infer<typeof step3Schema>

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
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
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
  const [submitError, setSubmitError] = useState<string | null>(null)

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
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

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      directorName: '',
      directorAddress: '',
      directorPhone: '',
      ninNumber: '',
      bvn: '',
      directorEmail: '',
    },
  })

  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
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
    setFormData((prev) => ({ ...prev, step2: data }))
    setCurrentStep(3)
  })

  const handleStep3Next = step3Form.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, step3: data }))
    setCurrentStep(4)
  })

  const handleSubmit = async () => {
    setSubmitError(null)
    try {
      const { step1, step2, step3 } = formData
      const created = await createOnboarding.mutateAsync({
        borrower: BORROWER_PARTY_ID,
        vetify: VETIFY_PARTY_ID,
        verifier: VERIFIER_PARTY_ID,
        business: {
          name: step1.name!,
          address: step1.address!,
          state: step1.state!,
          phoneNumber: step1.phoneNumber!,
          email: step1.email!,
          website: step1.website || undefined,
          businessType: step1.businessType!,
          incorporationDate: step1.incorporationDate!,
          directors: [{
            name: step2.directorName!,
            address: step2.directorAddress!,
            phoneNumber: step2.directorPhone!,
            ninNumber: step2.ninNumber!,
            bvn: step2.bvn!,
            email: step2.directorEmail!,
          }],
          businessActivity: step1.businessActivity!,
          businessSector: step1.businessSector!,
        },
        kyc: {
          cacRegNumber: step3.cacRegNumber!,
          taxId: step3.taxId!,
        },
      })
      await submitOnboarding.mutateAsync(created.contractId)
      setSubmitted(true)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit application')
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
        <div className="max-w-lg mx-auto mt-16 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Application Submitted!</h2>
          <p className="text-gray-600 text-sm mb-6">
            Your onboarding application has been submitted for review. Our AI Verification Agent will
            process it within 1–2 business days.
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
      <div className="max-w-2xl mx-auto">
        {/* Step Progress */}
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-0">
            {STEPS.map((step, idx) => {
              const isCompleted = step.num < currentStep
              const isCurrent = step.num === currentStep

              return (
                <div key={step.num} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? 'bg-primary text-white'
                          : isCurrent
                          ? 'bg-primary text-white ring-4 ring-primary-50'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 size={14} /> : step.icon}
                    </div>
                    <span
                      className={`text-center whitespace-nowrap ${
                        isCurrent ? 'text-primary text-xs font-semibold' : 'text-gray-400 text-xs'
                      }`}
                      style={{ fontSize: '10px' }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 mt-[-12px] ${step.num < currentStep ? 'bg-primary' : 'bg-gray-200'}`}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-xs text-gray-500 text-center">
            Step {currentStep} of {STEPS.length}: <strong>{STEPS[currentStep - 1]?.label}</strong>
          </div>
        </div>

        {/* Step 1 — Business Profile */}
        {currentStep === 1 && (
          <div className="card p-6 animate-fade-in">
            <h2 className="text-base font-semibold text-gray-900 mb-5">Business Profile</h2>
            <form onSubmit={handleStep1Next} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormLabel htmlFor="name" required>Business Name</FormLabel>
                  <input
                    id="name"
                    className={`input ${step1Form.formState.errors.name ? 'input-error' : ''}`}
                    placeholder="e.g. Adekunle Foods & Beverages Ltd"
                    {...step1Form.register('name')}
                  />
                  <FieldError message={step1Form.formState.errors.name?.message} />
                </div>

                <div className="col-span-2">
                  <FormLabel htmlFor="address" required>Business Address</FormLabel>
                  <input
                    id="address"
                    className={`input ${step1Form.formState.errors.address ? 'input-error' : ''}`}
                    placeholder="Street address, area"
                    {...step1Form.register('address')}
                  />
                  <FieldError message={step1Form.formState.errors.address?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="state" required>State</FormLabel>
                  <select
                    id="state"
                    className={`input ${step1Form.formState.errors.state ? 'input-error' : ''}`}
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
                  <div className="flex gap-3 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="SoleProprietorship"
                        className="accent-primary"
                        {...step1Form.register('businessType')}
                      />
                      <span className="text-sm text-gray-700">Sole Proprietorship</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="LimitedCompany"
                        className="accent-primary"
                        {...step1Form.register('businessType')}
                      />
                      <span className="text-sm text-gray-700">Limited Company</span>
                    </label>
                  </div>
                  <FieldError message={step1Form.formState.errors.businessType?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="phoneNumber" required>Phone Number</FormLabel>
                  <input
                    id="phoneNumber"
                    className={`input ${step1Form.formState.errors.phoneNumber ? 'input-error' : ''}`}
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
                    className={`input ${step1Form.formState.errors.email ? 'input-error' : ''}`}
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
                    className={`input ${step1Form.formState.errors.website ? 'input-error' : ''}`}
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
                    className={`input ${step1Form.formState.errors.incorporationDate ? 'input-error' : ''}`}
                    {...step1Form.register('incorporationDate')}
                  />
                  <FieldError message={step1Form.formState.errors.incorporationDate?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="businessSector" required>Business Sector</FormLabel>
                  <input
                    id="businessSector"
                    className={`input ${step1Form.formState.errors.businessSector ? 'input-error' : ''}`}
                    placeholder="e.g. Retail Trade"
                    {...step1Form.register('businessSector')}
                  />
                  <FieldError message={step1Form.formState.errors.businessSector?.message} />
                </div>

                <div className="col-span-2">
                  <FormLabel htmlFor="businessActivity" required>Business Activity</FormLabel>
                  <input
                    id="businessActivity"
                    className={`input ${step1Form.formState.errors.businessActivity ? 'input-error' : ''}`}
                    placeholder="e.g. retail sale of electronics"
                    {...step1Form.register('businessActivity')}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Used by our Shariah compliance screening — describe what your business actually does.
                  </p>
                  <FieldError message={step1Form.formState.errors.businessActivity?.message} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex items-center gap-2">
                  <Save size={14} />
                  Save Draft
                </button>
                <button type="submit" className="btn-primary ml-auto flex items-center gap-2">
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2 — Director */}
        {currentStep === 2 && (
          <div className="card p-6 animate-fade-in">
            <h2 className="text-base font-semibold text-gray-900 mb-5">Business Director</h2>
            <form onSubmit={handleStep2Next} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormLabel htmlFor="directorName" required>Full Name</FormLabel>
                  <input
                    id="directorName"
                    className={`input ${step2Form.formState.errors.directorName ? 'input-error' : ''}`}
                    placeholder="Full legal name as on NIN"
                    {...step2Form.register('directorName')}
                  />
                  <FieldError message={step2Form.formState.errors.directorName?.message} />
                </div>

                <div className="col-span-2">
                  <FormLabel htmlFor="directorAddress" required>Residential Address</FormLabel>
                  <input
                    id="directorAddress"
                    className={`input ${step2Form.formState.errors.directorAddress ? 'input-error' : ''}`}
                    placeholder="Residential address"
                    {...step2Form.register('directorAddress')}
                  />
                  <FieldError message={step2Form.formState.errors.directorAddress?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="directorPhone" required>Phone Number</FormLabel>
                  <input
                    id="directorPhone"
                    className={`input ${step2Form.formState.errors.directorPhone ? 'input-error' : ''}`}
                    placeholder="+234 801 234 5678"
                    {...step2Form.register('directorPhone')}
                  />
                  <FieldError message={step2Form.formState.errors.directorPhone?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="directorEmail" required>Email Address</FormLabel>
                  <input
                    id="directorEmail"
                    type="email"
                    className={`input ${step2Form.formState.errors.directorEmail ? 'input-error' : ''}`}
                    placeholder="director@email.com"
                    {...step2Form.register('directorEmail')}
                  />
                  <FieldError message={step2Form.formState.errors.directorEmail?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="ninNumber" required>NIN Number</FormLabel>
                  <input
                    id="ninNumber"
                    className={`input font-mono ${step2Form.formState.errors.ninNumber ? 'input-error' : ''}`}
                    placeholder="12345678901"
                    maxLength={11}
                    {...step2Form.register('ninNumber')}
                  />
                  <FieldError message={step2Form.formState.errors.ninNumber?.message} />
                </div>

                <div>
                  <FormLabel htmlFor="bvn" required>BVN</FormLabel>
                  <input
                    id="bvn"
                    className={`input font-mono ${step2Form.formState.errors.bvn ? 'input-error' : ''}`}
                    placeholder="22345678901"
                    maxLength={11}
                    {...step2Form.register('bvn')}
                  />
                  <FieldError message={step2Form.formState.errors.bvn?.message} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCurrentStep(1)} className="btn-secondary flex items-center gap-2">
                  <ChevronLeft size={14} />
                  Back
                </button>
                <button type="submit" className="btn-primary ml-auto flex items-center gap-2">
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3 — KYC */}
        {currentStep === 3 && (
          <div className="card p-6 animate-fade-in">
            <h2 className="text-base font-semibold text-gray-900 mb-2">KYC Documents</h2>
            <p className="text-sm text-gray-500 mb-5">
              Provide your business registration details. Our AI agent will verify these with the CAC registry.
            </p>
            <form onSubmit={handleStep3Next} className="space-y-4">
              <div>
                <FormLabel htmlFor="cacRegNumber" required>CAC Registration Number</FormLabel>
                <input
                  id="cacRegNumber"
                  className={`input font-mono ${step3Form.formState.errors.cacRegNumber ? 'input-error' : ''}`}
                  placeholder="RC-1234567 or BN-1234567"
                  {...step3Form.register('cacRegNumber')}
                />
                <p className="text-xs text-gray-400 mt-1">
                  For limited companies: RC-XXXXXXX. For sole proprietorships: BN-XXXXXXX.
                </p>
                <FieldError message={step3Form.formState.errors.cacRegNumber?.message} />
              </div>

              <div>
                <FormLabel htmlFor="taxId" required>Tax Identification Number (TIN)</FormLabel>
                <input
                  id="taxId"
                  className={`input font-mono ${step3Form.formState.errors.taxId ? 'input-error' : ''}`}
                  placeholder="TIN-XXXXXXXXX"
                  {...step3Form.register('taxId')}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Your Federal Inland Revenue Service (FIRS) TIN number.
                </p>
                <FieldError message={step3Form.formState.errors.taxId?.message} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCurrentStep(2)} className="btn-secondary flex items-center gap-2">
                  <ChevronLeft size={14} />
                  Back
                </button>
                <button type="submit" className="btn-primary ml-auto flex items-center gap-2">
                  Review
                  <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 4 — Review */}
        {currentStep === 4 && (
          <div className="card p-6 animate-fade-in space-y-6">
            <h2 className="text-base font-semibold text-gray-900">Review & Submit</h2>

            <div className="space-y-4">
              {/* Business Profile summary */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Business Profile</span>
                  <button onClick={() => setCurrentStep(1)} className="text-xs text-primary hover:underline">Edit</button>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
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
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Business Director</span>
                  <button onClick={() => setCurrentStep(2)} className="text-xs text-primary hover:underline">Edit</button>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">Name</span>
                    <p className="font-medium text-gray-900">{formData.step2.directorName}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">NIN</span>
                    <p className="font-medium font-mono text-gray-900">{formData.step2.ninNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">BVN</span>
                    <p className="font-medium font-mono text-gray-900">{formData.step2.bvn}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Email</span>
                    <p className="font-medium text-gray-900">{formData.step2.directorEmail}</p>
                  </div>
                </div>
              </div>

              {/* KYC summary */}
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">KYC Documents</span>
                  <button onClick={() => setCurrentStep(3)} className="text-xs text-primary hover:underline">Edit</button>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">CAC Number</span>
                    <p className="font-medium font-mono text-gray-900">{formData.step3.cacRegNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Tax ID</span>
                    <p className="font-medium font-mono text-gray-900">{formData.step3.taxId}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary-50 border border-primary/10">
              <p className="text-xs text-primary leading-relaxed">
                By submitting, you confirm that all information provided is accurate and complete.
                Submission initiates the AI verification process under Vetify's terms of service.
              </p>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setCurrentStep(3)} className="btn-secondary flex items-center gap-2">
                <ChevronLeft size={14} />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={createOnboarding.isPending || submitOnboarding.isPending}
                className="btn-primary ml-auto flex items-center gap-2 disabled:opacity-50"
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
