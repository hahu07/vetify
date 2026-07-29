"use client";

import { useState } from "react";
import { ScrollText, CheckCircle2 } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  usePendingVerificationPolicies,
  usePendingCompliancePolicies,
  useEndorseVerificationPolicy,
  useEndorseCompliancePolicy,
  type PendingVerificationPolicyEntry,
  type PendingCompliancePolicyEntry,
} from "@/lib/apiClient";

// New page (no legacy-frontend equivalent -- riskCommittee never had a
// portal in the real frontend either). Layer 2 of the Policy-Approval
// Security Roadmap (CLAUDE.md): a genuinely independent riskCommittee
// session must endorse a pending policy change before vetify can approve
// it. This page is that endorsement queue -- one card per pending
// proposal, an Endorse button that's hidden once already endorsed (only
// one endorsement per proposal; vetify's own approve/reject happens on
// /vetify/policies, not here, mirroring the two-separate-transactions
// design CLAUDE.md documents for this maker-checker chain).

function ScoringWeightsSummary({ weights }: { weights: Record<string, number> }) {
  const entries = Object.entries(weights ?? {});
  if (entries.length === 0) return <p className="text-xs text-gray-400">No scoring weights supplied</p>;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex justify-between text-xs">
          <span className="text-gray-500">{key}</span>
          <span className="font-mono text-gray-700">{value}</span>
        </div>
      ))}
    </div>
  );
}

function VerificationPolicyCard({ policy }: { policy: PendingVerificationPolicyEntry }) {
  const { user } = useAuth();
  const endorse = useEndorseVerificationPolicy();
  const [error, setError] = useState<string | null>(null);
  const alreadyEndorsed = policy.risk_committee_endorsed_by != null;

  const handleEndorse = async () => {
    setError(null);
    try {
      await endorse.mutateAsync({ id: policy.id, endorsedBy: user?.name ?? "Risk Committee" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to endorse");
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">VerificationPolicy {policy.policy_version}</h3>
        {alreadyEndorsed ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 size={13} /> Endorsed by {policy.risk_committee_endorsed_by}
          </span>
        ) : (
          <span className="text-xs font-medium text-amber-600">Awaiting endorsement</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-1">
        Proposed by <span className="font-mono">{policy.proposed_by}</span> — {policy.reason}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
        <div className="flex justify-between"><span className="text-gray-500">Auto-approve min</span><span className="font-mono text-gray-700">{policy.auto_approve_min}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Auto-reject max</span><span className="font-mono text-gray-700">{policy.auto_reject_max}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">SLA hours</span><span className="font-mono text-gray-700">{policy.sla_hours}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Max amendments</span><span className="font-mono text-gray-700">{policy.max_amendments}</span></div>
      </div>
      <ScoringWeightsSummary weights={policy.scoring_weights} />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {!alreadyEndorsed && (
        <button onClick={handleEndorse} disabled={endorse.isPending} className="btn-primary text-xs px-3 py-1.5 mt-3 disabled:opacity-50">
          {endorse.isPending ? "Endorsing…" : "Endorse"}
        </button>
      )}
    </div>
  );
}

function CompliancePolicyCard({ policy }: { policy: PendingCompliancePolicyEntry }) {
  const { user } = useAuth();
  const endorse = useEndorseCompliancePolicy();
  const [error, setError] = useState<string | null>(null);
  const alreadyEndorsed = policy.risk_committee_endorsed_by != null;

  const handleEndorse = async () => {
    setError(null);
    try {
      await endorse.mutateAsync({ id: policy.id, endorsedBy: user?.name ?? "Risk Committee" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to endorse");
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">CompliancePolicy {policy.policy_version}</h3>
        {alreadyEndorsed ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 size={13} /> Endorsed by {policy.risk_committee_endorsed_by}
          </span>
        ) : (
          <span className="text-xs font-medium text-amber-600">Awaiting endorsement</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-1">
        Proposed by <span className="font-mono">{policy.proposed_by}</span> — {policy.reason}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
        <div className="flex justify-between"><span className="text-gray-500">Auto-approve min</span><span className="font-mono text-gray-700">{policy.auto_approve_min}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Auto-reject max</span><span className="font-mono text-gray-700">{policy.auto_reject_max}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Escalation SLA hours</span><span className="font-mono text-gray-700">{policy.escalation_sla_hours}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Shariah policy version</span><span className="font-mono text-gray-700">{policy.shariah_policy_version}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Effective from</span><span className="font-mono text-gray-700">{policy.effective_from?.slice(0, 10)}</span></div>
        {policy.effective_to && <div className="flex justify-between"><span className="text-gray-500">Effective to</span><span className="font-mono text-gray-700">{policy.effective_to.slice(0, 10)}</span></div>}
      </div>
      <ScoringWeightsSummary weights={policy.scoring_weights} />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {!alreadyEndorsed && (
        <button onClick={handleEndorse} disabled={endorse.isPending} className="btn-primary text-xs px-3 py-1.5 mt-3 disabled:opacity-50">
          {endorse.isPending ? "Endorsing…" : "Endorse"}
        </button>
      )}
    </div>
  );
}

export default function RiskCommitteePoliciesPage() {
  const { user } = useAuth();
  const { data: pendingVerification, isLoading: loadingVerification } = usePendingVerificationPolicies();
  const { data: pendingCompliance, isLoading: loadingCompliance } = usePendingCompliancePolicies();

  return (
    <Layout title="Policy Endorsement Queue">
      <div className="space-y-6">
        <p className="text-xs text-gray-500">
          Layer 2 of the Policy-Approval Security Roadmap: a scoring-policy change cannot be approved by vetify until an
          independent Risk Committee session endorses it here. Logged in as <span className="font-mono">{user?.name}</span>.
        </p>

        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <ScrollText size={15} className="text-primary" />
            VerificationPolicy Proposals
          </h2>
          {loadingVerification ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : (pendingVerification ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">No pending VerificationPolicy proposals</p>
          ) : (
            <div className="space-y-3">
              {(pendingVerification ?? []).map((p) => (
                <VerificationPolicyCard key={p.id} policy={p} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <ScrollText size={15} className="text-primary" />
            CompliancePolicy Proposals
          </h2>
          {loadingCompliance ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : (pendingCompliance ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">No pending CompliancePolicy proposals</p>
          ) : (
            <div className="space-y-3">
              {(pendingCompliance ?? []).map((p) => (
                <CompliancePolicyCard key={p.id} policy={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
