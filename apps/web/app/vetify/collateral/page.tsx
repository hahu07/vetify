"use client";

import { FileText, ShieldCheck } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira, formatDate } from "@/lib/formatters";
import { useRahnAgreements, useCollateralValuationDocuments } from "@/lib/apiClient";

// Phase 2, seventh slice: the vetify oversight view of RahnAgreement
// collateral, giving vetify visibility into every business-submitted
// valuation document platform-wide -- see
// migrations/012_collateral_valuation_document.sql's header for the design
// rationale (this is independent evidence the business submits, not the
// FI's own Revalue decision, which stays out of scope). No page anywhere
// in apps/vetify showed RahnAgreement data at all before this slice.

function statusLabel(status: string) {
  if (status === "CollateralActive") return <span className="text-emerald-600">Active</span>;
  if (status === "CollateralReleased") return <span className="text-gray-500">Released</span>;
  return <span className="text-red-600">Enforced</span>;
}

export default function VetifyCollateralPage() {
  const { data: rahnAgreements, isLoading, isError } = useRahnAgreements();
  const { data: valuationDocuments } = useCollateralValuationDocuments();

  if (isLoading) return <Layout title="Collateral Oversight"><FullPageLoader /></Layout>;
  if (isError || !rahnAgreements) return <Layout title="Collateral Oversight"><ErrorState message="Failed to load collateral agreements" /></Layout>;

  return (
    <Layout title="Collateral Oversight">
      <div className="space-y-6">
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
