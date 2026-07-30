"use client";

import { useState } from "react";
import { ShieldCheck, X, Clock, FileWarning, ClipboardList, AlertOctagon } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira, formatDate } from "@/lib/formatters";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useMurabahahProposals,
  useShariahContractCertifications,
  useCertifyShariahTerms,
  useExpireProposal,
  useRevokeCertification,
  useShariahAuditRecords,
  useCreateShariahAuditRecord,
  useShariahExceptions,
  useCreateShariahException,
  useResolveException,
  type MurabahahProposal,
  type ShariahContractCertification,
  type ShariahExceptionItem,
} from "@/lib/apiClient";

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

// Phase 2, Forty-Second Slice: RevokeCertification (advisor alone -- the
// only Shariah choice this migration gates on a genuinely independent party
// rather than "vetify's own team"), plus the vetify-side oversight records
// ShariahAuditRecord (create-only, immutable) and ShariahException
// (create + ResolveException).

function RevokeCertificationModal({ certification, onClose }: { certification: ShariahContractCertification; onClose: () => void }) {
  const [revocationRef, setRevocationRef] = useState(`REV-${Date.now()}`);
  const [reason, setReason] = useState("");
  const [revokedBy, setRevokedBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const revoke = useRevokeCertification();

  const handleSubmit = async () => {
    setError(null);
    if (!revocationRef.trim() || !reason.trim() || !revokedBy.trim()) {
      setError("Revocation reference, reason, and revoking member are all required");
      return;
    }
    try {
      await revoke.mutateAsync({ id: certification.id, revocationRef, reason, revokedBy });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke the certification");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Revoke Certification</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{certification.certificationRef}</p>
        <p className="text-xs text-amber-600 mb-3">Blocks <code className="font-mono">AcceptProposal</code> until a fresh certification is issued.</p>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Revocation Reference</label>
          <input className="input text-sm font-mono" value={revocationRef} onChange={(e) => setRevocationRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
          <textarea rows={2} className="input text-sm resize-none" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Revoked By</label>
          <input className="input text-sm" value={revokedBy} onChange={(e) => setRevokedBy(e.target.value)} placeholder="Sheikh Ibrahim Yusuf" />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={revoke.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {revoke.isPending ? "Revoking…" : "Revoke Certification"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateAuditRecordModal({ onClose }: { onClose: () => void }) {
  const [cacRegNumber, setCacRegNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [facilityRef, setFacilityRef] = useState("");
  const [auditDate, setAuditDate] = useState(new Date().toISOString().slice(0, 10));
  const [auditPeriod, setAuditPeriod] = useState("");
  const [auditorRef, setAuditorRef] = useState("");
  const [findings, setFindings] = useState("");
  const [overallCompliant, setOverallCompliant] = useState(true);
  const [recommendations, setRecommendations] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateShariahAuditRecord();

  const handleSubmit = async () => {
    setError(null);
    if (!cacRegNumber.trim() || !businessName.trim() || !auditPeriod.trim() || !auditorRef.trim()) {
      setError("CAC number, business name, audit period, and auditor reference are all required");
      return;
    }
    try {
      await create.mutateAsync({
        cacRegNumber, businessName, facilityRef: facilityRef || null, auditDate, auditPeriod, auditorRef,
        findings: findings.split(",").map((s) => s.trim()).filter(Boolean),
        overallCompliant,
        recommendations: recommendations.split(",").map((s) => s.trim()).filter(Boolean),
        nextAuditDate: null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the audit record");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Shariah Audit Record</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">CAC Registration Number</label>
          <input className="input text-sm font-mono" value={cacRegNumber} onChange={(e) => setCacRegNumber(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Business Name</label>
          <input className="input text-sm" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Facility Reference (optional)</label>
          <input className="input text-sm font-mono" value={facilityRef} onChange={(e) => setFacilityRef(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Audit Date</label>
            <input type="date" className="input text-sm" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Audit Period</label>
            <input className="input text-sm" value={auditPeriod} onChange={(e) => setAuditPeriod(e.target.value)} placeholder="Q3 2026" />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Auditor Reference</label>
          <input className="input text-sm font-mono" value={auditorRef} onChange={(e) => setAuditorRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Findings (comma-separated)</label>
          <textarea rows={2} className="input text-sm resize-none" value={findings} onChange={(e) => setFindings(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
            <input type="checkbox" checked={overallCompliant} onChange={(e) => setOverallCompliant(e.target.checked)} />
            Overall compliant
          </label>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Recommendations (comma-separated)</label>
          <textarea rows={2} className="input text-sm resize-none" value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create Record"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateExceptionModal({ onClose }: { onClose: () => void }) {
  const [cacRegNumber, setCacRegNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [facilityRef, setFacilityRef] = useState("");
  const [exceptionType, setExceptionType] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<ShariahExceptionItem["severity"]>("MajorException");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateShariahException();

  const handleSubmit = async () => {
    setError(null);
    if (!cacRegNumber.trim() || !businessName.trim() || !exceptionType.trim() || !description.trim()) {
      setError("CAC number, business name, exception type, and description are all required");
      return;
    }
    try {
      await create.mutateAsync({ cacRegNumber, businessName, facilityRef: facilityRef || null, exceptionType, description, severity });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the exception");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Shariah Exception</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">CAC Registration Number</label>
          <input className="input text-sm font-mono" value={cacRegNumber} onChange={(e) => setCacRegNumber(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Business Name</label>
          <input className="input text-sm" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Facility Reference (optional)</label>
          <input className="input text-sm font-mono" value={facilityRef} onChange={(e) => setFacilityRef(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Exception Type</label>
          <input className="input text-sm" value={exceptionType} onChange={(e) => setExceptionType(e.target.value)} placeholder="Prohibited revenue threshold breach" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea rows={2} className="input text-sm resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Severity</label>
          <select className="input text-sm" value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
            <option value="MinorException">Minor</option>
            <option value="MajorException">Major</option>
            <option value="CriticalException">Critical</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-danger flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create Exception"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExceptionRow({ exception, canResolve }: { exception: ShariahExceptionItem; canResolve: boolean }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resolve = useResolveException();

  const handleResolve = async () => {
    setError(null);
    if (!note.trim()) {
      setError("Please provide a resolution note");
      return;
    }
    try {
      await resolve.mutateAsync({ id: exception.id, note });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resolve the exception");
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{exception.businessName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{exception.exceptionType} · <span className="font-medium">{exception.severity}</span></p>
          <p className="text-xs text-gray-600 mt-0.5">{exception.description}</p>
        </div>
        {exception.resolvedAt ? (
          <span className="text-xs text-emerald-600 flex-shrink-0">Resolved</span>
        ) : null}
      </div>
      {!exception.resolvedAt && canResolve && (
        <div className="grid grid-cols-[1fr_auto] gap-2 mt-2">
          <input className="input text-xs" placeholder="Resolution note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={handleResolve} disabled={resolve.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
            {resolve.isPending ? "Resolving…" : "Resolve"}
          </button>
        </div>
      )}
      {exception.resolutionNote && <p className="text-xs text-gray-400 mt-2">{exception.resolutionNote}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export default function ShariahCertificationPage() {
  const { user } = useAuth();
  const { data: proposals, isLoading, isError } = useMurabahahProposals();
  const { data: certifications } = useShariahContractCertifications();
  const { data: auditRecords } = useShariahAuditRecords();
  const { data: exceptions } = useShariahExceptions();
  const [modal, setModal] = useState<MurabahahProposal | null>(null);
  const [revokeModal, setRevokeModal] = useState<ShariahContractCertification | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);

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

        {(certifications ?? []).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileWarning size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Active Certifications</h2>
            </div>
            <div className="card overflow-hidden divide-y divide-gray-100">
              {(certifications ?? []).map((cert) => (
                <div key={cert.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{cert.businessName}</p>
                    <p className="text-xs text-gray-500 font-mono">{cert.certificationRef} · {cert.facilityRef}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{cert.certifiedBy} · {cert.verdict}</p>
                  </div>
                  {user?.realRole === "advisor" && (
                    <button onClick={() => setRevokeModal(cert)} className="btn-danger text-xs px-3 py-1.5 flex-shrink-0">
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Shariah Audits</h2>
            </div>
            {user?.realRole === "vetify" && (
              <button onClick={() => setAuditModalOpen(true)} className="btn-secondary text-xs px-3 py-1.5">
                New Audit Record
              </button>
            )}
          </div>
          <div className="card overflow-hidden">
            {(auditRecords ?? []).length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No audit records yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(auditRecords ?? []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{a.businessName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.auditPeriod} · Auditor {a.auditorRef} · {formatDate(a.auditDate)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${a.overallCompliant ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                      {a.overallCompliant ? "Compliant" : "Non-Compliant"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertOctagon size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Shariah Exceptions</h2>
            </div>
            {user?.realRole === "vetify" && (
              <button onClick={() => setExceptionModalOpen(true)} className="btn-danger text-xs px-3 py-1.5">
                New Exception
              </button>
            )}
          </div>
          <div className="card overflow-hidden">
            {(exceptions ?? []).length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No exceptions recorded</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(exceptions ?? []).map((ex) => (
                  <ExceptionRow key={ex.id} exception={ex} canResolve={user?.realRole === "vetify"} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {modal && <CertifyModal proposal={modal} onClose={() => setModal(null)} />}
      {revokeModal && <RevokeCertificationModal certification={revokeModal} onClose={() => setRevokeModal(null)} />}
      {auditModalOpen && <CreateAuditRecordModal onClose={() => setAuditModalOpen(false)} />}
      {exceptionModalOpen && <CreateExceptionModal onClose={() => setExceptionModalOpen(false)} />}
    </Layout>
  );
}
