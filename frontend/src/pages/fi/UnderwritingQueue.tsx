import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ClipboardCheck,
  X,
  CheckCircle2,
  XCircle,
  Info,
  TrendingUp,
} from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import AmountDisplay from '../../components/AmountDisplay'
import { EmptyState, FullPageLoader, ErrorState } from '../../components/LoadingState'
import { formatDate, formatNaira } from '../../lib/formatters'
import {
  useUnderwritingQueue, useRejectFinancing, useApproveFinancing,
  useApprovedProviders, useAuthorizedOfficers,
} from '../../api/client'
import type { FinancingRequest } from '../../api/client'
import { FI_PARTY_ID } from '../../api/parties'

const approveSchema = z.object({
  description: z.string().min(3, 'Describe the asset being financed'),
  supplier: z.string().min(2, 'Supplier name is required'),
  supplierRef: z.string().min(1, 'Supplier invoice/PO reference is required'),
  estimatedCost: z.number({ invalid_type_error: 'Enter estimated cost' }).positive(),
  approvingOfficerId: z.string().min(1, 'Select an authorizing officer'),
})

const rejectSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
})

type ApproveFormData = z.infer<typeof approveSchema>
type RejectFormData = z.infer<typeof rejectSchema>

function RiskScorePill({ score, riskCategory }: { score: number; riskCategory: string }) {
  const color =
    riskCategory === 'Low'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : riskCategory === 'Medium'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-red-700 bg-red-50 border-red-200'

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${color}`}>
      <span className="font-mono">{score}</span>
      <span>/ 100</span>
    </div>
  )
}

export default function UnderwritingQueue() {
  const [approveModal, setApproveModal] = useState<FinancingRequest | null>(null)
  const [rejectModal, setRejectModal] = useState<FinancingRequest | null>(null)
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)

  const { data: queue, isLoading, isError } = useUnderwritingQueue()
  const { data: approvedProviders } = useApprovedProviders()
  const { data: officers } = useAuthorizedOfficers()
  const rejectFinancing = useRejectFinancing()
  const approveFinancing = useApproveFinancing()

  const myApprovedProvider = approvedProviders?.find(
    (p) => p.financialInstitution === FI_PARTY_ID && p.approvedInstruments.includes('Murabahah')
  )
  const myCreditOfficers = (officers ?? []).filter(
    (o) => o.financialInstitution === FI_PARTY_ID && o.active && o.roles.includes('CreditOfficer')
  )

  const {
    register: registerApprove,
    handleSubmit: handleApproveSubmit,
    watch: watchApprove,
    formState: { errors: approveErrors },
    reset: resetApprove,
  } = useForm<ApproveFormData>({
    resolver: zodResolver(approveSchema),
    defaultValues: { description: '', supplier: '', supplierRef: '', estimatedCost: 0, approvingOfficerId: '' },
  })

  const {
    register: registerReject,
    handleSubmit: handleRejectSubmit,
    formState: { errors: rejectErrors },
    reset: resetReject,
  } = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
  })

  const estimatedCost = watchApprove('estimatedCost')

  const handleReject = async (data: RejectFormData) => {
    if (!rejectModal) return
    setRejectError(null)
    try {
      await rejectFinancing.mutateAsync({ id: rejectModal.id, reason: data.reason })
      setRejectModal(null)
      resetReject()
    } catch (e) {
      setRejectError(e instanceof Error ? e.message : 'Failed to reject financing request')
    }
  }

  const handleApprove = async (data: ApproveFormData) => {
    if (!approveModal || !myApprovedProvider) return
    setApproveError(null)
    try {
      await approveFinancing.mutateAsync({
        id: approveModal.id,
        payload: {
          assetDetails: {
            description: data.description,
            supplier: data.supplier,
            supplierRef: data.supplierRef,
            estimatedCost: data.estimatedCost,
          },
          approvedProviderCid: myApprovedProvider.id,
          approvingOfficerId: data.approvingOfficerId,
        },
      })
      setApproveModal(null)
      resetApprove()
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Failed to approve financing')
    }
  }

  if (isLoading) {
    return (
      <Layout breadcrumb={[{ label: 'FI Dashboard', path: '/fi/dashboard' }, { label: 'Underwriting Queue' }]}>
        <FullPageLoader />
      </Layout>
    )
  }

  if (isError || !queue) {
    return (
      <Layout breadcrumb={[{ label: 'FI Dashboard', path: '/fi/dashboard' }, { label: 'Underwriting Queue' }]}>
        <ErrorState message="Failed to load underwriting queue" />
      </Layout>
    )
  }

  return (
    <Layout
      breadcrumb={[
        { label: 'FI Dashboard', path: '/fi/dashboard' },
        { label: 'Underwriting Queue' },
      ]}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Underwriting Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">{queue.length} requests awaiting review</p>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Queue is empty"
              description="No financing requests are currently pending underwriting review"
              icon={<ClipboardCheck size={24} className="text-gray-400" />}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((req) => {
              return (
                <div key={req.id} className="card p-5 transition-all">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{req.businessName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={req.status} size="sm" />
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">Submitted {req.submittedAt ? formatDate(req.submittedAt) : '—'}</span>
                          </div>
                        </div>
                        {req.riskAssessment && (
                          <RiskScorePill
                            score={req.riskAssessment.score}
                            riskCategory={req.riskAssessment.riskCategory}
                          />
                        )}
                      </div>

                      {/* Request details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Requested Amount</p>
                          <AmountDisplay amount={req.terms.amount} className="font-semibold text-gray-900 text-sm" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tenure</p>
                          <p className="text-sm font-medium text-gray-900">{req.terms.tenureMonths} months</p>
                        </div>
                        {req.riskAssessment && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Risk Category</p>
                            <StatusBadge
                              status={
                                req.riskAssessment.riskCategory === 'Low'
                                  ? 'Approved'
                                  : req.riskAssessment.riskCategory === 'Medium'
                                  ? 'ManualReview'
                                  : 'Rejected'
                              }
                              size="sm"
                            />
                          </div>
                        )}
                        {req.riskAssessment && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">AI Recommended Limit</p>
                            <AmountDisplay amount={req.riskAssessment.recommendedLimit} className="text-sm font-semibold text-primary" />
                          </div>
                        )}
                      </div>

                      {/* Purpose */}
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Business Purpose</p>
                        <p className="text-sm text-gray-700">{req.terms.purpose}</p>
                      </div>

                      {/* AI Recommendation */}
                      {req.riskAssessment && (
                        <div className={`p-3 rounded-lg flex items-start gap-2 ${
                          req.riskAssessment.riskCategory === 'Low'
                            ? 'bg-emerald-50 border border-emerald-100'
                            : req.riskAssessment.riskCategory === 'Medium'
                            ? 'bg-amber-50 border border-amber-100'
                            : 'bg-red-50 border border-red-100'
                        }`}>
                          <TrendingUp size={14} className={
                            req.riskAssessment.riskCategory === 'Low' ? 'text-emerald-600 mt-0.5' :
                            req.riskAssessment.riskCategory === 'Medium' ? 'text-amber-600 mt-0.5' : 'text-red-500 mt-0.5'
                          } />
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-0.5">Underwriting Agent Recommendation</p>
                            <p className="text-xs text-gray-600">{req.riskAssessment.recommendation}</p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => setApproveModal(req)}
                          className="btn-primary flex items-center gap-2"
                        >
                          <CheckCircle2 size={14} />
                          Approve Financing
                        </button>
                        <button
                          onClick={() => setRejectModal(req)}
                          className="btn-danger flex items-center gap-2"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setApproveModal(null)} />
          <div className="relative card p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">Approve Funding — Asset Details</h2>
              <button onClick={() => setApproveModal(null)} className="p-1 rounded text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-primary-50">
              <p className="text-xs font-semibold text-primary">{approveModal.businessName}</p>
              <p className="text-xs text-primary/80 mt-0.5">Requested: {formatNaira(approveModal.terms.amount)}</p>
            </div>

            {!myApprovedProvider ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Your institution isn't an approved Murabahah provider yet — complete registration
                  under <strong>Provider Settings</strong> and have Vetify approve it before you can
                  approve funding.
                </p>
              </div>
            ) : myCreditOfficers.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  No active Credit Officer is registered — register one under <strong>Provider
                  Settings</strong> before approving funding.
                </p>
              </div>
            ) : (
              <form onSubmit={handleApproveSubmit(handleApprove)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Asset Description *</label>
                  <input
                    className={`input ${approveErrors.description ? 'input-error' : ''}`}
                    placeholder="e.g. 5 industrial sewing machines"
                    {...registerApprove('description')}
                  />
                  {approveErrors.description && <p className="text-xs text-red-600 mt-1">{approveErrors.description.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Supplier *</label>
                  <input
                    className={`input ${approveErrors.supplier ? 'input-error' : ''}`}
                    {...registerApprove('supplier')}
                  />
                  {approveErrors.supplier && <p className="text-xs text-red-600 mt-1">{approveErrors.supplier.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Supplier Invoice / PO Reference *</label>
                  <input
                    className={`input ${approveErrors.supplierRef ? 'input-error' : ''}`}
                    {...registerApprove('supplierRef')}
                  />
                  {approveErrors.supplierRef && <p className="text-xs text-red-600 mt-1">{approveErrors.supplierRef.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Cost (₦) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                    <input
                      type="number"
                      className={`input pl-6 font-mono ${approveErrors.estimatedCost ? 'input-error' : ''}`}
                      {...registerApprove('estimatedCost', { valueAsNumber: true })}
                    />
                  </div>
                  {approveErrors.estimatedCost && <p className="text-xs text-red-600 mt-1">{approveErrors.estimatedCost.message}</p>}
                  {estimatedCost > 0 && (
                    <p className="text-xs text-gray-400 mt-1">{formatNaira(estimatedCost)}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Authorizing Credit Officer *</label>
                  <select
                    className={`input ${approveErrors.approvingOfficerId ? 'input-error' : ''}`}
                    {...registerApprove('approvingOfficerId')}
                  >
                    <option value="">Select officer...</option>
                    {myCreditOfficers.map((o) => (
                      <option key={o.id} value={o.officerId}>{o.officerName} ({o.officerId})</option>
                    ))}
                  </select>
                  {approveErrors.approvingOfficerId && <p className="text-xs text-red-600 mt-1">{approveErrors.approvingOfficerId.message}</p>}
                </div>

                {approveError && <p className="text-xs text-red-600">{approveError}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setApproveModal(null)} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={approveFinancing.isPending}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    {approveFinancing.isPending ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative card p-6 w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">Reject Financing Request</h2>
              <button onClick={() => setRejectModal(null)} className="p-1 rounded text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Rejecting financing for <strong>{rejectModal.businessName}</strong>. Please provide a reason.
            </p>

            <form onSubmit={handleRejectSubmit(handleReject)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rejection Reason *</label>
                <textarea
                  rows={4}
                  className={`input resize-none ${rejectErrors.reason ? 'input-error' : ''}`}
                  placeholder="e.g. Insufficient cash flow evidence, high existing debt burden, business purpose does not meet Shariah criteria..."
                  {...registerReject('reason')}
                />
                {rejectErrors.reason && <p className="text-xs text-red-600 mt-1">{rejectErrors.reason.message}</p>}
              </div>

              {rejectError && <p className="text-xs text-red-600">{rejectError}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setRejectModal(null)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={rejectFinancing.isPending} className="btn-danger flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                  <XCircle size={14} />
                  {rejectFinancing.isPending ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
