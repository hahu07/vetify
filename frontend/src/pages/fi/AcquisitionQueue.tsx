import { useState } from 'react'
import { PackageCheck, HeartHandshake, Truck, FileSignature } from 'lucide-react'
import Layout from '../../components/Layout'
import AmountDisplay from '../../components/AmountDisplay'
import { FullPageLoader, ErrorState, EmptyState } from '../../components/LoadingState'
import {
  useWads, usePurchaseRecords, useProposals,
  useProceedWithWakala, useProceedDirectly, useOfferMurabahah,
} from '../../api/client'
import type { MurabahahWad, AssetPurchaseRecord, ProceedDirectlyPayload, OfferMurabahahPayload } from '../../api/client'

// FI's side of the Murabahah acquisition chain (AAOIFI Std No. 8/23):
//   MurabahahWad → ProceedWithWakala | ProceedDirectly → AssetPurchaseRecord
//   → (business AcknowledgeDelivery) → OfferMurabahah → MurabahahProposal
//   → (business Accept/Decline, gated by vetify's Shari'a certification)

export default function AcquisitionQueue() {
  const { data: wads, isLoading: loadingWads, isError: errorWads } = useWads()
  const { data: purchases, isLoading: loadingPurchases, isError: errorPurchases } = usePurchaseRecords()
  const { data: proposals, isLoading: loadingProposals, isError: errorProposals } = useProposals()

  const proceedWithWakala = useProceedWithWakala()
  const proceedDirectly = useProceedDirectly()
  const offerMurabahah = useOfferMurabahah()

  const [actionError, setActionError] = useState<string | null>(null)
  const [directModal, setDirectModal] = useState<MurabahahWad | null>(null)
  const [directForm, setDirectForm] = useState({ actualCost: '', purchaseDate: '', invoiceRef: '' })
  const [offerModal, setOfferModal] = useState<AssetPurchaseRecord | null>(null)
  const [offerForm, setOfferForm] = useState({
    profitAmount: '', tenureMonths: '', startDate: '', firstDueDate: '',
  })

  if (loadingWads || loadingPurchases || loadingProposals) {
    return <Layout title="Acquisition Pipeline"><FullPageLoader /></Layout>
  }
  if (errorWads || errorPurchases || errorProposals || !wads || !purchases || !proposals) {
    return <Layout title="Acquisition Pipeline"><ErrorState message="Failed to load acquisition pipeline" /></Layout>
  }

  const pendingWads = wads // /financing/wads is already FI-scoped server-side
  const pendingOffers = purchases.filter((p) => p.deliveryAcknowledged)
  const awaitingQabdh = purchases.filter((p) => !p.deliveryAcknowledged)

  const handleProceedWithWakala = async (id: string) => {
    setActionError(null)
    try {
      await proceedWithWakala.mutateAsync(id)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to appoint the business as purchasing agent')
    }
  }

  const handleProceedDirectly = async () => {
    if (!directModal) return
    setActionError(null)
    try {
      const payload: ProceedDirectlyPayload = {
        actualCost: parseFloat(directForm.actualCost),
        purchaseDate: directForm.purchaseDate,
        invoiceRef: directForm.invoiceRef,
      }
      await proceedDirectly.mutateAsync({ id: directModal.id, ...payload })
      setDirectModal(null)
      setDirectForm({ actualCost: '', purchaseDate: '', invoiceRef: '' })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to record direct purchase')
    }
  }

  const handleOfferMurabahah = async () => {
    if (!offerModal) return
    setActionError(null)
    try {
      const assetCost = offerModal.actualCost
      const profitAmount = parseFloat(offerForm.profitAmount)
      const salePrice = assetCost + profitAmount
      const tenureMonths = parseInt(offerForm.tenureMonths, 10)
      const installmentAmount = Math.round((salePrice / tenureMonths) * 100) / 100
      const firstDue = new Date(offerForm.firstDueDate)
      const paymentSchedule = Array.from({ length: tenureMonths }, (_, i) => {
        const due = new Date(firstDue)
        due.setMonth(due.getMonth() + i)
        return { installmentNo: i + 1, dueDate: due.toISOString().slice(0, 10), dueAmount: installmentAmount }
      })
      const payload: OfferMurabahahPayload = {
        murabahahTerms: { assetCost, profitAmount, salePrice, installmentAmount, tenureMonths },
        paymentSchedule,
        startDate: offerForm.startDate,
      }
      await offerMurabahah.mutateAsync({ id: offerModal.id, ...payload })
      setOfferModal(null)
      setOfferForm({ profitAmount: '', tenureMonths: '', startDate: '', firstDueDate: '' })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to offer Murabahah terms')
    }
  }

  return (
    <Layout title="Acquisition Pipeline">
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Murabahah Acquisition Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Wa'd → asset acquisition → Ijab (offer) — the steps between funding approval and a signed Murabahah contract
          </p>
        </div>

        {actionError && <p className="text-xs text-red-600">{actionError}</p>}

        {/* ── Wa'd: acquisition path decision ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <HeartHandshake size={15} /> Awaiting Acquisition Path ({pendingWads.length})
          </h2>
          {pendingWads.length === 0 ? (
            <div className="card"><EmptyState title="No pending Wa'd" description="Business promises awaiting a purchase path will appear here" icon={<HeartHandshake size={22} className="text-gray-400" />} /></div>
          ) : (
            <div className="space-y-3">
              {pendingWads.map((w) => (
                <div key={w.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{w.businessName}</p>
                    <p className="text-xs text-gray-500">{w.assetDetails.description} — supplier: {w.assetDetails.supplier}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Estimated cost: <AmountDisplay amount={w.assetDetails.estimatedCost} className="inline text-xs" /></p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleProceedWithWakala(w.id)}
                      disabled={proceedWithWakala.isPending}
                      className="btn-secondary text-xs disabled:opacity-40"
                      title="Appoint the business as your agent (Wakala) to purchase the asset"
                    >
                      Appoint as Agent (Wakala)
                    </button>
                    <button
                      onClick={() => setDirectModal(w)}
                      className="btn-primary text-xs"
                      title="Purchase the asset directly from the supplier"
                    >
                      Purchase Directly
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Asset Purchase Records awaiting Qabdh ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Truck size={15} /> Awaiting Business Delivery Acknowledgement ({awaitingQabdh.length})
          </h2>
          {awaitingQabdh.length === 0 ? (
            <div className="card"><EmptyState title="None pending" description="Purchases awaiting the business's Qabdh (delivery acknowledgement) will appear here" icon={<Truck size={22} className="text-gray-400" />} /></div>
          ) : (
            <div className="space-y-2">
              {awaitingQabdh.map((p) => (
                <div key={p.id} className="card p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{p.businessName}</p>
                    <p className="text-xs text-gray-500">{p.assetDetails.description} — invoice {p.invoiceRef}</p>
                  </div>
                  <p className="text-xs text-amber-600">Waiting on business</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Ready to offer ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <PackageCheck size={15} /> Ready to Offer Murabahah Terms ({pendingOffers.length})
          </h2>
          {pendingOffers.length === 0 ? (
            <div className="card"><EmptyState title="None ready" description="Purchases with confirmed delivery, ready for your Ijab (offer), will appear here" icon={<PackageCheck size={22} className="text-gray-400" />} /></div>
          ) : (
            <div className="space-y-3">
              {pendingOffers.map((p) => (
                <div key={p.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{p.businessName}</p>
                    <p className="text-xs text-gray-500">{p.assetDetails.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Acquisition cost: <AmountDisplay amount={p.totalAcquisitionCost} className="inline text-xs" /></p>
                  </div>
                  <button onClick={() => setOfferModal(p)} className="btn-primary text-xs">
                    Offer Terms (Ijab)
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Proposals status ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileSignature size={15} /> Proposals Awaiting Business Acceptance ({proposals.length})
          </h2>
          {proposals.length === 0 ? (
            <div className="card"><EmptyState title="No pending proposals" description="Offered terms awaiting Shari'a certification and business acceptance will appear here" icon={<FileSignature size={22} className="text-gray-400" />} /></div>
          ) : (
            <div className="space-y-2">
              {proposals.map((p) => (
                <div key={p.id} className="card p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{p.businessName} — {p.facilityRef}</p>
                    <p className="text-xs text-gray-500">
                      Sale price <AmountDisplay amount={p.murabahahTerms.salePrice} className="inline text-xs" /> over {p.murabahahTerms.tenureMonths} months
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">Certification + business acceptance pending</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Purchase Directly modal */}
      {directModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDirectModal(null)} />
          <div className="relative card p-6 w-full max-w-sm animate-fade-in space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Purchase Directly</h2>
            <p className="text-xs text-gray-500">
              Record the FI's direct purchase of <strong>{directModal.assetDetails.description}</strong> from the supplier.
            </p>
            <div>
              <label className="text-xs text-gray-500">Actual Cost (₦)</label>
              <input type="number" className="input" value={directForm.actualCost}
                onChange={(e) => setDirectForm((f) => ({ ...f, actualCost: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Purchase Date</label>
              <input type="date" className="input" value={directForm.purchaseDate}
                onChange={(e) => setDirectForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Invoice Reference</label>
              <input type="text" className="input" value={directForm.invoiceRef}
                onChange={(e) => setDirectForm((f) => ({ ...f, invoiceRef: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDirectModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleProceedDirectly}
                disabled={!directForm.actualCost || !directForm.purchaseDate || !directForm.invoiceRef || proceedDirectly.isPending}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {proceedDirectly.isPending ? 'Recording…' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Murabahah modal */}
      {offerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOfferModal(null)} />
          <div className="relative card p-6 w-full max-w-sm animate-fade-in space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Offer Murabahah Terms</h2>
            <p className="text-xs text-gray-500">
              Asset cost <AmountDisplay amount={offerModal.actualCost} className="inline text-xs" /> — disclose your profit margin and tenure.
            </p>
            <div>
              <label className="text-xs text-gray-500">Profit Amount (₦)</label>
              <input type="number" className="input" value={offerForm.profitAmount}
                onChange={(e) => setOfferForm((f) => ({ ...f, profitAmount: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Tenure (months)</label>
              <input type="number" className="input" value={offerForm.tenureMonths}
                onChange={(e) => setOfferForm((f) => ({ ...f, tenureMonths: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Contract Start Date</label>
              <input type="date" className="input" value={offerForm.startDate}
                onChange={(e) => setOfferForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">First Installment Due Date</label>
              <input type="date" className="input" value={offerForm.firstDueDate}
                onChange={(e) => setOfferForm((f) => ({ ...f, firstDueDate: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setOfferModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleOfferMurabahah}
                disabled={
                  !offerForm.profitAmount || !offerForm.tenureMonths || !offerForm.startDate ||
                  !offerForm.firstDueDate || offerMurabahah.isPending
                }
                className="btn-primary flex-1 disabled:opacity-40"
              >
                {offerMurabahah.isPending ? 'Submitting…' : 'Send Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
