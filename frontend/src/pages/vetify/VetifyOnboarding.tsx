import { useState } from 'react'
import { CheckCircle2, XCircle, Flag, X, FileEdit, Clock, ChevronDown, ChevronUp, PauseCircle, PlayCircle, Ban, RotateCw, Paperclip } from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import DocumentsModal from '../../components/DocumentsModal'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import { formatDate } from '../../lib/formatters'
import {
  useOnboardingList, useApproveOnboarding, useRejectOnboarding, useFlagOnboardingForManualReview,
  useRequestAmendment, useEscalateOverdue,
  useApprovedBusinesses, useSuspendBusiness, useReinstateBusiness, useExpireBusiness,
  useRevokeBusiness, useRequestRecertification,
  useVerificationResults, useSupersedeVerification,
  useComplianceResults, useSupersedeComplianceResult,
} from '../../api/client'
import type { Onboarding, VerificationChecks, RiskLevel } from '../../api/client'
import { VERIFIER_PARTY_ID, ADVISOR_PARTY_ID } from '../../api/parties'

const DEFAULT_CHECKS: VerificationChecks = {
  identityVerified: false,
  cacRegistered: false,
  documentsValid: false,
  dataConsistent: false,
}

const CHECK_LABELS: [keyof VerificationChecks, string][] = [
  ['identityVerified', 'Identity Verified (NIN/BVN)'],
  ['cacRegistered', 'CAC Registration Confirmed'],
  ['documentsValid', 'Documents Valid'],
  ['dataConsistent', 'Data Consistent'],
]

// Gap 7 (Onboarding.daml): built-in preset reasons for the required override justification —
// covers the common cases so the reviewer isn't forced to type a full sentence every time.
// "Other" reveals a free-text box for anything not covered.
const JUSTIFICATION_PRESETS = [
  'Manual document review confirmed authenticity beyond the agent’s assessment',
  'Applicant provided additional clarifying information after the agent flagged the case',
  'Agent risk classification was overly conservative given the full evidence',
  'Agent risk classification was overly lenient given the full evidence',
  'Data discrepancy the agent flagged has since been resolved',
  'Other (specify below)',
] as const

// No 'Approved'/'Rejected' tabs here — Onboarding.daml's Approve/Reject choices
// archive BusinessOnboarding without recreating it (the key is deliberately
// released), so its status can never actually hold either value; those tabs
// always read empty regardless of how many businesses were really approved
// or rejected. The real audit trail for both lives in the dedicated
// "Approved Businesses" / "Verification Results" / "Compliance Results"
// sections below (ApprovedBusiness / VerificationResult.outcome /
// ComplianceResult.outcome), which this page already renders separately.
type FilterTab = 'All' | 'Draft' | 'Pending' | 'UnderReview' | 'ManualReview' | 'PendingAmendment'

const TABS: FilterTab[] = ['All', 'Draft', 'Pending', 'UnderReview', 'ManualReview', 'PendingAmendment']

const TAB_LABELS: Record<FilterTab, string> = {
  All: 'All',
  Draft: 'Draft',
  Pending: 'Pending',
  UnderReview: 'Under Review',
  ManualReview: 'Manual Review',
  PendingAmendment: 'Pending Amendment',
}

// Approve/Reject: Onboarding.daml only allows these from UnderReview or ManualReview.
const canDecide = (status: string) => status === 'UnderReview' || status === 'ManualReview'
// Flag for manual review: Onboarding.daml only allows this from UnderReview.
const canFlag = (status: string) => status === 'UnderReview'
// RequestAmendment: only from UnderReview or ManualReview.
const canRequestAmendment = (status: string) => status === 'UnderReview' || status === 'ManualReview'
// EscalateOverdue: only from UnderReview (and the choice itself checks the SLA window has
// actually expired — this button can still fail against a fresh submission).
const canEscalate = (status: string) => status === 'UnderReview'

type ModalMode = 'approve' | 'reject' | 'flag' | 'amend' | 'escalate'
interface ModalState {
  mode: ModalMode
  row: Onboarding
}

function ReviewModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  const { mode, row } = modal
  const [checks, setChecks] = useState<VerificationChecks>(DEFAULT_CHECKS)
  const [riskScore, setRiskScore] = useState(row.agentScore ?? 50)
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(row.agentRisk ?? 'Medium')
  const [reason, setReason] = useState('')
  const [justificationPreset, setJustificationPreset] = useState<string>(JUSTIFICATION_PRESETS[0])
  const [customJustification, setCustomJustification] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isOtherJustification = justificationPreset === 'Other (specify below)'
  const overrideJustification = isOtherJustification ? customJustification.trim() : justificationPreset

  const approve = useApproveOnboarding()
  const reject = useRejectOnboarding()
  const flag = useFlagOnboardingForManualReview()
  const requestAmendment = useRequestAmendment()
  const escalateOverdue = useEscalateOverdue()
  const [slaHours, setSlaHours] = useState(48)

  // Gap 7 (Onboarding.daml): a human deciding on an application the agent already scored
  // must record why — required whenever this row already carries an agentScore.
  const needsJustification = row.agentScore != null
  const isPending = approve.isPending || reject.isPending || flag.isPending
    || requestAmendment.isPending || escalateOverdue.isPending

  const handleConfirm = async () => {
    setError(null)
    try {
      if (needsJustification && isOtherJustification && customJustification.trim().length < 5) {
        setError('Please specify the override justification (or pick a built-in reason above)')
        return
      }
      if (mode === 'approve') {
        await approve.mutateAsync({
          id: row.id, checks, riskScore, riskLevel,
          verificationRef: `VER-${Date.now()}`,
          overrideJustification: needsJustification ? overrideJustification : undefined,
          reviewNotes: reviewNotes.trim() || undefined,
        })
      } else if (mode === 'reject') {
        if (reason.trim().length < 5) {
          setError('Please provide a more detailed rejection reason')
          return
        }
        await reject.mutateAsync({
          id: row.id, checks, riskScore, riskLevel,
          verificationRef: `VER-${Date.now()}`, reason,
          overrideJustification: needsJustification ? overrideJustification : undefined,
          reviewNotes: reviewNotes.trim() || undefined,
        })
      } else if (mode === 'flag') {
        if (note.trim().length < 5) {
          setError('Please provide a note explaining the escalation')
          return
        }
        await flag.mutateAsync({ id: row.id, riskScore, riskLevel, note })
      } else if (mode === 'amend') {
        if (note.trim().length < 5) {
          setError('Please describe what the business needs to correct')
          return
        }
        await requestAmendment.mutateAsync({ id: row.id, note })
      } else {
        if (slaHours <= 0) {
          setError('SLA hours must be positive')
          return
        }
        await escalateOverdue.mutateAsync({ id: row.id, slaHours })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${mode} application`)
    }
  }

  const title =
    mode === 'approve' ? 'Approve Verification' :
    mode === 'reject' ? 'Reject Application' :
    mode === 'flag' ? 'Flag for Manual Review' :
    mode === 'amend' ? 'Request Amendment' : 'Escalate Overdue Application'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          {row.profile.name} <span className="font-mono">({row.kyc.cacRegNumber})</span>
        </p>

        {(mode === 'approve' || mode === 'reject') && (
          <>
            <div className="space-y-1 mb-4">
              {CHECK_LABELS.map(([key, label]) => (
                <label key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 cursor-pointer">
                  <span className="text-sm text-gray-700">{label}</span>
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-primary"
                    checked={checks[key]}
                    onChange={(e) => setChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Risk Score (0–100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={riskScore}
                  onChange={(e) => setRiskScore(Number(e.target.value))}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Risk Level</label>
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
                  className="input"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            {needsJustification && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Override Justification <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-400 mb-1.5">
                  This application was already scored by the AI agent — required for the audit trail.
                </p>
                <select
                  value={justificationPreset}
                  onChange={(e) => setJustificationPreset(e.target.value)}
                  className="input mb-2"
                >
                  {JUSTIFICATION_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>{preset}</option>
                  ))}
                </select>
                {isOtherJustification && (
                  <textarea
                    rows={2}
                    value={customJustification}
                    onChange={(e) => setCustomJustification(e.target.value)}
                    className="input resize-none"
                    placeholder="Why are you deciding this after the AI agent already scored it?"
                  />
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Review Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="input resize-none"
                placeholder="Any additional context for the audit record..."
              />
            </div>
          </>
        )}

        {mode === 'reject' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input resize-none"
              placeholder="State the verification reason for rejection..."
            />
          </div>
        )}

        {mode === 'flag' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Note <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input resize-none"
              placeholder="Why is this being escalated for manual review?"
            />
          </div>
        )}

        {mode === 'amend' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Correction Note <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-1.5">
              Returns the application to the business as Draft for them to resubmit (CAC number
              cannot change). They have a limited number of amendments.
            </p>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input resize-none"
              placeholder="What does the business need to fix or clarify?"
            />
          </div>
        )}

        {mode === 'escalate' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Fallback SLA Hours
            </label>
            <p className="text-xs text-gray-400 mb-1.5">
              Only used if no VerificationPolicy is active — otherwise the policy's own SLA
              governs. Fails if the SLA window hasn't actually expired yet.
            </p>
            <input
              type="number"
              min={1}
              value={slaHours}
              onChange={(e) => setSlaHours(Number(e.target.value))}
              className="input font-mono"
            />
          </div>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className={`flex-1 flex items-center justify-center gap-2 disabled:opacity-40 ${
              mode === 'reject' ? 'btn-danger' : 'btn-primary'
            }`}
          >
            {isPending ? 'Submitting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ApprovedBusiness lifecycle (Compliance.daml): status-gated the same way as the onboarding
// actions above. Suspend/ExpireBusiness only from BusinessActive; Reinstate only from
// BusinessSuspended; Revoke and RequestRecertification are unconditional (any status).
type BusinessAction = 'suspend' | 'reinstate' | 'expire' | 'revoke' | 'recertify'

function BusinessActionModal({
  action, businessName, onClose, onConfirm, isPending,
}: {
  action: { mode: BusinessAction; id: string }
  businessName: string
  onClose: () => void
  onConfirm: (reason: string, revokedBy?: string, newComplianceRef?: string) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState('')
  const [revokedBy, setRevokedBy] = useState('')
  const [newComplianceRef, setNewComplianceRef] = useState(`COM-${Date.now()}`)
  const [error, setError] = useState<string | null>(null)

  const titles: Record<BusinessAction, string> = {
    suspend: 'Suspend Business',
    reinstate: 'Reinstate Business',
    expire: 'Expire Approval',
    revoke: 'Revoke Approval',
    recertify: 'Request Recertification',
  }

  const handleConfirm = () => {
    setError(null)
    if (reason.trim().length < 3) {
      setError('Please provide a reason')
      return
    }
    if (action.mode === 'revoke' && !revokedBy.trim()) {
      setError('Please enter who is revoking this approval')
      return
    }
    onConfirm(reason, revokedBy || undefined, newComplianceRef || undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-sm animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{titles[action.mode]}</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{businessName}</p>

        <label className="block text-xs font-medium text-gray-700 mb-1">
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="input resize-none mb-3"
        />

        {action.mode === 'revoke' && (
          <>
            <label className="block text-xs font-medium text-gray-700 mb-1">Revoked By <span className="text-red-500">*</span></label>
            <input className="input mb-3" value={revokedBy} onChange={(e) => setRevokedBy(e.target.value)} placeholder="Your name" />
          </>
        )}

        {action.mode === 'recertify' && (
          <>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Compliance Reference</label>
            <input className="input mb-3" value={newComplianceRef} onChange={(e) => setNewComplianceRef(e.target.value)} />
          </>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className={`flex-1 disabled:opacity-40 ${action.mode === 'revoke' || action.mode === 'expire' ? 'btn-danger' : 'btn-primary'}`}
          >
            {isPending ? 'Submitting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

const canSuspend = (status: string) => status === 'BusinessActive'
const canReinstate = (status: string) => status === 'BusinessSuspended'
const canExpire = (status: string) => status === 'BusinessActive'

function ApprovedBusinessesSection() {
  const [open, setOpen] = useState(false)
  const { data: businesses, isLoading } = useApprovedBusinesses()
  const [action, setAction] = useState<{ mode: BusinessAction; id: string; businessName: string } | null>(null)
  const [docsTarget, setDocsTarget] = useState<{ businessName: string; cacRegNumber: string } | null>(null)

  const suspend = useSuspendBusiness()
  const reinstate = useReinstateBusiness()
  const expire = useExpireBusiness()
  const revoke = useRevokeBusiness()
  const recertify = useRequestRecertification()
  const isPending = suspend.isPending || reinstate.isPending || expire.isPending || revoke.isPending || recertify.isPending

  const handleConfirm = async (reason: string, revokedBy?: string, newComplianceRef?: string) => {
    if (!action) return
    if (action.mode === 'suspend') await suspend.mutateAsync({ id: action.id, reason })
    else if (action.mode === 'reinstate') await reinstate.mutateAsync({ id: action.id, reason })
    else if (action.mode === 'expire') await expire.mutateAsync({ id: action.id, reason })
    else if (action.mode === 'revoke') await revoke.mutateAsync({ id: action.id, reason, revokedBy: revokedBy! })
    else await recertify.mutateAsync({
      id: action.id, reason, newComplianceRef: newComplianceRef!,
      verifier: VERIFIER_PARTY_ID, advisor: ADVISOR_PARTY_ID,
    })
    setAction(null)
  }

  return (
    <div className="card p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Approved Businesses</h2>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        isLoading ? (
          <p className="text-xs text-gray-400 mt-2">Loading…</p>
        ) : (businesses ?? []).length === 0 ? (
          <p className="text-xs text-gray-400 mt-2">No approved businesses yet</p>
        ) : (
          <table className="table mt-2">
            <thead>
              <tr><th>Business</th><th>CAC No</th><th>Approved</th><th>Status</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {(businesses ?? []).map((b) => (
                <tr key={b.id}>
                  <td className="text-xs font-medium text-gray-900">{b.businessName}</td>
                  <td className="font-mono text-xs text-gray-700">{b.cacRegNumber}</td>
                  <td className="text-xs text-gray-500">{formatDate(b.approvedAt)}</td>
                  <td><StatusBadge status={b.status} size="sm" /></td>
                  <td>
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        title={canSuspend(b.status) ? 'Suspend' : 'Can only suspend an Active business'}
                        disabled={!canSuspend(b.status)}
                        onClick={() => setAction({ mode: 'suspend', id: b.id, businessName: b.businessName })}
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <PauseCircle size={14} />
                      </button>
                      <button
                        title={canReinstate(b.status) ? 'Reinstate' : 'Can only reinstate a Suspended business'}
                        disabled={!canReinstate(b.status)}
                        onClick={() => setAction({ mode: 'reinstate', id: b.id, businessName: b.businessName })}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <PlayCircle size={14} />
                      </button>
                      <button
                        title={canExpire(b.status) ? 'Expire (requires expiry date passed)' : 'Can only expire an Active business'}
                        disabled={!canExpire(b.status)}
                        onClick={() => setAction({ mode: 'expire', id: b.id, businessName: b.businessName })}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Clock size={14} />
                      </button>
                      <button
                        title="Revoke"
                        onClick={() => setAction({ mode: 'revoke', id: b.id, businessName: b.businessName })}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                      >
                        <Ban size={14} />
                      </button>
                      <button
                        title="Request recertification"
                        onClick={() => setAction({ mode: 'recertify', id: b.id, businessName: b.businessName })}
                        className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"
                      >
                        <RotateCw size={14} />
                      </button>
                      <button
                        title="View documents"
                        onClick={() => setDocsTarget({ businessName: b.businessName, cacRegNumber: b.cacRegNumber })}
                        className="p-1.5 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary"
                      >
                        <Paperclip size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {action && (
        <BusinessActionModal
          action={action}
          businessName={action.businessName}
          onClose={() => setAction(null)}
          onConfirm={handleConfirm}
          isPending={isPending}
        />
      )}

      {docsTarget && (
        <DocumentsModal
          businessName={docsTarget.businessName}
          cacRegNumber={docsTarget.cacRegNumber}
          onClose={() => setDocsTarget(null)}
        />
      )}
    </div>
  )
}

// Stage 2 audit trail: VerificationResult is a terminal, immutable record of the Approve/
// Reject decision — Supersede doesn't change it, it creates a separate VerificationCorrection
// alongside it for the audit record (mirrors SupersedeShariahVerdict's Option A pattern:
// vetify alone corrects, since verifier who made the call shouldn't unilaterally reverse it).
function VerificationResultsSection() {
  const [open, setOpen] = useState(false)
  const { data: results, isLoading } = useVerificationResults()
  const supersede = useSupersedeVerification()
  const [target, setTarget] = useState<{ id: string; businessName: string } | null>(null)
  const [correctedOutcome, setCorrectedOutcome] = useState<'Approved' | 'Rejected'>('Approved')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [docsTarget, setDocsTarget] = useState<{ businessName: string; cacRegNumber: string } | null>(null)

  const handleSupersede = async () => {
    if (!target) return
    setError(null)
    if (!reason.trim()) {
      setError('Reason is required')
      return
    }
    try {
      await supersede.mutateAsync({
        id: target.id, correctionRef: `COR-${Date.now()}`, correctedOutcome, reason,
      })
      setTarget(null)
      setReason('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to supersede verification result')
    }
  }

  return (
    <div className="card p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Verification Results (Stage 2 audit trail)</h2>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        isLoading ? (
          <p className="text-xs text-gray-400 mt-2">Loading…</p>
        ) : (results ?? []).length === 0 ? (
          <p className="text-xs text-gray-400 mt-2">No verification results yet</p>
        ) : (
          <table className="table mt-2">
            <thead>
              <tr><th>Business</th><th>CAC No</th><th>Outcome</th><th>Risk</th><th>Decided</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {(results ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="text-xs font-medium text-gray-900">{r.businessName}</td>
                  <td className="font-mono text-xs text-gray-700">{r.cacRegNumber}</td>
                  <td><StatusBadge status={r.outcome} size="sm" /></td>
                  <td className="text-xs text-gray-600">{r.riskScore} ({r.riskLevel})</td>
                  <td className="text-xs text-gray-500">{formatDate(r.decidedAt)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setDocsTarget({ businessName: r.businessName, cacRegNumber: r.cacRegNumber })}
                        className="text-xs text-primary hover:underline"
                      >
                        Documents
                      </button>
                      <button
                        onClick={() => setTarget({ id: r.id, businessName: r.businessName })}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Supersede
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setTarget(null)} />
          <div className="relative card p-6 w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Supersede Verification Result</h2>
              <button onClick={() => setTarget(null)} className="p-1 rounded text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{target.businessName}</p>

            <label className="block text-xs font-medium text-gray-700 mb-1">Corrected Outcome</label>
            <select value={correctedOutcome} onChange={(e) => setCorrectedOutcome(e.target.value as 'Approved' | 'Rejected')} className="input mb-3">
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>

            <label className="block text-xs font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none mb-3" placeholder="Why was the original decision wrong?" />

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSupersede} disabled={supersede.isPending} className="btn-primary flex-1 disabled:opacity-40">
                {supersede.isPending ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {docsTarget && (
        <DocumentsModal
          businessName={docsTarget.businessName}
          cacRegNumber={docsTarget.cacRegNumber}
          onClose={() => setDocsTarget(null)}
        />
      )}
    </div>
  )
}

function ComplianceResultsSection() {
  const [open, setOpen] = useState(false)
  const { data: results, isLoading } = useComplianceResults()
  const supersede = useSupersedeComplianceResult()
  const [target, setTarget] = useState<{ id: string; businessName: string; reviewedBy?: string } | null>(null)
  const [correctedOutcome, setCorrectedOutcome] = useState<'Approved' | 'Rejected'>('Approved')
  const [reason, setReason] = useState('')
  const [correctedBy, setCorrectedBy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [docsTarget, setDocsTarget] = useState<{ businessName: string; cacRegNumber: string } | null>(null)

  const handleSupersede = async () => {
    if (!target) return
    setError(null)
    if (!reason.trim() || !correctedBy.trim()) {
      setError('Reason and your name are required')
      return
    }
    if (target.reviewedBy && correctedBy.trim() === target.reviewedBy) {
      setError('Corrector cannot be the same as the original reviewer (maker-checker)')
      return
    }
    try {
      await supersede.mutateAsync({
        id: target.id, correctionRef: `COR-${Date.now()}`, correctedOutcome, reason, correctedBy,
      })
      setTarget(null)
      setReason('')
      setCorrectedBy('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to supersede compliance result')
    }
  }

  return (
    <div className="card p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Compliance Results (Stage 3 audit trail)</h2>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        isLoading ? (
          <p className="text-xs text-gray-400 mt-2">Loading…</p>
        ) : (results ?? []).length === 0 ? (
          <p className="text-xs text-gray-400 mt-2">No compliance results yet</p>
        ) : (
          <table className="table mt-2">
            <thead>
              <tr><th>Business</th><th>CAC No</th><th>Outcome</th><th>Risk</th><th>Decided</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {(results ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="text-xs font-medium text-gray-900">{r.businessName}</td>
                  <td className="font-mono text-xs text-gray-700">{r.cacRegNumber}</td>
                  <td><StatusBadge status={r.outcome} size="sm" /></td>
                  <td className="text-xs text-gray-600">{r.riskScore} ({r.riskLevel})</td>
                  <td className="text-xs text-gray-500">{formatDate(r.decidedAt)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setDocsTarget({ businessName: r.businessName, cacRegNumber: r.cacRegNumber })}
                        className="text-xs text-primary hover:underline"
                      >
                        Documents
                      </button>
                      <button
                        onClick={() => setTarget({ id: r.id, businessName: r.businessName, reviewedBy: r.reviewedBy })}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Supersede
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setTarget(null)} />
          <div className="relative card p-6 w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Supersede Compliance Result</h2>
              <button onClick={() => setTarget(null)} className="p-1 rounded text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{target.businessName}</p>

            <label className="block text-xs font-medium text-gray-700 mb-1">Corrected Outcome</label>
            <select value={correctedOutcome} onChange={(e) => setCorrectedOutcome(e.target.value as 'Approved' | 'Rejected')} className="input mb-3">
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>

            <label className="block text-xs font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none mb-3" placeholder="Why was the original decision wrong?" />

            <label className="block text-xs font-medium text-gray-700 mb-1">Corrected By <span className="text-red-500">*</span></label>
            <input className="input mb-3" value={correctedBy} onChange={(e) => setCorrectedBy(e.target.value)} placeholder="Your name" />
            {target.reviewedBy && (
              <p className="text-xs text-gray-400 -mt-2 mb-3">Original reviewer: {target.reviewedBy} (cannot be the same person)</p>
            )}

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSupersede} disabled={supersede.isPending} className="btn-primary flex-1 disabled:opacity-40">
                {supersede.isPending ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {docsTarget && (
        <DocumentsModal
          businessName={docsTarget.businessName}
          cacRegNumber={docsTarget.cacRegNumber}
          onClose={() => setDocsTarget(null)}
        />
      )}
    </div>
  )
}

export default function VetifyOnboarding() {
  const [activeTab, setActiveTab] = useState<FilterTab>('All')
  const [modal, setModal] = useState<ModalState | null>(null)
  const [docsTarget, setDocsTarget] = useState<{ businessName: string; cacRegNumber: string; documents: Onboarding['documents'] } | null>(null)
  const { data: onboardingData, isLoading, isError } = useOnboardingList()
  const onboarding = onboardingData ?? []

  const filtered: Onboarding[] =
    activeTab === 'All'
      ? onboarding
      : onboarding.filter((o) => o.status === activeTab)

  if (isLoading) return <Layout title="Onboarding Pipeline"><FullPageLoader /></Layout>
  if (isError) return <Layout title="Onboarding Pipeline"><ErrorState message="Failed to load onboarding pipeline" /></Layout>

  return (
    <Layout title="Onboarding Pipeline">
      <div className="space-y-5 animate-fade-in">
        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const count =
              tab === 'All'
                ? onboarding.length
                : onboarding.filter((o) => o.status === tab).length
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? '#0D6E4D' : '#fff',
                  color: isActive ? '#fff' : '#6B7280',
                  border: isActive ? 'none' : '1px solid #E5E7EB',
                }}
              >
                {TAB_LABELS[tab]}
                {count > 0 && (
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#F3F4F6',
                      color: isActive ? '#fff' : '#6B7280',
                      fontSize: 10,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">No businesses in this category</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Type</th>
                    <th>CAC No</th>
                    <th>Director</th>
                    <th>Submitted</th>
                    <th>Agent Score</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div>
                          <p className="font-medium text-gray-900 text-xs">{o.profile.name}</p>
                          <p className="text-gray-400 text-xs font-mono mt-0.5">
                            {o.id.slice(0, 18)}…
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-gray-600">
                          {o.profile.businessType === 'LimitedCompany'
                            ? 'Limited Co.'
                            : 'Sole Prop.'}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-gray-700">{o.kyc.cacRegNumber}</span>
                      </td>
                      <td>
                        <p className="text-xs text-gray-700">{o.profile.directors[0]?.name ?? '—'}</p>
                      </td>
                      <td className="text-xs text-gray-500">
                        {o.submittedAt ? formatDate(o.submittedAt) : '—'}
                      </td>
                      <td>
                        {o.agentScore != null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-10 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${o.agentScore}%`,
                                  backgroundColor:
                                    o.agentScore >= 80
                                      ? '#10B981'
                                      : o.agentScore >= 50
                                      ? '#F59E0B'
                                      : '#EF4444',
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-700">{o.agentScore}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={o.status} size="sm" />
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            title={canDecide(o.status) ? 'Approve' : 'Can only approve from Under Review or Manual Review'}
                            disabled={!canDecide(o.status)}
                            onClick={() => setModal({ mode: 'approve', row: o })}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            title={canDecide(o.status) ? 'Reject' : 'Can only reject from Under Review or Manual Review'}
                            disabled={!canDecide(o.status)}
                            onClick={() => setModal({ mode: 'reject', row: o })}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                          >
                            <XCircle size={14} />
                          </button>
                          <button
                            title={canFlag(o.status) ? 'Flag for manual review' : 'Can only flag from Under Review'}
                            disabled={!canFlag(o.status)}
                            onClick={() => setModal({ mode: 'flag', row: o })}
                            className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors text-gray-400 hover:text-amber-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                          >
                            <Flag size={14} />
                          </button>
                          <button
                            title={canRequestAmendment(o.status) ? 'Request amendment from business' : 'Can only request amendment from Under Review or Manual Review'}
                            disabled={!canRequestAmendment(o.status)}
                            onClick={() => setModal({ mode: 'amend', row: o })}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 transition-colors text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                          >
                            <FileEdit size={14} />
                          </button>
                          <button
                            title={canEscalate(o.status) ? 'Escalate overdue application' : 'Can only escalate from Under Review'}
                            disabled={!canEscalate(o.status)}
                            onClick={() => setModal({ mode: 'escalate', row: o })}
                            className="p-1.5 rounded-lg hover:bg-orange-50 transition-colors text-gray-400 hover:text-orange-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                          >
                            <Clock size={14} />
                          </button>
                          <button
                            title="View documents"
                            onClick={() => setDocsTarget({ businessName: o.profile.name, cacRegNumber: o.kyc.cacRegNumber, documents: o.documents })}
                            className="p-1.5 rounded-lg hover:bg-primary-50 transition-colors text-gray-400 hover:text-primary"
                          >
                            <Paperclip size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {docsTarget && (
          <DocumentsModal
            businessName={docsTarget.businessName}
            cacRegNumber={docsTarget.cacRegNumber}
            documents={docsTarget.documents}
            onClose={() => setDocsTarget(null)}
          />
        )}

        <ApprovedBusinessesSection />
        <VerificationResultsSection />
        <ComplianceResultsSection />
      </div>

      {modal && <ReviewModal modal={modal} onClose={() => setModal(null)} />}
    </Layout>
  )
}
