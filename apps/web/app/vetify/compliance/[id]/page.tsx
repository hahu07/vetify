"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Building, User, FileSearch, ShieldAlert } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useComplianceQueue,
  useOnboardingList,
  useApproveCompliance,
  useRejectCompliance,
  useFlagComplianceForManualReview,
  useStartReview,
  useReviewers,
  useEddCases,
  useOpenEddCase,
  useUpdateEddChecklist,
  useCloseEddCase,
  type EddCaseEntry,
} from "@/lib/apiClient";
import type { ComplianceCheck, RiskLevel } from "@/lib/apiClient";

// Trimmed port of frontend/src/pages/compliance/ComplianceReview.tsx. Dropped
// for this Phase 1 slice (no backend support): assign/reassign officer,
// Shariah verdict Supersede, EscalateOverdue -- none of those choices exist
// in this slice's backend (see migrations/001_stage1_4_vertical_slice.sql's
// scope note). The RiskGauge, business-info panel, and reviewer checklist +
// approve/reject/flag actions are kept. EDD case management (G14, Twentieth
// Slice) was added back in once its backend landed (Seventeenth Slice).

function RiskGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#059669" : score >= 50 ? "#D97706" : "#DC2626";
  const label = score >= 80 ? "Low Risk" : score >= 50 ? "Medium Risk" : "High Risk";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono" style={{ color }}>{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

const DEFAULT_CHECKS: ComplianceCheck = { shariahCompliant: false, amlCleared: false, kycValidated: false, cddCompleted: false };

