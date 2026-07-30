"use client";

import { useState } from "react";
import { Truck, FileSignature, X, ShieldCheck, Clock3 } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira, formatDate } from "@/lib/formatters";
import {
  useAssetPurchaseRecords,
  useAcknowledgeDelivery,
  useMurabahahProposals,
  useShariahContractCertifications,
  useAcceptProposal,
  useRejectDelivery,
  useAssetRejectionRecords,
  useRequestCancellation,
  useAcquisitionCancellationRequests,
  useDeclineProposal,
  type MurabahahProposal,
  type AssetPurchaseRecord,
} from "@/lib/apiClient";

// New page -- Stage 8's two business-side actions (AcknowledgeDelivery/Qabdh
// and AcceptProposal/Qabul) have no bundled legacy equivalent; the real
// frontend's src/pages/business/AcquisitionStatus.tsx is read-only status
// tracking without action buttons. Same card-list pattern as the rest of
// this migration's business-facing pages.

function AcceptProposalModal({
  proposal,
  certificationId,
  onClose,
}: {
  proposal: MurabahahProposal;
  certificationId: number;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const accept = useAcceptProposal();

  const handleConfirm = async () => {
    setError(null);
    try {
      await accept.mutateAsync({ id: proposal.id, certificationId });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept the proposal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Accept Murabahah Proposal</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{proposal.facilityRef}</p>
        <div className="rounded-xl bg-primary-50 p-4 space-y-1.5 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Sale Price</span>
            <span className="font-mono font-semibold text-gray-900">{formatNaira(proposal.murabahahTerms.salePrice)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Profit</span>
            <span className="font-mono text-gray-700">{formatNaira(proposal.murabahahTerms.profitAmount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Tenure</span>
            <span className="font-mono text-gray-700">{proposal.murabahahTerms.tenureMonths} months</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Monthly Installment</span>
            <span className="font-mono text-gray-700">{formatNaira(proposal.murabahahTerms.installmentAmount)}</span>
          </div>
        </div>
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
          <ShieldCheck size={14} className="flex-shrink-0" />
          Certified Shariah-compliant by the Shari&apos;a Supervisory Board
        </p>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={accept.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {accept.isPending ? "Accepting…" : "Accept Proposal (Qabul)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Phase 2, Thirty-Ninth Slice: RejectDelivery (before Qabdh -- the asset
// arrived defective) and DeclineProposal (the offered terms aren't
// acceptable). Both nonconsuming/terminal choices on the business's own
// side of the pre-contract chain, no backend counterpart requiring the
// business to pick between the two paths.

function RejectDeliveryModal({ record, onClose }: { record: AssetPurchaseRecord; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [defectDescription, setDefectDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reject = useRejectDelivery();

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError("Please provide a reason");
      return;
    }
    try {
      await reject.mutateAsync({ id: record.id, reason, defectDescription });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject the delivery");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Reject Delivery</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{record.assetDescription}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
          <textarea rows={2} className="input text-sm resize-none" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Defect Description</label>
          <textarea rows={2} className="input text-sm resize-none" value={defectDescription} onChange={(e) => setDefectDescription(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={reject.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {reject.isPending ? "Submitting…" : "Reject Delivery"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestCancellationModal({ record, onClose }: { record: AssetPurchaseRecord; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestCancellation = useRequestCancellation();

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError("Please provide a reason");
      return;
    }
    try {
      await requestCancellation.mutateAsync({ id: record.id, reason });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to request cancellation");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Request Cancellation</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{record.assetDescription}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
          <textarea rows={2} className="input text-sm resize-none" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={requestCancellation.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {requestCancellation.isPending ? "Submitting…" : "Request Cancellation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeclineProposalModal({ proposal, onClose }: { proposal: MurabahahProposal; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const decline = useDeclineProposal();

  const handleSubmit = async () => {
    setError(null);
    if (!reason.trim()) {
      setError("Please provide a reason");
      return;
    }
    try {
      await decline.mutateAsync({ id: proposal.id, reason });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decline the proposal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Decline Proposal</h2>
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
          <button onClick={handleSubmit} disabled={decline.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {decline.isPending ? "Submitting…" : "Decline Proposal"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BusinessAcquisitionPage() {
  const { data: records, isLoading: loadingRecords, isError: errorRecords } = useAssetPurchaseRecords();
  const { data: proposals, isLoading: loadingProposals, isError: errorProposals } = useMurabahahProposals();
  const { data: certifications } = useShariahContractCertifications();
  const acknowledge = useAcknowledgeDelivery();
  const [acceptModal, setAcceptModal] = useState<MurabahahProposal | null>(null);
  const [rejectModal, setRejectModal] = useState<AssetPurchaseRecord | null>(null);
  const [cancelModal, setCancelModal] = useState<AssetPurchaseRecord | null>(null);
  const [declineModal, setDeclineModal] = useState<MurabahahProposal | null>(null);
  const { data: rejectionRecords } = useAssetRejectionRecords();
  const { data: cancellationRequests } = useAcquisitionCancellationRequests();

  if (loadingRecords || loadingProposals) return <Layout title="Asset Acquisition"><FullPageLoader /></Layout>;
  if (errorRecords || errorProposals || !records || !proposals) {
    return <Layout title="Asset Acquisition"><ErrorState message="Failed to load acquisition status" /></Layout>;
  }

  const awaitingAcknowledgement = records.filter((r) => !r.deliveryAcknowledged);
  const recordById = new Map(records.map((r) => [r.id, r]));

  const certByFacility = new Map((certifications ?? []).map((c) => [c.facilityRef, c]));

  return (
    <Layout title="Asset Acquisition">
      <div className="space-y-6">
        {awaitingAcknowledgement.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Truck size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Confirm Asset Delivery</h2>
            </div>
            <div className="space-y-3">
              {awaitingAcknowledgement.map((record) => (
                <div key={record.id} className="card p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{record.assetDescription}</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{formatNaira(record.totalAcquisitionCost)} · Purchased {formatDate(record.purchaseDate)}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setRejectModal(record)} className="btn-secondary text-xs px-3 py-1.5">
                      Reject Delivery
                    </button>
                    <button
                      onClick={() => acknowledge.mutate(record.id)}
                      disabled={acknowledge.isPending}
                      className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      {acknowledge.isPending ? "Confirming…" : "Confirm Delivery Received"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(rejectionRecords ?? []).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Rejected Deliveries</h2>
            <div className="space-y-3">
              {(rejectionRecords ?? []).map((rejection) => {
                const record = recordById.get(rejection.assetPurchaseRecordId);
                const cancellation = (cancellationRequests ?? []).find((c) => c.assetPurchaseRecordId === rejection.assetPurchaseRecordId);
                return (
                  <div key={rejection.id} className="card p-4">
                    <p className="text-sm text-gray-900">{rejection.reason}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{rejection.defectDescription}</p>
                    {cancellation ? (
                      <p className="text-xs mt-2 font-medium">
                        Cancellation request: <span className={cancellation.status === "Pending" ? "text-amber-600" : cancellation.status === "Confirmed" ? "text-red-600" : "text-gray-500"}>{cancellation.status}</span>
                      </p>
                    ) : record ? (
                      <button onClick={() => setCancelModal(record)} className="btn-danger text-xs px-3 py-1.5 mt-2">
                        Request Cancellation
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileSignature size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Murabahah Proposals</h2>
          </div>
          <div className="card overflow-hidden">
            {proposals.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No proposals yet -- awaiting the financial institution&apos;s offer</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {proposals.map((proposal) => {
                  const cert = certByFacility.get(proposal.facilityRef);
                  return (
                    <div key={proposal.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 font-mono">{proposal.facilityRef}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatNaira(proposal.murabahahTerms.salePrice)} · {proposal.murabahahTerms.tenureMonths} months ·{" "}
                          {formatNaira(proposal.murabahahTerms.installmentAmount)}/mo
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {cert ? (
                          <button onClick={() => setAcceptModal(proposal)} className="btn-primary text-xs px-3 py-1.5">
                            Accept Proposal
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                            <Clock3 size={12} /> Awaiting Shariah certification
                          </span>
                        )}
                        <button onClick={() => setDeclineModal(proposal)} className="btn-secondary text-xs px-3 py-1.5">
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {acceptModal &&
        (() => {
          const cert = certByFacility.get(acceptModal.facilityRef);
          return cert ? <AcceptProposalModal proposal={acceptModal} certificationId={Number(cert.id)} onClose={() => setAcceptModal(null)} /> : null;
        })()}
      {rejectModal && <RejectDeliveryModal record={rejectModal} onClose={() => setRejectModal(null)} />}
      {cancelModal && <RequestCancellationModal record={cancelModal} onClose={() => setCancelModal(null)} />}
      {declineModal && <DeclineProposalModal proposal={declineModal} onClose={() => setDeclineModal(null)} />}
    </Layout>
  );
}
