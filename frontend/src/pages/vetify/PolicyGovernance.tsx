import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ShieldCheck, UserPlus, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import Layout from '../../components/Layout'
import GovernanceSignIn from '../../components/GovernanceSignIn'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import { useGovernanceAuth } from '../../auth/GovernanceAuthContext'
import {
  useVerificationPolicy, usePendingVerificationPolicies, useProposeVerificationPolicy,
  useApproveVerificationPolicy, useRejectVerificationPolicy,
  useCompliancePolicy, usePendingCompliancePolicies, useProposeCompliancePolicy,
  useApproveCompliancePolicy, useRejectCompliancePolicy,
  usePolicyApprovers, useRegisterPolicyApprover, useDeactivatePolicyApprover, useReactivatePolicyApprover,
} from '../../api/client'
import type {
  VerificationScoringWeights, ComplianceScoringWeights,
  PendingVerificationPolicy, PendingCompliancePolicy,
} from '../../api/client'
import { VETIFY_PARTY_ID, RISK_COMMITTEE_PARTY_ID } from '../../api/parties'

const DEFAULT_VERIFICATION_WEIGHTS: VerificationScoringWeights = {
  identityPerfect: 40, identityDobMissing: 30, identityDobMismatch: 20,
  identityBvnNotFound: 15, identityNinNotFound: 0,
  cacActiveExactMatch: 35, cacActiveCloseMatch: 28, cacActiveNameMismatch: 10,
  cacPending: 20, cacInactiveOrStruckOff: 10, cacNotFound: 0,
  tinVerifiedMatchesCac: 25, tinVerifiedDifferentEntity: 10, tinNotFound: 5, tinApiError: 10,
}

const DEFAULT_COMPLIANCE_WEIGHTS: ComplianceScoringWeights = {
  amlBothClear: 35, amlOneReviewRequired: 15,
  kybActiveFullMatch: 30, kybActiveMinorDiscrepancy: 20, kybInactiveOrMismatch: 10, kybNotFound: 0,
  creditClean: 10, creditMinorResolved: 7, creditDelinquentOrDefault: 0,
  businessAgeEstablishedBonus: 5, businessAgeNewlyRegisteredPenalty: -5,
}

const VERIFICATION_WEIGHT_LABELS: [keyof VerificationScoringWeights, string][] = [
  ['identityPerfect', 'Identity perfect match'],
  ['identityDobMissing', 'Identity, DOB missing'],
  ['identityDobMismatch', 'Identity, DOB mismatch'],
  ['identityBvnNotFound', 'BVN not found'],
  ['identityNinNotFound', 'NIN not found'],
  ['cacActiveExactMatch', 'CAC active, exact match'],
  ['cacActiveCloseMatch', 'CAC active, close match'],
  ['cacActiveNameMismatch', 'CAC active, name mismatch'],
  ['cacPending', 'CAC pending'],
  ['cacInactiveOrStruckOff', 'CAC inactive/struck off'],
  ['cacNotFound', 'CAC not found'],
  ['tinVerifiedMatchesCac', 'TIN verified, matches CAC'],
  ['tinVerifiedDifferentEntity', 'TIN verified, different entity'],
  ['tinNotFound', 'TIN not found'],
  ['tinApiError', 'TIN API error'],
]

const COMPLIANCE_WEIGHT_LABELS: [keyof ComplianceScoringWeights, string][] = [
  ['amlBothClear', 'AML both clear'],
  ['amlOneReviewRequired', 'AML review required'],
  ['kybActiveFullMatch', 'KYB active, full match'],
  ['kybActiveMinorDiscrepancy', 'KYB active, minor discrepancy'],
  ['kybInactiveOrMismatch', 'KYB inactive/mismatch'],
  ['kybNotFound', 'KYB not found'],
  ['creditClean', 'Credit history clean'],
  ['creditMinorResolved', 'Credit, minor resolved'],
  ['creditDelinquentOrDefault', 'Credit delinquent/default'],
  ['businessAgeEstablishedBonus', 'Business age >12mo (bonus)'],
  ['businessAgeNewlyRegisteredPenalty', 'Business age <3mo (penalty)'],
]

function WeightGrid<T>({
  labels, register,
}: {
  labels: [keyof T, string][]
  register: (name: string) => ReturnType<ReturnType<typeof useForm>['register']>
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {labels.map(([key, label]) => (
        <div key={String(key)}>
          <label className="block text-xs text-gray-500 mb-1">{label}</label>
          <input type="number" className="input font-mono text-sm" {...register(`scoringWeights.${String(key)}`)} />
        </div>
      ))}
    </div>
  )
}

