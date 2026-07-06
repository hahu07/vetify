import { FileText, TrendingUp, AlertTriangle, CheckCircle2, Download } from 'lucide-react'
import Layout from '../../components/Layout'
import AmountDisplay from '../../components/AmountDisplay'

interface PortfolioReportRow {
  id: string
  reportDate: string
  period: string
  totalDisbursed: number
  activeContracts: number
  delinquencyRate: number
  completed: number
  defaulted: number
}

const MOCK_REPORTS: PortfolioReportRow[] = [
  {
    id: 'rpt-june-2026',
    reportDate: '2026-06-01T00:00:00Z',
    period: 'June 2026',
    totalDisbursed: 11_500_000,
    activeContracts: 2,
    delinquencyRate: 14.3,
    completed: 1,
    defaulted: 0,
  },
  {
    id: 'rpt-may-2026',
    reportDate: '2026-05-01T00:00:00Z',
    period: 'May 2026',
    totalDisbursed: 10_300_000,
    activeContracts: 3,
    delinquencyRate: 0,
    completed: 1,
    defaulted: 0,
  },
  {
    id: 'rpt-apr-2026',
    reportDate: '2026-04-01T00:00:00Z',
    period: 'April 2026',
    totalDisbursed: 10_300_000,
    activeContracts: 3,
    delinquencyRate: 0,
    completed: 0,
    defaulted: 0,
  },
  {
    id: 'rpt-mar-2026',
    reportDate: '2026-03-01T00:00:00Z',
    period: 'March 2026',
    totalDisbursed: 9_100_000,
    activeContracts: 2,
    delinquencyRate: 0,
    completed: 0,
    defaulted: 0,
  },
]

const latest = MOCK_REPORTS[0]

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
  return (
    <Layout title="Portfolio Reports">
      <div className="space-y-6 animate-fade-in">
        {/* Latest Report Summary Card */}
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
                <h2 className="text-white text-lg font-bold">{latest.period}</h2>
                <p className="text-white/50 text-xs mt-0.5">Generated {formatDate(latest.reportDate)}</p>
              </div>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                style={{ backgroundColor: 'rgba(201,168,76,0.2)', color: '#e8c97a', border: '1px solid rgba(201,168,76,0.3)' }}
              >
                <Download size={12} />
                Export PDF
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-white/50 text-xs mb-1">Total Disbursed</p>
                <p className="text-white font-bold text-base">
                  ₦{(latest.totalDisbursed / 1_000_000).toFixed(1)}M
                </p>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-1">Active Contracts</p>
                <p className="text-white font-bold text-base">{latest.activeContracts}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-1">Delinquency Rate</p>
                <p
                  className="font-bold text-base"
                  style={{ color: latest.delinquencyRate > 10 ? '#FCA5A5' : '#6EE7B7' }}
                >
                  {formatPct(latest.delinquencyRate)}
                </p>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-1">Completed</p>
                <p className="text-white font-bold text-base">{latest.completed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Reports table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">All Portfolio Reports</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Report Date</th>
                  <th>Total Disbursed</th>
                  <th>Active</th>
                  <th>Delinquency</th>
                  <th>Completed</th>
                  <th>Defaulted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_REPORTS.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'rgba(13,110,77,0.08)' }}
                        >
                          <FileText size={12} style={{ color: '#0D6E4D' }} />
                        </div>
                        <span className="font-medium text-gray-900 text-xs">{r.period}</span>
                      </div>
                    </td>
                    <td className="text-xs text-gray-500">{formatDate(r.reportDate)}</td>
                    <td>
                      <AmountDisplay amount={r.totalDisbursed} />
                    </td>
                    <td>
                      <span className="text-xs font-semibold text-gray-800">{r.activeContracts}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {r.delinquencyRate > 10 ? (
                          <AlertTriangle size={12} className="text-red-500" />
                        ) : (
                          <CheckCircle2 size={12} className="text-emerald-500" />
                        )}
                        <span
                          className="text-xs font-semibold"
                          style={{ color: r.delinquencyRate > 10 ? '#DC2626' : '#059669' }}
                        >
                          {formatPct(r.delinquencyRate)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
                      >
                        <TrendingUp size={10} />
                        {r.completed}
                      </span>
                    </td>
                    <td>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: r.defaulted > 0 ? '#FEE2E2' : '#F3F4F6',
                          color: r.defaulted > 0 ? '#991B1B' : '#6B7280',
                        }}
                      >
                        {r.defaulted}
                      </span>
                    </td>
                    <td>
                      <button
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        title="View PDF stub"
                      >
                        <Download size={12} />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty state for when no reports */}
        {MOCK_REPORTS.length === 0 && (
          <div className="card py-16 text-center">
            <p className="text-sm text-gray-400">No portfolio reports available</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
