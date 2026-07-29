"use client";

import { useState } from "react";
import { ScrollText, ChevronDown, ChevronUp, PlusCircle, CheckCircle2 } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useVerificationPolicies,
  usePendingVerificationPolicies,
  useProposeVerificationPolicy,
  useApproveVerificationPolicyChange,
  useRejectVerificationPolicyChange,
  useCompliancePolicies,
  usePendingCompliancePolicies,
  useProposeCompliancePolicy,
  useApproveCompliancePolicyChange,
  useRejectCompliancePolicyChange,
  usePolicyApprovers,
  type VerificationPolicyEntry,
  type PendingVerificationPolicyEntry,
  type CompliancePolicyEntry,
  type PendingCompliancePolicyEntry,
} from "@/lib/apiClient";

// New page (no legacy-frontend equivalent). vetify's side of the
// Fourteenth Slice's maker-checker chain: propose a scoring-policy change,
// watch it wait for the Nineteenth Slice's new /riskcommittee/policies
// queue to endorse it, then approve (as a *different*, registered
// PolicyApprover) or reject. Two near-duplicate sections kept unabstracted
// on purpose, same discipline lib/domain/policy.ts's own header already
// applies to the backend pair.

function CollapsibleSection({
  icon,
  title,
  description,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full mb-2">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      {open && <div className="space-y-4 mt-2">{children}</div>}
    </div>
  );
}

function ActivePolicyCard({ policy, kind }: { policy: VerificationPolicyEntry | CompliancePolicyEntry; kind: "verification" | "compliance" }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-surface p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-gray-900">{policy.policy_version}</span>
        <span className="text-xs text-gray-400 font-mono">#{policy.id}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
        <div className="flex justify-between"><span className="text-gray-500">Auto-approve min</span><span className="font-mono text-gray-700">{policy.auto_approve_min}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Auto-reject max</span><span className="font-mono text-gray-700">{policy.auto_reject_max}</span></div>
        {kind === "verification" ? (
          <>
            <div className="flex justify-between"><span className="text-gray-500">SLA hours</span><span className="font-mono text-gray-700">{(policy as VerificationPolicyEntry).sla_hours}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Max amendments</span><span className="font-mono text-gray-700">{(policy as VerificationPolicyEntry).max_amendments}</span></div>
          </>
        ) : (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Escalation SLA hours</span><span className="font-mono text-gray-700">{(policy as CompliancePolicyEntry).escalation_sla_hours}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Shariah policy version</span><span className="font-mono text-gray-700">{(policy as CompliancePolicyEntry).shariah_policy_version}</span></div>
          </>
        )}
      </div>
    </div>
  );
}

