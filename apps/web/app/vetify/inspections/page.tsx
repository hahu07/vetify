"use client";

import { useState } from "react";
import { ClipboardCheck, Clock, X } from "lucide-react";
import Layout from "@/components/Layout";
import { formatDate } from "@/lib/formatters";
import {
  useRegulatoryInspectionRequests,
  useCreateRegulatoryInspectionRequest,
  useExtendDeadline,
  useInspectionResponses,
  useCloseInspection,
  useInspectionRecords,
  type RegulatoryInspectionRequestItem,
  type InspectionResponseItem,
} from "@/lib/apiClient";

// New page -- Phase 2, Forty-Third Slice. RegulatoryInspectionRequest is a
// vetify-initiated compliance audit of the financial institution itself
// (RespondToInspection's controller is financialInstitution, not a
// business) -- vetify creates the request and extends its deadline here;
// the FI's own response lives on /fi/inspections instead, mirroring the
// financing/underwriting split of authority elsewhere in this migration.
// CloseInspection (vetify, after the FI has responded) closes out the
// InspectionResponse with findings.

function CreateInspectionModal({ onClose }: { onClose: () => void }) {
  const [cacRegNumber, setCacRegNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [inspectionRef, setInspectionRef] = useState(`INSP-${Date.now()}`);
  const [inspectionScope, setInspectionScope] = useState("");
  const [responseDeadline, setResponseDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateRegulatoryInspectionRequest();

  const handleSubmit = async () => {
    setError(null);
    if (!cacRegNumber.trim() || !businessName.trim() || !inspectionScope.trim() || !responseDeadline) {
      setError("All fields are required");
      return;
    }
    try {
      await create.mutateAsync({ cacRegNumber, businessName, inspectionRef, inspectionScope, responseDeadline });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the inspection request");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Regulatory Inspection</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">CAC Registration Number (institution)</label>
          <input className="input text-sm font-mono" value={cacRegNumber} onChange={(e) => setCacRegNumber(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Business Name</label>
          <input className="input text-sm" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Inspection Reference</label>
          <input className="input text-sm font-mono" value={inspectionRef} onChange={(e) => setInspectionRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Inspection Scope</label>
          <textarea rows={2} className="input text-sm resize-none" value={inspectionScope} onChange={(e) => setInspectionScope(e.target.value)} placeholder="AML/KYC controls, Q3 2026" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Response Deadline</label>
          <input type="date" className="input text-sm" value={responseDeadline} onChange={(e) => setResponseDeadline(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtendDeadlineModal({ request, onClose }: { request: RegulatoryInspectionRequestItem; onClose: () => void }) {
  const [newDeadline, setNewDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const extend = useExtendDeadline();

  const handleSubmit = async () => {
    setError(null);
    if (!newDeadline) {
      setError("Please select a new deadline");
      return;
    }
    try {
      await extend.mutateAsync({ id: request.id, newDeadline });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to extend the deadline");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Extend Response Deadline</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-1 font-mono">{request.inspectionRef}</p>
        <p className="text-xs text-gray-500 mb-4">Current deadline: {formatDate(request.responseDeadline)} — the new date must be later.</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">New Deadline</label>
          <input type="date" className="input text-sm" min={request.responseDeadline.slice(0, 10)} value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={extend.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {extend.isPending ? "Extending…" : "Extend Deadline"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseInspectionModal({ response, onClose }: { response: InspectionResponseItem; onClose: () => void }) {
  const [findings, setFindings] = useState("");
  const [passed, setPassed] = useState(true);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [closingNote, setClosingNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = useCloseInspection();

  const handleSubmit = async () => {
    setError(null);
    if (!closingNote.trim()) {
      setError("Please provide a closing note");
      return;
    }
    try {
      await close.mutateAsync({
        id: response.id,
        findings: findings.split(",").map((s) => s.trim()).filter(Boolean),
        passed, followUpNeeded, closingNote,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close the inspection");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Close Inspection</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{response.inspectionRef}</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Findings (comma-separated)</label>
          <textarea rows={2} className="input text-sm resize-none" value={findings} onChange={(e) => setFindings(e.target.value)} />
        </div>
        <div className="mb-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
            <input type="checkbox" checked={passed} onChange={(e) => setPassed(e.target.checked)} />
            Passed
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
            <input type="checkbox" checked={followUpNeeded} onChange={(e) => setFollowUpNeeded(e.target.checked)} />
            Follow-up needed
          </label>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Closing Note</label>
          <textarea rows={2} className="input text-sm resize-none" value={closingNote} onChange={(e) => setClosingNote(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={close.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {close.isPending ? "Closing…" : "Close Inspection"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VetifyInspectionsPage() {
  const { data: requests } = useRegulatoryInspectionRequests();
  const { data: responses } = useInspectionResponses();
  const { data: records } = useInspectionRecords();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [extendModal, setExtendModal] = useState<RegulatoryInspectionRequestItem | null>(null);
  const [closeModal, setCloseModal] = useState<InspectionResponseItem | null>(null);

  // RespondToInspection is consuming (archives the request), so a request
  // that's been responded to already drops out of this filter naturally --
  // no separate "responded" check needed alongside archivedAt.
  const openRequests = (requests ?? []).filter((r) => !r.archivedAt);
  const recordedResponseIds = new Set((records ?? []).map((r) => r.inspectionResponseId));
  const pendingResponses = (responses ?? []).filter((r) => !r.archivedAt && !recordedResponseIds.has(r.id));

  return (
    <Layout title="Regulatory Inspections">
      <div className="space-y-6">
        <p className="text-xs text-gray-500">
          Compliance audits of the financial institution itself — vetify opens the request and closes it out; the institution
          responds on its own page.
        </p>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Open Requests</h2>
            </div>
            <button onClick={() => setCreateModalOpen(true)} className="btn-primary text-xs px-3 py-1.5">New Inspection</button>
          </div>
          <div className="card overflow-hidden">
            {openRequests.length === 0 ? (
              <div className="py-10 text-center"><p className="text-sm text-gray-400">No open inspection requests</p></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {openRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 font-mono">{r.inspectionRef}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.businessName} · {r.inspectionScope}</p>
                      <p className="text-xs text-gray-600 mt-0.5">Deadline: {formatDate(r.responseDeadline)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setExtendModal(r)} className="btn-secondary text-xs px-3 py-1.5">
                        <Clock size={12} className="inline mr-1" />Extend
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {pendingResponses.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Responses Awaiting Closure</h2>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {pendingResponses.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 font-mono">{r.inspectionRef}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.businessName} · Responded by {r.respondedByName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{formatDate(r.responseDate)}</p>
                  </div>
                  <button onClick={() => setCloseModal(r)} className="btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                    Close Inspection
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(records ?? []).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Closed Inspections</h2>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {(records ?? []).map((rec) => (
                <div key={rec.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 font-mono">{rec.inspectionRef}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{rec.businessName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{rec.closingNote}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rec.passed ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                      {rec.passed ? "Passed" : "Failed"}
                    </span>
                    {rec.followUpNeeded && <p className="text-xs text-amber-600 mt-1">Follow-up needed</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {createModalOpen && <CreateInspectionModal onClose={() => setCreateModalOpen(false)} />}
      {extendModal && <ExtendDeadlineModal request={extendModal} onClose={() => setExtendModal(null)} />}
      {closeModal && <CloseInspectionModal response={closeModal} onClose={() => setCloseModal(null)} />}
    </Layout>
  );
}
