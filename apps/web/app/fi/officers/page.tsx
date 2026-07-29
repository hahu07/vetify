"use client";

import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import Layout from "@/components/Layout";
import { formatNaira } from "@/lib/formatters";
import { useOfficers, useRegisterOfficer, useDeactivateOfficer, useReactivateOfficer } from "@/lib/apiClient";

// New page -- the FI's own AuthorizedOfficer RBAC/approval-limit registry
// (CLAUDE.md's Governance module), gating role + approval-limit checks on
// Financing/Murabahah choices. No legacy-frontend equivalent existed for
// this specific registry either.

// The canonical OfficerRole enum (daml/Vetify/Governance.daml). Found and
// fixed while building the sixth slice (RahnAgreement): the original list
// here had "ComplianceOfficer"/"BranchManager", neither of which exists in
// the real Daml enum -- a fabricated pair that happened to go unnoticed
// until RecoveryOfficer/OperationsOfficer (needed for real four-eyes checks
// on ReleaseCollateral/EnforceCollateral) exposed the mismatch.
const OFFICER_ROLES = ["CreditOfficer", "RiskOfficer", "RecoveryOfficer", "OperationsOfficer", "UnderwritingOfficer"];

export default function OfficersPage() {
  const { data: officers, isLoading } = useOfficers();
  const register = useRegisterOfficer();
  const deactivate = useDeactivateOfficer();
  const reactivate = useReactivateOfficer();

  const [officerId, setOfficerId] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [approvalLimit, setApprovalLimit] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (role: string) => {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const handleRegister = async () => {
    setError(null);
    if (!officerId.trim() || !officerName.trim() || !authorizedBy.trim()) {
      setError("Officer ID, name, and authorized-by are all required");
      return;
    }
    if (roles.length === 0) {
      setError("An officer must hold at least one role");
      return;
    }
    try {
      await register.mutateAsync({
        officerId,
        officerName,
        roles,
        authorizedBy,
        approvalLimit: approvalLimit === "" ? null : approvalLimit,
      });
      setOfficerId("");
      setOfficerName("");
      setRoles([]);
      setAuthorizedBy("");
      setApprovalLimit("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register officer");
    }
  };

  return (
    <Layout title="Officer Registry">
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          Gates role + approval-limit checks on Financing/Murabahah choices, per <span className="font-mono">CLAUDE.md</span>&apos;s Governance module.
        </p>

        <div className="card overflow-hidden">
          {isLoading ? (
            <p className="text-xs text-gray-400 p-4">Loading…</p>
          ) : !officers || officers.length === 0 ? (
            <div className="py-10 text-center">
              <Users size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No officers registered yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Officer ID</th>
                    <th>Name</th>
                    <th>Roles</th>
                    <th>Approval Limit</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {officers.map((o) => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs">{o.officer_id}</td>
                      <td className="text-xs text-gray-900">{o.officer_name}</td>
                      <td className="text-xs text-gray-600">{(o.roles ?? []).join(", ")}</td>
                      <td className="text-xs font-mono text-gray-700">{o.approval_limit != null ? formatNaira(o.approval_limit) : "—"}</td>
                      <td>
                        <span className={`text-xs font-medium ${o.active ? "text-emerald-600" : "text-gray-400"}`}>{o.active ? "Active" : "Inactive"}</span>
                      </td>
                      <td className="text-right">
                        {o.active ? (
                          <button
                            onClick={() => deactivate.mutate({ id: o.id, reason: "Deactivated by admin", performedBy: "Admin" })}
                            disabled={deactivate.isPending}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivate.mutate({ id: o.id, reason: "Reactivated by admin", performedBy: "Admin" })}
                            disabled={reactivate.isPending}
                            className="text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Register Officer</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input className="input text-sm" placeholder="Officer ID (e.g. OFF-001)" value={officerId} onChange={(e) => setOfficerId(e.target.value)} />
            <input className="input text-sm" placeholder="Officer name" value={officerName} onChange={(e) => setOfficerName(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Roles (at least one)</label>
            <div className="flex flex-wrap gap-2">
              {OFFICER_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    roles.includes(role) ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input className="input text-sm" placeholder="Authorized by" value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} />
            <input
              type="number"
              className="input text-sm font-mono"
              placeholder="Approval limit (NGN, optional)"
              value={approvalLimit}
              onChange={(e) => setApprovalLimit(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <button onClick={handleRegister} disabled={register.isPending} className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            <UserPlus size={14} />
            Register Officer
          </button>
        </div>
      </div>
    </Layout>
  );
}
