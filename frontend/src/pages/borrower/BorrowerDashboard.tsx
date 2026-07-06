import { Link } from 'react-router-dom'
import {
  FileText,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Send,
  RefreshCw,
  CreditCard,
} from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import AmountDisplay from '../../components/AmountDisplay'
import { FullPageLoader, ErrorState, EmptyState } from '../../components/LoadingState'
import { formatDate } from '../../lib/formatters'
import { useOnboardingList, useContracts, useContractRepayments } from '../../api/client'

const LIFECYCLE_STAGES = [
  { num: 1, label: 'Onboarding', icon: '📋' },
  { num: 2, label: 'Verification', icon: '🔍' },
  { num: 3, label: 'Compliance', icon: '🛡️' },
  { num: 4, label: 'Approved', icon: '✅' },
  { num: 5, label: 'Fin. Request', icon: '💰' },
  { num: 6, label: 'Underwriting', icon: '📊' },
  { num: 7, label: 'FI Review', icon: '🏦' },
  { num: 8, label: 'Murabahah', icon: '📝' },
  { num: 9, label: 'Repayment', icon: '💳' },
  { num: 10, label: 'Closure', icon: '🎉' },
]

function getStageFromStatus(status: string): number {
  switch (status) {
    case 'Draft': return 1
    case 'Pending': return 1
    case 'UnderReview': return 2
    case 'ManualReview': return 3
    case 'Approved': return 4
    default: return 1
  }
}

