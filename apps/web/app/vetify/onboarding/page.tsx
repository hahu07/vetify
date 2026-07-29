"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Flag, X, ChevronDown, ChevronUp } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useOnboardingList,
  useApproveOnboarding,
  useRejectOnboarding,
  useFlagOnboardingForManualReview,
  useApprovedBusinesses,
  useVerificationResults,
} from "@/lib/apiClient";
import type { Onboarding, VerificationChecks, RiskLevel } from "@/lib/apiClient";

// Ported from frontend/src/pages/vetify/VetifyOnboarding.tsx. Dropped for
// this Phase 1 slice (no backend support): RequestAmendment/EscalateOverdue
// modals, DocumentsModal, and ApprovedBusinessesSection/
// VerificationResultsSection's Suspend/Reinstate/Expire/Revoke/Recertify/
// Supersede actions (none of those choices exist in this slice's backend --
// see migrations/001_stage1_4_vertical_slice.sql's scope note). The
// read-only audit-trail sections are kept, just without action buttons.

const DEFAULT_CHECKS: VerificationChecks = {
  identityVerified: false,
  cacRegistered: false,
  documentsValid: false,
  dataConsistent: false,
};

const CHECK_LABELS: [keyof VerificationChecks, string][] = [
  ["identityVerified", "Identity Verified (NIN/BVN)"],
  ["cacRegistered", "CAC Registration Confirmed"],
  ["documentsValid", "Documents Valid"],
  ["dataConsistent", "Data Consistent"],
];

type FilterTab = "All" | "Draft" | "UnderReview" | "ManualReview";
const TABS: FilterTab[] = ["All", "Draft", "UnderReview", "ManualReview"];
const TAB_LABELS: Record<FilterTab, string> = {
  All: "All", Draft: "Draft", UnderReview: "Under Review", ManualReview: "Manual Review",
};

const canDecide = (status: string) => status === "UnderReview" || status === "ManualReview";
const canFlag = (status: string) => status === "UnderReview";

type ModalMode = "approve" | "reject" | "flag";
interface ModalState {
  mode: ModalMode;
  row: Onboarding;
}

function ReviewModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  const { mode, row } = modal;
  const [checks, setChecks] = useState<VerificationChecks>(DEFAULT_CHECKS);
  const [riskScore, setRiskScore] = useState(row.agentScore ?? 50);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(row.agentRisk ?? "Medium");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const approve = useApproveOnboarding();
  const reject = useRejectOnboarding();
  const flag = useFlagOnboardingForManualReview();
  const isPending = approve.isPending || reject.isPending || flag.isPending;

  const handleConfirm = async () => {
    setError(null);
    try {
      if (mode === "approve") {
        await approve.mutateAsync({ id: row.id, checks, riskScore, riskLevel, verificationRef: `VER-${Date.now()}` });
      } else if (mode === "reject") {
        if (reason.trim().length < 5) {
          setError("Please provide a more detailed rejection reason");
          return;
        }
        await reject.mutateAsync({ id: row.id, checks, riskScore, riskLevel, verificationRef: `VER-${Date.now()}`, reason });
      } else {
        if (note.trim().length < 5) {
          setError("Please provide a note explaining the escalation");
          return;
        }
        await flag.mutateAsync({ id: row.id, riskScore, riskLevel, note });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${mode} application`);
    }
  };

  const title = mode === "approve" ? "Approve Verification" : mode === "reject" ? "Reject Application" : "Flag for Manual Review";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {row.profile.name} <span className="font-mono">({row.kyc.cacRegNumber})</span>
        </p>

        {(mode === "approve" || mode === "reject") && (
          <>
            <div className="space-y-1 mb-4">
              {CHECK_LABELS.map(([key, label]) => (
                <label key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 cursor-pointer">
                  <span className="text-sm text-gray-700">{label}</span>
                  <input type="checkbox" className="w-4 h-4 accent-primary" checked={checks[key]} onChange={(e) => setChecks((prev) => ({ ...prev, [key]: e.target.checked }))} />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Risk Score (0–100)</label>
                <input type="number" min={0} max={100} value={riskScore} onChange={(e) => setRiskScore(Number(e.target.value))} className="input font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Risk Level</label>
                <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as RiskLevel)} className="input">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
          </>
        )}

        {mode === "reject" && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none" placeholder="State the verification reason for rejection..." />
          </div>
        )}

        {mode === "flag" && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">Note <span className="text-red-500">*</span></label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="input resize-none" placeholder="Why is this being escalated for manual review?" />
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

function ApprovedBusinessesSection() {
  const [open, setOpen] = useState(false);
  const { data: businesses, isLoading } = useApprovedBusinesses();
  return (
    <div className="card p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Approved Businesses</h2>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        isLoading ? <p className="text-xs text-gray-400 mt-2">Loading…</p>
        : (businesses ?? []).length === 0 ? <p className="text-xs text-gray-400 mt-2">No approved businesses yet</p>
        : (
          <table className="table mt-2">
            <thead><tr><th>Business</th><th>CAC No</th><th>Approved</th><th>Status</th></tr></thead>
            <tbody>
              {(businesses ?? []).map((b) => (
                <tr key={b.id}>
                  <td className="text-xs font-medium text-gray-900">{b.businessName}</td>
                  <td className="font-mono text-xs text-gray-700">{b.cacRegNumber}</td>
                  <td className="text-xs text-gray-500">{new Date(b.approvedAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td><StatusBadge status={b.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

function VerificationResultsSection() {
  const [open, setOpen] = useState(false);
  const { data: results, isLoading } = useVerificationResults();
  return (
    <div className="card p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Verification Results (Stage 2 audit trail)</h2>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        isLoading ? <p className="text-xs text-gray-400 mt-2">Loading…</p>
        : (results ?? []).length === 0 ? <p className="text-xs text-gray-400 mt-2">No verification results yet</p>
        : (
          <table className="table mt-2">
            <thead><tr><th>Business</th><th>CAC No</th><th>Outcome</th><th>Risk</th><th>Decided</th></tr></thead>
            <tbody>
              {(results ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="text-xs font-medium text-gray-900">{r.businessName}</td>
                  <td className="font-mono text-xs text-gray-700">{r.cacRegNumber}</td>
                  <td><StatusBadge status={r.outcome} size="sm" /></td>
                  <td className="text-xs text-gray-600">{r.riskScore} ({r.riskLevel})</td>
                  <td className="text-xs text-gray-500">{new Date(r.decidedAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

export default function VetifyOnboarding() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [modal, setModal] = useState<ModalState | null>(null);
  const { data: onboardingData, isLoading, isError } = useOnboardingList();
  const onboarding = onboardingData ?? [];

  const filtered: Onboarding[] = activeTab === "All" ? onboarding : onboarding.filter((o) => o.status === activeTab);

  if (isLoading) return <Layout title="Onboarding Pipeline"><p className="text-sm text-gray-500">Loading…</p></Layout>;
  if (isError) return <Layout title="Onboarding Pipeline"><p className="text-sm text-red-600">Failed to load onboarding pipeline</p></Layout>;

  return (
    <Layout title="Onboarding Pipeline">
      <div className="space-y-5 animate-fade-in">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const count = tab === "All" ? onboarding.length : onboarding.filter((o) => o.status === tab).length;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? "#0D6E4D" : "#fff",
                  color: isActive ? "#fff" : "#6B7280",
                  border: isActive ? "none" : "1px solid #E5E7EB",
                }}
              >
                {TAB_LABELS[tab]}
                {count > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold" style={{ backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "#F3F4F6", color: isActive ? "#fff" : "#6B7280", fontSize: 10 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center"><p className="text-sm text-gray-400">No businesses in this category</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Business Name</th><th>Type</th><th>CAC No</th><th>Director</th><th>Agent Score</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <p className="font-medium text-gray-900 text-xs">{o.profile.name}</p>
                        <p className="text-gray-400 text-xs font-mono mt-0.5">#{o.id}</p>
                      </td>
                      <td><span className="text-xs text-gray-600">{o.profile.businessType === "LimitedCompany" ? "Limited Co." : "Sole Prop."}</span></td>
                      <td><span className="font-mono text-xs text-gray-700">{o.kyc.cacRegNumber}</span></td>
                      <td><p className="text-xs text-gray-700">{o.profile.directors[0]?.name ?? "—"}</p></td>
                      <td>
                        {o.agentScore != null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-10 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${o.agentScore}%`, backgroundColor: o.agentScore >= 80 ? "#10B981" : o.agentScore >= 50 ? "#F59E0B" : "#EF4444" }} />
                            </div>
                            <span className="text-xs font-semibold text-gray-700">{o.agentScore}</span>
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td><StatusBadge status={o.status} size="sm" /></td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {user?.realRole === "verifier" && (
                            <>
                              <button title={canDecide(o.status) ? "Approve" : "Can only approve from Under Review or Manual Review"} disabled={!canDecide(o.status)} onClick={() => setModal({ mode: "approve", row: o })} className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed">
                                <CheckCircle2 size={14} />
                              </button>
                              <button title={canDecide(o.status) ? "Reject" : "Can only reject from Under Review or Manual Review"} disabled={!canDecide(o.status)} onClick={() => setModal({ mode: "reject", row: o })} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed">
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {user?.realRole === "vetify" && (
                            <button title={canFlag(o.status) ? "Flag for manual review" : "Can only flag from Under Review"} disabled={!canFlag(o.status)} onClick={() => setModal({ mode: "flag", row: o })} className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors text-gray-400 hover:text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed">
                              <Flag size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ApprovedBusinessesSection />
        <VerificationResultsSection />
      </div>

      {modal && <ReviewModal modal={modal} onClose={() => setModal(null)} />}
    </Layout>
  );
}
