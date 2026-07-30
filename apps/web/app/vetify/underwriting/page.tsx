"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Flag, X, Ban, Clock } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira } from "@/lib/formatters";
import {
  useFinancingList,
  useBeginUnderwriting,
  useRejectUnderwriting,
  useFlagUnderwritingForManualReview,
  useCancelRequest,
  useExpireRequest,
  type FinancingRequest,
  type RiskLevel,
} from "@/lib/apiClient";

// Ported from frontend/src/pages/vetify/AssessorQueue.tsx -- a clean
// table+modal pattern with no dependency on the deferred UnderwritingPolicy/
// ApprovedProvider modules, so it needed only hook-name/import changes.
// Financing.daml: BeginUnderwriting/RejectUnderwriting only valid from
// Submitted or UnderwritingManualReview; FlagUnderwritingForManualReview
// only from Submitted (mirrors FlagComplianceForManualReview's precedent).
const canDecide = (status: string) => status === "Submitted" || status === "UnderwritingManualReview";

type ModalMode = "begin" | "reject" | "flag" | "cancel" | "expire";
interface ModalState {
  mode: ModalMode;
  row: FinancingRequest;
}

function AssessorModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  const { mode, row } = modal;
  const [score, setScore] = useState(70);
  const [riskCategory, setRiskCategory] = useState<RiskLevel>("Low");
  const [recommendedLimit, setRecommendedLimit] = useState(row.terms.amount);
  const [recommendation, setRecommendation] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const begin = useBeginUnderwriting();
  const reject = useRejectUnderwriting();
  const flag = useFlagUnderwritingForManualReview();
  const cancel = useCancelRequest();
  const expire = useExpireRequest();
  const isPending = begin.isPending || reject.isPending || flag.isPending || cancel.isPending || expire.isPending;

  const handleConfirm = async () => {
    setError(null);
    try {
      if (mode === "begin") {
        if (!recommendation.trim()) {
          setError("Please provide a recommendation summary");
          return;
        }
        await begin.mutateAsync({ id: row.id, assessment: { score, riskCategory, recommendedLimit, recommendation } });
      } else if (mode === "reject") {
        if (reason.trim().length < 5) {
          setError("Please provide a more detailed rejection reason");
          return;
        }
        await reject.mutateAsync({ id: row.id, reason });
      } else if (mode === "flag") {
        if (note.trim().length < 5) {
          setError("Please provide a note explaining the escalation");
          return;
        }
        await flag.mutateAsync({ id: row.id, riskScore: score, riskLevel: riskCategory, note });
      } else if (mode === "cancel") {
        if (!reason.trim()) {
          setError("Please provide a cancellation reason");
          return;
        }
        await cancel.mutateAsync({ id: row.id, reason });
      } else {
        await expire.mutateAsync({ id: row.id, reason: reason || undefined });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${mode}`);
    }
  };

  const title = mode === "begin" ? "Qualify for Underwriting" : mode === "reject" ? "Reject Underwriting"
    : mode === "flag" ? "Flag for Manual Review" : mode === "cancel" ? "Cancel Request" : "Expire Request (SLA elapsed)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          {row.businessName} <span className="font-mono">({row.cacRegNumber})</span> -- requested {formatNaira(row.terms.amount)}
        </p>

        {mode === "begin" && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Risk Score (0-100)</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Recommended Limit (NGN)</label>
              <input type="number" value={recommendedLimit} onChange={(e) => setRecommendedLimit(Number(e.target.value))} className="input font-mono" />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Recommendation <span className="text-red-500">*</span>
              </label>
              <textarea rows={2} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} className="input resize-none" placeholder="Summary of the underwriting rationale..." />
            </div>
          </>
        )}

        {mode === "reject" && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none" placeholder="Why is this request being rejected before it reaches the FI?" />
          </div>
        )}

        {mode === "flag" && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Note <span className="text-red-500">*</span>
            </label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="input resize-none" placeholder="Why does this need a second look?" />
          </div>
        )}

        {mode === "cancel" && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Cancellation Reason <span className="text-red-500">*</span>
            </label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none" placeholder="Why is this request being cancelled?" />
          </div>
        )}

        {mode === "expire" && (
          <>
            <p className="text-xs text-amber-600 mb-3">Only valid once this request&apos;s SLA has elapsed -- the server rejects an early expiry.</p>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
              <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none" />
            </div>
          </>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={isPending} className={`flex-1 disabled:opacity-40 ${mode === "reject" || mode === "cancel" ? "btn-danger" : "btn-primary"}`}>
            {isPending ? "Submitting…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UnderwritingQueuePage() {
  const { data: requests, isLoading, isError } = useFinancingList();
  const [modal, setModal] = useState<ModalState | null>(null);

  if (isLoading) return <Layout title="Underwriting Queue"><FullPageLoader /></Layout>;
  if (isError || !requests) return <Layout title="Underwriting Queue"><ErrorState message="Failed to load underwriting queue" /></Layout>;

  // Phase 2, Forty-First Slice: widened to include "Underwriting" (already
  // qualified, awaiting the FI's decision) so Cancel/Expire -- valid across
  // the full OPEN_FINANCING_STATUSES range, not just the assessor's own
  // Qualify/Reject/Flag decision window -- have somewhere to reach those
  // rows too. canDecide/status-specific disabled checks on the other three
  // actions already correctly grey them out for "Underwriting" rows.
  const queue = requests.filter((r) => r.status === "Submitted" || r.status === "UnderwritingManualReview" || r.status === "Underwriting");
  const canCloseOut = (status: string) => status === "Submitted" || status === "Underwriting";

  return (
    <Layout title="Underwriting Queue">
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          Stage 6: requests awaiting an assessor&apos;s qualify/reject/flag decision, before they ever reach the financial institution.
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
                      <td className="font-mono text-xs text-gray-700">{req.cacRegNumber}</td>
                      <td className="text-xs text-gray-700">{formatNaira(req.terms.amount)}</td>
                      <td className="text-xs text-gray-600">{req.terms.purpose}</td>
                      <td><StatusBadge status={req.status} /></td>
                      <td>
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            title="Qualify for underwriting"
                            disabled={!canDecide(req.status)}
                            onClick={() => setModal({ mode: "begin", row: req })}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            title="Reject"
                            disabled={!canDecide(req.status)}
                            onClick={() => setModal({ mode: "reject", row: req })}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <XCircle size={14} />
                          </button>
                          <button
                            title="Flag for manual review"
                            disabled={req.status !== "Submitted"}
                            onClick={() => setModal({ mode: "flag", row: req })}
                            className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors text-gray-400 hover:text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Flag size={14} />
                          </button>
                          <button
                            title="Cancel request"
                            disabled={!canCloseOut(req.status)}
                            onClick={() => setModal({ mode: "cancel", row: req })}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Ban size={14} />
                          </button>
                          <button
                            title="Expire request (SLA elapsed)"
                            disabled={!canCloseOut(req.status)}
                            onClick={() => setModal({ mode: "expire", row: req })}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Clock size={14} />
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
  );
}
