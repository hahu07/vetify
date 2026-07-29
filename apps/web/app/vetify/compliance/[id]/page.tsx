"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Building, User, FileSearch } from "lucide-react";
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
} from "@/lib/apiClient";
import type { ComplianceCheck, RiskLevel } from "@/lib/apiClient";

// Trimmed port of frontend/src/pages/compliance/ComplianceReview.tsx. Dropped
// for this Phase 1 slice (no backend support): EDD case management,
// assign/reassign officer, Shariah verdict Supersede, EscalateOverdue --
// none of those choices exist in this slice's backend (see
// migrations/001_stage1_4_vertical_slice.sql's scope note). The RiskGauge,
// business-info panel, and reviewer checklist + approve/reject/flag actions
// are kept.

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
  const approveCompliance = useApproveCompliance();
  const rejectCompliance = useRejectCompliance();
  const flagCompliance = useFlagComplianceForManualReview();
  const startReview = useStartReview();
  const [reviewerAuthId, setReviewerAuthId] = useState<number | "">("");

  const activeReviewers = (reviewers ?? []).filter((r) => !r.archived_at);

  const review = queue?.find((r) => r.id === id);
  const onboarding = onboardingList?.find((o) => o.kyc.cacRegNumber === review?.cacNumber);

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
      await approveCompliance.mutateAsync({ id: review.id, completedChecks: checks, riskScore, riskLevel, reviewerAuthId });
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
