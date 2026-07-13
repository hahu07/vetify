import { FileText, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Layout from '../../components/Layout'
import AmountDisplay from '../../components/AmountDisplay'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import { usePortfolioReports } from '../../api/client'
import type { PortfolioReport } from '../../api/client'

function delinquencyRate(r: PortfolioReport): number {
  return r.totalActiveContracts > 0 ? (r.delinquentCount / r.totalActiveContracts) * 100 : 0
}

function formatPct(v: number): string {
  return `${v.toFixed(1)}%`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function VetifyReports() {
  const { data: reports, isLoading, isError } = usePortfolioReports()

  if (isLoading) return <Layout title="Portfolio Reports"><FullPageLoader /></Layout>
  if (isError || !reports) return <Layout title="Portfolio Reports"><ErrorState message="Failed to load portfolio reports" /></Layout>

  const latest = reports[0]

  return (
    <Layout title="Portfolio Reports">
      <div className="space-y-6 animate-fade-in">
        {/* Latest Report Summary Card */}
        {latest && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              backgroundImage:
                'linear-gradient(135deg, #0D6E4D 0%, #0A4A34 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 0, transparent 50%), repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 0, transparent 50%)',
              backgroundSize: 'cover, 20px 20px, 20px 20px',
            }}
          >
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #C9A84C, #e8c97a, #C9A84C)' }} />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-white/50 text-xs mb-1">Latest Report</p>
                  <h2 className="text-white text-lg font-bold">{formatDate(latest.reportDate)}</h2>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-white/50 text-xs mb-1">Total Disbursed</p>
                  <p className="text-white font-bold text-base">
                    ₦{(latest.totalDisbursed / 1_000_000).toFixed(1)}M
                  </p>
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1">Active Contracts</p>
                  <p className="text-white font-bold text-base">{latest.totalActiveContracts}</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1">Delinquency Rate</p>
                  <p
                    className="font-bold text-base"
                    style={{ color: delinquencyRate(latest) > 10 ? '#FCA5A5' : '#6EE7B7' }}
                  >
                    {formatPct(delinquencyRate(latest))}
                  </p>
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1">Completed</p>
                  <p className="text-white font-bold text-base">{latest.completedCount}</p>
                </div>
              </div>

              {latest.summary && (
                <p className="text-white/70 text-xs leading-relaxed border-t border-white/10 pt-4">
                  {latest.summary}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Reports table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">All Portfolio Reports</h3>
          </div>
          {reports.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">No portfolio reports available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Report Date</th>
                    <th>Total Disbursed</th>
                    <th>Outstanding</th>
                    <th>Active</th>
                    <th>Delinquency</th>
                    <th>Completed</th>
                    <th>Defaulted</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'rgba(13,110,77,0.08)' }}
                          >
                            <FileText size={12} style={{ color: '#0D6E4D' }} />
                          </div>
                          <span className="font-medium text-gray-900 text-xs">{formatDate(r.reportDate)}</span>
                        </div>
                      </td>
                      <td>
                        <AmountDisplay amount={r.totalDisbursed} />
                      </td>
                      <td>
                        <AmountDisplay amount={r.totalOutstanding} />
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-gray-800">{r.totalActiveContracts}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {delinquencyRate(r) > 10 ? (
                            <AlertTriangle size={12} className="text-red-500" />
                          ) : (
                            <CheckCircle2 size={12} className="text-emerald-500" />
                          )}
                          <span
                            className="text-xs font-semibold"
                            style={{ color: delinquencyRate(r) > 10 ? '#DC2626' : '#059669' }}
                          >
                            {formatPct(delinquencyRate(r))}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
                        >
                          <TrendingUp size={10} />
                          {r.completedCount}
                        </span>
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: r.defaultedCount > 0 ? '#FEE2E2' : '#F3F4F6',
                            color: r.defaultedCount > 0 ? '#991B1B' : '#6B7280',
                          }}
                        >
                          {r.defaultedCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
