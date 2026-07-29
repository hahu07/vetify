"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, UserPlus, BookOpen, ClipboardCheck, ShieldCheck, ScrollText, FileSearch } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useAssessors, useRegisterAssessor, useDeactivateAssessor, useReactivateAssessor,
  useActiveSentinels, useRegisterSentinel, useDeactivateSentinel, useReactivateSentinel,
  useAdvisors, useRegisterAdvisor, useDeactivateAdvisor, useReactivateAdvisor,
  usePolicyApprovers, useRegisterPolicyApprover, useDeactivatePolicyApprover, useReactivatePolicyApprover,
  useReviewers, useRegisterReviewer, useDeauthorizeReviewer,
} from "@/lib/apiClient";

// Ported in spirit from frontend/src/pages/vetify/Registries.tsx: same
// collapsible-section-per-registry shape (kept unabstracted across sections,
// mirroring lib/domain/governance.ts's own comment that these near-duplicate
// bodies are a direct, checkable translation, not a place for a shared
// abstraction). PolicyApprover has no legacy-frontend equivalent at all --
// added here since it's one of the five registries this migration's codegen
// pass built a backend for.

interface RegistryRow {
  id: number;
  identity: string;
  role: string;
  authorized_by: string;
  active: boolean;
}

function RegistryTable({
  rows,
  identityLabel,
  onDeactivate,
  onReactivate,
  pending,
}: {
  rows: RegistryRow[];
  identityLabel: string;
  onDeactivate: (id: number) => void;
  onReactivate: (id: number) => void;
  pending: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-gray-400 py-2">No entries registered yet</p>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>{identityLabel}</th>
          <th>Role</th>
          <th>Authorized By</th>
          <th>Status</th>
          <th className="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="font-mono text-xs">{r.identity}</td>
            <td className="text-xs text-gray-600">{r.role}</td>
            <td className="text-xs text-gray-500">{r.authorized_by}</td>
            <td>
              <span className={`text-xs font-medium ${r.active ? "text-emerald-600" : "text-gray-400"}`}>{r.active ? "Active" : "Inactive"}</span>
            </td>
            <td className="text-right">
              {r.active ? (
                <button onClick={() => onDeactivate(r.id)} disabled={pending} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                  Deactivate
                </button>
              ) : (
                <button onClick={() => onReactivate(r.id)} disabled={pending} className="text-xs text-primary hover:underline disabled:opacity-50">
                  Reactivate
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RegisterForm({
  identityPlaceholder,
  onRegister,
  pending,
  actionLabel,
}: {
  identityPlaceholder: string;
  onRegister: (identity: string, role: string, authorizedBy: string) => Promise<void>;
  pending: boolean;
  actionLabel: string;
}) {
  const [identity, setIdentity] = useState("");
  const [role, setRole] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!identity.trim() || !role.trim() || !authorizedBy.trim()) {
      setError("All fields are required");
      return;
    }
    try {
      await onRegister(identity, role, authorizedBy);
      setIdentity("");
      setRole("");
      setAuthorizedBy("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register");
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
      <input className="input text-sm" placeholder={identityPlaceholder} value={identity} onChange={(e) => setIdentity(e.target.value)} />
      <input className="input text-sm" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
      <input className="input text-sm" placeholder="Authorized by" value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} />
      {error && <p className="text-xs text-red-600 col-span-3">{error}</p>}
      <button onClick={handleSubmit} disabled={pending} className="btn-primary text-sm col-span-3 flex items-center justify-center gap-2 disabled:opacity-50">
        <UserPlus size={14} />
        {actionLabel}
      </button>
    </div>
  );
}

function CollapsibleSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
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

function AssessorSection() {
  const { data: assessors, isLoading } = useAssessors();
  const register = useRegisterAssessor();
  const deactivate = useDeactivateAssessor();
  const reactivate = useReactivateAssessor();

  return (
    <CollapsibleSection
      icon={<ClipboardCheck size={15} className="text-primary" />}
      title="Assessor Registry"
      description={
        <>
          Gates who may exercise <code className="font-mono">BeginUnderwriting</code>/<code className="font-mono">RejectUnderwriting</code> as{" "}
          <code className="font-mono">assessor</code>.
        </>
      }
    >
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <RegistryTable
          rows={(assessors ?? []).map((a) => ({ id: a.id, identity: a.assessor, role: a.role, authorized_by: a.authorized_by, active: a.active }))}
          identityLabel="Assessor Party"
          pending={deactivate.isPending || reactivate.isPending}
          onDeactivate={(id) => deactivate.mutate({ id, reason: "Deactivated by admin", performedBy: "Vetify Admin" })}
          onReactivate={(id) => reactivate.mutate({ id, reason: "Reactivated by admin", performedBy: "Vetify Admin" })}
        />
      )}
      <RegisterForm
        identityPlaceholder="Assessor party ID"
        pending={register.isPending}
        actionLabel="Register Assessor"
        onRegister={(assessor, role, authorizedBy) => register.mutateAsync({ assessor, role, authorizedBy })}
      />
    </CollapsibleSection>
  );
}

