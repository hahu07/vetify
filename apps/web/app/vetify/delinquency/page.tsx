"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters";
import { useMurabahahContracts, useActiveSentinels, useFlagDelinquent, useResumeActive, useEndMoratorium, type MurabahahContract } from "@/lib/apiClient";

// Ported in spirit from frontend/src/pages/vetify/DelinquencyMonitoring.tsx --
// the real page also surfaces DirectDebit/GSM collections history (a
// separate procedural workflow, CLAUDE.md's Collections Agent) not built in
// this migration; this page covers only the sentinel's real delinquency
// decision (FlagDelinquent/ResumeActive), matching migrations/
// 008_murabahah_stage9_10.sql's scope.
//
// Phase 2, tenth slice adds EndMoratorium here (not on the FI's own contract
// page) -- it's `controller vetify` in the real Daml source (GrantMoratorium
// is financialInstitution; EndMoratorium is vetify), and this page already
// lists every Active/Delinquent contract, the natural place for the
// counterpart action. See
// migrations/015_murabahah_moratorium_hamish.sql's header for scope, and the
// eighth slice's writeup for why controller placement gets re-checked
// against the Daml source at UI-build time now, not just at domain-function
// time.

type ModalMode = "flag" | "resume";
interface ModalState {
  mode: ModalMode;
  contract: MurabahahContract;
}

function DelinquencyModal({ modal, sentinelId, onClose }: { modal: ModalState; sentinelId: number; onClose: () => void }) {
  const { mode, contract } = modal;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const flag = useFlagDelinquent();
  const resume = useResumeActive();
  const isPending = flag.isPending || resume.isPending;

  const handleConfirm = async () => {
    setError(null);
    if (text.trim().length < 5) {
      setError(mode === "flag" ? "Please provide a more detailed reason" : "Please provide a note");
      return;
    }
    try {
      if (mode === "flag") {
        await flag.mutateAsync({ id: contract.id, reason: text, sentinelId });
      } else {
        await resume.mutateAsync({ id: contract.id, note: text, sentinelId });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${mode}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{mode === "flag" ? "Flag as Delinquent" : "Resume to Active"}</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {contract.businessName} <span className="font-mono">({contract.facilityRef})</span> -- {formatNaira(contract.outstandingBalance)} outstanding
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {mode === "flag" ? "Reason" : "Note"} <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            className="input resize-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === "flag" ? "Two consecutive missed installments, no offsetting credit found..." : "Arrears cleared, business back on schedule..."}
          />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={isPending} className={`flex-1 disabled:opacity-40 ${mode === "flag" ? "btn-danger" : "btn-primary"}`}>
            {isPending ? "Submitting…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EndMoratoriumButton({ contractId }: { contractId: string }) {
  const endMoratorium = useEndMoratorium();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    if (note.trim().length < 5) {
      setError("Please provide a note");
      return;
    }
    try {
      await endMoratorium.mutateAsync({ id: contractId, note });
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end moratorium");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input className="input text-xs w-40" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <button onClick={handleClick} disabled={endMoratorium.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
        End Moratorium
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export default function DelinquencyMonitoringPage() {
  const { data: contracts, isLoading, isError } = useMurabahahContracts();
  const { data: sentinels } = useActiveSentinels();
  const [modal, setModal] = useState<ModalState | null>(null);

  if (isLoading) return <Layout title="Delinquency Monitoring"><FullPageLoader /></Layout>;
  if (isError || !contracts) return <Layout title="Delinquency Monitoring"><ErrorState message="Failed to load contracts" /></Layout>;

  // Mirrors the single-FI auto-select pattern from the Financing UI pass --
  // this system has exactly one registered sentinel in practice, so no
  // picker is offered; a genuinely multi-sentinel deployment would need one.
  const activeSentinel = sentinels?.find((s) => s.active);

  const active = contracts.filter((c) => c.status === "Active");
  const delinquent = contracts.filter((c) => c.status === "Delinquent" || c.status === "DelinquencyManualReview");

  if (!activeSentinel) {
    return (
      <Layout title="Delinquency Monitoring">
        <div className="card p-8 text-center">
          <AlertTriangle size={24} className="text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No active AuthorizedSentinel is registered -- FlagDelinquent/ResumeActive fail closed without one.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Delinquency Monitoring">
      <div className="space-y-6">
        {delinquent.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-500" />
              <h2 className="text-sm font-semibold text-gray-800">Delinquent / Under Review</h2>
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">{delinquent.length}</span>
            </div>
            <div className="space-y-3">
              {delinquent.map((c) => (
                <div key={c.id} className="card p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{c.businessName}</p>
                      <StatusBadge status={c.status} size="sm" />
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{c.facilityRef}</p>
                    {c.activeMoratorium && <p className="text-xs text-primary mt-0.5">Moratorium active until {formatDate(c.activeMoratorium)}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-mono text-gray-700">{formatNaira(c.outstandingBalance)}</span>
                    {c.activeMoratorium && <EndMoratoriumButton contractId={c.id} />}
                    {c.status !== "DelinquencyManualReview" && (
                      <button onClick={() => setModal({ mode: "resume", contract: c })} className="btn-primary text-xs px-3 py-1.5">
                        Resume Active
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-800">Active Contracts</h2>
          </div>
          <div className="card overflow-hidden">
            {active.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No active contracts</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {active.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.businessName}</p>
                      <p className="text-xs text-gray-500 font-mono">{c.facilityRef}</p>
                      {c.activeMoratorium && <p className="text-xs text-primary mt-0.5">Moratorium active until {formatDate(c.activeMoratorium)}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-mono text-gray-700">{formatNaira(c.outstandingBalance)}</span>
                      {c.activeMoratorium && <EndMoratoriumButton contractId={c.id} />}
                      <button onClick={() => setModal({ mode: "flag", contract: c })} className="btn-danger text-xs px-3 py-1.5">
                        Flag Delinquent
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {modal && <DelinquencyModal modal={modal} sentinelId={activeSentinel.id} onClose={() => setModal(null)} />}
    </Layout>
  );
}
