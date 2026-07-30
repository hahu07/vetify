"use client";

import { useState } from "react";
import { ShieldCheck, X, Clock } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira } from "@/lib/formatters";
import { useMurabahahProposals, useShariahContractCertifications, useCertifyShariahTerms, useExpireProposal, type MurabahahProposal } from "@/lib/apiClient";

// New page -- G11's per-contract Shari'a certification (CertifyShariahTerms),
// the advisor's real decision authority over Stage 8's financial-structure
// sign-off (distinct from the standalone Shariah pre-check agent, which
// only clears the business's line of activity in Stage 3). No legacy
// frontend equivalent exists for this specific choice.

function CertifyModal({ proposal, onClose }: { proposal: MurabahahProposal; onClose: () => void }) {
  const [certificationRef, setCertificationRef] = useState(`CERT-${proposal.facilityRef}`);
  const [aaoifiStandards, setAaoifiStandards] = useState("Std No. 8");
  const [rationale, setRationale] = useState("");
  const [certifiedBy, setCertifiedBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const certify = useCertifyShariahTerms();

  const handleConfirm = async () => {
    setError(null);
    if (!certificationRef.trim()) {
      setError("Please provide a certification reference");
      return;
    }
    if (!rationale.trim()) {
      setError("Please provide a rationale");
      return;
    }
    if (!certifiedBy.trim()) {
      setError("Please name the certifying scholar/member");
      return;
    }
    try {
      await certify.mutateAsync({
        id: proposal.id,
        certificationRef,
        aaoifiStandards: aaoifiStandards.split(",").map((s) => s.trim()).filter(Boolean),
        rationale,
        certifiedBy,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to certify the proposal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Certify Shari&apos;a Terms</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {proposal.businessName} <span className="font-mono">({proposal.facilityRef})</span> --{" "}
          {formatNaira(proposal.murabahahTerms.salePrice)} sale price, {formatNaira(proposal.murabahahTerms.profitAmount)} profit
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Certification Reference</label>
          <input className="input font-mono" value={certificationRef} onChange={(e) => setCertificationRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">AAOIFI Standards (comma-separated)</label>
          <input className="input" value={aaoifiStandards} onChange={(e) => setAaoifiStandards(e.target.value)} placeholder="Std No. 8, Std No. 40" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Rationale <span className="text-red-500">*</span>
          </label>
          <textarea rows={3} className="input resize-none" value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Sale price correctly discloses cost and profit; tenure matches disbursement plan..." />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Certified By <span className="text-red-500">*</span>
          </label>
          <input className="input" value={certifiedBy} onChange={(e) => setCertifiedBy(e.target.value)} placeholder="Sheikh Ibrahim Yusuf" />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={certify.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {certify.isPending ? "Certifying…" : "Certify Compliant"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpireProposalRow({ proposal }: { proposal: MurabahahProposal }) {
  const [error, setError] = useState<string | null>(null);
  const expire = useExpireProposal();

  const handleExpire = async () => {
    setError(null);
    try {
      await expire.mutateAsync(proposal.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to expire the proposal");
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{proposal.businessName}</p>
        <p className="text-xs text-gray-500 font-mono">{proposal.facilityRef}</p>
        <p className="text-xs text-gray-600 mt-0.5">
          {formatNaira(proposal.murabahahTerms.salePrice)} · acceptance window closed{" "}
          {proposal.acceptanceExpiresAt ? new Date(proposal.acceptanceExpiresAt).toLocaleString() : ""}
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button onClick={handleExpire} disabled={expire.isPending} className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0 disabled:opacity-40">
        {expire.isPending ? "Expiring…" : "Expire"}
      </button>
    </div>
  );
}

export default function ShariahCertificationPage() {
  const { data: proposals, isLoading, isError } = useMurabahahProposals();
  const { data: certifications } = useShariahContractCertifications();
  const [modal, setModal] = useState<MurabahahProposal | null>(null);

  if (isLoading) return <Layout title="Shariah Certification"><FullPageLoader /></Layout>;
  if (isError || !proposals) return <Layout title="Shariah Certification"><ErrorState message="Failed to load proposals" /></Layout>;

  const certifiedFacilities = new Set((certifications ?? []).map((c) => c.facilityRef));
  const pending = proposals.filter((p) => !certifiedFacilities.has(p.facilityRef));
  const now = Date.now();
  const expired = pending.filter((p) => p.acceptanceExpiresAt && new Date(p.acceptanceExpiresAt).getTime() < now);

  return (
    <Layout title="Shariah Certification">
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          Stage 8 (G11): per-contract Shari&apos;a sign-off on the executed cost/profit/sale-price/tenure -- distinct from the
          Stage 3 sector pre-check, which only clears the business&apos;s line of activity.
        </p>

        <div className="card overflow-hidden">
          {pending.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck size={28} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No proposals awaiting certification</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pending.map((proposal) => (
                <div key={proposal.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{proposal.businessName}</p>
                    <p className="text-xs text-gray-500 font-mono">{proposal.facilityRef}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {formatNaira(proposal.murabahahTerms.salePrice)} · {proposal.murabahahTerms.tenureMonths} months
                    </p>
                  </div>
                  <button onClick={() => setModal(proposal)} className="btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                    Certify Terms
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {expired.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-800">Expired Proposals (acceptance window closed)</h2>
            </div>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {expired.map((proposal) => (
                <ExpireProposalRow key={proposal.id} proposal={proposal} />
              ))}
            </div>
          </div>
        )}
      </div>

      {modal && <CertifyModal proposal={modal} onClose={() => setModal(null)} />}
    </Layout>
  );
}
