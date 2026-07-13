import { useState } from 'react'
import { AlertTriangle, Flag, RotateCcw, ChevronDown, ChevronUp, UserPlus, ShieldAlert } from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import { formatNaira } from '../../lib/formatters'
import {
  useContracts, useFlagDelinquent, useResumeActive, useFlagForDelinquencyReview,
  useAuthorizedSentinels, useRegisterSentinel, useDeactivateSentinel, useReactivateSentinel,
} from '../../api/client'
import type { MurabahahContract } from '../../api/client'
import { VETIFY_PARTY_ID, SENTINEL_PARTY_ID } from '../../api/parties'

// Murabahah.daml's isValidMurabahahTransition: FlagDelinquent only valid from
// Active/DelinquencyManualReview; ResumeActive only from Delinquent/DelinquencyManualReview;
// FlagForDelinquencyReview only from Active.
const canFlagDelinquent = (status: string) => status === 'Active' || status === 'DelinquencyManualReview'
const canResumeActive = (status: string) => status === 'Delinquent' || status === 'DelinquencyManualReview'
const canFlagForReview = (status: string) => status === 'Active'

type ModalMode = 'flag' | 'resume' | 'review'
interface ModalState {
  mode: ModalMode
  row: MurabahahContract
}

function ActionModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  const { mode, row } = modal
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const flagDelinquent = useFlagDelinquent()
  const resumeActive = useResumeActive()
  const flagForReview = useFlagForDelinquencyReview()
  const isPending = flagDelinquent.isPending || resumeActive.isPending || flagForReview.isPending

  const title =
    mode === 'flag' ? 'Flag as Delinquent' : mode === 'resume' ? 'Resume to Active' : 'Escalate for Manual Review'
  const label =
    mode === 'flag' ? 'Reason' : mode === 'resume' ? 'Note' : 'Note'
  const placeholder =
    mode === 'flag'
      ? 'Why is this facility being flagged delinquent (e.g. missed installments, no offsetting credit)?'
      : mode === 'resume'
      ? 'Why is this facility being cleared back to Active (e.g. business caught up on schedule)?'
      : 'Why is this ambiguous case being escalated for a human sentinel to resolve?'

  const handleConfirm = async () => {
    setError(null)
    if (text.trim().length < 5) {
      setError('Please provide more detail')
      return
    }
    try {
      if (mode === 'flag') await flagDelinquent.mutateAsync({ id: row.id, reason: text })
      else if (mode === 'resume') await resumeActive.mutateAsync({ id: row.id, note: text })
      else await flagForReview.mutateAsync({ id: row.id, note: text })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${mode}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-sm animate-fade-in">
        <h2 className="text-base font-semibold text-gray-900 mb-1">{title}</h2>
        <p className="text-xs text-gray-500 mb-4">
          {row.businessName} <span className="font-mono">({row.cacNumber})</span>
        </p>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {label} <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input resize-none mb-3"
          placeholder={placeholder}
        />
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className={`flex-1 disabled:opacity-40 ${mode === 'flag' ? 'btn-danger' : 'btn-primary'}`}
          >
            {isPending ? 'Submitting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DelinquencyMonitoring() {
  const { data: contracts, isLoading, isError } = useContracts()
  const [modal, setModal] = useState<ModalState | null>(null)
  const [showSentinels, setShowSentinels] = useState(false)

  const { data: sentinels, isLoading: sentinelsLoading } = useAuthorizedSentinels()
  const registerSentinel = useRegisterSentinel()
  const deactivateSentinel = useDeactivateSentinel()
  const reactivateSentinel = useReactivateSentinel()

  const [sentinelParty, setSentinelParty] = useState(SENTINEL_PARTY_ID)
  const [sentinelRole, setSentinelRole] = useState('')
  const [sentinelAuthorizedBy, setSentinelAuthorizedBy] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)

  if (isLoading) return <Layout title="Delinquency Monitoring"><FullPageLoader /></Layout>
  if (isError || !contracts) return <Layout title="Delinquency Monitoring"><ErrorState message="Failed to load contracts" /></Layout>

  // Everything a sentinel might need to act on: currently delinquent, under
  // manual review, or still active (to flag/escalate). Completed/Defaulted
  // facilities are done — no delinquency action ever applies to them again.
  const relevant = contracts.filter((c) =>
    c.status === 'Active' || c.status === 'Delinquent' || c.status === 'DelinquencyManualReview'
  )
  const delinquent = relevant.filter((c) => c.status === 'Delinquent')
  const manualReview = relevant.filter((c) => c.status === 'DelinquencyManualReview')
  const active = relevant.filter((c) => c.status === 'Active')

  const handleRegisterSentinel = async () => {
    setRegisterError(null)
    if (!sentinelRole.trim() || !sentinelAuthorizedBy.trim()) {
      setRegisterError('Role and Authorized By are required')
      return
    }
    try {
      await registerSentinel.mutateAsync({
        vetify: VETIFY_PARTY_ID, sentinel: sentinelParty, role: sentinelRole, authorizedBy: sentinelAuthorizedBy,
      })
      setSentinelRole('')
      setSentinelAuthorizedBy('')
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : 'Failed to register sentinel')
    }
  }

  const Row = ({ c }: { c: MurabahahContract }) => (
    <tr key={c.id}>
      <td>
        <p className="font-medium text-gray-900 text-xs">{c.businessName}</p>
        <p className="text-gray-400 text-xs font-mono mt-0.5">{c.cacNumber}</p>
      </td>
      <td className="text-xs text-gray-700 font-mono">{formatNaira(c.outstandingBalance)}</td>
      <td className="text-xs text-gray-600">{c.installmentsPaid}</td>
      <td><StatusBadge status={c.status} size="sm" /></td>
      <td>
        <div className="flex items-center gap-1.5 justify-end">
          {canFlagDelinquent(c.status) && (
            <button
              title="Flag as Delinquent"
              onClick={() => setModal({ mode: 'flag', row: c })}
              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600"
            >
              <AlertTriangle size={14} />
            </button>
          )}
          {canResumeActive(c.status) && (
            <button
              title="Resume to Active"
              onClick={() => setModal({ mode: 'resume', row: c })}
              className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors text-gray-400 hover:text-emerald-600"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {canFlagForReview(c.status) && (
            <button
              title="Escalate for Manual Review"
              onClick={() => setModal({ mode: 'review', row: c })}
              className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors text-gray-400 hover:text-amber-600"
            >
              <Flag size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )

  return (
    <Layout title="Delinquency Monitoring">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500">Delinquent</p>
            <p className="text-xl font-bold text-red-700 font-mono">{delinquent.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500">Manual Review</p>
            <p className="text-xl font-bold text-amber-700 font-mono">{manualReview.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500">Active</p>
            <p className="text-xl font-bold text-emerald-700 font-mono">{active.length}</p>
          </div>
        </div>

        <div className="card overflow-hidden">
          {relevant.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">No contracts to monitor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Outstanding</th>
                    <th>Installments Paid</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...manualReview, ...delinquent, ...active].map((c) => <Row key={c.id} c={c} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AuthorizedSentinel registry — mirrors PolicyGovernance's approver registry */}
        <div className="card p-5">
          <button onClick={() => setShowSentinels((v) => !v)} className="flex items-center justify-between w-full mb-2">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ShieldAlert size={15} className="text-primary" />
              Sentinel Registry
            </h2>
            {showSentinels ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showSentinels && (
            <div className="space-y-4 mt-2">
              {sentinelsLoading ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Sentinel Party</th><th>Role</th><th>Status</th><th className="text-right">Actions</th></tr>
                  </thead>
                  <tbody>
                    {(sentinels ?? []).map((s) => (
                      <tr key={s.id}>
                        <td className="font-mono text-xs">{s.sentinel}</td>
                        <td className="text-xs text-gray-600">{s.role}</td>
                        <td>
                          <span className={`text-xs font-medium ${s.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {s.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-right">
                          {s.active ? (
                            <button
                              onClick={() => deactivateSentinel.mutate({ id: s.id, reason: 'Deactivated by admin', performedBy: 'Vetify Admin' })}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => reactivateSentinel.mutate({ id: s.id, reason: 'Reactivated by admin', performedBy: 'Vetify Admin' })}
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
              )}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                <input
                  className="input text-sm font-mono"
                  placeholder="Sentinel party ID"
                  value={sentinelParty}
                  onChange={(e) => setSentinelParty(e.target.value)}
                />
                <input
                  className="input text-sm"
                  placeholder="Role (e.g. Senior Portfolio Analyst)"
                  value={sentinelRole}
                  onChange={(e) => setSentinelRole(e.target.value)}
                />
                <input
                  className="input text-sm"
                  placeholder="Authorized by"
                  value={sentinelAuthorizedBy}
                  onChange={(e) => setSentinelAuthorizedBy(e.target.value)}
                />
                {registerError && <p className="text-xs text-red-600 col-span-3">{registerError}</p>}
                <button
                  onClick={handleRegisterSentinel}
                  disabled={registerSentinel.isPending}
                  className="btn-primary text-sm col-span-3 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <UserPlus size={14} />
                  Register Sentinel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && <ActionModal modal={modal} onClose={() => setModal(null)} />}
    </Layout>
  )
}
