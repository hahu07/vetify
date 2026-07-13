import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Building2, Send, UserPlus, ShieldCheck, XCircle, CheckCircle2, Clock, AlertTriangle, FileEdit,
} from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import {
  useProviderOnboardings, useApprovedProviders, useAuthorizedOfficers,
  useCreateProvider, useSubmitProvider, useCreateOfficer, useDeactivateOfficer, useReactivateOfficer,
  useAmendProvider,
} from '../../api/client'
import type { ProviderType, OfficerRole } from '../../api/client'
import { VETIFY_PARTY_ID } from '../../api/parties'

const providerSchema = z.object({
  providerName: z.string().min(2, 'Provider name is required'),
  address: z.string().min(5, 'Address is required'),
  cacRegNumber: z.string().min(2, 'CAC registration number is required'),
  providerType: z.custom<ProviderType>(),
  licenseNumber: z.string().optional(),
})

type ProviderFormData = z.infer<typeof providerSchema>

const amendSchema = z.object({
  updatedProviderName: z.string().min(2, 'Provider name is required'),
  updatedAddress: z.string().min(5, 'Address is required'),
  updatedCacRegNumber: z.string().min(2, 'CAC registration number is required'),
  updatedLicenseNumber: z.string().optional(),
})

type AmendFormData = z.infer<typeof amendSchema>

const officerSchema = z.object({
  officerId: z.string().min(1, 'Officer ID is required'),
  officerName: z.string().min(2, 'Officer name is required'),
  role: z.custom<OfficerRole>(),
  authorizedBy: z.string().min(2, 'Your name is required'),
})

type OfficerFormData = z.infer<typeof officerSchema>

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'CBNLicensedNIFI', label: 'CBN-Licensed NIFI' },
  { value: 'SECFundManager', label: 'SEC Fund Manager' },
  { value: 'PenComPensionManager', label: 'PenCom Pension Manager' },
  { value: 'CooperativeSociety', label: 'Cooperative Society' },
  { value: 'InvestmentClub', label: 'Investment Club' },
  { value: 'WaqfFund', label: 'Waqf Fund' },
  { value: 'ZakatFund', label: 'Zakat Fund' },
  { value: 'Philanthropy', label: 'Philanthropy' },
]

const OFFICER_ROLES: OfficerRole[] = [
  'CreditOfficer', 'RiskOfficer', 'RecoveryOfficer', 'OperationsOfficer', 'UnderwritingOfficer',
]

function FormLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

