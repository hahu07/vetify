"use client";

import { FileBarChart, RefreshCw } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira, formatDate } from "@/lib/formatters";
import { usePortfolioReports, useGeneratePortfolioReport } from "@/lib/apiClient";

// New page -- the Reporting module (CLAUDE.md's "Reporting Agent") had no
// frontend, backend, or schema anywhere in this migration until this pass.
// The real system's Reporting Agent runs a monthly autonomous sweep with an
// LLM-authored narrative; this slice has neither an autonomous Supervisor
// nor an LLM, so report generation is a manual vetify button (same
// simplification precedent as Stage 3-4's "Open Compliance Review" button)
// and the summary is a deterministic templated sentence
// (lib/scoring/reporting.ts's buildSummary), not a fabricated narrative.

export default function VetifyReportsPage() {
  const { data: reports, isLoading, isError } = usePortfolioReports();
  const generate = useGeneratePortfolioReport();

  if (isLoading) return <Layout title="Portfolio Reports"><FullPageLoader /></Layout>;
  if (isError || !reports) return <Layout title="Portfolio Reports"><ErrorState message="Failed to load portfolio reports" /></Layout>;

  return (
    <Layout title="Portfolio Reports">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 max-w-2xl">
            Every metric below is computed deterministically from the current <span className="font-mono">MurabahahContract</span> set
            (<span className="font-mono">lib/scoring/reporting.ts</span>) -- no LLM involved in this migration, so the summary is a templated
            sentence, not a narrative.
          </p>
          <button onClick={() => generate.mutate()} disabled={generate.isPending} className="btn-primary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-50 flex-shrink-0">
            <RefreshCw size={14} className={generate.isPending ? "animate-spin" : ""} />
            {generate.isPending ? "Generating…" : "Generate Report"}
          </button>
        </div>

        {generate.isError && <p className="text-xs text-red-600">{(generate.error as Error)?.message ?? "Failed to generate report"}</p>}

        <div className="card overflow-hidden">
          {reports.length === 0 ? (
            <div className="py-16 text-center">
              <FileBarChart size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No portfolio reports generated yet</p>
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
      </div>
    </Layout>
  );
}
