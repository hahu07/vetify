"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira } from "@/lib/formatters";
import { useFinancingList, useFinancingDecisions, useApproveFunding, useRejectFunding, type FinancingRequest } from "@/lib/apiClient";

// New page (no direct 1:1 legacy equivalent -- the real frontend's Stage 7
// decision lives inside src/pages/fi/UnderwritingQueue.tsx bundled with
// other FI concerns not yet ported here). Simplified table+modal pattern
// matching the Underwriting Queue page's shape for consistency.

type ModalMode = "approve" | "reject";
interface ModalState {
  mode: ModalMode;
  row: FinancingRequest;
}

function DecisionModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  const { mode, row } = modal;
  const [description, setDescription] = useState("");
  const [supplier, setSupplier] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [estimatedCost, setEstimatedCost] = useState(row.terms.amount);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const approve = useApproveFunding();
  const reject = useRejectFunding();
  const isPending = approve.isPending || reject.isPending;

  const handleConfirm = async () => {
    setError(null);
    try {
      if (mode === "approve") {
        if (!description.trim() || !supplier.trim() || !supplierRef.trim()) {
          setError("Please fill in the asset description, supplier, and supplier reference");
          return;
        }
        if (estimatedCost <= 0) {
          setError("Estimated cost must be positive");
          return;
        }
        await approve.mutateAsync({ id: row.id, assetDetails: { description, supplier, supplierRef, estimatedCost } });
      } else {
        if (reason.trim().length < 5) {
          setError("Please provide a more detailed rejection reason");
          return;
        }
        await reject.mutateAsync({ id: row.id, reason });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${mode}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{mode === "approve" ? "Approve Funding" : "Reject Funding"}</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          {row.businessName} <span className="font-mono">({row.cacRegNumber})</span> -- {formatNaira(row.terms.amount)}
        </p>

        {mode === "approve" ? (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Approving creates the Murabahah asset-purchase promise (MurabahahWad) -- describe the asset the institution will purchase on the business&apos;s behalf.
            </p>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Asset Description <span className="text-red-500">*</span>
              </label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 50 tonnes of flour" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Golden Mills" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Supplier Ref <span className="text-red-500">*</span>
                </label>
                <input className="input" value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="PO-1" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Cost (NGN)</label>
              <input type="number" className="input font-mono" value={estimatedCost} onChange={(e) => setEstimatedCost(Number(e.target.value))} />
            </div>
          </>
        ) : (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none" placeholder="Why is this financing request being declined?" />
          </div>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={isPending} className={`flex-1 disabled:opacity-40 ${mode === "reject" ? "btn-danger" : "btn-primary"}`}>
            {isPending ? "Submitting…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FiFinancingPage() {
  const { data: requests, isLoading, isError } = useFinancingList();
  const { data: decisions } = useFinancingDecisions();
  const [modal, setModal] = useState<ModalState | null>(null);

  if (isLoading) return <Layout title="Financing Decisions"><FullPageLoader /></Layout>;
  if (isError || !requests) return <Layout title="Financing Decisions"><ErrorState message="Failed to load financing requests" /></Layout>;

  const queue = requests.filter((r) => r.status === "Underwriting");

  return (
    <Layout title="Financing Decisions">
      <div className="space-y-6">
        <p className="text-xs text-gray-500">
          Stage 7: requests that cleared underwriting and are awaiting this institution&apos;s final Approve/Reject decision.
        </p>

        <div className="card overflow-hidden">
          {queue.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">No requests awaiting a funding decision</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>CAC No</th>
                    <th>Amount</th>
                    <th>Purpose</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((req) => (
                    <tr key={req.id}>
                      <td className="text-xs font-medium text-gray-900">{req.businessName}</td>
                      <td className="font-mono text-xs text-gray-700">{req.cacRegNumber}</td>
                      <td className="text-xs text-gray-700">{formatNaira(req.terms.amount)}</td>
                      <td className="text-xs text-gray-600">{req.terms.purpose}</td>
                      <td><StatusBadge status={req.status} /></td>
                      <td>
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            title="Approve funding"
                            onClick={() => setModal({ mode: "approve", row: req })}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors text-gray-400 hover:text-emerald-600"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            title="Reject funding"
                            onClick={() => setModal({ mode: "reject", row: req })}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600"
                          >
                            <XCircle size={14} />
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

        {decisions && decisions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Recent Decisions</h3>
            <div className="space-y-2.5">
              {decisions.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-surface border border-gray-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{d.businessName}</span>
                      <StatusBadge status={d.outcome} size="sm" />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{d.cacRegNumber}</p>
                    {d.reason && <p className="text-xs text-gray-500 mt-0.5">{d.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modal && <DecisionModal modal={modal} onClose={() => setModal(null)} />}
    </Layout>
  );
}
