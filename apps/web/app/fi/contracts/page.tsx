"use client";

import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira } from "@/lib/formatters";
import { useMurabahahContracts } from "@/lib/apiClient";

// New page -- Stage 9-10's repayment lifecycle had only been verified via
// curl/API until now (see the "Phase 2, Third Slice" design-doc section).
// Ported list+detail shape mirrors frontend/src/pages/fi/ContractList.tsx's
// intent (a simple facility list linking into per-contract detail) without
// its fuller collections/restructuring surface, all deferred in
// migrations/008_murabahah_stage9_10.sql.

export default function FiContractsPage() {
  const { data: contracts, isLoading, isError } = useMurabahahContracts();

  if (isLoading) return <Layout title="Murabahah Contracts"><FullPageLoader /></Layout>;
  if (isError || !contracts) return <Layout title="Murabahah Contracts"><ErrorState message="Failed to load contracts" /></Layout>;

  return (
    <Layout title="Murabahah Contracts">
      <div className="card overflow-hidden">
        {contracts.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No Murabahah contracts yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {contracts.map((c) => (
              <Link key={c.id} href={`/fi/contracts/${c.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-surface transition-colors group">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{c.businessName}</p>
                    <StatusBadge status={c.status} size="sm" />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{c.facilityRef}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Outstanding</p>
                    <p className="text-sm font-mono font-semibold text-gray-900">{formatNaira(c.outstandingBalance)}</p>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
