import { useState } from 'react'
import { CheckCircle2, XCircle, Flag, X } from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import { formatNaira } from '../../lib/formatters'
import {
  useAssessorQueue, useBeginUnderwriting, useRejectUnderwriting, useFlagUnderwritingForManualReview,
} from '../../api/client'
import type { FinancingRequest, RiskLevel } from '../../api/client'

// Financing.daml: BeginUnderwriting/RejectUnderwriting only valid from Submitted or
// UnderwritingManualReview; FlagUnderwritingForManualReview implicitly the same window
// (mirrors FlagComplianceForManualReview's precedent — vetify escalates before a decision).
const canDecide = (status: string) => status === 'Submitted' || status === 'UnderwritingManualReview'

type ModalMode = 'begin' | 'reject' | 'flag'
interface ModalState {
  mode: ModalMode
  row: FinancingRequest
}

function AssessorModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  const { mode, row } = modal
  const [score, setScore] = useState(row.riskAssessment?.score ?? 70)
  const [riskCategory, setRiskCategory] = useState<RiskLevel>(row.riskAssessment?.riskCategory ?? 'Low')
  const [recommendedLimit, setRecommendedLimit] = useState(row.terms.amount)
  const [recommendation, setRecommendation] = useState('')
  const [assessorName, setAssessorName] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const begin = useBeginUnderwriting()
  const reject = useRejectUnderwriting()
  const flag = useFlagUnderwritingForManualReview()
  const isPending = begin.isPending || reject.isPending || flag.isPending

  const handleConfirm = async () => {
    setError(null)
    try {
      if (mode === 'begin') {
        if (!recommendation.trim()) {
          setError('Please provide a recommendation summary')
          return
        }
        await begin.mutateAsync({
          id: row.id,
          assessment: { score, riskCategory, recommendedLimit, recommendation },
          assessorName: assessorName || undefined,
        })
      } else if (mode === 'reject') {
        if (reason.trim().length < 5) {
          setError('Please provide a more detailed rejection reason')
          return
        }
        await reject.mutateAsync({ id: row.id, reason })
      } else {
        if (note.trim().length < 5) {
          setError('Please provide a note explaining the escalation')
          return
        }
        await flag.mutateAsync({ id: row.id, riskScore: score, riskLevel: riskCategory, note })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${mode}`)
    }
  }

  const title =
    mode === 'begin' ? 'Qualify for Underwriting' : mode === 'reject' ? 'Reject Underwriting' : 'Flag for Manual Review'

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
          {row.businessName} <span className="font-mono">({row.cacNumber})</span> — requested {formatNaira(row.terms.amount)}
        </p>

        {mode === 'begin' && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Risk Score (0–100)</label>
                <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} className="input font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Risk Category</label>
                <select value={riskCategory} onChange={(e) => setRiskCategory(e.target.value as RiskLevel)} className="input">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Recommended Limit (₦)</label>
              <input type="number" value={recommendedLimit} onChange={(e) => setRecommendedLimit(Number(e.target.value))} className="input font-mono" />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Recommendation <span className="text-red-500">*</span></label>
              <textarea rows={2} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} className="input resize-none" placeholder="Summary of the underwriting rationale..." />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Assessor Name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className="input" value={assessorName} onChange={(e) => setAssessorName(e.target.value)} placeholder="Your name, for the audit trail" />
            </div>
          </>
        )}

        {mode === 'reject' && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none" placeholder="Why is this request being rejected before it reaches the FI?" />
          </div>
        )}

        {mode === 'flag' && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Note <span className="text-red-500">*</span></label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="input resize-none" placeholder="Why does this need a second look?" />
          </div>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className={`flex-1 disabled:opacity-40 ${mode === 'reject' ? 'btn-danger' : 'btn-primary'}`}
          >
            {isPending ? 'Submitting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AssessorQueue() {
  const { data: queue, isLoading, isError } = useAssessorQueue()
  const [modal, setModal] = useState<ModalState | null>(null)

  if (isLoading) return <Layout title="Underwriting Queue"><FullPageLoader /></Layout>
  if (isError || !queue) return <Layout title="Underwriting Queue"><ErrorState message="Failed to load underwriting queue" /></Layout>

  return (
    <Layout title="Underwriting Queue">
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          Stage 6: requests awaiting an assessor's qualify/reject/flag decision, before they ever
          reach the financial institution. Separate from Stage 7's FI review queue.
        </p>

        <div className="card overflow-hidden">
          {queue.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">No requests awaiting underwriting</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>CAC No</th>
                    <th>Requested Amount</th>
                    <th>Purpose</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((req) => (
                    <tr key={req.id}>
                      <td className="text-xs font-medium text-gray-900">{req.businessName}</td>
                      <td className="font-mono text-xs text-gray-700">{req.cacNumber}</td>
                      <td className="text-xs text-gray-700">{formatNaira(req.terms.amount)}</td>
                      <td className="text-xs text-gray-600">{req.terms.purpose}</td>
                      <td><StatusBadge status={req.status} size="sm" /></td>
                      <td>
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            title="Qualify for underwriting"
                            disabled={!canDecide(req.status)}
                            onClick={() => setModal({ mode: 'begin', row: req })}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            title="Reject"
                            disabled={!canDecide(req.status)}
                            onClick={() => setModal({ mode: 'reject', row: req })}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <XCircle size={14} />
                          </button>
                          <button
                            title="Flag for manual review"
                            disabled={req.status !== 'Submitted'}
                            onClick={() => setModal({ mode: 'flag', row: req })}
                            className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors text-gray-400 hover:text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Flag size={14} />
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
      </div>

      {modal && <AssessorModal modal={modal} onClose={() => setModal(null)} />}
    </Layout>
  )
}
