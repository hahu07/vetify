import { useState } from 'react'
import { CheckCircle2, XCircle, Flag } from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import { formatDate } from '../../lib/formatters'
import { useOnboardingList } from '../../api/client'
import type { Onboarding } from '../../api/client'

type FilterTab = 'All' | 'Draft' | 'Pending' | 'UnderReview' | 'ManualReview' | 'Approved' | 'Rejected'

const TABS: FilterTab[] = ['All', 'Draft', 'Pending', 'UnderReview', 'ManualReview', 'Approved', 'Rejected']

const TAB_LABELS: Record<FilterTab, string> = {
  All: 'All',
  Draft: 'Draft',
  Pending: 'Pending',
  UnderReview: 'Under Review',
  ManualReview: 'Manual Review',
  Approved: 'Approved',
  Rejected: 'Rejected',
}

export default function VetifyOnboarding() {
  const [activeTab, setActiveTab] = useState<FilterTab>('All')
  const { data: onboardingData, isLoading, isError } = useOnboardingList()
  const onboarding = onboardingData ?? []

  const filtered: Onboarding[] =
    activeTab === 'All'
      ? onboarding
      : onboarding.filter((o) => o.status === activeTab)

  if (isLoading) return <Layout title="Onboarding Pipeline"><FullPageLoader /></Layout>
  if (isError) return <Layout title="Onboarding Pipeline"><ErrorState message="Failed to load onboarding pipeline" /></Layout>

  return (
    <Layout title="Onboarding Pipeline">
      <div className="space-y-5 animate-fade-in">
        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const count =
              tab === 'All'
                ? onboarding.length
                : onboarding.filter((o) => o.status === tab).length
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? '#0D6E4D' : '#fff',
                  color: isActive ? '#fff' : '#6B7280',
                  border: isActive ? 'none' : '1px solid #E5E7EB',
                }}
              >
                {TAB_LABELS[tab]}
                {count > 0 && (
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#F3F4F6',
                      color: isActive ? '#fff' : '#6B7280',
                      fontSize: 10,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">No businesses in this category</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Type</th>
                    <th>CAC No</th>
                    <th>Director</th>
                    <th>Submitted</th>
                    <th>Agent Score</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div>
                          <p className="font-medium text-gray-900 text-xs">{o.profile.name}</p>
                          <p className="text-gray-400 text-xs font-mono mt-0.5">
                            {o.id.slice(0, 18)}…
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-gray-600">
                          {o.profile.businessType === 'LimitedCompany'
                            ? 'Limited Co.'
                            : 'Sole Prop.'}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-gray-700">{o.kyc.cacRegNumber}</span>
                      </td>
                      <td>
                        <p className="text-xs text-gray-700">{o.profile.directors[0]?.name ?? '—'}</p>
                      </td>
                      <td className="text-xs text-gray-500">
                        {o.submittedAt ? formatDate(o.submittedAt) : '—'}
                      </td>
                      <td>
                        {o.agentScore != null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-10 bg-gray-200 rounded-full overflow-hidden">
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
                      <td>
                        <StatusBadge status={o.status} size="sm" />
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            title="Approve"
                            className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors text-gray-400 hover:text-emerald-600"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            title="Reject"
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600"
                          >
                            <XCircle size={14} />
                          </button>
                          <button
                            title="Flag for manual review"
                            className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors text-gray-400 hover:text-amber-600"
                          >
                            <Flag size={14} />
                          </button>
                        </div>
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
