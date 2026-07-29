"use client";

import Link from "next/link";
import { Shield, CheckCircle2, Clock, AlertTriangle, ArrowRight, Users, PlusCircle } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth/AuthContext";
import { useComplianceQueue, useVerificationResults, useOpenComplianceReview, useApprovedBusinesses } from "@/lib/apiClient";
import type { ComplianceReviewItem } from "@/lib/apiClient";

// Ported from frontend/src/pages/compliance/ComplianceDashboard.tsx. The
// "Approved verifications awaiting a compliance review" section has no
// counterpart in the real frontend -- the real system's autonomous Verifier
// Agent creates a ComplianceReview automatically the instant a
// VerificationResult is Approved (see CLAUDE.md's Shariah Compliance Agent
// section); this Phase 1 slice has no autonomous agent, so opening the
// review is a manual vetify action instead.

function CheckPill({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pass ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
      {pass ? <CheckCircle2 size={10} /> : <Clock size={10} />}
      {label}
    </span>
  );
}

function ReviewCard({ item }: { item: ComplianceReviewItem }) {
  return (
    <Link href={`/vetify/compliance/${item.id}`} className="card p-5 flex items-center gap-4 hover:shadow-card-hover transition-all duration-150 group">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${item.status === "ManualReview" ? "bg-amber-100" : item.status === "UnderReview" ? "bg-indigo-100" : "bg-gray-100"}`}>
        {item.status === "ManualReview" ? <AlertTriangle size={18} className="text-amber-600" /> : <Shield size={18} className="text-indigo-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
          <h3 className="text-sm font-semibold text-gray-900 break-words">{item.businessName}</h3>
          <StatusBadge status={item.status} size="sm" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-gray-500">{item.cacNumber}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CheckPill pass={item.checks?.amlCleared ?? false} label="AML" />
          <CheckPill pass={item.checks?.kycValidated ?? false} label="KYC" />
          <CheckPill pass={item.checks?.cddCompleted ?? false} label="CDD" />
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        <span className="text-xs font-medium text-primary px-3 py-1.5 rounded-lg bg-primary-50 group-hover:bg-primary group-hover:text-white transition-colors flex items-center gap-1.5">
          Review <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}

function AwaitingReviewSection() {
  const { data: verifications } = useVerificationResults();
  const { data: queue } = useComplianceQueue();
  const { data: approvedBusinesses } = useApprovedBusinesses();
  const openReview = useOpenComplianceReview();

  // Excludes both a currently-open review (queue, active only -- archived_at
  // IS NULL) AND an already-fully-processed business (approvedBusinesses) --
  // checking the queue alone isn't enough, since ApproveCompliance archives
  // the compliance_review row, which would otherwise make an already-decided
  // business reappear here as "awaiting review" (confirmed live).
  const reviewedVerificationIds = new Set((queue ?? []).map((r) => r.verificationRef));
  const approvedCacNumbers = new Set((approvedBusinesses ?? []).map((b) => b.cacRegNumber));
  const awaiting = (verifications ?? []).filter(
    (v) => v.outcome === "Approved" && !reviewedVerificationIds.has(v.verificationRef) && !approvedCacNumbers.has(v.cacRegNumber),
  );

  if (awaiting.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <PlusCircle size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-gray-800">Approved Verifications Awaiting a Compliance Review</h2>
      </div>
      <div className="space-y-3">
        {awaiting.map((v) => (
          <div key={v.id} className="card p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{v.businessName}</p>
              <p className="text-xs font-mono text-gray-500">{v.cacRegNumber}</p>
            </div>
            <button onClick={() => openReview.mutate(v.id)} disabled={openReview.isPending} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
              {openReview.isPending ? "Opening…" : "Open Compliance Review"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComplianceDashboard() {
  const { user } = useAuth();
  const { data: queue, isLoading, isError } = useComplianceQueue();

  if (isLoading) return <Layout title="Compliance Review Queue"><p className="text-sm text-gray-500">Loading…</p></Layout>;
  if (isError || !queue) return <Layout title="Compliance Review Queue"><p className="text-sm text-red-600">Failed to load compliance queue</p></Layout>;

  const pending = queue.filter((q) => q.status === "Pending" || q.status === "UnderReview");
  const manualReview = queue.filter((q) => q.status === "ManualReview");

  return (
    <Layout title="Compliance Review Queue">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center"><Users size={18} className="text-primary" /></div>
            <div><p className="text-xs text-gray-500">Total in Queue</p><p className="text-xl font-bold text-gray-900 font-mono">{queue.length}</p></div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center"><Clock size={18} className="text-indigo-500" /></div>
            <div><p className="text-xs text-gray-500">Pending / Under Review</p><p className="text-xl font-bold text-gray-900 font-mono">{pending.length}</p></div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center"><AlertTriangle size={18} className="text-amber-600" /></div>
            <div><p className="text-xs text-gray-500">Manual Review Required</p><p className="text-xl font-bold text-amber-700 font-mono">{manualReview.length}</p></div>
          </div>
        </div>

        {user?.realRole === "vetify" && <AwaitingReviewSection />}

        {manualReview.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-amber-600" />
              <h2 className="text-sm font-semibold text-gray-800">Manual Review Required</h2>
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{manualReview.length}</span>
            </div>
            <div className="space-y-3">{manualReview.map((item) => <ReviewCard key={item.id} item={item} />)}</div>
          </div>
        )}

        {pending.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-800">Pending Review</h2>
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">{pending.length}</span>
            </div>
            <div className="space-y-3">{pending.map((item) => <ReviewCard key={item.id} item={item} />)}</div>
          </div>
        )}

        {queue.length === 0 && (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} className="text-emerald-500" /></div>
            <h3 className="text-base font-semibold text-gray-800 mb-2">All clear — no pending reviews</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">All compliance reviews are complete. New reviews appear here once opened.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
