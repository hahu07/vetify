import { useState } from 'react'
import { Building2, CheckCircle2, XCircle, FileEdit, ShieldCheck } from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { FullPageLoader, ErrorState, EmptyState } from '../../components/LoadingState'
import { formatDate } from '../../lib/formatters'
import {
  useProviderOnboardings, useApproveProvider, useRejectProvider, useRequestProviderAmendment,
  useApprovedProviders, useAuthorizedOfficers,
} from '../../api/client'
import type { ProviderOnboarding, FinancingInstrument, AuthorizedOfficer } from '../../api/client'
import { IMPLEMENTED_INSTRUMENTS } from '../../api/client'

export default function ProviderApprovals() {
  const { data: onboardings, isLoading, isError } = useProviderOnboardings()
  // Once ApproveProvider fires, the FinancingProviderOnboarding record is archived — this is
  // the only place that institution shows up again on the admin side. Previously there was no
  // admin view of approved providers at all: they simply vanished from this page's pending
  // queue with nowhere else to look them up (staff-role GET /providers/approved and
  // /providers/officers already return the full unscoped list server-side, so this only needed
  // a frontend view, no backend change).
  const { data: approvedProviders, isLoading: loadingApproved, isError: errorApproved } = useApprovedProviders()
  const { data: officers, isLoading: loadingOfficers, isError: errorOfficers } = useAuthorizedOfficers()
  const approveProvider = useApproveProvider()
  const rejectProvider = useRejectProvider()
  const requestAmendment = useRequestProviderAmendment()
  const [actionError, setActionError] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<ProviderOnboarding | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [amendModal, setAmendModal] = useState<ProviderOnboarding | null>(null)
  const [amendNote, setAmendNote] = useState('')

  if (isLoading || loadingApproved || loadingOfficers) return <Layout title="Provider Approvals"><FullPageLoader /></Layout>
  if (isError || errorApproved || errorOfficers || !onboardings || !approvedProviders) {
    return <Layout title="Provider Approvals"><ErrorState message="Failed to load provider registrations" /></Layout>
  }

  const pending = onboardings.filter((o) => o.status === 'UnderReview' || o.status === 'ManualReview')
  const officersByFi = (officers ?? []).reduce<Record<string, AuthorizedOfficer[]>>((acc, o) => {
    (acc[o.financialInstitution] ??= []).push(o)
    return acc
  }, {})

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

  const handleRequestAmendment = async () => {
    if (!amendModal || amendNote.length < 5) return
    setActionError(null)
    try {
      await requestAmendment.mutateAsync({ id: amendModal.id, note: amendNote })
      setAmendModal(null)
      setAmendNote('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to request amendment')
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
                    <p className="text-xs text-gray-500">CAC Registration Number</p>
                    <p className="text-gray-800 font-mono">{o.cacRegNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">License Number</p>
                    <p className="text-gray-800 font-mono">{o.licenseNumber ?? '—'}</p>
                  </div>
                </div>
                {o.agentScore != null ? (
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    <p className="text-xs text-gray-500">
                      Automated CAC/regulatory check: <span className="font-semibold text-gray-800">{o.agentScore}</span> ({o.agentRisk})
                    </p>
                    {o.agentNote && <p className="text-xs text-amber-600 mt-1">{o.agentNote}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      Instrument selection is still a manual judgment call based on governing documents.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Automated CAC/regulatory check pending.</p>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Declared Instruments</p>
                  <div className="flex flex-wrap gap-1.5">
                    {o.declaredInstruments.map((i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                          IMPLEMENTED_INSTRUMENTS.has(i)
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {i}
                        {!IMPLEMENTED_INSTRUMENTS.has(i) && ' (not yet supported)'}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    // G18: approval is filtered to implemented instruments only —
                    // a provider declaring Ijarah/QardHasan (valid Daml enum values)
                    // cannot be approved for a product the platform can't execute.
                    onClick={() => handleApprove(o, o.declaredInstruments.filter((i) => IMPLEMENTED_INSTRUMENTS.has(i)))}
                    disabled={approveProvider.isPending || !o.declaredInstruments.some((i) => IMPLEMENTED_INSTRUMENTS.has(i))}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    Approve (supported instruments)
                  </button>
                  <button
                    onClick={() => setRejectModal(o)}
                    className="btn-danger flex items-center gap-2"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                  <button
                    onClick={() => setAmendModal(o)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-medium transition-colors"
                  >
                    <FileEdit size={14} />
                    Request Amendment
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approved institutions — the pending queue above is the only place a
            registration is visible before a decision; once approved it archives and
            disappears from there, so this is the only remaining admin-side view of it. */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-primary" />
            <h2 className="text-base font-semibold text-gray-900">Approved Financing Providers</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">{approvedProviders.length} institution{approvedProviders.length === 1 ? '' : 's'}</p>

          {approvedProviders.length === 0 ? (
            <div className="card">
              <EmptyState
                title="No approved providers yet"
                description="Institutions approved above will appear here"
                icon={<ShieldCheck size={24} className="text-gray-400" />}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {approvedProviders.map((p) => {
                const providerOfficers = officersByFi[p.financialInstitution] ?? []
                return (
                  <div key={p.id} className="card p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{p.providerName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{p.providerType} · Approved {formatDate(p.approvedAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {p.approvedInstruments.map((i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
                            {i}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1.5">
                        {providerOfficers.length === 0 ? 'No officers registered yet' : `${providerOfficers.length} registered officer${providerOfficers.length === 1 ? '' : 's'}`}
                      </p>
                      {providerOfficers.length === 0 ? (
                        <p className="text-xs text-amber-600">
                          This institution cannot approve financing requests until it registers at least one active CreditOfficer.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {providerOfficers.map((o) => (
                            <span
                              key={o.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                o.active ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-50 border-gray-100 text-gray-400'
                              }`}
                            >
                              {o.officerName} <span className="text-gray-400">· {o.roles.join(', ')}</span>
                              {!o.active && ' (inactive)'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
      {amendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAmendModal(null)} />
          <div className="relative card p-6 w-full max-w-sm animate-fade-in">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Request Amendment</h2>
            <p className="text-xs text-gray-500 mb-4">
              Returns <strong>{amendModal.providerName}</strong>'s registration for correction. Please
              describe what needs to change.
            </p>
            <textarea
              rows={4}
              value={amendNote}
              onChange={(e) => setAmendNote(e.target.value)}
              className="input resize-none"
              placeholder="What does the provider need to correct or clarify?"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setAmendModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleRequestAmendment}
                disabled={amendNote.length < 5 || requestAmendment.isPending}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {requestAmendment.isPending ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
