import { useState } from 'react'
import { Building2, CheckCircle2, XCircle } from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { FullPageLoader, ErrorState, EmptyState } from '../../components/LoadingState'
import { useProviderOnboardings, useApproveProvider, useRejectProvider } from '../../api/client'
import type { ProviderOnboarding, FinancingInstrument } from '../../api/client'

export default function ProviderApprovals() {
  const { data: onboardings, isLoading, isError } = useProviderOnboardings()
  const approveProvider = useApproveProvider()
  const rejectProvider = useRejectProvider()
  const [actionError, setActionError] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<ProviderOnboarding | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  if (isLoading) return <Layout title="Provider Approvals"><FullPageLoader /></Layout>
  if (isError || !onboardings) return <Layout title="Provider Approvals"><ErrorState message="Failed to load provider registrations" /></Layout>

  const pending = onboardings.filter((o) => o.status === 'UnderReview' || o.status === 'ManualReview')

  const handleApprove = async (o: ProviderOnboarding, instruments: FinancingInstrument[]) => {
    setActionError(null)
    try {
      await approveProvider.mutateAsync({ id: o.id, approvedInstruments: instruments })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to approve provider')
    }
  }

  const handleReject = async () => {
    if (!rejectModal || rejectReason.length < 5) return
    setActionError(null)
    try {
      await rejectProvider.mutateAsync({ id: rejectModal.id, reason: rejectReason })
      setRejectModal(null)
      setRejectReason('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to reject provider')
    }
  }

  return (
    <Layout title="Provider Approvals">
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Financing Provider Registrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pending.length} awaiting review</p>
        </div>

        {actionError && <p className="text-xs text-red-600">{actionError}</p>}

        {pending.length === 0 ? (
          <div className="card">
            <EmptyState
              title="No pending registrations"
              description="Financing providers awaiting approval will appear here"
              icon={<Building2 size={24} className="text-gray-400" />}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((o) => (
              <div key={o.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{o.providerName}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{o.address}</p>
                  </div>
                  <StatusBadge status={o.status} size="sm" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Provider Type</p>
                    <p className="text-gray-800">{o.providerType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">License Number</p>
                    <p className="text-gray-800 font-mono">{o.licenseNumber ?? '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Declared Instruments</p>
                  <div className="flex flex-wrap gap-1.5">
                    {o.declaredInstruments.map((i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                        {i}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => handleApprove(o, o.declaredInstruments)}
                    disabled={approveProvider.isPending}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    Approve (all declared instruments)
                  </button>
                  <button
                    onClick={() => setRejectModal(o)}
                    className="btn-danger flex items-center gap-2"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative card p-6 w-full max-w-sm animate-fade-in">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Reject Provider Registration</h2>
            <p className="text-xs text-gray-500 mb-4">
              Rejecting <strong>{rejectModal.providerName}</strong>. Please provide a reason.
            </p>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input resize-none"
              placeholder="Reason for rejection..."
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleReject}
                disabled={rejectReason.length < 5 || rejectProvider.isPending}
                className="btn-danger flex-1 disabled:opacity-40"
              >
                {rejectProvider.isPending ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