export default function ProviderSettings() {
  const [createError, setCreateError] = useState<string | null>(null)
  const [officerError, setOfficerError] = useState<string | null>(null)
  const [showOfficerForm, setShowOfficerForm] = useState(false)

  const { data: onboardings, isLoading: l1, isError: e1 } = useProviderOnboardings()
  const { data: approvedProviders, isLoading: l2, isError: e2 } = useApprovedProviders()
  const { data: officers, isLoading: l3, isError: e3 } = useAuthorizedOfficers()

  const createProvider = useCreateProvider()
  const submitProvider = useSubmitProvider()
  const createOfficer = useCreateOfficer()
  const deactivateOfficer = useDeactivateOfficer()
  const reactivateOfficer = useReactivateOfficer()
  const amendProvider = useAmendProvider()
  const [amendError, setAmendError] = useState<string | null>(null)

  const providerForm = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    defaultValues: { providerName: '', address: '', cacRegNumber: '', providerType: 'CBNLicensedNIFI', licenseNumber: '' },
  })

  const amendForm = useForm<AmendFormData>({
    resolver: zodResolver(amendSchema),
    values: onboardings?.[0] ? {
      updatedProviderName: onboardings[0].providerName,
      updatedAddress: onboardings[0].address,
      updatedCacRegNumber: onboardings[0].cacRegNumber,
      updatedLicenseNumber: onboardings[0].licenseNumber ?? '',
    } : undefined,
  })

  const officerForm = useForm<OfficerFormData>({
    resolver: zodResolver(officerSchema),
    defaultValues: { officerId: '', officerName: '', role: 'CreditOfficer', authorizedBy: '' },
  })

  if (l1 || l2 || l3) return <Layout title="Provider Settings"><FullPageLoader /></Layout>
  if (e1 || e2 || e3) return <Layout title="Provider Settings"><ErrorState message="Failed to load provider settings" /></Layout>

  // Self-serve signup: GET /providers, /providers/approved and
  // /providers/officers now come back already scoped to this session's own
  // financial institution (each self-serve FI has its own Canton party), so
  // this is simply "the" record rather than a client-side find/filter
  // against the legacy static FI_PARTY_ID — comparing against that constant
  // would never match a freshly signed-up FI's own dynamically-allocated
  // party. Mirrors BusinessDashboard.tsx's `onboardingList?.[0]` pattern.
  const approved = approvedProviders?.[0]
  const myOnboarding = onboardings?.[0]
  const myOfficers = officers ?? []

  const onCreateProvider = async (data: ProviderFormData) => {
    setCreateError(null)
    try {
      await createProvider.mutateAsync({
        vetify: VETIFY_PARTY_ID,
        providerName: data.providerName,
        address: data.address,
        cacRegNumber: data.cacRegNumber,
        providerType: data.providerType,
        licenseNumber: data.licenseNumber || undefined,
        governingDocRef: {
          docType: 'Governing Document',
          // Placeholder — real document upload/hashing isn't wired up yet.
          contentHash: '0'.repeat(64),
          storageRef: 'pending-upload',
        },
        declaredInstruments: ['Murabahah'],
      })
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to register as a financing provider')
    }
  }

  const onAmendProvider = async (data: AmendFormData) => {
    if (!myOnboarding) return
    setAmendError(null)
    try {
      await amendProvider.mutateAsync({
        id: myOnboarding.id,
        updatedProviderName: data.updatedProviderName,
        updatedAddress: data.updatedAddress,
        updatedCacRegNumber: data.updatedCacRegNumber,
        updatedLicenseNumber: data.updatedLicenseNumber || undefined,
        updatedGoverningDocRef: {
          docType: 'Governing Document',
          // Same placeholder pattern as initial registration — real document upload/hashing
          // isn't wired up yet.
          contentHash: '0'.repeat(64),
          storageRef: 'pending-upload',
        },
        updatedDeclaredInstruments: myOnboarding.declaredInstruments,
      })
    } catch (e) {
      setAmendError(e instanceof Error ? e.message : 'Failed to resubmit amended registration')
    }
  }

  const onCreateOfficer = async (data: OfficerFormData) => {
    setOfficerError(null)
    try {
      await createOfficer.mutateAsync({
        vetify: VETIFY_PARTY_ID,
        officerId: data.officerId,
        officerName: data.officerName,
        roles: [data.role],
        authorizedBy: data.authorizedBy,
      })
      officerForm.reset()
      setShowOfficerForm(false)
    } catch (e) {
      setOfficerError(e instanceof Error ? e.message : 'Failed to register officer')
    }
  }

  return (
    <Layout title="Provider Settings">
      <div className="max-w-3xl space-y-7">
        {/* Registration status */}
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-gray-900 tracking-tight">
                Financing Provider Registration
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Stage 0 — required before this institution can approve Murabahah funding
              </p>
            </div>
          </div>

          {approved ? (
            <div className="rounded-2xl p-6 bg-emerald-50 border border-emerald-100">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Approved Financing Provider</p>
                  <p className="text-sm text-emerald-700 mt-0.5">{approved.providerName}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {approved.approvedInstruments.map((i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-white border border-emerald-200 text-emerald-700 text-xs font-medium">
                    {i}
                  </span>
                ))}
              </div>
              <p className="text-xs text-emerald-700/70 mt-4">
                Approved instruments gate which financing types this institution may offer —{' '}
                <code className="font-mono">ApproveFunding</code> requires this contract's ID.
              </p>
            </div>
          ) : myOnboarding ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-surface border border-gray-100">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                  myOnboarding.status === 'ManualReview' || myOnboarding.status === 'PendingAmendment'
                    ? 'bg-amber-100' : 'bg-indigo-100'
                }`}>
                  {myOnboarding.status === 'Draft' && <FileEdit size={20} className="text-indigo-600" />}
                  {myOnboarding.status === 'UnderReview' && <Clock size={20} className="text-indigo-600" />}
                  {(myOnboarding.status === 'ManualReview' || myOnboarding.status === 'PendingAmendment') && (
                    <AlertTriangle size={20} className="text-amber-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{myOnboarding.providerName}</p>
                    <StatusBadge status={myOnboarding.status} />
                  </div>
                  {myOnboarding.status === 'Draft' && (
                    <p className="text-xs text-gray-500 mt-0.5">Ready to submit for Vetify's review.</p>
                  )}
                  {myOnboarding.status === 'UnderReview' && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Awaiting Vetify's review of your registration.
                      {myOnboarding.agentScore != null && (
                        <> Automated CAC/regulatory check: score {myOnboarding.agentScore} ({myOnboarding.agentRisk}) — still requires manual sign-off on approved instruments.</>
                      )}
                    </p>
                  )}
                  {myOnboarding.status === 'ManualReview' && (
                    <p className="text-xs text-amber-700 mt-0.5">
                      Flagged for manual review{myOnboarding.agentNote ? `: ${myOnboarding.agentNote}` : ''}
                    </p>
                  )}
                  {myOnboarding.status === 'PendingAmendment' && (
                    <p className="text-xs text-amber-700 mt-0.5">
                      Vetify has requested changes to this registration — update the details below and resubmit.
                    </p>
                  )}
                </div>
              </div>

              {myOnboarding.status === 'Draft' && (
                <button
                  onClick={() => submitProvider.mutate(myOnboarding.id)}
                  disabled={submitProvider.isPending}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 disabled:opacity-50"
                >
                  <Send size={14} />
                  {submitProvider.isPending ? 'Submitting…' : 'Submit for Review'}
                </button>
              )}

              {myOnboarding.status === 'PendingAmendment' && (
                <form onSubmit={amendForm.handleSubmit(onAmendProvider)} className="space-y-5 pt-5 mt-1 border-t border-gray-100">
                  <div>
                    <FormLabel htmlFor="updatedProviderName" required>Provider / Institution Name</FormLabel>
                    <input id="updatedProviderName" className="input py-2.5" {...amendForm.register('updatedProviderName')} />
                    {amendForm.formState.errors.updatedProviderName && (
                      <p className="mt-1.5 text-xs text-red-600">{amendForm.formState.errors.updatedProviderName.message}</p>
                    )}
                  </div>
                  <div>
                    <FormLabel htmlFor="updatedAddress" required>Address</FormLabel>
                    <input id="updatedAddress" className="input py-2.5" {...amendForm.register('updatedAddress')} />
                    {amendForm.formState.errors.updatedAddress && (
                      <p className="mt-1.5 text-xs text-red-600">{amendForm.formState.errors.updatedAddress.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <FormLabel htmlFor="updatedCacRegNumber" required>CAC Registration Number</FormLabel>
                      <input id="updatedCacRegNumber" className="input py-2.5" {...amendForm.register('updatedCacRegNumber')} />
                      {amendForm.formState.errors.updatedCacRegNumber && (
                        <p className="mt-1.5 text-xs text-red-600">{amendForm.formState.errors.updatedCacRegNumber.message}</p>
                      )}
                    </div>
                    <div>
                      <FormLabel htmlFor="updatedLicenseNumber">License Number (Optional)</FormLabel>
                      <input id="updatedLicenseNumber" className="input py-2.5" {...amendForm.register('updatedLicenseNumber')} />
                    </div>
                  </div>
                  {amendError && <p className="text-xs text-red-600">{amendError}</p>}
                  <button type="submit" disabled={amendProvider.isPending} className="btn-primary px-5 py-2.5 disabled:opacity-50">
                    {amendProvider.isPending ? 'Resubmitting…' : 'Resubmit Registration'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={providerForm.handleSubmit(onCreateProvider)} className="space-y-5">
              <div>
                <FormLabel htmlFor="providerName" required>Provider / Institution Name</FormLabel>
                <input id="providerName" className="input py-2.5" {...providerForm.register('providerName')} />
                {providerForm.formState.errors.providerName && (
                  <p className="mt-1.5 text-xs text-red-600">{providerForm.formState.errors.providerName.message}</p>
                )}
              </div>
              <div>
                <FormLabel htmlFor="address" required>Address</FormLabel>
                <input id="address" className="input py-2.5" {...providerForm.register('address')} />
                {providerForm.formState.errors.address && (
                  <p className="mt-1.5 text-xs text-red-600">{providerForm.formState.errors.address.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <FormLabel htmlFor="cacRegNumber" required>CAC Registration Number</FormLabel>
                  <input id="cacRegNumber" className="input py-2.5" placeholder="RC1234567" {...providerForm.register('cacRegNumber')} />
                  {providerForm.formState.errors.cacRegNumber && (
                    <p className="mt-1.5 text-xs text-red-600">{providerForm.formState.errors.cacRegNumber.message}</p>
                  )}
                </div>
                <div>
                  <FormLabel htmlFor="licenseNumber">License Number (Optional)</FormLabel>
                  <input id="licenseNumber" className="input py-2.5" {...providerForm.register('licenseNumber')} />
                </div>
              </div>
              <div>
                <FormLabel htmlFor="providerType" required>Provider Type</FormLabel>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PROVIDER_TYPES.map((t) => {
                    const isSelected = providerForm.watch('providerType') === t.value
                    return (
                      <label key={t.value} className="cursor-pointer">
                        <input
                          type="radio"
                          value={t.value}
                          className="sr-only"
                          {...providerForm.register('providerType')}
                        />
                        <div
                          className={`text-center py-2.5 px-2 rounded-lg border-2 transition-all text-xs font-medium leading-tight ${
                            isSelected
                              ? 'border-primary bg-primary text-white shadow-[0_2px_8px_rgba(13,110,77,0.2)]'
                              : 'border-gray-200 text-gray-600 hover:border-primary/40'
                          }`}
                        >
                          {t.label}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
              {createError && <p className="text-xs text-red-600">{createError}</p>}
              <button
                type="submit"
                disabled={createProvider.isPending}
                className="btn-primary px-5 py-2.5 disabled:opacity-50"
              >
                {createProvider.isPending ? 'Registering…' : 'Register as Financing Provider'}
              </button>
            </form>
          )}
        </div>

        {/* Authorized officers */}
        {approved && (
          <div className="card p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold text-gray-900 tracking-tight">Authorized Officers</h2>
                  <p className="text-sm text-gray-500 mt-0.5">RBAC registry gating who may act on this institution's behalf</p>
                </div>
              </div>
              <button
                onClick={() => setShowOfficerForm((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark px-3 py-2 rounded-lg hover:bg-primary-50 transition-colors"
              >
                <UserPlus size={14} />
                Register Officer
              </button>
            </div>

            {myOfficers.length === 0 ? (
              <div className="rounded-2xl p-5 bg-amber-50 border border-amber-100">
                <p className="text-sm text-amber-800">
                  No officers registered yet. At least one active <code className="font-mono">CreditOfficer</code> is
                  required before this institution can approve financing requests.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myOfficers.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-surface border border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white ${
                        o.active ? 'bg-primary' : 'bg-gray-300'
                      }`}>
                        {o.officerName[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{o.officerName}</p>
                          <span className="text-xs text-gray-400 font-mono">{o.officerId}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{o.roles.join(', ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-medium ${o.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {o.active ? 'Active' : 'Inactive'}
                      </span>
                      {o.active ? (
                        <button
                          onClick={() => deactivateOfficer.mutate({ id: o.id, reason: 'Deactivated by FI admin', performedBy: 'FI Admin' })}
                          className="flex items-center gap-1 text-xs text-red-600 hover:underline"
                        >
                          <XCircle size={12} />
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => reactivateOfficer.mutate({ id: o.id, reason: 'Reactivated by FI admin', performedBy: 'FI Admin' })}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <CheckCircle2 size={12} />
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showOfficerForm && (
              <form onSubmit={officerForm.handleSubmit(onCreateOfficer)} className="mt-6 pt-6 border-t border-gray-100 space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <FormLabel htmlFor="officerId" required>Officer ID</FormLabel>
                    <input id="officerId" className="input py-2.5" placeholder="OFF-001" {...officerForm.register('officerId')} />
                  </div>
                  <div>
                    <FormLabel htmlFor="officerName" required>Officer Name</FormLabel>
                    <input id="officerName" className="input py-2.5" {...officerForm.register('officerName')} />
                  </div>
                  <div>
                    <FormLabel htmlFor="role" required>Role</FormLabel>
                    <select id="role" className="input py-2.5" {...officerForm.register('role')}>
                      {OFFICER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <FormLabel htmlFor="authorizedBy" required>Authorized By</FormLabel>
                    <input id="authorizedBy" className="input py-2.5" placeholder="Head of Credit" {...officerForm.register('authorizedBy')} />
                  </div>
                </div>
                {officerError && <p className="text-xs text-red-600">{officerError}</p>}
                <button type="submit" disabled={createOfficer.isPending} className="btn-primary text-sm px-5 py-2.5 disabled:opacity-50">
                  {createOfficer.isPending ? 'Registering…' : 'Register Officer'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
