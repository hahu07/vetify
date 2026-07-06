import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Send, UserPlus, ShieldCheck, XCircle } from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import {
  useProviderOnboardings, useApprovedProviders, useAuthorizedOfficers,
  useCreateProvider, useSubmitProvider, useCreateOfficer, useDeactivateOfficer, useReactivateOfficer,
} from '../../api/client'
import type { ProviderType, OfficerRole } from '../../api/client'
import { VETIFY_PARTY_ID, FI_PARTY_ID } from '../../api/parties'

const providerSchema = z.object({
  providerName: z.string().min(2, 'Provider name is required'),
  address: z.string().min(5, 'Address is required'),
  providerType: z.custom<ProviderType>(),
  licenseNumber: z.string().optional(),
})

type ProviderFormData = z.infer<typeof providerSchema>

const officerSchema = z.object({
  officerId: z.string().min(1, 'Officer ID is required'),
  officerName: z.string().min(2, 'Officer name is required'),
  role: z.custom<OfficerRole>(),
  authorizedBy: z.string().min(2, 'Your name is required'),
})

type OfficerFormData = z.infer<typeof officerSchema>

const PROVIDER_TYPES: ProviderType[] = [
  'CBNLicensedNIFI', 'SECFundManager', 'PenComPensionManager', 'CooperativeSociety',
  'InvestmentClub', 'WaqfFund', 'ZakatFund', 'Philanthropy',
]

const OFFICER_ROLES: OfficerRole[] = [
  'CreditOfficer', 'RiskOfficer', 'RecoveryOfficer', 'OperationsOfficer', 'UnderwritingOfficer',
]

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

  const providerForm = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    defaultValues: { providerName: '', address: '', providerType: 'CBNLicensedNIFI', licenseNumber: '' },
  })

  const officerForm = useForm<OfficerFormData>({
    resolver: zodResolver(officerSchema),
    defaultValues: { officerId: '', officerName: '', role: 'CreditOfficer', authorizedBy: '' },
  })

  if (l1 || l2 || l3) return <Layout title="Provider Settings"><FullPageLoader /></Layout>
  if (e1 || e2 || e3) return <Layout title="Provider Settings"><ErrorState message="Failed to load provider settings" /></Layout>

  const approved = approvedProviders?.find((p) => p.financialInstitution === FI_PARTY_ID)
  const myOnboarding = onboardings?.find((o) => o.financialInstitution === FI_PARTY_ID)
  const myOfficers = officers?.filter((o) => o.financialInstitution === FI_PARTY_ID) ?? []

  const onCreateProvider = async (data: ProviderFormData) => {
    setCreateError(null)
    try {
      await createProvider.mutateAsync({
        financialInstitution: FI_PARTY_ID,
        vetify: VETIFY_PARTY_ID,
        providerName: data.providerName,
        address: data.address,
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

  const onCreateOfficer = async (data: OfficerFormData) => {
    setOfficerError(null)
    try {
      await createOfficer.mutateAsync({
        financialInstitution: FI_PARTY_ID,
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
      <div className="space-y-5 max-w-3xl">
        {/* Provider registration status */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-700">Financing Provider Registration</h2>
          </div>

          {approved ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">Approved</span>
              </div>
              <p className="text-sm text-gray-700">{approved.providerName}</p>
              <div className="flex flex-wrap gap-1.5">
                {approved.approvedInstruments.map((i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
                    {i}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Approved instruments gate which financing types this institution may offer —
                <code className="mx-1">ApproveFunding</code> requires this contract's ID.
              </p>
            </div>
          ) : myOnboarding ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={myOnboarding.status} />
                <span className="text-sm text-gray-700">{myOnboarding.providerName}</span>
              </div>
              {myOnboarding.status === 'Draft' && (
                <button
                  onClick={() => submitProvider.mutate(myOnboarding.id)}
                  disabled={submitProvider.isPending}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <Send size={14} />
                  {submitProvider.isPending ? 'Submitting…' : 'Submit for Review'}
                </button>
              )}
              {myOnboarding.status === 'UnderReview' && (
                <p className="text-xs text-gray-500">Awaiting Vetify's review of your registration.</p>
              )}
              {myOnboarding.status === 'PendingAmendment' && (
                <p className="text-xs text-amber-600">Vetify has requested changes to this registration.</p>
              )}
            </div>
          ) : (
            <form onSubmit={providerForm.handleSubmit(onCreateProvider)} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Provider / Institution Name</label>
                <input className="input" {...providerForm.register('providerName')} />
                {providerForm.formState.errors.providerName && (
                  <p className="text-xs text-red-600 mt-1">{providerForm.formState.errors.providerName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <input className="input" {...providerForm.register('address')} />
                {providerForm.formState.errors.address && (
                  <p className="text-xs text-red-600 mt-1">{providerForm.formState.errors.address.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Provider Type</label>
                <select className="input" {...providerForm.register('providerType')}>
                  {PROVIDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">License Number (Optional)</label>
                <input className="input" {...providerForm.register('licenseNumber')} />
              </div>
              {createError && <p className="text-xs text-red-600">{createError}</p>}
              <button type="submit" disabled={createProvider.isPending} className="btn-primary disabled:opacity-50">
                {createProvider.isPending ? 'Registering…' : 'Register as Financing Provider'}
              </button>
            </form>
          )}
        </div>

        {/* Authorized officers */}
        {approved && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-gray-700">Authorized Officers</h2>
              </div>
              <button
                onClick={() => setShowOfficerForm((v) => !v)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <UserPlus size={12} />
                Register Officer
              </button>
            </div>

            {myOfficers.length === 0 ? (
              <p className="text-sm text-gray-500">
                No officers registered yet. At least one active <code>CreditOfficer</code> is required
                before this institution can approve financing requests.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Officer ID</th>
                    <th>Name</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myOfficers.map((o) => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs">{o.officerId}</td>
                      <td>{o.officerName}</td>
                      <td className="text-xs text-gray-600">{o.roles.join(', ')}</td>
                      <td>
                        <span className={`text-xs font-medium ${o.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {o.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-right">
                        {o.active ? (
                          <button
                            onClick={() => deactivateOfficer.mutate({ id: o.id, reason: 'Deactivated by FI admin', performedBy: 'FI Admin' })}
                            className="text-xs text-red-600 hover:underline flex items-center gap-1 ml-auto"
                          >
                            <XCircle size={12} />
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivateOfficer.mutate({ id: o.id, reason: 'Reactivated by FI admin', performedBy: 'FI Admin' })}
                            className="text-xs text-primary hover:underline ml-auto"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showOfficerForm && (
              <form onSubmit={officerForm.handleSubmit(onCreateOfficer)} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Officer ID</label>
                    <input className="input" placeholder="OFF-001" {...officerForm.register('officerId')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Officer Name</label>
                    <input className="input" {...officerForm.register('officerName')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                    <select className="input" {...officerForm.register('role')}>
                      {OFFICER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Authorized By</label>
                    <input className="input" placeholder="Head of Credit" {...officerForm.register('authorizedBy')} />
                  </div>
                </div>
                {officerError && <p className="text-xs text-red-600">{officerError}</p>}
                <button type="submit" disabled={createOfficer.isPending} className="btn-primary text-sm disabled:opacity-50">
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
