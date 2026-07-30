"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, X, FileEdit } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira } from "@/lib/formatters";
import {
  useFinancingList, useFinancingDecisions, useApproveFunding, useRejectFunding, type FinancingRequest,
  useApprovedProviders, useOfficers,
  useProposeAmendment, useFundingGovernanceRecords, useRecordGovernanceAssessment,
  type FinancingDecisionItem,
} from "@/lib/apiClient";

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
  const [approvedProviderId, setApprovedProviderId] = useState("");
  const [approvingOfficerId, setApprovingOfficerId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: approvedProviders } = useApprovedProviders();
  const { data: officers } = useOfficers();
  const approve = useApproveFunding();
  const reject = useRejectFunding();
  const isPending = approve.isPending || reject.isPending;

  // Stage 0 gate: only providers approved for Murabahah, and only active
  // CreditOfficer-role officers, are selectable here -- mirrors the checks
  // lib/domain/financing.ts's approveFundingImpl enforces server-side.
  const murabahahProviders = (approvedProviders ?? []).filter((p) => p.approvedInstruments.includes("Murabahah"));
  const creditOfficers = (officers ?? []).filter((o) => o.active && o.roles.includes("CreditOfficer"));

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
        if (!approvedProviderId || !approvingOfficerId) {
          setError("Please select an approved provider and an approving credit officer");
          return;
        }
        const officer = creditOfficers.find((o) => o.officer_id === approvingOfficerId);
        await approve.mutateAsync({
          id: row.id,
          assetDetails: { description, supplier, supplierRef, estimatedCost },
          approvedProviderId,
          approvingOfficerId,
          approvedByName: officer?.officer_name ?? approvingOfficerId,
        });
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
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Approved Provider <span className="text-red-500">*</span>
                </label>
                <select className="input text-sm" value={approvedProviderId} onChange={(e) => setApprovedProviderId(e.target.value)}>
                  <option value="">Select…</option>
                  {murabahahProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.providerName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Approving Credit Officer <span className="text-red-500">*</span>
                </label>
                <select className="input text-sm" value={approvingOfficerId} onChange={(e) => setApprovingOfficerId(e.target.value)}>
                  <option value="">Select…</option>
                  {creditOfficers.map((o) => (
                    <option key={o.officer_id} value={o.officer_id}>
                      {o.officer_name}
                    </option>
                  ))}
                </select>
              </div>
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

// Phase 2, Forty-First Slice: ProposeAmendment (nonconsuming -- the original
// request stays active while the business decides) and
// RecordGovernanceAssessment (a side-record on an already-decided
// FinancingDecision, not a new decision itself).

function ProposeAmendmentModal({ row, onClose }: { row: FinancingRequest; onClose: () => void }) {
  const [amount, setAmount] = useState(row.terms.amount);
  const [purpose, setPurpose] = useState(row.terms.purpose);
  const [tenureMonths, setTenureMonths] = useState(row.terms.tenureMonths);
  const [proposalNote, setProposalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const propose = useProposeAmendment();

  const handleSubmit = async () => {
    setError(null);
    if (amount <= 0 || tenureMonths <= 0) {
      setError("Amount and tenure must be positive");
      return;
    }
    try {
      await propose.mutateAsync({ id: row.id, proposedTerms: { amount, purpose, tenureMonths }, proposalNote: proposalNote || null });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to propose the amendment");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Propose Amendment</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {row.businessName} <span className="font-mono">({row.cacRegNumber})</span> -- current: {formatNaira(row.terms.amount)} / {row.terms.tenureMonths} months
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Proposed Amount (NGN)</label>
          <input type="number" className="input text-sm font-mono" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Proposed Purpose</label>
          <textarea rows={2} className="input text-sm resize-none" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Proposed Tenure (months)</label>
          <input type="number" className="input text-sm font-mono" value={tenureMonths} onChange={(e) => setTenureMonths(Number(e.target.value))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label>
          <textarea rows={2} className="input text-sm resize-none" value={proposalNote} onChange={(e) => setProposalNote(e.target.value)} placeholder="Why is this amendment being proposed?" />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={propose.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {propose.isPending ? "Proposing…" : "Propose Amendment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GovernanceAssessmentModal({ decision, onClose }: { decision: FinancingDecisionItem; onClose: () => void }) {
  const [aiRecommendationFollowed, setAiRecommendationFollowed] = useState(true);
  const [governanceNote, setGovernanceNote] = useState("");
  const [assessedBy, setAssessedBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const record = useRecordGovernanceAssessment();

  const handleSubmit = async () => {
    setError(null);
    if (!assessedBy.trim()) {
      setError("Please name the governance assessor");
      return;
    }
    try {
      await record.mutateAsync({ id: decision.id, aiRecommendationFollowed, governanceNote: governanceNote || null, assessedBy });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record the governance assessment");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Record Governance Assessment</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{decision.businessName} <span className="font-mono">({decision.cacRegNumber})</span></p>
        <div className="mb-3">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
            <input type="checkbox" checked={aiRecommendationFollowed} onChange={(e) => setAiRecommendationFollowed(e.target.checked)} />
            AI recommendation was followed
          </label>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Governance Note (optional)</label>
          <textarea rows={2} className="input text-sm resize-none" value={governanceNote} onChange={(e) => setGovernanceNote(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Assessed By</label>
          <input className="input text-sm" value={assessedBy} onChange={(e) => setAssessedBy(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={record.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {record.isPending ? "Recording…" : "Record Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FiFinancingPage() {
  const { data: requests, isLoading, isError } = useFinancingList();
  const { data: decisions } = useFinancingDecisions();
  const { data: governanceRecords } = useFundingGovernanceRecords();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [amendmentModal, setAmendmentModal] = useState<FinancingRequest | null>(null);
  const [governanceModal, setGovernanceModal] = useState<FinancingDecisionItem | null>(null);

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
                          <button
                            title="Propose amendment"
                            onClick={() => setAmendmentModal(req)}
                            className="p-1.5 rounded-lg hover:bg-primary-50 transition-colors text-gray-400 hover:text-primary"
                          >
                            <FileEdit size={14} />
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
              {decisions.map((d) => {
                const assessed = governanceRecords?.find((g) => g.financingDecisionId === d.id);
                return (
                  <div key={d.id} className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-surface border border-gray-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{d.businessName}</span>
                        <StatusBadge status={d.outcome} size="sm" />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">{d.cacRegNumber}</p>
                      {d.reason && <p className="text-xs text-gray-500 mt-0.5">{d.reason}</p>}
                    </div>
                    {assessed ? (
                      <span className="text-xs text-gray-400 flex-shrink-0">Assessed by {assessed.assessedBy}</span>
                    ) : (
                      <button onClick={() => setGovernanceModal(d)} className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0">
                        Record Governance Assessment
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {modal && <DecisionModal modal={modal} onClose={() => setModal(null)} />}
      {amendmentModal && <ProposeAmendmentModal row={amendmentModal} onClose={() => setAmendmentModal(null)} />}
      {governanceModal && <GovernanceAssessmentModal decision={governanceModal} onClose={() => setGovernanceModal(null)} />}
    </Layout>
  );
}
