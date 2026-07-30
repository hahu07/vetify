"use client";

import { useState } from "react";
import { Package, Truck, X } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira } from "@/lib/formatters";
import {
  useMurabahahWads,
  useProceedDirectly,
  useAssetPurchaseRecords,
  useOfferMurabahah,
  useAssetRejectionRecords,
  useProceedWithReplacement,
  useAcquisitionCancellationRequests,
  useConfirmCancellation,
  useRejectCancellation,
  useMurabahahProposals,
  useWithdrawProposal,
  type MurabahahWad,
  type AssetPurchaseRecord,
  type PaymentScheduleEntry,
  type AcquisitionCancellationRequestItem,
  type MurabahahProposal,
} from "@/lib/apiClient";

// New page -- Stage 8's acquisition chain (MurabahahWad -> AssetPurchaseRecord
// -> MurabahahProposal) has no direct 1:1 legacy equivalent bundled the same
// way; frontend/src/pages/fi/AcquisitionQueue.tsx covers similar ground but
// against the real backend's fuller Wakala/quotation/delivery-milestone
// surface, all deferred here (see migrations/006_murabahah_stage8.sql's
// header). Same table+modal shape as the Stage 5-7 pages for consistency.

function ProceedDirectlyModal({ wad, onClose }: { wad: MurabahahWad; onClose: () => void }) {
  const [actualCost, setActualCost] = useState(wad.assetDetails.estimatedCost);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceRef, setInvoiceRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const proceed = useProceedDirectly();

  const handleConfirm = async () => {
    setError(null);
    if (!invoiceRef.trim()) {
      setError("Please provide an invoice reference");
      return;
    }
    if (actualCost <= 0) {
      setError("Actual cost must be positive");
      return;
    }
    try {
      await proceed.mutateAsync({ id: wad.id, actualCost, purchaseDate, invoiceRef });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record the purchase");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Record Asset Purchase</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {wad.businessName} <span className="font-mono">({wad.cacRegNumber})</span> -- {wad.assetDetails.description}
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Actual Cost (NGN)</label>
          <input type="number" className="input font-mono" value={actualCost} onChange={(e) => setActualCost(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Date</label>
          <input type="date" className="input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Invoice Reference <span className="text-red-500">*</span>
          </label>
          <input className="input" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="INV-2026-001" />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={proceed.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {proceed.isPending ? "Submitting…" : "Confirm Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OfferMurabahahModal({ record, onClose }: { record: AssetPurchaseRecord; onClose: () => void }) {
  const [profitAmount, setProfitAmount] = useState(Math.round(record.totalAcquisitionCost * 0.1));
  const [facilityRef, setFacilityRef] = useState(`FAC-${record.id}-${Date.now()}`);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const offer = useOfferMurabahah();

  const assetCost = record.totalAcquisitionCost;
  const salePrice = assetCost + profitAmount;
  const tenureMonths = record.terms.tenureMonths;
  const installmentAmount = Math.round((salePrice / tenureMonths) * 100) / 100;

  const handleConfirm = async () => {
    setError(null);
    if (!facilityRef.trim()) {
      setError("Please provide a facility reference");
      return;
    }
    if (profitAmount < 0) {
      setError("Profit amount must be non-negative");
      return;
    }
    const start = new Date(startDate);
    const schedule: PaymentScheduleEntry[] = Array.from({ length: tenureMonths }, (_, i) => {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i + 1);
      return { installmentNo: i + 1, dueDate: due.toISOString().slice(0, 10), dueAmount: installmentAmount };
    });
    try {
      await offer.mutateAsync({
        id: record.id,
        murabahahTerms: { assetCost, profitAmount, salePrice, installmentAmount, tenureMonths },
        paymentSchedule: schedule,
        facilityRef,
        startDate,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to offer the Murabahah proposal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Offer Murabahah Proposal</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {record.businessName} <span className="font-mono">({record.cacRegNumber})</span> -- {record.assetDescription}
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Facility Reference</label>
          <input className="input font-mono" value={facilityRef} onChange={(e) => setFacilityRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Asset Cost (fixed to acquisition cost)</label>
          <input className="input font-mono bg-gray-50" value={formatNaira(assetCost)} disabled readOnly />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Profit Amount (NGN)</label>
          <input type="number" className="input font-mono" value={profitAmount} onChange={(e) => setProfitAmount(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
          <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="rounded-xl bg-primary-50 p-3.5 mb-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Sale Price</span>
            <span className="font-mono font-semibold text-gray-900">{formatNaira(salePrice)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Tenure</span>
            <span className="font-mono text-gray-700">{tenureMonths} months</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Monthly Installment</span>
            <span className="font-mono text-gray-700">{formatNaira(installmentAmount)}</span>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={offer.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {offer.isPending ? "Submitting…" : "Send Offer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Phase 2, Thirty-Ninth Slice: ProceedWithReplacement (the FI's response to
// a business rejection) and WithdrawProposal (the FI pulls its own offer
// before the business responds). ConfirmCancellation/RejectCancellation are
// simple enough to render inline, no modal needed. ExpireProposal is
// deliberately not here -- its Daml controller is `vetify` alone (a system
// sweep once the acceptance window has elapsed, not an FI action), so it
// lives on /vetify/shariah-certification instead, the one vetify-facing
// page that already has full MurabahahProposal visibility.

function ProceedWithReplacementModal({ record, onClose }: { record: AssetPurchaseRecord; onClose: () => void }) {
  const [newActualCost, setNewActualCost] = useState<number | "">(record.totalAcquisitionCost);
  const [newPurchaseDate, setNewPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [newInvoiceRef, setNewInvoiceRef] = useState("");
  const [replacementNote, setReplacementNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const proceedWithReplacement = useProceedWithReplacement();

  const handleSubmit = async () => {
    setError(null);
    if (!newActualCost || !newInvoiceRef.trim() || !replacementNote.trim()) {
      setError("New cost, invoice reference, and a replacement note are all required");
      return;
    }
    try {
      await proceedWithReplacement.mutateAsync({ id: record.id, newActualCost: Number(newActualCost), newPurchaseDate, newInvoiceRef, replacementNote });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to replace the asset");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Replace Asset</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{record.assetDescription}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">New Actual Cost (NGN)</label>
          <input type="number" className="input text-sm font-mono" value={newActualCost} onChange={(e) => setNewActualCost(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">New Purchase Date</label>
          <input type="date" className="input text-sm" value={newPurchaseDate} onChange={(e) => setNewPurchaseDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">New Invoice Reference</label>
          <input className="input text-sm" value={newInvoiceRef} onChange={(e) => setNewInvoiceRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Replacement Note</label>
          <textarea rows={2} className="input text-sm resize-none" value={replacementNote} onChange={(e) => setReplacementNote(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={proceedWithReplacement.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {proceedWithReplacement.isPending ? "Submitting…" : "Replace Asset"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WithdrawProposalModal({ proposal, onClose }: { proposal: MurabahahProposal; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const withdraw = useWithdrawProposal();

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError("Please provide a reason");
      return;
    }
    try {
      await withdraw.mutateAsync({ id: proposal.id, reason });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to withdraw the proposal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Withdraw Proposal</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.facilityRef}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
          <textarea rows={2} className="input text-sm resize-none" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={withdraw.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {withdraw.isPending ? "Submitting…" : "Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingCancellationRow({ cancellation, record }: { cancellation: AcquisitionCancellationRequestItem; record: AssetPurchaseRecord | undefined }) {
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirmCancellation();
  const reject = useRejectCancellation();

  const handleConfirm = async () => {
    setError(null);
    if (!record) return;
    try {
      await confirm.mutateAsync({ id: record.id, requestId: cancellation.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm cancellation");
    }
  };

  const handleReject = async () => {
    setError(null);
    try {
      await reject.mutateAsync({ id: cancellation.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject cancellation");
    }
  };

  return (
    <div className="card p-4">
      <p className="text-sm text-gray-900">{cancellation.businessName}</p>
      <p className="text-xs text-gray-500 mt-0.5">{cancellation.reason}</p>
      <div className="flex gap-2 mt-2">
        <button onClick={handleReject} disabled={reject.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">
          {reject.isPending ? "Rejecting…" : "Reject"}
        </button>
        <button onClick={handleConfirm} disabled={confirm.isPending || !record} className="btn-danger text-xs px-3 py-1.5 disabled:opacity-40">
          {confirm.isPending ? "Confirming…" : "Confirm Cancellation"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export default function FiAcquisitionPage() {
  const { data: wads, isLoading: loadingWads, isError: errorWads } = useMurabahahWads();
  const { data: records, isLoading: loadingRecords, isError: errorRecords } = useAssetPurchaseRecords();
  const { data: rejectionRecords } = useAssetRejectionRecords();
  const { data: cancellationRequests } = useAcquisitionCancellationRequests();
  const { data: proposals } = useMurabahahProposals();
  const [purchaseModal, setPurchaseModal] = useState<MurabahahWad | null>(null);
  const [offerModal, setOfferModal] = useState<AssetPurchaseRecord | null>(null);
  const [replacementModal, setReplacementModal] = useState<AssetPurchaseRecord | null>(null);
  const [withdrawModal, setWithdrawModal] = useState<MurabahahProposal | null>(null);

  if (loadingWads || loadingRecords) return <Layout title="Asset Acquisition"><FullPageLoader /></Layout>;
  if (errorWads || errorRecords || !wads || !records) {
    return <Layout title="Asset Acquisition"><ErrorState message="Failed to load acquisition queue" /></Layout>;
  }

  const rejectedRecordIds = new Set((rejectionRecords ?? []).map((r) => r.assetPurchaseRecordId));
  const readyToOffer = records.filter((r) => r.deliveryAcknowledged);
  const rejectedRecords = records.filter((r) => !r.deliveryAcknowledged && rejectedRecordIds.has(r.id));
  const pendingCancellations = (cancellationRequests ?? []).filter((c) => c.status === "Pending");
  const recordById = new Map(records.map((r) => [r.id, r]));

  return (
    <Layout title="Asset Acquisition">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Awaiting Asset Purchase</h2>
          </div>
          <div className="card overflow-hidden">
            {wads.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No pending asset purchases</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {wads.map((wad) => (
                  <div key={wad.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{wad.businessName}</p>
                      <p className="text-xs text-gray-500 font-mono">{wad.cacRegNumber}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{wad.assetDetails.description}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-mono text-gray-700">{formatNaira(wad.assetDetails.estimatedCost)}</span>
                      <button onClick={() => setPurchaseModal(wad)} className="btn-primary text-xs px-3 py-1.5">
                        Record Purchase
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Ready to Offer (Qabdh confirmed)</h2>
          </div>
          <div className="card overflow-hidden">
            {readyToOffer.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No asset purchases awaiting an offer</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {readyToOffer.map((record) => (
                  <div key={record.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{record.businessName}</p>
                      <p className="text-xs text-gray-500 font-mono">{record.cacRegNumber}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{record.assetDescription}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-mono text-gray-700">{formatNaira(record.totalAcquisitionCost)}</span>
                      <button onClick={() => setOfferModal(record)} className="btn-primary text-xs px-3 py-1.5">
                        Offer Murabahah
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {rejectedRecords.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Rejected Deliveries</h2>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {rejectedRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{record.businessName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{record.assetDescription}</p>
                  </div>
                  <button onClick={() => setReplacementModal(record)} className="btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                    Replace Asset
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingCancellations.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Pending Cancellation Requests</h2>
            <div className="space-y-3">
              {pendingCancellations.map((c) => (
                <PendingCancellationRow key={c.id} cancellation={c} record={recordById.get(c.assetPurchaseRecordId)} />
              ))}
            </div>
          </div>
        )}

        {(proposals ?? []).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Sent Proposals</h2>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {(proposals ?? []).map((proposal) => (
                <div key={proposal.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 font-mono">{proposal.facilityRef}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatNaira(proposal.murabahahTerms.salePrice)} · {proposal.murabahahTerms.tenureMonths} months</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setWithdrawModal(proposal)} className="btn-danger text-xs px-3 py-1.5">
                      Withdraw
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {purchaseModal && <ProceedDirectlyModal wad={purchaseModal} onClose={() => setPurchaseModal(null)} />}
      {replacementModal && <ProceedWithReplacementModal record={replacementModal} onClose={() => setReplacementModal(null)} />}
      {withdrawModal && <WithdrawProposalModal proposal={withdrawModal} onClose={() => setWithdrawModal(null)} />}
      {offerModal && <OfferMurabahahModal record={offerModal} onClose={() => setOfferModal(null)} />}
    </Layout>
  );
}