function PendingRow({
  title, proposedBy, reason, proposedAt, endorsed, onApprove, onReject, approving, canAct,
}: {
  title: string; proposedBy: string; reason: string; proposedAt: string
  endorsed: boolean
  onApprove: () => void
  onReject: (reason: string) => void
  approving: boolean
  canAct: boolean
}) {
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  return (
    <div className="p-4 rounded-lg border border-gray-100 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${endorsed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {endorsed ? 'Endorsed by Risk Committee' : 'Awaiting Risk Committee endorsement'}
        </span>
      </div>
      <p className="text-xs text-gray-500">Proposed by {proposedBy} — {reason}</p>
      <p className="text-xs text-gray-400">{new Date(proposedAt).toLocaleString()}</p>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onApprove}
          disabled={!endorsed || !canAct || approving}
          className="btn-primary text-sm flex items-center gap-1 disabled:opacity-40"
        >
          <CheckCircle2 size={14} />
          {approving ? 'Approving…' : 'Approve'}
        </button>
        <button
          onClick={() => setShowReject((v) => !v)}
          disabled={!canAct}
          className="btn-danger text-sm flex items-center gap-1 disabled:opacity-40"
        >
          <XCircle size={14} />
          Reject
        </button>
      </div>
      {!endorsed && (
        <p className="text-xs text-amber-600">
          Cannot approve until the Risk Committee independently endorses this proposal (Layer 2).
        </p>
      )}
      {showReject && (
        <div className="flex items-center gap-2 pt-1">
          <input
            className="input text-sm flex-1"
            placeholder="Rejection reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <button
            onClick={() => { onReject(rejectReason); setShowReject(false); setRejectReason('') }}
            disabled={rejectReason.length < 5}
            className="btn-danger text-sm disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  )
}

export default function PolicyGovernance() {
  const [showProposeVerification, setShowProposeVerification] = useState(false)
  const [showProposeCompliance, setShowProposeCompliance] = useState(false)
  const [showApprovers, setShowApprovers] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: verificationPolicy, isLoading: l1, isError: e1 } = useVerificationPolicy()
  const { data: pendingVerification, isLoading: l2, isError: e2 } = usePendingVerificationPolicies()
  const { data: compliancePolicy, isLoading: l3, isError: e3 } = useCompliancePolicy()
  const { data: pendingCompliance, isLoading: l4, isError: e4 } = usePendingCompliancePolicies()
  const { data: approvers, isLoading: l5, isError: e5 } = usePolicyApprovers()

  const proposeVerification = useProposeVerificationPolicy()
  const approveVerification = useApproveVerificationPolicy()
  const rejectVerification = useRejectVerificationPolicy()
  const proposeCompliance = useProposeCompliancePolicy()
  const approveCompliance = useApproveCompliancePolicy()
  const rejectCompliance = useRejectCompliancePolicy()
  const registerApprover = useRegisterPolicyApprover()
  const deactivateApprover = useDeactivatePolicyApprover()
  const reactivateApprover = useReactivatePolicyApprover()

  const { session } = useGovernanceAuth()
  const canAct = !!session && session.partyRole === 'vetify'

  const verificationForm = useForm({
    defaultValues: {
      policyVersion: '', maxAmendments: 5, slaHours: 48, autoApproveMin: 80, autoRejectMax: 50,
      requiredDocTypes: 'CAC_CERTIFICATE', proposedBy: '', reason: '',
      scoringWeights: verificationPolicy?.scoringWeights ?? DEFAULT_VERIFICATION_WEIGHTS,
    },
  })
  const complianceForm = useForm({
    defaultValues: {
      policyVersion: '', autoApproveMin: 80, autoRejectMax: 50, escalationSlaHours: 48,
      shariahPolicyVersion: 'AAOIFI-2023-Std8', proposedBy: '', reason: '',
      scoringWeights: compliancePolicy?.scoringWeights ?? DEFAULT_COMPLIANCE_WEIGHTS,
    },
  })
  const approverForm = useForm({ defaultValues: { approverName: '', role: '', authorizedBy: '' } })

  if (l1 || l2 || l3 || l4 || l5) return <Layout title="Policy Governance"><FullPageLoader /></Layout>
  if (e1 || e2 || e3 || e4 || e5 || !pendingVerification || !pendingCompliance || !approvers) {
    return <Layout title="Policy Governance"><ErrorState message="Failed to load policy governance data" /></Layout>
  }

  const onProposeVerification = async (data: any) => {
    setError(null)
    try {
      await proposeVerification.mutateAsync({
        vetify: VETIFY_PARTY_ID,
        riskCommittee: RISK_COMMITTEE_PARTY_ID,
        maxAmendments: Number(data.maxAmendments),
        slaHours: Number(data.slaHours),
        autoApproveMin: Number(data.autoApproveMin),
        autoRejectMax: Number(data.autoRejectMax),
        requiredDocTypes: data.requiredDocTypes.split(',').map((s: string) => s.trim()).filter(Boolean),
        policyVersion: data.policyVersion,
        scoringWeights: Object.fromEntries(
          Object.entries(data.scoringWeights).map(([k, v]) => [k, Number(v)])
        ) as unknown as VerificationScoringWeights,
        proposedBy: data.proposedBy,
        reason: data.reason,
      })
      setShowProposeVerification(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to propose verification policy change')
    }
  }

  const onProposeCompliance = async (data: any) => {
    setError(null)
    try {
      await proposeCompliance.mutateAsync({
        vetify: VETIFY_PARTY_ID,
        riskCommittee: RISK_COMMITTEE_PARTY_ID,
        autoApproveMin: Number(data.autoApproveMin),
        autoRejectMax: Number(data.autoRejectMax),
        escalationSlaHours: Number(data.escalationSlaHours),
        shariahPolicyVersion: data.shariahPolicyVersion,
        policyVersion: data.policyVersion,
        effectiveFrom: new Date().toISOString(),
        scoringWeights: Object.fromEntries(
          Object.entries(data.scoringWeights).map(([k, v]) => [k, Number(v)])
        ) as unknown as ComplianceScoringWeights,
        proposedBy: data.proposedBy,
        reason: data.reason,
      })
      setShowProposeCompliance(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to propose compliance policy change')
    }
  }

  const onRegisterApprover = async (data: any) => {
    setError(null)
    try {
      await registerApprover.mutateAsync({ vetify: VETIFY_PARTY_ID, ...data })
      approverForm.reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register approver')
    }
  }

  return (
    <Layout title="Policy Governance">
      <div className="space-y-6 max-w-4xl">
        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Active policies */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Active Verification Policy (Stage 2)</p>
            <p className="text-lg font-semibold text-gray-900">{verificationPolicy?.policyVersion ?? 'None active'}</p>
            {verificationPolicy && (
              <p className="text-xs text-gray-400 mt-1">
                Auto-approve ≥{verificationPolicy.autoApproveMin} · Auto-reject &lt;{verificationPolicy.autoRejectMax}
              </p>
            )}
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Active Compliance Policy (Stage 3)</p>
            <p className="text-lg font-semibold text-gray-900">{compliancePolicy?.policyVersion ?? 'None active'}</p>
            {compliancePolicy && (
              <p className="text-xs text-gray-400 mt-1">
                Auto-approve ≥{compliancePolicy.autoApproveMin} · Auto-reject &lt;{compliancePolicy.autoRejectMax}
              </p>
            )}
          </div>
        </div>

        {/* Pending proposals */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-700">Pending Proposals</h2>
          </div>
          <GovernanceSignIn requiredRole="vetify" />
          <div className="space-y-3">
            {pendingVerification.map((p: PendingVerificationPolicy) => (
              <PendingRow
                key={p.id}
                title={`Verification Policy — ${p.policyVersion}`}
                proposedBy={p.proposedBy}
                reason={p.reason}
                proposedAt={p.proposedAt}
                endorsed={!!p.riskCommitteeEndorsedBy}
                approving={approveVerification.isPending}
                canAct={canAct}
                onApprove={() => session && approveVerification.mutate({ id: p.id, token: session.token })}
                onReject={(rejectionReason) => session && rejectVerification.mutate({ id: p.id, token: session.token, rejectionReason })}
              />
            ))}
            {pendingCompliance.map((p: PendingCompliancePolicy) => (
              <PendingRow
                key={p.id}
                title={`Compliance Policy — ${p.policyVersion}`}
                proposedBy={p.proposedBy}
                reason={p.reason}
                proposedAt={p.proposedAt}
                endorsed={!!p.riskCommitteeEndorsedBy}
                approving={approveCompliance.isPending}
                canAct={canAct}
                onApprove={() => session && approveCompliance.mutate({ id: p.id, token: session.token })}
                onReject={(rejectionReason) => session && rejectCompliance.mutate({ id: p.id, token: session.token, rejectionReason })}
              />
            ))}
            {pendingVerification.length === 0 && pendingCompliance.length === 0 && (
              <p className="text-sm text-gray-500">No pending proposals.</p>
            )}
          </div>
        </div>

        {/* Propose Verification Policy */}
        <div className="card p-5">
          <button onClick={() => setShowProposeVerification((v) => !v)} className="flex items-center justify-between w-full">
            <h2 className="text-sm font-semibold text-gray-700">Propose Verification Policy Change</h2>
            {showProposeVerification ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showProposeVerification && (
            <form onSubmit={verificationForm.handleSubmit(onProposeVerification)} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Policy Version</label>
                  <input className="input text-sm" placeholder="2026-v2" {...verificationForm.register('policyVersion')} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Amendments</label>
                  <input type="number" className="input text-sm" {...verificationForm.register('maxAmendments')} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">SLA Hours</label>
                  <input type="number" className="input text-sm" {...verificationForm.register('slaHours')} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Auto-approve ≥</label>
                  <input type="number" className="input text-sm" {...verificationForm.register('autoApproveMin')} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Auto-reject &lt;</label>
                  <input type="number" className="input text-sm" {...verificationForm.register('autoRejectMax')} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Required Doc Types (comma-separated)</label>
                  <input className="input text-sm" {...verificationForm.register('requiredDocTypes')} />
                </div>
              </div>
              <WeightGrid<VerificationScoringWeights> labels={VERIFICATION_WEIGHT_LABELS} register={verificationForm.register as any} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input text-sm" placeholder="Proposed by (your name)" {...verificationForm.register('proposedBy')} />
                <input className="input text-sm" placeholder="Reason for change" {...verificationForm.register('reason')} />
              </div>
              <button type="submit" disabled={proposeVerification.isPending} className="btn-primary text-sm disabled:opacity-50">
                {proposeVerification.isPending ? 'Proposing…' : 'Submit Proposal'}
              </button>
            </form>
          )}
        </div>

        {/* Propose Compliance Policy */}
        <div className="card p-5">
          <button onClick={() => setShowProposeCompliance((v) => !v)} className="flex items-center justify-between w-full">
            <h2 className="text-sm font-semibold text-gray-700">Propose Compliance Policy Change</h2>
            {showProposeCompliance ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showProposeCompliance && (
            <form onSubmit={complianceForm.handleSubmit(onProposeCompliance)} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Policy Version</label>
                  <input className="input text-sm" placeholder="2026-v2" {...complianceForm.register('policyVersion')} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Auto-approve ≥</label>
                  <input type="number" className="input text-sm" {...complianceForm.register('autoApproveMin')} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Auto-reject &lt;</label>
                  <input type="number" className="input text-sm" {...complianceForm.register('autoRejectMax')} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Escalation SLA Hours</label>
                  <input type="number" className="input text-sm" {...complianceForm.register('escalationSlaHours')} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Shariah Policy Version</label>
                  <input className="input text-sm" {...complianceForm.register('shariahPolicyVersion')} />
                </div>
              </div>
              <WeightGrid<ComplianceScoringWeights> labels={COMPLIANCE_WEIGHT_LABELS} register={complianceForm.register as any} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input text-sm" placeholder="Proposed by (your name)" {...complianceForm.register('proposedBy')} />
                <input className="input text-sm" placeholder="Reason for change" {...complianceForm.register('reason')} />
              </div>
              <button type="submit" disabled={proposeCompliance.isPending} className="btn-primary text-sm disabled:opacity-50">
                {proposeCompliance.isPending ? 'Proposing…' : 'Submit Proposal'}
              </button>
            </form>
          )}
        </div>

        {/* PolicyApprover registry */}
        <div className="card p-5">
          <button onClick={() => setShowApprovers((v) => !v)} className="flex items-center justify-between w-full mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Policy Approver Registry (Layer 1)</h2>
            {showApprovers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showApprovers && (
            <div className="space-y-4 mt-2">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Status</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {approvers.map((a) => (
                    <tr key={a.id}>
                      <td>{a.approverName}</td>
                      <td className="text-xs text-gray-600">{a.role}</td>
                      <td>
                        <span className={`text-xs font-medium ${a.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {a.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-right">
                        {a.active ? (
                          <button
                            onClick={() => deactivateApprover.mutate({ id: a.id, reason: 'Deactivated by admin', performedBy: 'Vetify Admin' })}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivateApprover.mutate({ id: a.id, reason: 'Reactivated by admin', performedBy: 'Vetify Admin' })}
                            className="text-xs text-primary hover:underline"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <form onSubmit={approverForm.handleSubmit(onRegisterApprover)} className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                <input className="input text-sm" placeholder="Approver name" {...approverForm.register('approverName')} />
                <input className="input text-sm" placeholder="Role (e.g. Risk Manager)" {...approverForm.register('role')} />
                <input className="input text-sm" placeholder="Authorized by" {...approverForm.register('authorizedBy')} />
                <button type="submit" disabled={registerApprover.isPending} className="btn-primary text-sm col-span-3 flex items-center justify-center gap-2 disabled:opacity-50">
                  <UserPlus size={14} />
                  Register Approver
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