function ProposeForm({
  kind,
  proposedBy,
  onSubmit,
  pending,
}: {
  kind: "verification" | "compliance";
  proposedBy: string;
  onSubmit: (fields: Record<string, unknown>) => Promise<void>;
  pending: boolean;
}) {
  const [policyVersion, setPolicyVersion] = useState("");
  const [autoApproveMin, setAutoApproveMin] = useState(80);
  const [autoRejectMax, setAutoRejectMax] = useState(50);
  const [slaHours, setSlaHours] = useState(48);
  const [maxAmendments, setMaxAmendments] = useState(5);
  const [requiredDocTypes, setRequiredDocTypes] = useState("");
  const [escalationSlaHours, setEscalationSlaHours] = useState(72);
  const [shariahPolicyVersion, setShariahPolicyVersion] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [scoringWeightsJson, setScoringWeightsJson] = useState("{}");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!policyVersion.trim() || !reason.trim()) {
      setError("Policy version and reason are both required");
      return;
    }
    let scoringWeights: Record<string, number>;
    try {
      scoringWeights = JSON.parse(scoringWeightsJson || "{}");
    } catch {
      setError("Scoring weights must be valid JSON");
      return;
    }
    try {
      if (kind === "verification") {
        await onSubmit({
          policyVersion, autoApproveMin, autoRejectMax, slaHours, maxAmendments,
          requiredDocTypes: requiredDocTypes.split(",").map((s) => s.trim()).filter(Boolean),
          scoringWeights, proposedBy, reason,
        });
      } else {
        if (!shariahPolicyVersion.trim() || !effectiveFrom) {
          setError("Shariah policy version and effective-from date are required");
          return;
        }
        await onSubmit({
          policyVersion, autoApproveMin, autoRejectMax, escalationSlaHours, shariahPolicyVersion,
          effectiveFrom, effectiveTo: effectiveTo || null, scoringWeights, proposedBy, reason,
        });
      }
      setPolicyVersion("");
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to propose policy change");
    }
  };

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Policy Version</label>
          <input className="input text-sm" placeholder="e.g. VP-2026-02" value={policyVersion} onChange={(e) => setPolicyVersion(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Auto-Approve Min</label>
          <input type="number" className="input text-sm font-mono" value={autoApproveMin} onChange={(e) => setAutoApproveMin(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Auto-Reject Max</label>
          <input type="number" className="input text-sm font-mono" value={autoRejectMax} onChange={(e) => setAutoRejectMax(Number(e.target.value))} />
        </div>
        {kind === "verification" ? (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">SLA Hours</label>
              <input type="number" className="input text-sm font-mono" value={slaHours} onChange={(e) => setSlaHours(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max Amendments</label>
              <input type="number" className="input text-sm font-mono" value={maxAmendments} onChange={(e) => setMaxAmendments(Number(e.target.value))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Required Document Types (comma-separated)</label>
              <input className="input text-sm" placeholder="CACCertificate, ValidID, ProofOfAddress" value={requiredDocTypes} onChange={(e) => setRequiredDocTypes(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Escalation SLA Hours</label>
              <input type="number" className="input text-sm font-mono" value={escalationSlaHours} onChange={(e) => setEscalationSlaHours(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Shariah Policy Version</label>
              <input className="input text-sm" placeholder="e.g. SP-2026-01" value={shariahPolicyVersion} onChange={(e) => setShariahPolicyVersion(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Effective From</label>
              <input type="date" className="input text-sm" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Effective To (optional)</label>
              <input type="date" className="input text-sm" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
            </div>
          </>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Scoring Weights (JSON)</label>
        <textarea rows={2} className="input text-xs font-mono resize-none" value={scoringWeightsJson} onChange={(e) => setScoringWeightsJson(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
        <textarea rows={2} className="input text-sm resize-none" placeholder="Why is this change being proposed?" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handleSubmit} disabled={pending} className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        <PlusCircle size={14} />
        {pending ? "Submitting…" : "Propose Change"}
      </button>
    </div>
  );
}

function PendingCard({
  proposedBy,
  reason,
  policyVersion,
  endorsedBy,
  onApprove,
  onReject,
  approving,
  rejecting,
  approverNames,
}: {
  proposedBy: string;
  reason: string;
  policyVersion: string;
  endorsedBy: string | null;
  onApprove: (approvedBy: string) => Promise<void>;
  onReject: (rejectedBy: string, rejectionReason: string) => Promise<void>;
  approving: boolean;
  rejecting: boolean;
  approverNames: string[];
}) {
  const [approvedBy, setApprovedBy] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [rejectedBy, setRejectedBy] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const eligibleApprovers = approverNames.filter((name) => name !== proposedBy);

  const handleApprove = async () => {
    setError(null);
    if (!approvedBy) {
      setError("Select a registered approver (must differ from the proposer)");
      return;
    }
    try {
      await onApprove(approvedBy);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    }
  };

  const handleReject = async () => {
    setError(null);
    if (!rejectedBy.trim() || rejectionReason.trim().length < 5) {
      setError("Rejected-by and a detailed rejection reason are both required");
      return;
    }
    try {
      await onReject(rejectedBy, rejectionReason);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-surface p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-gray-900">{policyVersion}</span>
        {endorsedBy ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 size={13} /> Endorsed by {endorsedBy}
          </span>
        ) : (
          <span className="text-xs font-medium text-amber-600">Awaiting Risk Committee endorsement</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Proposed by <span className="font-mono">{proposedBy}</span> — {reason}
      </p>

      {endorsedBy && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select className="input text-sm flex-1" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)}>
              <option value="">Select an approver…</option>
              {eligibleApprovers.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button onClick={handleApprove} disabled={approving} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
              {approving ? "Approving…" : "Approve"}
            </button>
          </div>
          {!showReject ? (
            <button onClick={() => setShowReject(true)} className="text-xs text-red-600 hover:underline">Reject instead</button>
          ) : (
            <div className="space-y-2 pt-1">
              <input className="input text-xs" placeholder="Rejected by" value={rejectedBy} onChange={(e) => setRejectedBy(e.target.value)} />
              <textarea rows={2} className="input text-xs resize-none" placeholder="Rejection reason…" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => setShowReject(false)} className="btn-secondary text-xs px-3 py-1.5 flex-1">Cancel</button>
                <button onClick={handleReject} disabled={rejecting} className="btn-danger text-xs px-3 py-1.5 flex-1 disabled:opacity-50">
                  {rejecting ? "Submitting…" : "Confirm Reject"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function VerificationPolicySection({ proposedBy, approverNames }: { proposedBy: string; approverNames: string[] }) {
  const { data: active, isLoading: loadingActive } = useVerificationPolicies();
  const { data: pending, isLoading: loadingPending } = usePendingVerificationPolicies();
  const propose = useProposeVerificationPolicy();
  const approve = useApproveVerificationPolicyChange();
  const reject = useRejectVerificationPolicyChange();

  const activePolicy = (active ?? []).find((p) => !p.archived_at);
  const pendingList = pending ?? [];

  return (
    <CollapsibleSection
      icon={<ScrollText size={15} className="text-primary" />}
      title="VerificationPolicy (Stage 2)"
      description="Auto-approve/reject thresholds, SLA hours, and per-check scoring weights for identity/KYC verification."
    >
      <div>
        <h3 className="text-xs font-semibold text-gray-600 mb-2">Active Policy</h3>
        {loadingActive ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : activePolicy ? (
          <ActivePolicyCard policy={activePolicy} kind="verification" />
        ) : (
          <p className="text-xs text-gray-400">No active VerificationPolicy — the scoring engine falls back to DEFAULT_VERIFICATION_WEIGHTS.</p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-600 mb-2">Pending Proposals</h3>
        {loadingPending ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : pendingList.length === 0 ? (
          <p className="text-xs text-gray-400">No pending proposals</p>
        ) : (
          <div className="space-y-2">
            {pendingList.map((p: PendingVerificationPolicyEntry) => (
              <PendingCard
                key={p.id}
                proposedBy={p.proposed_by}
                reason={p.reason}
                policyVersion={p.policy_version}
                endorsedBy={p.risk_committee_endorsed_by}
                approving={approve.isPending}
                rejecting={reject.isPending}
                approverNames={approverNames}
                onApprove={(approvedBy) => approve.mutateAsync({ id: p.id, approvedBy })}
                onReject={(rejectedBy, rejectionReason) => reject.mutateAsync({ id: p.id, rejectedBy, rejectionReason })}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-600 mb-2">Propose a Change</h3>
        <ProposeForm kind="verification" proposedBy={proposedBy} pending={propose.isPending} onSubmit={(fields) => propose.mutateAsync(fields as never)} />
      </div>
    </CollapsibleSection>
  );
}

function CompliancePolicySection({ proposedBy, approverNames }: { proposedBy: string; approverNames: string[] }) {
  const { data: active, isLoading: loadingActive } = useCompliancePolicies();
  const { data: pending, isLoading: loadingPending } = usePendingCompliancePolicies();
  const propose = useProposeCompliancePolicy();
  const approve = useApproveCompliancePolicyChange();
  const reject = useRejectCompliancePolicyChange();

  const activePolicy = (active ?? []).find((p) => !p.archived_at);
  const pendingList = pending ?? [];

  return (
    <CollapsibleSection
      icon={<ScrollText size={15} className="text-primary" />}
      title="CompliancePolicy (Stage 3)"
      description="Auto-approve/reject thresholds, escalation SLA, Shariah policy version, and scoring weights for AML/KYB/CDD review."
    >
      <div>
        <h3 className="text-xs font-semibold text-gray-600 mb-2">Active Policy</h3>
        {loadingActive ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : activePolicy ? (
          <ActivePolicyCard policy={activePolicy} kind="compliance" />
        ) : (
          <p className="text-xs text-gray-400">No active CompliancePolicy — the scoring engine falls back to DEFAULT_COMPLIANCE_WEIGHTS.</p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-600 mb-2">Pending Proposals</h3>
        {loadingPending ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : pendingList.length === 0 ? (
          <p className="text-xs text-gray-400">No pending proposals</p>
        ) : (
          <div className="space-y-2">
            {pendingList.map((p: PendingCompliancePolicyEntry) => (
              <PendingCard
                key={p.id}
                proposedBy={p.proposed_by}
                reason={p.reason}
                policyVersion={p.policy_version}
                endorsedBy={p.risk_committee_endorsed_by}
                approving={approve.isPending}
                rejecting={reject.isPending}
                approverNames={approverNames}
                onApprove={(approvedBy) => approve.mutateAsync({ id: p.id, approvedBy })}
                onReject={(rejectedBy, rejectionReason) => reject.mutateAsync({ id: p.id, rejectedBy, rejectionReason })}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-600 mb-2">Propose a Change</h3>
        <ProposeForm kind="compliance" proposedBy={proposedBy} pending={propose.isPending} onSubmit={(fields) => propose.mutateAsync(fields as never)} />
      </div>
    </CollapsibleSection>
  );
}

export default function VetifyPoliciesPage() {
  const { user } = useAuth();
  const { data: approvers } = usePolicyApprovers();
  const approverNames = (approvers ?? []).filter((a) => a.active).map((a) => a.approver_name);

  return (
    <Layout title="Policy Governance">
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          Propose, endorse, and approve VerificationPolicy/CompliancePolicy scoring changes. Every change needs an
          independent Risk Committee endorsement (<code className="font-mono">/riskcommittee/policies</code>) before a
          different, registered <code className="font-mono">PolicyApprover</code> can approve it here. Logged in as{" "}
          <span className="font-mono">{user?.name}</span>.
        </p>
        <VerificationPolicySection proposedBy={user?.name ?? "Vetify Ops"} approverNames={approverNames} />
        <CompliancePolicySection proposedBy={user?.name ?? "Vetify Ops"} approverNames={approverNames} />
      </div>
    </Layout>
  );
}