function SentinelSection() {
  const { data: sentinels, isLoading } = useActiveSentinels();
  const register = useRegisterSentinel();
  const deactivate = useDeactivateSentinel();
  const reactivate = useReactivateSentinel();

  return (
    <CollapsibleSection
      icon={<ShieldCheck size={15} className="text-primary" />}
      title="Sentinel Registry"
      description={
        <>
          Gates who may exercise <code className="font-mono">FlagDelinquent</code>/<code className="font-mono">ResumeActive</code> as{" "}
          <code className="font-mono">sentinel</code>.
        </>
      }
    >
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <RegistryTable
          rows={(sentinels ?? []).map((s) => ({ id: s.id, identity: s.sentinel, role: s.role, authorized_by: s.authorized_by, active: s.active }))}
          identityLabel="Sentinel Party"
          pending={deactivate.isPending || reactivate.isPending}
          onDeactivate={(id) => deactivate.mutate({ id, reason: "Deactivated by admin", performedBy: "Vetify Admin" })}
          onReactivate={(id) => reactivate.mutate({ id, reason: "Reactivated by admin", performedBy: "Vetify Admin" })}
        />
      )}
      <RegisterForm
        identityPlaceholder="Sentinel party ID"
        pending={register.isPending}
        actionLabel="Register Sentinel"
        onRegister={(sentinel, role, authorizedBy) => register.mutateAsync({ sentinel, role, authorizedBy })}
      />
    </CollapsibleSection>
  );
}

function AdvisorSection() {
  const { data: advisors, isLoading } = useAdvisors();
  const register = useRegisterAdvisor();
  const deactivate = useDeactivateAdvisor();
  const reactivate = useReactivateAdvisor();

  return (
    <CollapsibleSection
      icon={<BookOpen size={15} className="text-primary" />}
      title="Shari'a Advisor Registry"
      description={
        <>
          Gates who may exercise <code className="font-mono">RecordShariahPreCheck</code>/<code className="font-mono">CertifyShariahTerms</code> as
          the independent Shari&apos;a Supervisory Board.
        </>
      }
    >
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <RegistryTable
          rows={(advisors ?? []).map((a) => ({ id: a.id, identity: a.advisor, role: a.role, authorized_by: a.authorized_by, active: a.active }))}
          identityLabel="Advisor Party"
          pending={deactivate.isPending || reactivate.isPending}
          onDeactivate={(id) => deactivate.mutate({ id, reason: "Deactivated by admin", performedBy: "Vetify Admin" })}
          onReactivate={(id) => reactivate.mutate({ id, reason: "Reactivated by admin", performedBy: "Vetify Admin" })}
        />
      )}
      <RegisterForm
        identityPlaceholder="Advisor party ID"
        pending={register.isPending}
        actionLabel="Register Advisor"
        onRegister={(advisor, role, authorizedBy) => register.mutateAsync({ advisor, role, authorizedBy })}
      />
    </CollapsibleSection>
  );
}

