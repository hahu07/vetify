"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Flag, X, PencilLine, MessageSquareWarning } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import {
  useProviderOnboardings,
  useApprovedProviders,
  useRecordProviderScore,
  useFlagProviderForManualReview,
  useRequestProviderAmendment,
  useApproveProvider,
  useRejectProvider,
  type ProviderOnboarding,
  type RiskLevel,
  type FinancingInstrument,
} from "@/lib/apiClient";

// New page -- vetify's own review queue for Stage 0 (daml/Vetify/
// FinancingProvider.daml). Mirrors app/vetify/onboarding/page.tsx's
// review-modal shape (Stage 2's Approve/Reject/Flag), since
// FinancingProviderOnboarding follows the same Draft/UnderReview/
// ManualReview lifecycle -- but every action here is vetify-controlled
// (no separate verifier-equivalent party for Stage 0), so there's no
// per-role button split the way Stage 2's page has.

const REVIEWABLE = ["UnderReview", "ManualReview"];
const canDecide = (status: string) => REVIEWABLE.includes(status);
const canFlagOrAmend = (status: string) => status === "UnderReview";

type ModalMode = "score" | "approve" | "reject" | "flag" | "amend";
interface ModalState {
  mode: ModalMode;
  row: ProviderOnboarding;
}

function ReviewModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  const { mode, row } = modal;
  const [score, setScore] = useState(row.agentScore ?? 50);
  const [risk, setRisk] = useState<RiskLevel>(row.agentRisk ?? "Medium");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [approvedInstruments, setApprovedInstruments] = useState<FinancingInstrument[]>(row.declaredInstruments);
  const [error, setError] = useState<string | null>(null);

  const recordScore = useRecordProviderScore();
  const flag = useFlagProviderForManualReview();
  const requestAmendment = useRequestProviderAmendment();
  const approve = useApproveProvider();
  const reject = useRejectProvider();
  const isPending = recordScore.isPending || flag.isPending || requestAmendment.isPending || approve.isPending || reject.isPending;

  const toggleInstrument = (i: FinancingInstrument) => {
    setApprovedInstruments((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  const handleConfirm = async () => {
    setError(null);
    try {
      if (mode === "score") {
        await recordScore.mutateAsync({ id: row.id, score, risk, note: note || undefined, version: "manual" });
      } else if (mode === "flag") {
        if (note.trim().length < 5) { setError("Please provide a note explaining the escalation"); return; }
        await flag.mutateAsync({ id: row.id, score, risk, note });
      } else if (mode === "amend") {
        if (note.trim().length < 5) { setError("Please provide a note explaining what needs correcting"); return; }
        await requestAmendment.mutateAsync({ id: row.id, note });
      } else if (mode === "approve") {
        if (approvedInstruments.length === 0) { setError("Must approve at least one financing instrument"); return; }
        await approve.mutateAsync({ id: row.id, approvedInstruments });
      } else {
        if (reason.trim().length < 5) { setError("Please provide a more detailed rejection reason"); return; }
        await reject.mutateAsync({ id: row.id, reason });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${mode}`);
    }
  };

  const titles: Record<ModalMode, string> = {
    score: "Record Evaluation Score",
    approve: "Approve Provider",
    reject: "Reject Registration",
    flag: "Flag for Manual Review",
    amend: "Request Amendment",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{titles[mode]}</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {row.providerName} <span className="font-mono">({row.cacRegNumber})</span>
        </p>

        {(mode === "score" || mode === "flag") && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Score (0–100)</label>
              <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} className="input font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Risk Level</label>
              <select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)} className="input">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
        )}

        {mode === "approve" && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Approved Instruments (may be a subset of declared)</label>
            <div className="flex flex-wrap gap-2">
              {row.declaredInstruments.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleInstrument(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    approvedInstruments.includes(i) ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "reject" && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none" placeholder="Why is this registration being rejected?" />
          </div>
        )}

        {(mode === "flag" || mode === "amend" || mode === "score") && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">Note {mode !== "score" && <span className="text-red-500">*</span>}</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="input resize-none" placeholder={mode === "amend" ? "What needs to be corrected?" : "Reasoning (optional for a recorded score)"} />
          </div>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleConfirm} disabled={isPending} className={`flex-1 flex items-center justify-center gap-2 disabled:opacity-40 ${mode === "reject" ? "btn-danger" : "btn-primary"}`}>
            {isPending ? "Submitting…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApprovedProvidersSection() {
  const { data: approved, isLoading } = useApprovedProviders();
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Approved Providers</h2>
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : !approved || approved.length === 0 ? (
        <p className="text-xs text-gray-400">No providers approved yet</p>
      ) : (
        <table className="table">
          <thead><tr><th>Provider</th><th>Type</th><th>Instruments</th><th>Approved</th></tr></thead>
          <tbody>
            {approved.map((p) => (
              <tr key={p.id}>
                <td className="text-xs font-medium text-gray-900">{p.providerName}</td>
                <td className="text-xs text-gray-600">{p.providerType}</td>
                <td className="text-xs text-gray-600">{p.approvedInstruments.join(", ")}</td>
                <td className="text-xs text-gray-500">{new Date(p.approvedAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ProvidersPage() {
  const { data, isLoading, isError } = useProviderOnboardings();
  const [modal, setModal] = useState<ModalState | null>(null);
  const providers = data ?? [];

  if (isLoading) return <Layout title="Provider Registrations"><p className="text-sm text-gray-500">Loading…</p></Layout>;
  if (isError) return <Layout title="Provider Registrations"><p className="text-sm text-red-600">Failed to load provider registrations</p></Layout>;

  return (
    <Layout title="Provider Registrations">
      <div className="space-y-5 animate-fade-in">
        <div className="card overflow-hidden">
          {providers.length === 0 ? (
            <div className="py-16 text-center"><p className="text-sm text-gray-400">No provider registrations yet</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Provider</th><th>Type</th><th>CAC No</th><th>Score</th><th>Status</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <p className="font-medium text-gray-900 text-xs">{p.providerName}</p>
                        <p className="text-gray-400 text-xs font-mono mt-0.5">#{p.id}</p>
                      </td>
                      <td className="text-xs text-gray-600">{p.providerType}</td>
                      <td className="font-mono text-xs text-gray-700">{p.cacRegNumber}</td>
                      <td>
                        {p.agentScore != null ? (
                          <span className="text-xs font-semibold text-gray-700">{p.agentScore} ({p.agentRisk})</span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td><StatusBadge status={p.status} size="sm" /></td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button title="Record score" disabled={p.status !== "UnderReview"} onClick={() => setModal({ mode: "score", row: p })} className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed">
                            <PencilLine size={14} />
                          </button>
                          <button title={canFlagOrAmend(p.status) ? "Flag for manual review" : "Can only flag from Under Review"} disabled={!canFlagOrAmend(p.status)} onClick={() => setModal({ mode: "flag", row: p })} className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors text-gray-400 hover:text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed">
                            <Flag size={14} />
                          </button>
                          <button title={canFlagOrAmend(p.status) ? "Request amendment" : "Can only request amendment from Under Review"} disabled={!canFlagOrAmend(p.status)} onClick={() => setModal({ mode: "amend", row: p })} className="p-1.5 rounded-lg hover:bg-orange-50 transition-colors text-gray-400 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed">
                            <MessageSquareWarning size={14} />
                          </button>
                          <button title={canDecide(p.status) ? "Approve" : "Can only approve from Under Review or Manual Review"} disabled={!canDecide(p.status)} onClick={() => setModal({ mode: "approve", row: p })} className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed">
                            <CheckCircle2 size={14} />
                          </button>
                          <button title={canDecide(p.status) ? "Reject" : "Can only reject from Under Review or Manual Review"} disabled={!canDecide(p.status)} onClick={() => setModal({ mode: "reject", row: p })} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed">
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

        <ApprovedProvidersSection />
      </div>

      {modal && <ReviewModal modal={modal} onClose={() => setModal(null)} />}
    </Layout>
  );
}