// G14 (Seventeenth/Twentieth Slice): OpenEddCase is vetify-controlled and
// nonconsuming (doesn't itself change status); UpdateEddChecklist/
// CloseEddCase are verifier-controlled. A review has at most one live EDD
// case in practice (nothing in this UI re-opens a closed one), so this
// section renders either an "open a case" action or the one case's
// checklist, never a list.
function EddCaseSection({ reviewId, realRole }: { reviewId: string; realRole?: string }) {
  const { data: allCases } = useEddCases();
  const openCase = useOpenEddCase();
  const updateChecklist = useUpdateEddChecklist();
  const closeCase = useCloseEddCase();
  const { user } = useAuth();

  const [showOpen, setShowOpen] = useState(false);
  const [triggerReason, setTriggerReason] = useState("");
  const [sourceOfWealthNote, setSourceOfWealthNote] = useState("");
  const [seniorManagementSignoff, setSeniorManagementSignoff] = useState("");
  const [monitoringFrequency, setMonitoringFrequency] = useState("");
  const [error, setError] = useState<string | null>(null);

  const eddCase: EddCaseEntry | undefined = (allCases ?? []).find((c) => String(c.compliance_review_id) === reviewId);

  const handleOpen = async () => {
    setError(null);
    if (triggerReason.trim().length < 5) {
      setError("Please describe why enhanced due diligence is needed");
      return;
    }
    try {
      await openCase.mutateAsync({ reviewId, triggerReason });
      setShowOpen(false);
      setTriggerReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open EDD case");
    }
  };

  const handleToggle = async (field: "sourceOfWealthVerified" | "enhancedMediaSearchDone", value: boolean) => {
    if (!eddCase) return;
    setError(null);
    try {
      await updateChecklist.mutateAsync({ id: eddCase.id, [field]: value });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update checklist");
    }
  };

  const handleSaveNotes = async () => {
    if (!eddCase) return;
    setError(null);
    try {
      await updateChecklist.mutateAsync({
        id: eddCase.id,
        sourceOfWealthNote: sourceOfWealthNote || undefined,
        seniorManagementSignoff: seniorManagementSignoff || undefined,
        monitoringFrequency: monitoringFrequency || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleClose = async () => {
    if (!eddCase) return;
    setError(null);
    try {
      await closeCase.mutateAsync({ id: eddCase.id, closedBy: user?.name ?? "Verifier" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close EDD case");
    }
  };

  if (!eddCase) {
    if (realRole !== "vetify") return null;
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={15} className="text-amber-600" />
          <h2 className="text-sm font-semibold text-gray-700">Enhanced Due Diligence (G14)</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Open an EDD case when this review surfaces a PEP hit -- gates <code className="font-mono">ApproveCompliance</code> until
          the checklist is complete.
        </p>
        {!showOpen ? (
          <button onClick={() => setShowOpen(true)} className="btn-secondary text-xs px-3 py-1.5">Open EDD Case</button>
        ) : (
          <div className="space-y-2">
            <textarea rows={2} value={triggerReason} onChange={(e) => setTriggerReason(e.target.value)} className="input resize-none text-xs" placeholder="e.g. PEP hit on director during KYC screening" />
            <div className="flex gap-2">
              <button onClick={() => setShowOpen(false)} className="btn-secondary text-xs px-3 py-1.5 flex-1">Cancel</button>
              <button onClick={handleOpen} disabled={openCase.isPending} className="btn-primary text-xs px-3 py-1.5 flex-1 disabled:opacity-50">
                {openCase.isPending ? "Opening…" : "Confirm"}
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    );
  }

  const canEdit = realRole === "verifier" && eddCase.status === "EddOpen";
  const allComplete =
    eddCase.source_of_wealth_verified &&
    eddCase.enhanced_media_search_done &&
    eddCase.senior_management_signoff != null &&
    eddCase.monitoring_frequency != null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-amber-600" />
          <h2 className="text-sm font-semibold text-gray-700">Enhanced Due Diligence (G14)</h2>
        </div>
        <span className={`text-xs font-medium ${eddCase.status === "EddClosed" ? "text-emerald-600" : "text-amber-600"}`}>
          {eddCase.status === "EddClosed" ? "Closed" : "Open"}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{eddCase.trigger_reason}</p>

      <label className="flex items-center justify-between py-2 border-b border-gray-100 cursor-pointer">
        <span className="text-xs text-gray-700">Source of wealth verified</span>
        <input
          type="checkbox"
          className="w-4 h-4 accent-primary"
          checked={eddCase.source_of_wealth_verified}
          disabled={!canEdit}
          onChange={(e) => handleToggle("sourceOfWealthVerified", e.target.checked)}
        />
      </label>
      <label className="flex items-center justify-between py-2 border-b border-gray-100 cursor-pointer">
        <span className="text-xs text-gray-700">Enhanced media search done</span>
        <input
          type="checkbox"
          className="w-4 h-4 accent-primary"
          checked={eddCase.enhanced_media_search_done}
          disabled={!canEdit}
          onChange={(e) => handleToggle("enhancedMediaSearchDone", e.target.checked)}
        />
      </label>

      {canEdit ? (
        <div className="space-y-2 mt-3">
          <input className="input text-xs" placeholder="Source of wealth note" defaultValue={eddCase.source_of_wealth_note ?? ""} onChange={(e) => setSourceOfWealthNote(e.target.value)} />
          <input className="input text-xs" placeholder="Senior management sign-off (name)" defaultValue={eddCase.senior_management_signoff ?? ""} onChange={(e) => setSeniorManagementSignoff(e.target.value)} />
          <input className="input text-xs" placeholder="Monitoring frequency (e.g. quarterly)" defaultValue={eddCase.monitoring_frequency ?? ""} onChange={(e) => setMonitoringFrequency(e.target.value)} />
          <button onClick={handleSaveNotes} disabled={updateChecklist.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
            {updateChecklist.isPending ? "Saving…" : "Save Notes"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-1 text-xs text-gray-600">
          {eddCase.senior_management_signoff && <p>Sign-off: {eddCase.senior_management_signoff}</p>}
          {eddCase.monitoring_frequency && <p>Monitoring: {eddCase.monitoring_frequency}</p>}
        </div>
      )}

      {canEdit && (
        <button onClick={handleClose} disabled={!allComplete || closeCase.isPending} className="btn-primary text-xs px-3 py-1.5 mt-3 w-full disabled:opacity-40">
          {closeCase.isPending ? "Closing…" : allComplete ? "Close EDD Case" : "Complete all fields to close"}
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export default function ComplianceReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [showFlag, setShowFlag] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: queue, isLoading: loadingQueue } = useComplianceQueue();
  const { data: onboardingList } = useOnboardingList();
  const { data: reviewers } = useReviewers();
  const { data: eddCases } = useEddCases();
  const approveCompliance = useApproveCompliance();
  const rejectCompliance = useRejectCompliance();
  const flagCompliance = useFlagComplianceForManualReview();
  const startReview = useStartReview();
  const [reviewerAuthId, setReviewerAuthId] = useState<number | "">("");

  const activeReviewers = (reviewers ?? []).filter((r) => !r.archived_at);

  const review = queue?.find((r) => r.id === id);
  const onboarding = onboardingList?.find((o) => o.kyc.cacRegNumber === review?.cacNumber);
  // Always threaded through to ApproveCompliance when a case exists for
  // this review, regardless of status -- omitting it whenever the case is
  // still Open would silently bypass the G14 gate instead of triggering
  // the "must be Closed" error a verifier needs to see.
  const eddCase = (eddCases ?? []).find((c) => review && String(c.compliance_review_id) === review.id);

  const [checks, setChecks] = useState<ComplianceCheck>(DEFAULT_CHECKS);
  const [riskScore, setRiskScore] = useState(review?.agentScore ?? 85);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(review?.agentRisk ?? "Low");

  if (loadingQueue) {
    return <Layout breadcrumb={[{ label: "Compliance", path: "/vetify/compliance" }, { label: "…" }]}><p className="text-sm text-gray-500">Loading…</p></Layout>;
  }
  if (!review) {
    return <Layout breadcrumb={[{ label: "Compliance", path: "/vetify/compliance" }, { label: "Not Found" }]}><p className="text-sm text-red-600">Review not found</p></Layout>;
  }

  const handleStartReview = async () => {
    setActionError(null);
    try {
      await startReview.mutateAsync(review.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to start review");
    }
  };

  const handleApprove = async () => {
    setActionError(null);
    if (!reviewerAuthId) {
      setActionError("Please select an authorized reviewer credential");
      return;
    }
    try {
      await approveCompliance.mutateAsync({ id: review.id, completedChecks: checks, riskScore, riskLevel, reviewerAuthId, eddCaseId: eddCase?.id ?? null });
      router.push("/vetify/compliance");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to approve");
    }
  };

  const handleReject = async () => {
    setActionError(null);
    if (rejectReason.trim().length < 5) {
      setActionError("Please provide a more detailed rejection reason");
      return;
    }
    if (!reviewerAuthId) {
      setActionError("Please select an authorized reviewer credential");
      return;
    }
    try {
      await rejectCompliance.mutateAsync({ id: review.id, completedChecks: checks, riskScore, riskLevel, reason: rejectReason, reviewerAuthId });
      router.push("/vetify/compliance");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to reject");
    }
  };

  const handleFlag = async () => {
    setActionError(null);
    if (flagNote.trim().length < 5) {
      setActionError("Please provide a note explaining the escalation");
      return;
    }
    try {
      await flagCompliance.mutateAsync({ id: review.id, riskScore, riskLevel, note: flagNote });
      router.push("/vetify/compliance");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to flag");
    }
  };

  const canDecide = review.status === "UnderReview" || review.status === "ManualReview";

  return (
    <Layout breadcrumb={[{ label: "Compliance", path: "/vetify/compliance" }, { label: review.businessName }]}>
      <div className="space-y-5">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push("/vetify/compliance")} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">{review.businessName}</h1>
            <StatusBadge status={review.status} />
          </div>
          <p className="ml-7 text-xs text-gray-500">
            CAC: <span className="font-mono text-gray-700">{review.cacNumber}</span>
          </p>
          {review.status === "Pending" && user?.realRole === "vetify" && (
            <div className="ml-7 mt-3">
              <button onClick={handleStartReview} disabled={startReview.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
                {startReview.isPending ? "Starting…" : "Start Review"}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="space-y-4">
            {onboarding ? (
              <>
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Building size={15} className="text-primary" />
                    <h2 className="text-sm font-semibold text-gray-700">Business Information</h2>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Business Name", value: onboarding.profile.name },
                      { label: "Type", value: onboarding.profile.businessType === "LimitedCompany" ? "Limited Company" : "Sole Proprietorship" },
                      { label: "State", value: onboarding.profile.state },
                      { label: "Phone", value: onboarding.profile.phoneNumber },
                      { label: "Email", value: onboarding.profile.email },
                      { label: "CAC Number", value: onboarding.kyc.cacRegNumber, mono: true },
                      { label: "Tax ID", value: onboarding.kyc.taxId, mono: true },
                    ].map(({ label, value, mono }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className={`text-sm font-medium text-gray-900 mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {onboarding.profile.directors.map((director, idx) => (
                  <div className="card p-5" key={idx}>
                    <div className="flex items-center gap-2 mb-4">
                      <User size={15} className="text-primary" />
                      <h2 className="text-sm font-semibold text-gray-700">{onboarding.profile.directors.length > 1 ? `Director ${idx + 1}` : "Director"}</h2>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Full Name", value: director.name },
                        { label: "Phone", value: director.phoneNumber },
                        { label: "NIN", value: director.ninNumber, mono: true },
                        { label: "BVN", value: director.bvn, mono: true },
                      ].map(({ label, value, mono }) => (
                        <div key={label}>
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className={`text-sm font-medium text-gray-900 mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="card p-5">
                <p className="text-xs text-gray-500">No matching onboarding record found for this business (the source Draft/UnderReview row is archived once Stage 2 completes).</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {review.agentScore !== undefined && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">AI Agent Assessment</h2>
                <div className="flex items-center justify-center"><RiskGauge score={review.agentScore ?? 0} /></div>
                <p className="text-xs text-gray-500 text-center mt-3">Advisory only — confirm the checklist below before deciding.</p>
              </div>
            )}

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileSearch size={15} className="text-primary" />
                <h2 className="text-sm font-semibold text-gray-700">Reviewer Checklist</h2>
              </div>
              {([
                ["shariahCompliant", "Shariah Compliant"],
                ["amlCleared", "AML Screening Cleared"],
                ["kycValidated", "KYC Validated"],
                ["cddCompleted", "CDD Completed"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 cursor-pointer">
                  <span className="text-sm text-gray-700">{label}</span>
                  <input type="checkbox" className="w-4 h-4 accent-primary" checked={checks[key]} onChange={(e) => setChecks((prev) => ({ ...prev, [key]: e.target.checked }))} />
                </label>
              ))}
            </div>

            <div className="card p-5">
              <div className="grid grid-cols-2 gap-3">
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
            </div>

            <EddCaseSection reviewId={review.id} realRole={user?.realRole} />
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Decision</h2>

              {user?.realRole === "verifier" && (
                <div className="space-y-2">
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Reviewer Credential <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="input text-sm"
                      value={reviewerAuthId}
                      onChange={(e) => setReviewerAuthId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">Select…</option>
                      {activeReviewers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.role} (authorized by {r.authorized_by})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button onClick={handleApprove} disabled={!canDecide || approveCompliance.isPending} className="btn-primary w-full disabled:opacity-40">
                    {approveCompliance.isPending ? "Approving…" : "Approve Compliance"}
                  </button>
                  {!showReject ? (
                    <button onClick={() => setShowReject(true)} disabled={!canDecide} className="btn-danger w-full disabled:opacity-40">Reject</button>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="input resize-none text-xs" placeholder="Rejection reason..." />
                      <div className="flex gap-2">
                        <button onClick={() => setShowReject(false)} className="btn-secondary text-xs px-3 py-1.5 flex-1">Cancel</button>
                        <button onClick={handleReject} disabled={rejectCompliance.isPending} className="btn-danger text-xs px-3 py-1.5 flex-1 disabled:opacity-50">
                          {rejectCompliance.isPending ? "Submitting…" : "Confirm Reject"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {user?.realRole === "vetify" && review.status === "UnderReview" && (
                <div className="space-y-2 mt-2">
                  {!showFlag ? (
                    <button onClick={() => setShowFlag(true)} className="btn-secondary w-full">Flag for Manual Review</button>
                  ) : (
                    <div className="space-y-2">
                      <textarea rows={2} value={flagNote} onChange={(e) => setFlagNote(e.target.value)} className="input resize-none text-xs" placeholder="Why is this being escalated?" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowFlag(false)} className="btn-secondary text-xs px-3 py-1.5 flex-1">Cancel</button>
                        <button onClick={handleFlag} disabled={flagCompliance.isPending} className="btn-primary text-xs px-3 py-1.5 flex-1 disabled:opacity-50">
                          {flagCompliance.isPending ? "Submitting…" : "Confirm Flag"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {actionError && <p className="text-xs text-red-600 mt-3">{actionError}</p>}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
