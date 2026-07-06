import { useNavigate } from 'react-router-dom'
import {
  Users,
  Clock,
  FileText,
  Shield,
  Banknote,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import AmountDisplay from '../../components/AmountDisplay'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import { formatDate } from '../../lib/formatters'
import { useOnboardingList, useComplianceQueue, useContracts } from '../../api/client'

interface Alert {
  id: string
  businessName: string
  type: 'ManualReview' | 'Delinquent' | 'CompliancePending'
  path: string
}

export default function VetifyDashboard() {
  const navigate = useNavigate()
  const { data: onboarding, isLoading: l1, isError: e1 } = useOnboardingList()
  const { data: complianceQueue, isLoading: l2, isError: e2 } = useComplianceQueue()
  const { data: contracts, isLoading: l3, isError: e3 } = useContracts()

  if (l1 || l2 || l3) return <Layout title="Platform Overview"><FullPageLoader /></Layout>
  if (e1 || e2 || e3 || !onboarding || !complianceQueue || !contracts) {
    return <Layout title="Platform Overview"><ErrorState message="Failed to load platform overview" /></Layout>
  }

  const totalBusinesses = onboarding.length
  const pendingReviews = onboarding.filter((o) => o.status === 'UnderReview' || o.status === 'ManualReview').length
  const activeContracts = contracts.filter((c) => c.status === 'Active').length
  const pendingCompliance = complianceQueue.filter((c) => c.status === 'Pending' || c.status === 'UnderReview').length
  const totalDisbursed = contracts
    .filter((c) => c.status === 'Active' || c.status === 'Completed')
    .reduce((sum, c) => sum + c.terms.salePrice, 0)

  const KPI_CARDS = [
    { label: 'Total Businesses', value: totalBusinesses, icon: Users, color: '#0D6E4D' },
    { label: 'Pending Reviews', value: pendingReviews, icon: Clock, color: '#F59E0B' },
    { label: 'Active Contracts', value: activeContracts, icon: FileText, color: '#3B82F6' },
    { label: 'Pending Compliance', value: pendingCompliance, icon: Shield, color: '#8B5CF6' },
  ]

  const alerts: Alert[] = [
    ...onboarding
      .filter((o) => o.status === 'ManualReview')
      .map((o): Alert => ({ id: o.id, businessName: o.profile.name, type: 'ManualReview', path: '/vetify/onboarding' })),
    ...contracts
      .filter((c) => c.status === 'Delinquent')
      .map((c): Alert => ({ id: c.id, businessName: c.businessName, type: 'Delinquent', path: '/fi/contracts' })),
    ...complianceQueue
      .filter((c) => c.status === 'Pending' || c.status === 'UnderReview')
      .map((c): Alert => ({ id: c.id, businessName: c.businessName, type: 'CompliancePending', path: '/vetify/compliance' })),
  ]

  return (
    <Layout title="Platform Overview">
      <div className="space-y-6 animate-fade-in">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {KPI_CARDS.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${color}14` }}
                >
                  <Icon size={14} style={{ color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          ))}

          {/* Total Disbursed — spans full width on mobile, 1 col on large */}
          <div className="card p-4 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-medium">Total Disbursed</p>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(201,168,76,0.12)' }}
              >
                <Banknote size={14} style={{ color: '#C9A84C' }} />
              </div>
            </div>
            <AmountDisplay amount={totalDisbursed} large />
          </div>
        </div>

        {/* Main content: pipeline table + alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Onboarding pipeline table (60%) */}
          <div className="lg:col-span-3 card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Onboarding Pipeline</h3>
              <button
                onClick={() => navigate('/vetify/onboarding')}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight size={12} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>CAC No</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {onboarding.map((o) => (
                    <tr
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => navigate('/vetify/onboarding')}
                    >
                      <td>
                        <p className="font-medium text-gray-900 text-xs">{o.profile.name}</p>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-gray-600">{o.kyc.cacRegNumber}</span>
                      </td>
                      <td>
                        <StatusBadge status={o.status} size="sm" />
                      </td>
                      <td className="text-xs text-gray-500">
                        {o.submittedAt ? formatDate(o.submittedAt) : '—'}
                      </td>
                      <td>
                        {o.agentScore != null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-12 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${o.agentScore}%`,
                                  backgroundColor:
                                    o.agentScore >= 80
                                      ? '#10B981'
                                      : o.agentScore >= 50
                                      ? '#F59E0B'
                                      : '#EF4444',
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-700">{o.agentScore}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alerts feed (40%) */}
          <div className="lg:col-span-2 card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Alerts — Action Required</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {alerts.map((alert) => (
                <div key={alert.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {alert.type === 'ManualReview' && (
                        <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                          <AlertTriangle size={13} className="text-amber-500" />
                        </div>
                      )}
                      {alert.type === 'Delinquent' && (
                        <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                          <AlertCircle size={13} className="text-red-500" />
                        </div>
                      )}
                      {alert.type === 'CompliancePending' && (
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Clock size={13} className="text-blue-500" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{alert.businessName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {alert.type === 'ManualReview' && 'Flagged for manual review'}
                        {alert.type === 'Delinquent' && 'Contract delinquent'}
                        {alert.type === 'CompliancePending' && 'Compliance pending >48hrs'}
                      </p>
                    </div>

                    <button
                      onClick={() => navigate(alert.path)}
                      className="flex-shrink-0 text-xs text-primary font-medium hover:underline"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">No pending alerts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
