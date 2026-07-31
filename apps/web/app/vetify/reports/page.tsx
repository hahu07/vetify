"use client";

import { useState } from "react";
import { FileBarChart, RefreshCw, ShieldAlert, X } from "lucide-react";
import Layout from "@/components/Layout";
import { FullPageLoader, ErrorState } from "@/components/LoadingState";
import { formatNaira, formatDate } from "@/lib/formatters";
import { usePortfolioReports, useGeneratePortfolioReport, usePortfolioRiskReports, useCreatePortfolioRiskReport } from "@/lib/apiClient";

// Phase 2, Forty-Third Slice: PortfolioRiskReport (Basel-style PD/LGD/EAD
// portfolio metrics) -- a distinct template from PortfolioReport above (the
// deterministic contract-count/disbursement summary), so it gets its own
// section rather than folding into the existing card shape.

function CreateRiskReportModal({ onClose }: { onClose: () => void }) {
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportPeriod, setReportPeriod] = useState("");
  const [probabilityOfDefault, setProbabilityOfDefault] = useState(0);
  const [lossGivenDefault, setLossGivenDefault] = useState(0);
  const [expectedLoss, setExpectedLoss] = useState(0);
  const [exposureAtDefault, setExposureAtDefault] = useState(0);
  const [concentrationRisk, setConcentrationRisk] = useState(0);
  const [sectorConcentration, setSectorConcentration] = useState("");
  const [delinquencyRate, setDelinquencyRate] = useState(0);
  const [activeContractCount, setActiveContractCount] = useState(0);
  const [generatedByAgent, setGeneratedByAgent] = useState("vetify-reporting");
  const [modelVersion, setModelVersion] = useState("v1.0");
  const [error, setError] = useState<string | null>(null);
  const create = useCreatePortfolioRiskReport();

  const handleSubmit = async () => {
    setError(null);
    if (!reportPeriod.trim() || !sectorConcentration.trim() || !generatedByAgent.trim() || !modelVersion.trim()) {
      setError("Report period, sector concentration, generator, and model version are all required");
      return;
    }
    try {
      await create.mutateAsync({
        reportDate, reportPeriod,
        metrics: { probabilityOfDefault, lossGivenDefault, expectedLoss, exposureAtDefault, concentrationRisk, sectorConcentration, delinquencyRate, activeContractCount },
        generatedByAgent, modelVersion,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create the risk report");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Portfolio Risk Report</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Report Date</label>
            <input type="date" className="input text-sm" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Report Period</label>
            <input className="input text-sm" value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)} placeholder="Q3 2026" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Probability of Default (%)</label>
            <input type="number" step="0.01" className="input text-sm font-mono" value={probabilityOfDefault} onChange={(e) => setProbabilityOfDefault(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Loss Given Default (%)</label>
            <input type="number" step="0.01" className="input text-sm font-mono" value={lossGivenDefault} onChange={(e) => setLossGivenDefault(Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Expected Loss (NGN)</label>
            <input type="number" className="input text-sm font-mono" value={expectedLoss} onChange={(e) => setExpectedLoss(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Exposure at Default (NGN)</label>
            <input type="number" className="input text-sm font-mono" value={exposureAtDefault} onChange={(e) => setExposureAtDefault(Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Concentration Risk (%)</label>
            <input type="number" step="0.01" className="input text-sm font-mono" value={concentrationRisk} onChange={(e) => setConcentrationRisk(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Delinquency Rate (%)</label>
            <input type="number" step="0.01" className="input text-sm font-mono" value={delinquencyRate} onChange={(e) => setDelinquencyRate(Number(e.target.value))} />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Sector Concentration</label>
          <input className="input text-sm" value={sectorConcentration} onChange={(e) => setSectorConcentration(e.target.value)} placeholder="Retail Trade: 42%" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Active Contract Count</label>
          <input type="number" className="input text-sm font-mono" value={activeContractCount} onChange={(e) => setActiveContractCount(Number(e.target.value))} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Generated By</label>
            <input className="input text-sm" value={generatedByAgent} onChange={(e) => setGeneratedByAgent(e.target.value)} placeholder="vetify-reporting" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Model Version</label>
            <input className="input text-sm font-mono" value={modelVersion} onChange={(e) => setModelVersion(e.target.value)} placeholder="v1.0" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1 disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const { data: riskReports } = usePortfolioRiskReports();
  const generate = useGeneratePortfolioReport();
  const [riskModalOpen, setRiskModalOpen] = useState(false);

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

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-gray-800">Portfolio Risk Reports</h2>
            </div>
            <button onClick={() => setRiskModalOpen(true)} className="btn-secondary text-xs px-3 py-1.5">
              New Risk Report
            </button>
          </div>
          <div className="card overflow-hidden">
            {(riskReports ?? []).length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No portfolio risk reports yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(riskReports ?? []).map((r) => (
                  <div key={r.id} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">{r.reportPeriod}</h3>
                      <span className="text-xs text-gray-400">{formatDate(r.reportDate)} · {r.generatedByAgent} ({r.modelVersion})</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">PD</p>
                        <p className="text-sm font-mono font-semibold text-gray-900">{r.metrics.probabilityOfDefault}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">LGD</p>
                        <p className="text-sm font-mono font-semibold text-gray-900">{r.metrics.lossGivenDefault}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Expected Loss</p>
                        <p className="text-sm font-mono font-semibold text-gray-900">{formatNaira(r.metrics.expectedLoss)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Delinquency Rate</p>
                        <p className="text-sm font-mono font-semibold text-amber-600">{r.metrics.delinquencyRate}%</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{r.metrics.sectorConcentration}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {riskModalOpen && <CreateRiskReportModal onClose={() => setRiskModalOpen(false)} />}
    </Layout>
  );
}
