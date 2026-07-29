"use client";

import { FileBarChart } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira, formatDate } from "@/lib/formatters";
import { usePortfolioReports } from "@/lib/apiClient";

// Read-only counterpart to app/vetify/reports/page.tsx (same shape as
// app/fi/reports/page.tsx) -- no generate action (PortfolioReport is
// vetify-signed; regulator is only ever the read-only supervisory
// observer in the Daml original).

export default function FiReportsPage() {
  const { data: reports, isLoading, isError } = usePortfolioReports();

  if (isLoading) return <Layout title="Portfolio Reports"><FullPageLoader /></Layout>;
  if (isError || !reports) return <Layout title="Portfolio Reports"><ErrorState message="Failed to load portfolio reports" /></Layout>;

  return (
    <Layout title="Portfolio Reports">
      <div className="card overflow-hidden">
        {reports.length === 0 ? (
          <div className="py-16 text-center">
            <FileBarChart size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No portfolio reports published yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((r) => (
              <div key={r.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">{formatDate(r.reportDate)}</h3>
                  <span className="text-xs text-gray-400">Generated {formatDate(r.createdAt)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Active Contracts</p>
                    <p className="text-base font-mono font-semibold text-gray-900">{r.totalActiveContracts}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Disbursed</p>
                    <p className="text-base font-mono font-semibold text-gray-900">{formatNaira(r.totalDisbursed)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Outstanding</p>
                    <p className="text-base font-mono font-semibold text-gray-900">{formatNaira(r.totalOutstanding)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Delinquent</p>
                    <p className="text-base font-mono font-semibold text-amber-600">{r.delinquentCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Completed</p>
                    <p className="text-base font-mono font-semibold text-emerald-600">{r.completedCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Defaulted</p>
                    <p className="text-base font-mono font-semibold text-red-600">{r.defaultedCount}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 bg-surface rounded-lg px-3 py-2">{r.summary}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
