"use client";

import { useState } from "react";
import { ClipboardCheck, X } from "lucide-react";
import Layout from "@/components/Layout";
import { formatDate } from "@/lib/formatters";
import {
  useRegulatoryInspectionRequests,
  useRespondToInspection,
  useInspectionResponses,
  useInspectionRecords,
  type RegulatoryInspectionRequestItem,
} from "@/lib/apiClient";

// New page -- Phase 2, Forty-Third Slice. RespondToInspection's Daml
// controller is financialInstitution alone -- vetify opens and closes the
// regulatory inspection (/vetify/inspections), but only the institution
// being inspected can submit its own response.

function RespondModal({ request, onClose }: { request: RegulatoryInspectionRequestItem; onClose: () => void }) {
  const [responseRef, setResponseRef] = useState(`RESP-${Date.now()}`);
  const [respondedByName, setRespondedByName] = useState("");
  const [responseDate, setResponseDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const respond = useRespondToInspection();

  const handleSubmit = async () => {
    setError(null);
    if (!responseRef.trim() || !respondedByName.trim()) {
      setError("Response reference and responder name are required");
      return;
    }
    try {
      await respond.mutateAsync({ id: request.id, responseRef, respondedByName, responseDate, documents: [] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit the response");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Respond to Inspection</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{request.inspectionScope}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Response Reference</label>
          <input className="input text-sm font-mono" value={responseRef} onChange={(e) => setResponseRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Responded By</label>
          <input className="input text-sm" value={respondedByName} onChange={(e) => setRespondedByName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Response Date</label>
          <input type="date" className="input text-sm" value={responseDate} onChange={(e) => setResponseDate(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={respond.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {respond.isPending ? "Submitting…" : "Submit Response"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FiInspectionsPage() {
  const { data: requests, isLoading, isError } = useRegulatoryInspectionRequests();
  const { data: responses } = useInspectionResponses();
  const { data: records } = useInspectionRecords();
  const [respondModal, setRespondModal] = useState<RegulatoryInspectionRequestItem | null>(null);

  if (isLoading) return <Layout title="Regulatory Inspections"><div className="p-8 text-center text-sm text-gray-400">Loading…</div></Layout>;
  if (isError || !requests) return <Layout title="Regulatory Inspections"><div className="p-8 text-center text-sm text-red-500">Failed to load inspection requests</div></Layout>;

  const pendingRequests = requests.filter((r) => !r.archivedAt);
  const recordedResponseIds = new Set((records ?? []).map((r) => r.inspectionResponseId));
  const myResponses = (responses ?? []).filter((r) => !recordedResponseIds.has(r.id));

  return (
    <Layout title="Regulatory Inspections">
      <div className="space-y-6">
        <p className="text-xs text-gray-500">
          Compliance audits opened against this institution by vetify. Submitting a response archives the request; vetify closes
          the inspection out with findings afterward.
        </p>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Pending Requests</h2>
          </div>
          <div className="card overflow-hidden">
            {pendingRequests.length === 0 ? (
              <div className="py-10 text-center"><p className="text-sm text-gray-400">No pending inspection requests</p></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 font-mono">{r.inspectionRef}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.inspectionScope}</p>
                      <p className="text-xs text-gray-600 mt-0.5">Deadline: {formatDate(r.responseDeadline)}</p>
                    </div>
                    <button onClick={() => setRespondModal(r)} className="btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                      Respond
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {myResponses.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Awaiting Closure</h2>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {myResponses.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 font-mono">{r.inspectionRef}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Responded {formatDate(r.responseDate)} by {r.respondedByName}</p>
                  </div>
                  <span className="text-xs text-amber-600 flex-shrink-0">Pending vetify closure</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {respondModal && <RespondModal request={respondModal} onClose={() => setRespondModal(null)} />}
    </Layout>
  );
}
