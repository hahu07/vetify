import { useState } from 'react'
import { HeartHandshake, Truck, PackageCheck, FileSignature } from 'lucide-react'
import Layout from '../../components/Layout'
import AmountDisplay from '../../components/AmountDisplay'
import { FullPageLoader, ErrorState, EmptyState } from '../../components/LoadingState'
import {
  useWads, useWakalas, usePurchaseRecords, useProposals, useShariahCertifications,
  useWithdrawWad, useRecordAssetPurchase, useDeclineAgency, useAcknowledgeDelivery,
  useAcceptProposal, useDeclineProposal,
} from '../../api/client'
import type { MurabahahWakala, MurabahahProposal, ProceedDirectlyPayload } from '../../api/client'

// Business's side of the Murabahah acquisition chain (AAOIFI Std No. 8/23):
//   MurabahahWad (can Withdraw) → MurabahahWakala (record purchase / decline agency)
//   → AssetPurchaseRecord (Qabdh — acknowledge delivery) → MurabahahProposal
//   (Accept, gated by the advisor's Shari'a certification — or Decline)

export default function AcquisitionStatus() {
  const { data: wads, isLoading: l1, isError: e1 } = useWads()
  const { data: wakalas, isLoading: l2, isError: e2 } = useWakalas()
  const { data: purchases, isLoading: l3, isError: e3 } = usePurchaseRecords()
  const { data: proposals, isLoading: l4, isError: e4 } = useProposals()
  const { data: certifications } = useShariahCertifications()

  const withdrawWad = useWithdrawWad()
  const recordAssetPurchase = useRecordAssetPurchase()
  const declineAgency = useDeclineAgency()
  const acknowledgeDelivery = useAcknowledgeDelivery()
  const acceptProposal = useAcceptProposal()
  const declineProposal = useDeclineProposal()

  const [actionError, setActionError] = useState<string | null>(null)
  const [withdrawModal, setWithdrawModal] = useState<string | null>(null)
  const [withdrawReason, setWithdrawReason] = useState('')
  const [purchaseModal, setPurchaseModal] = useState<MurabahahWakala | null>(null)
  const [purchaseForm, setPurchaseForm] = useState({ actualCost: '', purchaseDate: '', invoiceRef: '' })
  const [declineWakalaModal, setDeclineWakalaModal] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [declineProposalModal, setDeclineProposalModal] = useState<MurabahahProposal | null>(null)
  const [declineProposalReason, setDeclineProposalReason] = useState('')

  if (l1 || l2 || l3 || l4) return <Layout title="Acquisition Status"><FullPageLoader /></Layout>
  if (e1 || e2 || e3 || e4 || !wads || !wakalas || !purchases || !proposals) {
    return <Layout title="Acquisition Status"><ErrorState message="Failed to load acquisition status" /></Layout>
  }

  const awaitingQabdh = purchases.filter((p) => !p.deliveryAcknowledged)

  const handleWithdraw = async () => {
    if (!withdrawModal || withdrawReason.length < 5) return
    setActionError(null)
    try {
      await withdrawWad.mutateAsync({ id: withdrawModal, reason: withdrawReason })
      setWithdrawModal(null)
      setWithdrawReason('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to withdraw promise')
    }
  }

  const handleRecordPurchase = async () => {
    if (!purchaseModal) return
    setActionError(null)
    try {
      const payload: ProceedDirectlyPayload = {
        actualCost: parseFloat(purchaseForm.actualCost),
        purchaseDate: purchaseForm.purchaseDate,
        invoiceRef: purchaseForm.invoiceRef,
      }
      await recordAssetPurchase.mutateAsync({ id: purchaseModal.id, ...payload })
      setPurchaseModal(null)
      setPurchaseForm({ actualCost: '', purchaseDate: '', invoiceRef: '' })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to record asset purchase')
    }
  }

  const handleDeclineAgency = async () => {
    if (!declineWakalaModal || declineReason.length < 5) return
    setActionError(null)
    try {
      await declineAgency.mutateAsync({ id: declineWakalaModal, reason: declineReason })
      setDeclineWakalaModal(null)
      setDeclineReason('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to decline agency')
    }
  }

  const handleAcknowledgeDelivery = async (id: string) => {
    setActionError(null)
    try {
      await acknowledgeDelivery.mutateAsync(id)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to acknowledge delivery')
    }
  }

  const handleAccept = async (proposal: MurabahahProposal) => {
    setActionError(null)
    const cert = (certifications ?? []).find(
      (c) => c.facilityRef === proposal.facilityRef && c.verdict === 'COMPLIANT'
    )
    if (!cert) {
      setActionError('No compliant Shari\'a certification exists yet for this proposal — the Shari\'a advisor must certify these terms before you can accept.')
      return
    }
    try {
      await acceptProposal.mutateAsync({ id: proposal.id, certificationCid: cert.id })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to accept proposal')
    }
  }

  const handleDeclineProposal = async () => {
    if (!declineProposalModal || declineProposalReason.length < 5) return
    setActionError(null)
    try {
      await declineProposal.mutateAsync({ id: declineProposalModal.id, reason: declineProposalReason })
      setDeclineProposalModal(null)
      setDeclineProposalReason('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to decline proposal')
    }
  }

  return (
    <Layout title="Acquisition Status">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-xl font-semibold text-gray-900 tracking-tight">Murabahah Acquisition Status</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track your promise (Wa'd) through asset acquisition to the final contract offer
          </p>
        </div>

        {actionError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{actionError}</p>
        )}

        {/* ── Wa'd ── */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <HeartHandshake size={16} className="text-primary" />
            </span>
            <span className="font-display text-base font-semibold text-gray-800 tracking-tight">Your Promise to Purchase</span>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{wads.length}</span>
          </h2>
          {wads.length === 0 ? (
            <div className="card"><EmptyState title="No pending promises" description="A Wa'd appears here once the FI approves your funding request" icon={<HeartHandshake size={22} className="text-gray-400" />} /></div>
          ) : (
            <div className="space-y-3">
              {wads.map((w) => (
                <div key={w.id} className="card p-5 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{w.assetDetails.description}</p>
                    <p className="text-sm text-gray-500 mt-0.5">Supplier: {w.assetDetails.supplier}</p>
                    <p className="text-xs text-gray-400 mt-1">Awaiting the FI to choose a purchase path</p>
                  </div>
                  <button onClick={() => setWithdrawModal(w.id)} className="btn-secondary text-xs px-4 py-2">
                    Withdraw Promise
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Wakala ── */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Truck size={16} className="text-primary" />
            </span>
            <span className="font-display text-base font-semibold text-gray-800 tracking-tight">Purchasing as the FI's Agent</span>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{wakalas.length}</span>
          </h2>
          {wakalas.length === 0 ? (
            <div className="card"><EmptyState title="No agency appointments" description="Appears here if the FI appoints you to purchase the asset on its behalf" icon={<Truck size={22} className="text-gray-400" />} /></div>
          ) : (
            <div className="space-y-3">
              {wakalas.map((w) => (
                <div key={w.id} className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{w.assetDetails.description}</p>
                    <p className="text-sm text-gray-500 mt-0.5">Supplier: {w.assetDetails.supplier}</p>
                    {w.agencyFee !== undefined && (
                      <p className="text-xs text-gray-400 mt-1">Agency fee: <AmountDisplay amount={w.agencyFee} className="inline text-xs" /></p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setDeclineWakalaModal(w.id)} className="btn-secondary text-xs px-4 py-2">Decline</button>
                    <button onClick={() => setPurchaseModal(w)} className="btn-primary text-xs px-4 py-2">Record Purchase</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Qabdh (delivery acknowledgement) ── */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <PackageCheck size={16} className="text-primary" />
            </span>
            <span className="font-display text-base font-semibold text-gray-800 tracking-tight">Confirm Delivery Received</span>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{awaitingQabdh.length}</span>
          </h2>
          {awaitingQabdh.length === 0 ? (
            <div className="card"><EmptyState title="Nothing to confirm" description="Once the FI records the asset purchase, confirm receipt here" icon={<PackageCheck size={22} className="text-gray-400" />} /></div>
          ) : (
            <div className="space-y-3">
              {awaitingQabdh.map((p) => (
                <div key={p.id} className="card p-5 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{p.assetDetails.description}</p>
                    <p className="text-sm text-gray-500 mt-0.5">Invoice {p.invoiceRef} — cost <AmountDisplay amount={p.actualCost} className="inline text-sm" /></p>
                  </div>
                  <button
                    onClick={() => handleAcknowledgeDelivery(p.id)}
                    disabled={acknowledgeDelivery.isPending}
                    className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
                  >
                    Confirm Receipt (Qabdh)
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Proposals ── */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <FileSignature size={16} className="text-primary" />
            </span>
            <span className="font-display text-base font-semibold text-gray-800 tracking-tight">Offered Terms</span>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{proposals.length}</span>
          </h2>
          {proposals.length === 0 ? (
            <div className="card"><EmptyState title="No offers yet" description="The FI's formal Murabahah offer (Ijab) will appear here once terms are set" icon={<FileSignature size={22} className="text-gray-400" />} /></div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => {
                const cert = (certifications ?? []).find((c) => c.facilityRef === p.facilityRef && c.verdict === 'COMPLIANT')
                return (
                  <div key={p.id} className="card p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{p.facilityRef}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Asset cost <AmountDisplay amount={p.murabahahTerms.assetCost} className="inline text-sm" /> +
                          {' '}profit <AmountDisplay amount={p.murabahahTerms.profit} className="inline text-sm" /> ={' '}
                          <AmountDisplay amount={p.murabahahTerms.salePrice} className="inline text-sm font-semibold" />
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {p.murabahahTerms.tenureMonths} months — installment <AmountDisplay amount={p.murabahahTerms.installmentAmount} className="inline text-xs" />
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${cert ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>
                        {cert ? "Shari'a Certified" : 'Awaiting Certification'}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button onClick={() => setDeclineProposalModal(p)} className="btn-secondary text-xs px-4 py-2 mt-2">Decline</button>
                      <button
                        onClick={() => handleAccept(p)}
                        disabled={!cert || acceptProposal.isPending}
                        className="btn-primary text-xs px-4 py-2 mt-2 disabled:opacity-40"
                        title={cert ? undefined : "Waiting on the Shari'a advisor's certification of these terms"}
                      >
                        Accept (Qabul)
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Withdraw Wa'd modal */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setWithdrawModal(null)} />
          <div className="relative card p-7 w-full max-w-sm animate-fade-in space-y-4">
            <h2 className="font-display text-lg font-semibold text-gray-900 tracking-tight">Withdraw Promise</h2>
            <textarea rows={3} className="input resize-none" placeholder="Reason for withdrawing (e.g. supplier unavailable)..."
              value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} />
            <div className="flex gap-3 pt-1">
              <button onClick={() => setWithdrawModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleWithdraw} disabled={withdrawReason.length < 5 || withdrawWad.isPending} className="btn-danger flex-1 disabled:opacity-40">
                {withdrawWad.isPending ? 'Withdrawing…' : 'Confirm Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Purchase modal */}
      {purchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPurchaseModal(null)} />
          <div className="relative card p-7 w-full max-w-sm animate-fade-in space-y-4">
            <h2 className="font-display text-lg font-semibold text-gray-900 tracking-tight">Record Asset Purchase</h2>
            <p className="text-xs text-gray-500">Confirm the purchase you made as the FI's agent for <strong>{purchaseModal.assetDetails.description}</strong>.</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Actual Cost (₦)</label>
              <input type="number" className="input" value={purchaseForm.actualCost}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, actualCost: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Purchase Date</label>
              <input type="date" className="input" value={purchaseForm.purchaseDate}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Invoice Reference</label>
              <input type="text" className="input" value={purchaseForm.invoiceRef}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, invoiceRef: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setPurchaseModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleRecordPurchase}
                disabled={!purchaseForm.actualCost || !purchaseForm.purchaseDate || !purchaseForm.invoiceRef || recordAssetPurchase.isPending}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {recordAssetPurchase.isPending ? 'Recording…' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Agency modal */}
      {declineWakalaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeclineWakalaModal(null)} />
          <div className="relative card p-7 w-full max-w-sm animate-fade-in space-y-4">
            <h2 className="font-display text-lg font-semibold text-gray-900 tracking-tight">Decline Agency Appointment</h2>
            <p className="text-xs text-gray-500">The FI will need to purchase the asset directly instead.</p>
            <textarea rows={3} className="input resize-none" placeholder="Reason..."
              value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDeclineWakalaModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDeclineAgency} disabled={declineReason.length < 5 || declineAgency.isPending} className="btn-danger flex-1 disabled:opacity-40">
                {declineAgency.isPending ? 'Declining…' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Proposal modal */}
      {declineProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeclineProposalModal(null)} />
          <div className="relative card p-7 w-full max-w-sm animate-fade-in space-y-4">
            <h2 className="font-display text-lg font-semibold text-gray-900 tracking-tight">Decline Proposal</h2>
            <textarea rows={3} className="input resize-none" placeholder="Reason for declining these terms..."
              value={declineProposalReason} onChange={(e) => setDeclineProposalReason(e.target.value)} />
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDeclineProposalModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDeclineProposal} disabled={declineProposalReason.length < 5 || declineProposal.isPending} className="btn-danger flex-1 disabled:opacity-40">
                {declineProposal.isPending ? 'Declining…' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
