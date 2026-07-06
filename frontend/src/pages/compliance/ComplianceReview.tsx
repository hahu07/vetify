import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Building,
  User,
  ChevronLeft,
  X,
  FileSearch,
  BookOpen,
} from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { ErrorState, FullPageLoader } from '../../components/LoadingState'
import { formatDate } from '../../lib/formatters'
import {
  useComplianceQueue, useOnboardingList, useApproveCompliance, useRejectCompliance,
  useFlagComplianceForManualReview,
} from '../../api/client'
import type { ComplianceCheck, RiskLevel } from '../../api/client'

function RiskGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 80 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626'

  const label =
    score >= 80 ? 'Low Risk' : score >= 50 ? 'Medium Risk' : 'High Risk'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#f3f4f6"
            strokeWidth="10"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono" style={{ color }}>{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

const DEFAULT_CHECKS: ComplianceCheck = {
  shariahCompliant: false,
  amlCleared: false,
  kycValidated: false,
  cddCompleted: false,
}

export default function ComplianceReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionDone, setActionDone] = useState<'approved' | 'rejected' | 'flagged' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: queue, isLoading: loadingQueue } = useComplianceQueue()
  const { data: onboardingList, isLoading: loadingOnboarding } = useOnboardingList()
  const approveCompliance = useApproveCompliance()
  const rejectCompliance = useRejectCompliance()
  const flagCompliance = useFlagComplianceForManualReview()

  const review = queue?.find((r) => r.id === id)
  const onboarding = onboardingList?.find((o) => o.kyc.cacRegNumber === review?.cacNumber)

  // The reviewer's own checklist — ComplianceCheck is a decision the reviewer submits, not
  // pre-computed state read from the ledger (ComplianceReview.checks is only ever set inside
  // the ApproveCompliance/RejectCompliance choice itself, confirmed in Compliance.daml).
  const [checks, setChecks] = useState<ComplianceCheck>(DEFAULT_CHECKS)
  const [riskScore, setRiskScore] = useState(review?.agentScore ?? 50)
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(review?.agentRisk ?? 'Medium')

  if (loadingQueue || loadingOnboarding) {
    return (
      <Layout breadcrumb={[{ label: 'Compliance', path: '/vetify/compliance' }, { label: '…' }]}>
        <FullPageLoader />
      </Layout>
    )
  }

  if (!review) {
    return (
      <Layout breadcrumb={[{ label: 'Compliance', path: '/vetify/compliance' }, { label: 'Not Found' }]}>
        <ErrorState message="Review not found" />
      </Layout>
    )
  }

  const handleApprove = async () => {
    setActionError(null)
    try {
      await approveCompliance.mutateAsync({ id: review.id, completedChecks: checks, riskScore, riskLevel })
      setActionDone('approved')
      setTimeout(() => navigate('/vetify/compliance'), 2000)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to approve compliance review')
    }
  }

  const handleReject = async () => {
    if (rejectReason.length < 5) return
    setActionError(null)
    try {
      await rejectCompliance.mutateAsync({ id: review.id, completedChecks: checks, riskScore, riskLevel, reason: rejectReason })
      setRejectModal(false)
      setActionDone('rejected')
      setTimeout(() => navigate('/vetify/compliance'), 2000)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to reject compliance review')
    }
  }

  const handleFlag = async () => {
    setActionError(null)
    try {
      await flagCompliance.mutateAsync({
        id: review.id, riskScore, riskLevel, note: 'Escalated for manual review by compliance officer',
      })
      setActionDone('flagged')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to flag for manual review')
    }
  }

  if (actionDone) {
    return (
      <Layout
        breadcrumb={[
          { label: 'Compliance', path: '/vetify/compliance' },
          { label: review.businessName },
        ]}
      >
        <div className="max-w-lg mx-auto mt-16 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            actionDone === 'approved' ? 'bg-emerald-100' :
            actionDone === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            {actionDone === 'approved' ? (
              <CheckCircle2 size={32} className="text-emerald-600" />
            ) : actionDone === 'rejected' ? (
              <XCircle size={32} className="text-red-600" />
            ) : (
              <AlertTriangle size={32} className="text-amber-600" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {actionDone === 'approved'
              ? 'Compliance Approved'
              : actionDone === 'rejected'
              ? 'Application Rejected'
              : 'Flagged for Manual Review'}
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            {actionDone === 'approved'
              ? `${review.businessName} has passed compliance. An ApprovedBorrower record has been created on the ledger.`
              : actionDone === 'rejected'
              ? 'The compliance review has been rejected and the borrower notified.'
              : 'This application has been escalated for manual review.'}
          </p>
          <p className="text-xs text-gray-400">Redirecting to queue...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      breadcrumb={[
        { label: 'Compliance', path: '/vetify/compliance' },
        { label: review.businessName },
      ]}
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => navigate('/vetify/compliance')}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">{review.businessName}</h1>
            <StatusBadge status={review.status} />
          </div>
          <p className="ml-7 text-xs text-gray-500">
            CAC: <span className="font-mono text-gray-700">{review.cacNumber}</span> • Submitted{' '}
            {review.submittedAt ? formatDate(review.submittedAt) : '—'}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Left: Business Info */}
          <div className="space-y-4">
            {onboarding ? (
              <>
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Building size={15} className="text-primary" />
                    <h2 className="text-sm font-semibold text-gray-700">Business Information</h2>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Business Name', value: onboarding.profile.name },
                      {
                        label: 'Type',
                        value:
                          onboarding.profile.businessType === 'LimitedCompany'
                            ? 'Limited Company'
                            : 'Sole Proprietorship',
                      },
                      { label: 'State', value: onboarding.profile.state },
                      { label: 'Incorporation Date', value: formatDate(onboarding.profile.incorporationDate) },
                      { label: 'Phone', value: onboarding.profile.phoneNumber },
                      { label: 'Email', value: onboarding.profile.email },
                      { label: 'CAC Number', value: onboarding.kyc.cacRegNumber, mono: true },
                      { label: 'Tax ID', value: onboarding.kyc.taxId, mono: true },
                    ].map(({ label, value, mono }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className={`text-sm font-medium text-gray-900 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {onboarding.profile.directors.map((director, idx) => (
                  <div className="card p-5" key={idx}>
                    <div className="flex items-center gap-2 mb-4">
                      <User size={15} className="text-primary" />
                      <h2 className="text-sm font-semibold text-gray-700">
                        {onboarding.profile.directors.length > 1 ? `Director ${idx + 1}` : 'Director'}
                      </h2>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Full Name', value: director.name },
                        { label: 'Phone', value: director.phoneNumber },
                        { label: 'NIN', value: director.ninNumber, mono: true },
                        { label: 'BVN', value: director.bvn, mono: true },
                      ].map(({ label, value, mono }) => (
                        <div key={label}>
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className={`text-sm font-medium text-gray-900 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="card p-5">
                <p className="text-xs text-gray-500">No matching onboarding record found for this business.</p>
              </div>
            )}
          </div>

          {/* Center: Compliance Checks */}
          <div className="space-y-4">
            {/* Shariah */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={15} className="text-primary" />
                <h2 className="text-sm font-semibold text-gray-700">Shariah Compliance</h2>
              </div>

              <div className="flex items-center gap-3 mb-3">
                {review.shariahVerdict ? (
                  <StatusBadge status={review.shariahVerdict} />
                ) : (
                  <span className="text-xs text-gray-400">Not yet screened</span>
                )}
              </div>

              {review.shariahReason && (
                <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                  review.shariahVerdict === 'COMPLIANT'
                    ? 'bg-emerald-50 text-emerald-800'
                    : review.shariahVerdict === 'REQUIRES_REVIEW'
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-red-50 text-red-800'
                }`}>
                  {review.shariahReason}
                </div>
              )}
            </div>

            {/* AI agent assessment (advisory only — the reviewer below submits the final decision) */}
            {(review.agentScore !== undefined || review.agentRisk) && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">AI Agent Assessment</h2>
                <div className="flex items-center justify-center">
                  <RiskGauge score={review.agentScore ?? 0} />
                </div>
                <p className="text-xs text-gray-500 text-center mt-3">
                  Advisory only — confirm the checklist below before deciding.
                </p>
              </div>
            )}

            {/* KYC/AML/CDD checklist — the reviewer's own decision, not pre-computed ledger state
                (ComplianceReview.checks is only ever set inside ApproveCompliance/RejectCompliance) */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileSearch size={15} className="text-primary" />
                <h2 className="text-sm font-semibold text-gray-700">Reviewer Checklist</h2>
              </div>

              {([
                ['shariahCompliant', 'Shariah Compliant'],
                ['amlCleared', 'AML Screening Cleared'],
                ['kycValidated', 'KYC Validated'],
                ['cddCompleted', 'CDD Completed'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 cursor-pointer">
                  <span className="text-sm text-gray-700">{label}</span>
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-primary"
                    checked={checks[key]}
                    onChange={(e) => setChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                </label>
              ))}

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Risk Score (0–100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={riskScore}
                    onChange={(e) => setRiskScore(Number(e.target.value))}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Risk Level</label>
                  <select
                    value={riskLevel}
                    onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
                    className="input"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={15} className="text-primary" />
                <h2 className="text-sm font-semibold text-gray-700">Compliance Decision</h2>
              </div>

              <div className="space-y-3">
                {/* Approve */}
                <button
                  onClick={handleApprove}
                  disabled={!checks.amlCleared || !checks.kycValidated || approveCompliance.isPending}
                  className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <CheckCircle2 size={15} />
                  {approveCompliance.isPending ? 'Approving…' : 'Approve Compliance'}
                </button>
                {(!checks.amlCleared || !checks.kycValidated) && (
                  <p className="text-xs text-gray-500 text-center">
                    AML and KYC must be checked before approving
                  </p>
                )}

                {/* Reject */}
                <button
                  onClick={() => setRejectModal(true)}
                  className="w-full btn-danger flex items-center justify-center gap-2"
                >
                  <XCircle size={15} />
                  Reject Application
                </button>

                {/* Flag */}
                {review.status !== 'ManualReview' && (
                  <button
                    onClick={handleFlag}
                    disabled={flagCompliance.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-medium transition-colors disabled:opacity-40"
                  >
                    <AlertTriangle size={15} />
                    Flag for Manual Review
                  </button>
                )}

                {actionError && <p className="text-xs text-red-600 text-center">{actionError}</p>}
              </div>
            </div>

            {/* Info panel */}
            <div className="card p-4 bg-primary-50 border-primary/10">
              <p className="text-xs font-semibold text-primary mb-2">Decision Guidelines</p>
              <ul className="space-y-1.5 text-xs text-primary/80">
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  <span><strong>Approve</strong>: AML cleared, KYC validated, CDD complete, Shariah compliant</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  <span><strong>Manual Review</strong>: Shariah REQUIRES_REVIEW or mixed signals</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  <span><strong>Reject</strong>: AML fail, KYC fail, or NON_COMPLIANT Shariah</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRejectModal(false)} />
          <div className="relative card p-6 w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">Reject Application</h2>
              <button onClick={() => setRejectModal(false)} className="p-1 rounded text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Rejecting compliance review for <strong>{review.businessName}</strong>.
              This will archive the compliance review on the ledger.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="input resize-none"
                placeholder="State the compliance reason for rejection..."
              />
              {rejectReason.length > 0 && rejectReason.length < 5 && (
                <p className="text-xs text-red-600 mt-1">Please provide a more detailed reason</p>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectReason.length < 5}
                className="btn-danger flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <XCircle size={14} />
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
