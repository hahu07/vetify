"use client";

import { useState } from "react";
import { FileText, ShieldCheck, AlertTriangle } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira, formatDate } from "@/lib/formatters";
import {
  useRahnAgreements,
  useCollateralValuationDocuments,
  usePendingCollateralEnforcements,
  useConfirmEnforce,
  useRejectEnforce,
  useOfficers,
  type PendingCollateralEnforcementItem,
} from "@/lib/apiClient";

// Phase 2, seventh slice: the vetify oversight view of RahnAgreement
// collateral, giving vetify visibility into every business-submitted
// valuation document platform-wide -- see
// migrations/012_collateral_valuation_document.sql's header for the design
// rationale (this is independent evidence the business submits, not the
// FI's own Revalue decision, which stays out of scope). No page anywhere
// in apps/vetify showed RahnAgreement data at all before this slice.
//
// Phase 2, Thirty-Seventh Slice adds the vetify side of the
// ProposeEnforceCollateral maker-checker: the FI's RecoveryOfficer proposes
// (on /fi/contracts/[id]), vetify confirms (nested-exercises the real
// EnforceCollateral) or rejects here.

function statusLabel(status: string) {
  if (status === "CollateralActive") return <span className="text-emerald-600">Active</span>;
  if (status === "CollateralReleased") return <span className="text-gray-500">Released</span>;
  return <span className="text-red-600">Enforced</span>;
}

function PendingEnforcementCard({ pending }: { pending: PendingCollateralEnforcementItem }) {
  const { data: officers } = useOfficers();
  const [confirmedByOfficerId, setConfirmedByOfficerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirmEnforce();
  const reject = useRejectEnforce();

  const confirmers = (officers ?? []).filter((o) => o.active && o.roles.includes("RiskOfficer"));

  const handleConfirm = async () => {
    setError(null);
    if (!confirmedByOfficerId) {
      setError("Select a confirming RiskOfficer (must differ from the proposing RecoveryOfficer)");
      return;
    }
    try {
      await confirm.mutateAsync({ id: pending.id, confirmedByOfficerId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm enforcement");
    }
  };

  const handleReject = async () => {
    setError(null);
    try {
      await reject.mutateAsync({ id: pending.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject enforcement");
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between gap-4 mb-1">
        <p className="text-sm font-semibold text-gray-900">{pending.businessName}</p>
        <span className="text-xs text-amber-700 font-medium">Pending Confirmation</span>
      </div>
      <p className="text-xs text-gray-600 mb-1">{pending.reason}</p>
      <p className="text-xs text-gray-500 mb-3">
        Proposed by <span className="font-mono">{pending.proposedByOfficerId}</span>
        {pending.gsmExhausted && <span> · GSM sweeps attempted{pending.gsmRef ? ` (${pending.gsmRef})` : ""}</span>}
      </p>
      <div className="flex gap-2 items-center">
        <select className="input text-sm flex-1" value={confirmedByOfficerId} onChange={(e) => setConfirmedByOfficerId(e.target.value)}>
          <option value="">Select a confirming RiskOfficer…</option>
          {confirmers.map((o) => (
            <option key={o.id} value={o.officer_id}>{o.officer_name} ({o.officer_id})</option>
          ))}
        </select>
        <button onClick={handleConfirm} disabled={confirm.isPending} className="btn-danger text-xs px-3 py-1.5 disabled:opacity-40 flex-shrink-0">
          {confirm.isPending ? "Confirming…" : "Confirm Enforcement"}
        </button>
        <button onClick={handleReject} disabled={reject.isPending} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 flex-shrink-0">
          {reject.isPending ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export default function VetifyCollateralPage() {
  const { data: rahnAgreements, isLoading, isError } = useRahnAgreements();
  const { data: valuationDocuments } = useCollateralValuationDocuments();
  const { data: pendingEnforcements } = usePendingCollateralEnforcements();

  if (isLoading) return <Layout title="Collateral Oversight"><FullPageLoader /></Layout>;
  if (isError || !rahnAgreements) return <Layout title="Collateral Oversight"><ErrorState message="Failed to load collateral agreements" /></Layout>;

  const pendingList = (pendingEnforcements ?? []).filter((p) => p.status === "Pending");

  return (
    <Layout title="Collateral Oversight">
      <div className="space-y-6">
        {pendingList.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-amber-600" />
              Pending Collateral Enforcements ({pendingList.length})
            </h3>
            <div className="space-y-2">
              {pendingList.map((p) => (
                <PendingEnforcementCard key={p.id} pending={p} />
              ))}
            </div>
          </div>
        )}

        {rahnAgreements.length === 0 ? (
          <div className="card p-8 text-center">
            <ShieldCheck size={24} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No collateral (Rahn) agreements pledged yet</p>
          </div>
        ) : (
          rahnAgreements.map((rahn) => {
            const docs = (valuationDocuments ?? []).filter((d) => d.rahnAgreementId === rahn.id);
            return (
              <div key={rahn.id} className="card overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{rahn.businessName}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{rahn.facilityRef}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">{statusLabel(rahn.collateralStatus)}</p>
                    <p className="text-sm font-mono font-semibold text-gray-900 mt-0.5">{formatNaira(rahn.collateralValue)}</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-800">{rahn.collateralDescription}</p>
                </div>
                <div className="px-4 pb-4">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Submitted Valuation Documents</h4>
                  {docs.length === 0 ? (
                    <p className="text-xs text-gray-400">No valuation documents submitted yet</p>
                  ) : (
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                      {docs.map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-4 p-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={14} className="text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-800">
                                {d.valuatorRef} · {formatDate(d.valuationDate)}
                              </p>
                              {d.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{d.notes}</p>}
                              <p className="text-xs text-gray-300 font-mono mt-0.5 truncate">
                                {d.storageRef.split("/").pop()} · {d.contentHash.slice(0, 12)}…
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-mono text-gray-700 flex-shrink-0">{formatNaira(d.valuationAmount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