function PolicyApproverSection() {
  const { data: approvers, isLoading } = usePolicyApprovers();
  const register = useRegisterPolicyApprover();
  const deactivate = useDeactivatePolicyApprover();
  const reactivate = useReactivatePolicyApprover();

  return (
    <CollapsibleSection
      icon={<ScrollText size={15} className="text-primary" />}
      title="Policy Approver Registry"
      description={
        <>
          Gates who may exercise <code className="font-mono">ApprovePolicyChange</code> -- Layer 1 of the Policy-Approval Security Roadmap
          (<code className="font-mono">CLAUDE.md</code>): <code className="font-mono">approvedBy</code> must match a real, currently-active
          registrant here, not any invented string.
        </>
      }
    >
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <RegistryTable
          rows={(approvers ?? []).map((a) => ({ id: a.id, identity: a.approver_name, role: a.role, authorized_by: a.authorized_by, active: a.active }))}
          identityLabel="Approver Name"
          pending={deactivate.isPending || reactivate.isPending}
          onDeactivate={(id) => deactivate.mutate({ id, reason: "Deactivated by admin", performedBy: "Vetify Admin" })}
          onReactivate={(id) => reactivate.mutate({ id, reason: "Reactivated by admin", performedBy: "Vetify Admin" })}
        />
      )}
      <RegisterForm
        identityPlaceholder="Approver name"
        pending={register.isPending}
        actionLabel="Register Approver"
        onRegister={(approverName, role, authorizedBy) => register.mutateAsync({ approverName, role, authorizedBy })}
      />
    </CollapsibleSection>
  );
}

function ReviewerRegisterForm({ onRegister, pending }: { onRegister: (role: string, authorizedBy: string) => Promise<void>; pending: boolean }) {
  const [role, setRole] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!role.trim() || !authorizedBy.trim()) {
      setError("Both fields are required");
      return;
    }
    try {
      await onRegister(role, authorizedBy);
      setRole("");
      setAuthorizedBy("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register");
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
      <input className="input text-sm" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
      <input className="input text-sm" placeholder="Authorized by" value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} />
      {error && <p className="text-xs text-red-600 col-span-2">{error}</p>}
      <button onClick={handleSubmit} disabled={pending} className="btn-primary text-sm col-span-2 flex items-center justify-center gap-2 disabled:opacity-50">
        <UserPlus size={14} />
        Register Reviewer
      </button>
    </div>
  );
}

// Sixteenth Slice: AuthorizedReviewer -- unlike the four registries above,
// the real Daml template has only a one-way Deauthorize choice (no
// Reactivate) and no separate identity field, so this section doesn't reuse
// RegistryTable/RegisterForm (which both assume an identity column and a
// reactivate path) -- a plain "Active"/"Deauthorized" table and a
// role/authorizedBy-only form instead.
function ReviewerSection() {
  const { data: reviewers, isLoading } = useReviewers();
  const register = useRegisterReviewer();
  const deauthorize = useDeauthorizeReviewer();

  return (
    <CollapsibleSection
      icon={<FileSearch size={15} className="text-primary" />}
      title="Compliance Reviewer Registry"
      description={
        <>
          Gates who may exercise <code className="font-mono">ApproveCompliance</code>/<code className="font-mono">RejectCompliance</code> as{" "}
          <code className="font-mono">verifier</code>. One-way deauthorization only -- no reinstatement choice exists on the real Daml template.
        </>
      }
    >
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (reviewers ?? []).length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No entries registered yet</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Authorized By</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(reviewers ?? []).map((r) => (
              <tr key={r.id}>
                <td className="text-xs text-gray-600">{r.role}</td>
                <td className="text-xs text-gray-500">{r.authorized_by}</td>
                <td>
                  <span className={`text-xs font-medium ${!r.archived_at ? "text-emerald-600" : "text-gray-400"}`}>
                    {!r.archived_at ? "Active" : "Deauthorized"}
                  </span>
                </td>
                <td className="text-right">
                  {!r.archived_at && (
                    <button
                      onClick={() => deauthorize.mutate({ id: r.id, reason: "Deauthorized by admin" })}
                      disabled={deauthorize.isPending}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Deauthorize
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ReviewerRegisterForm
        pending={register.isPending}
        onRegister={(role, authorizedBy) => register.mutateAsync({ role, authorizedBy })}
      />
    </CollapsibleSection>
  );
}

export default function RegistriesPage() {
  const { user } = useAuth();
  return (
    <Layout title="Governance Registries">
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          RBAC registries gating who may act as each of vetify&apos;s cross-cutting decision-authority roles. Logged in as{" "}
          <span className="font-mono">{user?.name}</span>.
        </p>
        <AssessorSection />
        <SentinelSection />
        <AdvisorSection />
        <PolicyApproverSection />
        <ReviewerSection />
      </div>
    </Layout>
  );
}
