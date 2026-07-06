import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Eye, CreditCard, FileX } from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import AmountDisplay from '../../components/AmountDisplay'
import { EmptyState, FullPageLoader, ErrorState } from '../../components/LoadingState'
import { useContracts } from '../../api/client'
import type { MurabahahStatus } from '../../api/client'

type FilterTab = 'All' | MurabahahStatus

const TABS: FilterTab[] = ['All', 'Active', 'Delinquent', 'Completed', 'Defaulted']

const PAGE_SIZE = 10

export default function ContractList() {
  const [activeTab, setActiveTab] = useState<FilterTab>('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: contractsData, isLoading, isError } = useContracts()
  const contracts = contractsData ?? []

  const filtered = contracts.filter((c) => {
    const matchesTab = activeTab === 'All' || c.status === activeTab
    const matchesSearch =
      !search ||
      c.businessName.toLowerCase().includes(search.toLowerCase()) ||
      c.cacNumber.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (isLoading) {
    return (
      <Layout breadcrumb={[{ label: 'FI Dashboard', path: '/fi/dashboard' }, { label: 'Contracts' }]}>
        <FullPageLoader />
      </Layout>
    )
  }

  if (isError) {
    return (
      <Layout breadcrumb={[{ label: 'FI Dashboard', path: '/fi/dashboard' }, { label: 'Contracts' }]}>
        <ErrorState message="Failed to load contracts" />
      </Layout>
    )
  }

  return (
    <Layout
      breadcrumb={[
        { label: 'FI Dashboard', path: '/fi/dashboard' },
        { label: 'Contracts' },
      ]}
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Murabahah Contracts</h1>
            <p className="text-sm text-gray-500 mt-0.5">{contracts.length} total contracts</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Filter tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setPage(1) }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                  {tab === 'All' && (
                    <span className="ml-1 text-gray-400">({contracts.length})</span>
                  )}
                  {tab !== 'All' && (
                    <span className="ml-1 text-gray-400">
                      ({contracts.filter((c) => c.status === tab).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-xs sm:ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search business name or CAC..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="input pl-9 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Table + Mobile card list */}
        <div className="card overflow-hidden">
          {paginated.length === 0 ? (
            <EmptyState
              title="No contracts found"
              description={search ? 'Try a different search term' : 'No contracts match the selected filter'}
              icon={<FileX size={24} className="text-gray-400" />}
            />
          ) : (
            <>
              {/* ── Desktop table (hidden on mobile) ── */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="table" style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th>Business Name</th>
                      <th>CAC No.</th>
                      <th>Sale Price</th>
                      <th>Outstanding</th>
                      <th>Installment</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((contract) => {
                      const progress =
                        ((contract.terms.salePrice - contract.outstandingBalance) /
                          contract.terms.salePrice) *
                        100

                      return (
                        <tr key={contract.id}>
                          <td>
                            <div>
                              <p className="font-medium text-gray-900">{contract.businessName}</p>
                              <div className="mt-1 w-24">
                                <div className="progress-bar h-1">
                                  <div
                                    className="progress-fill h-full"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">{progress.toFixed(0)}% repaid</p>
                            </div>
                          </td>
                          <td>
                            <span className="font-mono text-xs text-gray-600">{contract.cacNumber}</span>
                          </td>
                          <td>
                            <AmountDisplay amount={contract.terms.salePrice} />
                          </td>
                          <td>
                            <AmountDisplay
                              amount={contract.outstandingBalance}
                              className={contract.status === 'Delinquent' ? 'text-red-600 font-semibold' : ''}
                            />
                          </td>
                          <td>
                            <AmountDisplay amount={contract.terms.installmentAmount} />
                          </td>
                          <td>
                            <StatusBadge status={contract.status} />
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                to={`/fi/contracts/${contract.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary text-xs font-medium hover:bg-primary-100 transition-colors"
                              >
                                <Eye size={12} />
                                View
                              </Link>
                              <Link
                                to={`/fi/contracts/${contract.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
                              >
                                <CreditCard size={12} />
                                Payment
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile card list (shown only on mobile, hidden sm:) ── */}
              <div className="sm:hidden divide-y divide-gray-100">
                {paginated.map((contract) => {
                  const progress =
                    ((contract.terms.salePrice - contract.outstandingBalance) /
                      contract.terms.salePrice) *
                    100

                  return (
                    <div key={contract.id} className="p-4 space-y-3">
                      {/* Top row: name + status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm leading-tight">{contract.businessName}</p>
                          <p className="text-xs font-mono text-gray-500 mt-0.5">{contract.cacNumber}</p>
                        </div>
                        <StatusBadge status={contract.status} />
                      </div>

                      {/* Amounts row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Sale Price</p>
                          <AmountDisplay amount={contract.terms.salePrice} className="text-xs" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Outstanding</p>
                          <AmountDisplay
                            amount={contract.outstandingBalance}
                            className={`text-xs ${contract.status === 'Delinquent' ? 'text-red-600 font-semibold' : ''}`}
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Installment</p>
                          <AmountDisplay amount={contract.terms.installmentAmount} className="text-xs" />
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-gray-400">Repayment progress</span>
                          <span className="text-xs font-medium text-primary">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="progress-bar h-1.5">
                          <div className="progress-fill h-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      {/* Action buttons — always fully visible at 375px */}
                      <div className="flex gap-2 pt-1">
                        <Link
                          to={`/fi/contracts/${contract.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-600 transition-colors"
                        >
                          <Eye size={13} />
                          View Details
                        </Link>
                        <Link
                          to={`/fi/contracts/${contract.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors"
                        >
                          <CreditCard size={13} />
                          Record Payment
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination (shared) */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
                    {filtered.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn-secondary py-1 px-2.5 text-xs disabled:opacity-40"
                    >
                      Prev
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i + 1)}
                        className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                          page === i + 1
                            ? 'bg-primary text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="btn-secondary py-1 px-2.5 text-xs disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
