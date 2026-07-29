"use client";

import { useState } from "react";
import { Gavel, AlertCircle, CheckCircle2, X } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { useDisputeRecords, useArbitrationRequests, useEscalateToArbitration, useRecordArbitrationOutcome, type DisputeRecordItem } from "@/lib/apiClient";

// Phase 2, eighth slice: vetify's dispute-resolution queue --
// EscalateToArbitration/RecordArbitrationOutcome are vetify's own authority
// in Daml (controller vetify on DisputeRecord/ArbitrationRequest -- see
// migrations/013_murabahah_restructuring_disputes.sql's header), distinct
// from RaiseDispute (business) and ApproveRestructuring/RejectRestructuring
// (financialInstitution, handled on /fi/contracts/[id] instead). The FI's
// own contract page shows disputes read-only with a pointer here.

const DISPUTE_TYPE_LABELS: Record<string, string> = {
  PaymentDispute: "Payment Dispute",
  ContractTermsDispute: "Contract Terms Dispute",
  AssetDefectDispute: "Asset Defect Dispute",
};

const ARBITRATION_OUTCOMES = [
  { value: "BusinessPrevails", label: "Business Prevails" },
  { value: "FIPrevails", label: "FI Prevails" },
  { value: "SettlementAgreed", label: "Settlement Agreed" },
];

function EscalateModal({ dispute, onClose }: { dispute: DisputeRecordItem; onClose: () => void }) {
  const [arbitrator, setArbitrator] = useState("");
  const [error, setError] = useState<string | null>(null);
  const escalate = useEscalateToArbitration();

  const handleConfirm = async () => {
    setError(null);
    if (!arbitrator.trim()) {
      setError("Please name an arbitrator");
      return;
    }
    try {
      await escalate.mutateAsync({ id: dispute.id, arbitrator });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to escalate to arbitration");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Escalate to Arbitration</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{dispute.description}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Arbitrator</label>
          <input className="input" placeholder="e.g. Lagos Chamber of Commerce Arbitration Centre" value={arbitrator} onChange={(e) => setArbitrator(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={escalate.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {escalate.isPending ? "Escalating…" : "Escalate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordOutcomeModal({ arbitrationId, arbitrator, onClose }: { arbitrationId: string; arbitrator: string; onClose: () => void }) {
  const [outcome, setOutcome] = useState("");
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recordOutcome = useRecordArbitrationOutcome();

  const handleConfirm = async () => {
    setError(null);
    if (!outcome || !resolution.trim()) {
      setError("Please select an outcome and provide a resolution summary");
      return;
    }
    try {
      await recordOutcome.mutateAsync({ id: arbitrationId, arbOutcome: outcome, arbResolution: resolution });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record arbitration outcome");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Record Arbitration Outcome</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Arbitrator: {arbitrator}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Outcome</label>
          <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">Select outcome…</option>
            {ARBITRATION_OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Resolution Summary</label>
          <textarea rows={3} className="input resize-none" value={resolution} onChange={(e) => setResolution(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={recordOutcome.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {recordOutcome.isPending ? "Recording…" : "Record Outcome"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VetifyDisputesPage() {
  const { data: disputes, isLoading, isError } = useDisputeRecords();
  const { data: arbitrations } = useArbitrationRequests();
  const [escalateModal, setEscalateModal] = useState<DisputeRecordItem | null>(null);
  const [outcomeModal, setOutcomeModal] = useState<{ id: string; arbitrator: string } | null>(null);

  if (isLoading) return <Layout title="Dispute Resolution"><FullPageLoader /></Layout>;
  if (isError || !disputes) return <Layout title="Dispute Resolution"><ErrorState message="Failed to load disputes" /></Layout>;

  const open = disputes.filter((d) => !d.archived);
  const escalated = (arbitrations ?? []).filter((a) => !a.outcome);
  const resolved = (arbitrations ?? []).filter((a) => a.outcome);

  return (
    <Layout title="Dispute Resolution">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800">Open Disputes</h2>
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{open.length}</span>
          </div>
          <div className="card overflow-hidden">
            {open.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No open disputes</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {open.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{d.businessName}</p>
                      <p className="text-xs text-gray-500 font-mono">{d.facilityRef}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {DISPUTE_TYPE_LABELS[d.disputeType] ?? d.disputeType}: {d.description}
                      </p>
                    </div>
                    <button onClick={() => setEscalateModal(d)} className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0">
                      Escalate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Gavel size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Under Arbitration</h2>
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-50 text-primary text-xs font-bold">{escalated.length}</span>
          </div>
          <div className="card overflow-hidden">
            {escalated.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No disputes under arbitration</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {escalated.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{a.businessName}</p>
                      <p className="text-xs text-gray-500">{a.disputeDescription}</p>
                      <p className="text-xs text-gray-400 mt-1">Arbitrator: {a.arbitrator}</p>
                    </div>
                    <button onClick={() => setOutcomeModal({ id: a.id, arbitrator: a.arbitrator })} className="btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                      Record Outcome
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {resolved.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <h2 className="text-sm font-semibold text-gray-800">Resolved</h2>
            </div>
            <div className="card overflow-hidden">
              <div className="divide-y divide-gray-100">
                {resolved.map((a) => (
                  <div key={a.id} className="p-4">
                    <p className="text-sm font-semibold text-gray-900">{a.businessName}</p>
                    <p className="text-xs text-gray-500">{a.disputeDescription}</p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {a.outcome} — {a.resolution}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {escalateModal && <EscalateModal dispute={escalateModal} onClose={() => setEscalateModal(null)} />}
      {outcomeModal && <RecordOutcomeModal arbitrationId={outcomeModal.id} arbitrator={outcomeModal.arbitrator} onClose={() => setOutcomeModal(null)} />}
    </Layout>
  );
}