export default function BorrowerDashboard() {
  const { data: onboardingList, isLoading: loadingOnboarding, isError: onboardingError } = useOnboardingList()
  const { data: contracts, isLoading: loadingContracts } = useContracts()

  const onboarding = onboardingList?.[0]
  const activeContract = contracts?.find((c) => c.status === 'Active')

  const { data: repayments } = useContractRepayments(activeContract?.cacNumber ?? '')
  const recentRepayments = (repayments ?? []).slice(0, 5)

  if (loadingOnboarding || loadingContracts) return <Layout title="Borrower Portal"><FullPageLoader /></Layout>
  if (onboardingError) return <Layout title="Borrower Portal"><ErrorState message="Failed to load your application" /></Layout>
  if (!onboarding) {
    return (
      <Layout title="Borrower Portal">
        <EmptyState
          title="No application yet"
          description="Start your onboarding application to begin the financing lifecycle."
        />
      </Layout>
    )
  }

  const currentStage = getStageFromStatus(onboarding.status)

  return (
    <Layout title="Borrower Portal">
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div
          className="rounded-xl overflow-hidden relative"
          style={{
            backgroundImage: 'linear-gradient(135deg, #0D6E4D 0%, #0A4A34 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 0, transparent 50%), repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 0, transparent 50%)',
            backgroundSize: 'cover, 20px 20px, 20px 20px',
            backgroundBlendMode: 'normal, overlay, overlay',
          }}
        >
          {/* Gold accent bar at top */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #C9A84C, #e8c97a, #C9A84C)' }} />

          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-white/60 text-sm font-medium mb-1">Welcome back</p>
              <h2 className="text-white text-xl font-semibold tracking-tight">
                {onboarding.profile.name}
              </h2>
              <p className="text-white/75 text-sm mt-1.5">
                Your application is in{' '}
                <span
                  className="font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(201,168,76,0.20)', color: '#e8c97a' }}
                >
                  Stage {currentStage}: {LIFECYCLE_STAGES[currentStage - 1]?.label}
                </span>
              </p>
            </div>

            {/* Gold decorative element + status badge */}
            <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0">
              {/* Gold monogram ornament */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(201,168,76,0.15)',
                  border: '1.5px solid rgba(201,168,76,0.40)',
                }}
              >
                <span className="text-xl font-bold" style={{ color: '#C9A84C' }}>
                  {currentStage}
                </span>
              </div>
              <StatusBadge status={onboarding.status} />
            </div>
          </div>
        </div>

        {/* Progress Stepper — the signature element of the Borrower Portal */}
        <div className="card p-6">
          {/* Header row: title + stage hero counter */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Financing Lifecycle Progress</h3>
              <p className="text-xs text-gray-500 mt-0.5">Track your journey through the Vetify platform</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div
                className="text-5xl font-bold leading-none"
                style={{ color: 'rgba(13,110,77,0.10)', fontVariantNumeric: 'tabular-nums' }}
              >
                {String(currentStage).padStart(2, '0')}
              </div>
              <div className="text-xs font-semibold text-primary mt-0.5">
                of 10 stages
              </div>
            </div>
          </div>

          {/* Background progress track (behind circles) */}
          <div className="relative mb-2">
            {/* Full-width track background */}
            <div className="absolute top-6 left-6 right-6 h-0.5 bg-gray-200" style={{ zIndex: 0 }} />
            {/* Filled portion */}
            <div
              className="absolute top-6 left-6 h-0.5 bg-primary transition-all duration-700"
              style={{
                zIndex: 0,
                width: `calc(${((currentStage - 1) / 9) * 100}% - 12px)`,
              }}
            />

            {/* Steps row — use overflow-x-auto for narrow viewports, full-width on desktop */}
            <div className="overflow-x-auto pb-1">
              <div className="flex items-start" style={{ minWidth: 640 }}>
                {LIFECYCLE_STAGES.map((stage, idx) => {
                  const isCompleted = stage.num < currentStage
                  const isCurrent = stage.num === currentStage

                  return (
                    <div key={stage.num} className="flex items-start flex-1 last:flex-none">
                      {/* Stage column */}
                      <div className="flex flex-col items-center gap-2" style={{ width: 64 }}>
                        {/* Circle */}
                        <div className="relative" style={{ zIndex: 1 }}>
                          {/* Pulsing ring for current step */}
                          {isCurrent && (
                            <div
                              className="absolute rounded-full animate-ping"
                              style={{
                                backgroundColor: '#0D6E4D',
                                opacity: 0.25,
                                top: -8,
                                left: -8,
                                right: -8,
                                bottom: -8,
                              }}
                            />
                          )}
                          {/* Static glow ring for current step */}
                          {isCurrent && (
                            <div
                              className="absolute rounded-full"
                              style={{
                                backgroundColor: 'transparent',
                                border: '3px solid rgba(13,110,77,0.25)',
                                top: -5,
                                left: -5,
                                right: -5,
                                bottom: -5,
                              }}
                            />
                          )}
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold relative transition-all duration-300 ${
                              isCompleted
                                ? 'bg-primary text-white shadow-md'
                                : isCurrent
                                ? 'bg-primary text-white shadow-lg'
                                : 'bg-gray-100 text-gray-400 border border-gray-200'
                            }`}
                          >
                            {isCompleted ? (
                              <span className="text-base">{stage.icon}</span>
                            ) : isCurrent ? (
                              <span className="text-sm font-bold">{stage.num}</span>
                            ) : (
                              <span className="text-xs text-gray-400">{stage.num}</span>
                            )}
                          </div>
                        </div>

                        {/* Label */}
                        <span
                          className={`text-center leading-tight px-0.5 ${
                            isCompleted
                              ? 'text-primary font-medium'
                              : isCurrent
                              ? 'text-primary font-semibold'
                              : 'text-gray-400'
                          }`}
                          style={{ fontSize: 11 }}
                        >
                          {stage.label}
                        </span>
                      </div>

                      {/* Connector spacer (flex-1 — spans the remaining space to next circle) */}
                      {idx < LIFECYCLE_STAGES.length - 1 && (
                        <div className="flex-1 mt-6" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Status detail */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
            {onboarding.status === 'UnderReview' && (
              <>
                <Clock size={14} className="text-indigo-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">
                  Your application is under AI verification review. Submitted{' '}
                  <strong>{onboarding.submittedAt ? formatDate(onboarding.submittedAt) : '—'}</strong>
                </p>
              </>
            )}
            {onboarding.status === 'Approved' && (
              <>
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">
                  Identity verified and approved. You can now submit a financing request.
                </p>
              </>
            )}
            {onboarding.status === 'ManualReview' && (
              <>
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">
                  Your application has been flagged for manual review. Our compliance team will contact you within 2 business days.
                  {onboarding.agentScore && (
                    <span className="ml-1 text-gray-500">Agent score: {onboarding.agentScore}</span>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column — contract + repayments */}
          <div className="lg:col-span-2 space-y-5">
            {/* Application Status Card */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Application Details</h3>
                <StatusBadge status={onboarding.status} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Business Name</p>
                  <p className="text-sm font-medium text-gray-900">{onboarding.profile.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Business Type</p>
                  <p className="text-sm font-medium text-gray-900">
                    {onboarding.profile.businessType === 'LimitedCompany' ? 'Limited Company' : 'Sole Proprietorship'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">CAC Number</p>
                  <p className="text-sm font-mono text-gray-900">{onboarding.kyc.cacRegNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Date Submitted</p>
                  <p className="text-sm text-gray-900">
                    {onboarding.submittedAt ? formatDate(onboarding.submittedAt) : 'Not submitted'}
                  </p>
                </div>
                {onboarding.agentScore && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">AI Risk Score</p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            onboarding.agentScore >= 80
                              ? 'bg-emerald-500'
                              : onboarding.agentScore >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${onboarding.agentScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{onboarding.agentScore}</span>
                    </div>
                  </div>
                )}
                {onboarding.agentRisk && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Risk Category</p>
                    <StatusBadge
                      status={onboarding.agentRisk === 'Low' ? 'Approved' : onboarding.agentRisk === 'Medium' ? 'ManualReview' : 'Rejected'}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Active Murabahah Contract */}
            {activeContract && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Active Murabahah Contract</h3>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {activeContract.id.slice(0, 20)}...
                    </p>
                  </div>
                  <StatusBadge status={activeContract.status} />
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Sale Price</p>
                    <AmountDisplay amount={activeContract.terms.salePrice} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Outstanding</p>
                    <AmountDisplay amount={activeContract.outstandingBalance} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Monthly Installment</p>
                    <AmountDisplay amount={activeContract.terms.installmentAmount} />
                  </div>
                </div>

                {/* Payment progress */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">Repayment Progress</span>
                    <span className="text-xs font-semibold text-primary">
                      {Math.round(
                        ((activeContract.terms.salePrice - activeContract.outstandingBalance) /
                          activeContract.terms.salePrice) *
                          100
                      )}
                      % complete
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${
                          ((activeContract.terms.salePrice - activeContract.outstandingBalance) /
                            activeContract.terms.salePrice) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">Started {formatDate(activeContract.terms.startDate)}</span>
                    <span className="text-xs text-gray-400">{activeContract.terms.tenureMonths} months</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Repayments */}
            {recentRepayments.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Recent Repayments</h3>
                  <span className="text-xs text-gray-500">{recentRepayments.length} records</span>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Installment #</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRepayments.map((r) => (
                      <tr key={r.id}>
                        <td className="text-gray-600">{formatDate(r.date)}</td>
                        <td>
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-50 text-primary text-xs font-semibold">
                            {r.installmentNumber}
                          </span>
                        </td>
                        <td><AmountDisplay amount={r.amount} /></td>
                        <td><StatusBadge status={r.status} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right column — quick actions */}
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  to="/business/onboarding"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-50 hover:bg-primary-50 border border-primary/10 text-sm font-medium text-primary hover:bg-primary/5 transition-colors group"
                >
                  <FileText size={16} />
                  <span>View Onboarding</span>
                  <ArrowRight size={14} className="ml-auto text-primary/40 group-hover:text-primary transition-colors" />
                </Link>

                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-sm font-medium text-gray-700 transition-colors group">
                  <Send size={16} className="text-gray-500" />
                  <span>Submit for Review</span>
                  <ArrowRight size={14} className="ml-auto text-gray-400 group-hover:text-gray-600 transition-colors" />
                </button>

                <Link
                  to="/business/financing"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-sm font-medium text-gray-700 transition-colors group"
                >
                  <TrendingUp size={16} className="text-gray-500" />
                  <span>Financing Request</span>
                  <ArrowRight size={14} className="ml-auto text-gray-400 group-hover:text-gray-600 transition-colors" />
                </Link>

                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-sm font-medium text-gray-700 transition-colors group">
                  <CreditCard size={16} className="text-gray-500" />
                  <span>View Full History</span>
                  <ArrowRight size={14} className="ml-auto text-gray-400 group-hover:text-gray-600 transition-colors" />
                </button>
              </div>
            </div>

            {/* Info card */}
            <div className="card p-5 border-l-4" style={{ borderLeftColor: '#C9A84C' }}>
              <div className="flex items-start gap-3">
                <RefreshCw size={16} className="text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">What happens next?</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Your application is being reviewed by our AI Verification Agent and Compliance team.
                    This typically takes 1–2 business days. You'll receive a notification once complete.
                  </p>
                </div>
              </div>
            </div>

            {/* Shariah compliance note */}
            <div className="card p-5 bg-emerald-50 border-emerald-100">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-800 mb-1">Shariah-Compliant Financing</p>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    All financing is structured as Murabahah — a cost-plus sale with full transparency.
                    No interest (Riba). Certified under AAOIFI Standard No. 8.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
