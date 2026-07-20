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
import {
  useOnboardingList,
  useApprovedBusinesses,
  useContracts,
  useContractRepayments,
  useVerificationResults,
  useComplianceQueue,
  useComplianceResults,
  useFinancingList,
  useUnderwritingRejections,
  useWads,
  useWakalas,
  usePurchaseRecords,
  useProposals,
} from '../../api/client'

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
    // ManualReview is a Stage 2 (Verification) sub-state, not a transition to Stage 3 —
    // Approve hasn't run yet, so no VerificationResult/ComplianceReview exists yet either.
    case 'ManualReview': return 2
    case 'Approved': return 4
    default: return 1
  }
}

// FinancingRequest.status stays live through Stage 5-7 (BeginUnderwriting recreates the
// contract with status=Underwriting rather than archiving it — only a Stage 6 rejection
// (RejectUnderwriting) or a Stage 7 FI decision archives it for good). Stage 5 covers
// everything still awaiting a decision — Submitted AND UnderwritingManualReview both, since
// being flagged for a human assessor isn't itself a decision, just a routing state. Stage 6
// only becomes current once a decision genuinely exists; for the qualify path that's the
// same instant the request lands with the FI (BeginUnderwriting sets status=Underwriting AND
// creates UnderwritingResult atomically — there's no separate dwell time at "qualified, not
// yet with the FI"), so this jumps straight to Stage 7 rather than pausing at 6. The reject
// path has no live status to read at all (RejectUnderwriting archives the request) — see
// stageFromUnderwritingRejection below for that terminal case.
function stageFromFinancingStatus(status: string): number | undefined {
  switch (status) {
    case 'Submitted': return 5
    case 'UnderwritingManualReview': return 5
    case 'Underwriting': return 7
    default: return undefined
  }
}

// A live MurabahahContract of any status implies Stage 8 (execution) already happened —
// Completed is the only status that means Stage 10 (Closure); every other status
// (Active/Delinquent/DelinquencyManualReview/Defaulted) is still Stage 9 (Repayment
// Monitoring), including Defaulted — a write-off is an outcome reached during repayment
// monitoring, not a distinct stage of its own.
function stageFromContractStatus(status: string): number {
  return status === 'Completed' ? 10 : 9
}

// Most recently decided record wins — active() can legitimately return more than one once a
// business has gone through a rejected cycle and a later, successful one (old audit records
// are never archived by a fresh onboarding attempt, only by Supersede).
function latestByDecidedAt<T extends { decidedAt: string }>(items: T[] | undefined): T | undefined {
  if (!items || items.length === 0) return undefined
  return [...items].sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0]
}

export default function BusinessDashboard() {
  const { data: onboardingList, isLoading: loadingOnboarding, isError: onboardingError } = useOnboardingList()
  const { data: contracts, isLoading: loadingContracts } = useContracts()

  const onboarding = onboardingList?.[0]

  // BusinessOnboarding.Approve archives BusinessOnboarding rather than
  // recreating it (Onboarding.daml — the key is deliberately released so a
  // fresh onboarding cycle can begin), so once a business is approved,
  // useOnboardingList() legitimately returns []. Fall back to the business's
  // own ApprovedBusiness (now CAC-scoped server-side, see
  // routes/onboarding.ts's GET /approved) so an approved business doesn't
  // read as "never applied" — found live: it did, right after Dev Tools
  // drove an onboarding through Stage 2/3 approval.
  const { data: approvedList, isLoading: loadingApproved } = useApprovedBusinesses()
  const approvedBusiness = !onboarding ? approvedList?.[0] : undefined

  // The same archive-without-recreate pattern leaves a second, narrower gap: Stage 2's Approve
  // archives BusinessOnboarding immediately, but ApprovedBusiness doesn't exist until Stage 3's
  // ComplianceReview is ALSO approved — so between those two events there is genuinely no
  // "current" record for this business's dashboard to read from at all. Found live: running the
  // Dev Tools Stage 2/3 simulator with "stop after Stage 2" ticked left the dashboard reading as
  // "No application yet" even though verification had already passed and a ComplianceReview was
  // sitting Pending. These three (business-scoped server-side, same pattern as
  // listApprovedBusinessByCac) fill that gap, plus the mirror gap for a Stage 2/3 rejection
  // (VerificationResult/ComplianceResult are terminal audit records — BusinessOnboarding and
  // ComplianceReview archive on rejection too, same as on approval).
  const skipInterimQueries = !!onboarding || !!approvedBusiness
  const { data: complianceReviewList, isLoading: loadingComplianceReview } = useComplianceQueue()
  const { data: complianceResultList, isLoading: loadingComplianceResult } = useComplianceResults()
  const { data: verificationResultList, isLoading: loadingVerification } = useVerificationResults()

  const complianceReview = skipInterimQueries ? undefined : complianceReviewList?.[0]
  const complianceResult = skipInterimQueries || complianceReview
    ? undefined
    : latestByDecidedAt(complianceResultList)?.outcome === 'Rejected'
      ? latestByDecidedAt(complianceResultList)
      : undefined
  // Found live: a VerificationResult with outcome Approved falls into a second gap the
  // comment above only partly covers — Approve archives BusinessOnboarding and creates
  // VerificationResult synchronously, but ComplianceReview is created separately by the
  // Verifier Agent's own follow-up call, not atomically by the same Daml choice. Whenever
  // that follow-up hasn't run yet (agent pipeline lag, or not running at all), there is a
  // real window where a business is genuinely "Stage 2 approved, Stage 3 not started" with
  // no ComplianceReview/ComplianceResult/ApprovedBusiness to read from — previously this
  // read as "No application yet" despite a real, approved verification existing. Only
  // skipped once a live ComplianceReview/ComplianceResult exists (the checks above), same
  // "most recent wins" precedent as complianceResult/underwritingRejection.
  const verificationResult = skipInterimQueries || complianceReview || complianceResult
    ? undefined
    : latestByDecidedAt(verificationResultList)

  const activeContract = contracts?.find((c) => c.status === 'Active')

  const { data: repayments } = useContractRepayments(activeContract?.cacNumber ?? '')
  const recentRepayments = (repayments ?? []).slice(0, 5)

  // Stage 5-10 coverage: an approved business's dashboard previously hardcoded Stage 4
  // forever, regardless of any FinancingRequest/MurabahahContract that had since
  // progressed further — found live: a business whose request had already been flagged
  // for manual review at Stage 6 still read as "Stage 4: Approved" with no trace it had
  // ever submitted anything. A live MurabahahContract (any status) outranks a
  // FinancingRequest (Stage 8 already happened), and the most recently submitted
  // FinancingRequest outranks the bare approvedBusiness fallback.
  const { data: financingRequests } = useFinancingList()
  const latestFinancingRequest = [...(financingRequests ?? [])].sort(
    (a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '')
  )[0]
  const latestContract = contracts?.find((c) => c.status !== 'Completed') ?? contracts?.[0]

  // RejectUnderwriting archives FinancingRequest without recreating it — no live status to
  // read at all, so this terminal audit record is the only trace a rejection leaves. Only
  // consulted when there's no live financing request (an old rejection followed by a fresh,
  // still-live request should read as the live one, same "most recent wins" precedent as
  // complianceResult/verificationResult above).
  const { data: underwritingRejectionList } = useUnderwritingRejections()
  const latestUnderwritingRejection = latestFinancingRequest
    ? undefined
    : latestByDecidedAt(underwritingRejectionList)

  // Stage 7's ApproveFunding archives FinancingRequest and creates a MurabahahWad — the start
  // of a multi-step acquisition chain (Wad -> Wakala/AssetPurchaseRecord -> Proposal ->
  // Certification -> MurabahahContract) with no live FinancingRequest and no MurabahahContract
  // yet for most of its duration. Found live: right after an FI approved funding, the
  // dashboard fell all the way back to "Stage 4: Approved" — currentStage's fallback chain
  // had no case between "financing request archived" and "contract exists" at all. Any live
  // record in that chain is enough to know we're in Stage 8; the Acquisition Status page
  // already covers which specific step, so this dashboard doesn't need to re-derive it.
  const { data: wads } = useWads()
  const { data: wakalas } = useWakalas()
  const { data: purchaseRecords } = usePurchaseRecords()
  const { data: proposals } = useProposals()
  const inAcquisitionChain =
    (wads?.length ?? 0) > 0 || (wakalas?.length ?? 0) > 0 ||
    (purchaseRecords?.length ?? 0) > 0 || (proposals?.length ?? 0) > 0

  if (
    loadingOnboarding || loadingApproved || loadingContracts ||
    loadingComplianceReview || loadingComplianceResult || loadingVerification
  ) {
    return <Layout title="Business Portal"><FullPageLoader /></Layout>
  }
  if (onboardingError) return <Layout title="Business Portal"><ErrorState message="Failed to load your application" /></Layout>
  if (!onboarding && !approvedBusiness && !complianceReview && !complianceResult && !verificationResult) {
    return (
      <Layout title="Business Portal">
        <EmptyState
          title="No application yet"
          description="Start your onboarding application to begin the financing lifecycle."
        />
      </Layout>
    )
  }

  const currentStage = latestContract
    ? stageFromContractStatus(latestContract.status)
    : inAcquisitionChain
    ? 8
    : latestFinancingRequest && stageFromFinancingStatus(latestFinancingRequest.status) !== undefined
    ? stageFromFinancingStatus(latestFinancingRequest.status)!
    : latestUnderwritingRejection
    ? 6
    : onboarding
    ? getStageFromStatus(onboarding.status)
    : approvedBusiness
    ? 4
    : complianceReview
    ? 3
    : complianceResult
    ? 3
    : verificationResult!.outcome === 'Rejected'
    ? 2
    : 3 // verificationResult (approved, ComplianceReview not yet created)
  const displayName =
    latestContract?.businessName ??
    latestFinancingRequest?.businessName ??
    latestUnderwritingRejection?.businessName ??
    onboarding?.profile.name ??
    approvedBusiness?.businessName ??
    complianceReview?.businessName ??
    complianceResult?.businessName ??
    verificationResult!.businessName
  const displayCacRegNumber =
    latestContract?.cacNumber ??
    latestFinancingRequest?.cacNumber ??
    latestUnderwritingRejection?.cacRegNumber ??
    onboarding?.kyc.cacRegNumber ??
    approvedBusiness?.cacRegNumber ??
    complianceReview?.cacNumber ??
    complianceResult?.cacRegNumber ??
    verificationResult!.cacRegNumber
  const displayStatus =
    latestContract?.status ?? latestFinancingRequest?.status ??
    (latestUnderwritingRejection ? 'FinancingRejected' : undefined) ??
    onboarding?.status ?? approvedBusiness?.status ?? complianceReview?.status ??
    complianceResult?.outcome ?? verificationResult!.outcome

  return (
    <Layout title="Business Portal">
      <div className="space-y-7">
        {/* Welcome Banner */}
        <div
          className="rounded-2xl overflow-hidden relative shadow-[0_20px_45px_-20px_rgba(13,40,28,0.4)]"
          style={{
            backgroundImage: 'linear-gradient(135deg, #0D6E4D 0%, #0A4A34 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 0, transparent 50%), repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 0, transparent 50%)',
            backgroundSize: 'cover, 20px 20px, 20px 20px',
            backgroundBlendMode: 'normal, overlay, overlay',
          }}
        >
          {/* Gold accent bar at top */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #C9A84C, #e8c97a, #C9A84C)' }} />

          <div className="px-7 py-7 flex items-center justify-between gap-4">
            <div>
              <p className="text-white/60 text-sm font-medium mb-1.5">Welcome back</p>
              <h2 className="font-display text-white text-2xl font-semibold tracking-tight">
                {displayName}
              </h2>
              <p className="text-white/75 text-sm mt-2.5">
                Your application is in{' '}
                <span
                  className="font-semibold px-2.5 py-1 rounded-md"
                  style={{ background: 'rgba(201,168,76,0.20)', color: '#e8c97a' }}
                >
                  Stage {currentStage}: {LIFECYCLE_STAGES[currentStage - 1]?.label}
                </span>
              </p>
            </div>

            {/* Gold decorative element + status badge */}
            <div className="hidden sm:flex flex-col items-end gap-2.5 flex-shrink-0">
              {/* Gold monogram ornament */}
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(201,168,76,0.15)',
                  border: '1.5px solid rgba(201,168,76,0.40)',
                }}
              >
                <span className="font-display text-2xl font-bold" style={{ color: '#C9A84C' }}>
                  {currentStage}
                </span>
              </div>
              <StatusBadge status={displayStatus} />
            </div>
          </div>
        </div>

        {/* Progress Stepper — the signature element of the Business Portal */}
        <div className="card p-7">
          {/* Header row: title + stage hero counter */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="font-display text-base font-semibold text-gray-800 tracking-tight">Financing Lifecycle Progress</h3>
              <p className="text-sm text-gray-500 mt-0.5">Track your journey through the Vetify platform</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div
                className="font-display text-5xl font-bold leading-none"
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
          <div className="mt-5 pt-5 border-t border-gray-100 flex items-center gap-3">
            {onboarding?.status === 'UnderReview' && (
              <>
                <Clock size={14} className="text-indigo-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Your application is under AI verification review. Submitted{' '}
                  <strong>{onboarding.submittedAt ? formatDate(onboarding.submittedAt) : '—'}</strong>
                </p>
              </>
            )}
            {/* Reachable only via the approvedBusiness fallback — BusinessOnboarding.status
                can never actually be 'Approved' itself, since Approve archives the contract
                rather than transitioning its status (see the fallback comment above). Gated to
                currentStage === 4 so this doesn't keep claiming "you can now submit a financing
                request" once one already has been — found live: an approved business whose
                request had already reached Stage 6 (UnderwritingManualReview) still showed this
                message and a hardcoded Stage 4, with no trace the request existed at all. */}
            {approvedBusiness && currentStage === 4 && (
              <>
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Identity verified and approved{' '}
                  <strong>{formatDate(approvedBusiness.approvedAt)}</strong>. You can now submit a financing request.
                </p>
              </>
            )}
            {latestFinancingRequest && currentStage === 5 && (
              <>
                {latestFinancingRequest.status === 'UnderwritingManualReview' ? (
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                ) : (
                  <Clock size={14} className="text-indigo-500 flex-shrink-0" />
                )}
                <p className="text-sm text-gray-600">
                  Financing request {latestFinancingRequest.financingRef} submitted
                  {latestFinancingRequest.submittedAt && <> <strong>{formatDate(latestFinancingRequest.submittedAt)}</strong></>}
                  {latestFinancingRequest.status === 'UnderwritingManualReview'
                    ? ' — flagged for manual underwriting review. Our assessment team will complete it shortly.'
                    : ' — awaiting an underwriting decision.'}
                </p>
              </>
            )}
            {/* No live FinancingRequest to read a status from at all — RejectUnderwriting
                archives it, so this terminal audit record is the only trace the decision
                left (see latestUnderwritingRejection's own comment above). */}
            {latestUnderwritingRejection && currentStage === 6 && (
              <>
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Financing request {latestUnderwritingRejection.financingRef} did not qualify at underwriting
                  {latestUnderwritingRejection.reason
                    ? <>: <span className="text-gray-700">{latestUnderwritingRejection.reason}</span></>
                    : '.'}{' '}
                  Contact support if you'd like to discuss reapplying.
                </p>
              </>
            )}
            {latestFinancingRequest && currentStage === 7 && (
              <>
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Financing request {latestFinancingRequest.financingRef} qualified at underwriting —
                  now with the financial institution for final review.
                </p>
              </>
            )}
            {inAcquisitionChain && currentStage === 8 && (
              <>
                <Clock size={14} className="text-indigo-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Financing approved — the Murabahah asset acquisition is in progress.{' '}
                  <Link to="/business/acquisition" className="text-primary font-medium hover:underline">
                    View Acquisition Status
                  </Link>{' '}
                  for the full step-by-step.
                </p>
              </>
            )}
            {latestContract && currentStage === 9 && (
              <>
                {latestContract.status === 'Active' ? (
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                )}
                <p className="text-sm text-gray-600">
                  Murabahah contract {latestContract.facilityRef} is in repayment
                  {latestContract.status !== 'Active' && <> ({latestContract.status})</>}.
                </p>
              </>
            )}
            {latestContract && currentStage === 10 && (
              <>
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Murabahah contract {latestContract.facilityRef} fully repaid and closed.
                </p>
              </>
            )}
            {onboarding?.status === 'ManualReview' && (
              <>
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Your application has been flagged for manual review. Our compliance team will contact you within 2 business days.
                  {onboarding.agentScore && (
                    <span className="ml-1 text-gray-500">Agent score: {onboarding.agentScore}</span>
                  )}
                </p>
              </>
            )}
            {/* Identity verification (Stage 2) has already passed — BusinessOnboarding is gone,
                ApprovedBusiness doesn't exist yet, and this is the only record in between. */}
            {complianceReview && (
              <>
                {complianceReview.status === 'ManualReview' ? (
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                ) : (
                  <Clock size={14} className="text-indigo-500 flex-shrink-0" />
                )}
                <p className="text-sm text-gray-600">
                  Identity verified — your application is now in compliance review
                  {complianceReview.status === 'ManualReview' && ' and has been flagged for manual review'}.
                  {complianceReview.submittedAt && (
                    <> Started <strong>{formatDate(complianceReview.submittedAt)}</strong>.</>
                  )}
                </p>
              </>
            )}
            {complianceResult && (
              <>
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Your application was not approved at compliance review
                  {complianceResult.reason
                    ? <>: <span className="text-gray-700">{complianceResult.reason}</span></>
                    : '.'}{' '}
                  Contact support if you'd like to discuss reapplying.
                </p>
              </>
            )}
            {verificationResult && verificationResult.outcome === 'Rejected' && (
              <>
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Your application was not approved at identity verification
                  {verificationResult.note
                    ? <>: <span className="text-gray-700">{verificationResult.note}</span></>
                    : '.'}{' '}
                  Contact support if you'd like to discuss reapplying.
                </p>
              </>
            )}
            {/* Same "identity verified, approved, compliance review not started yet" gap the
                complianceReview block above already covers — this is the case where even that
                ComplianceReview contract doesn't exist yet (see the verificationResult
                derivation above the early-return check). */}
            {verificationResult && verificationResult.outcome !== 'Rejected' && !complianceReview && (
              <>
                <Clock size={14} className="text-indigo-500 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  Identity verified — your application will move to compliance review shortly.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — contract + repayments */}
          <div className="lg:col-span-2 space-y-6">
            {/* Application Status Card */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-base font-semibold text-gray-800 tracking-tight">Application Details</h3>
                <StatusBadge status={displayStatus} />
              </div>
              {onboarding ? (
                <div className="grid grid-cols-2 gap-5">
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
              ) : approvedBusiness ? (
                // approvedBusiness fallback — BusinessOnboarding is gone (archived by Approve),
                // so only what ApprovedBusiness itself carries is available here. Full profile
                // fields (address, directors, docs) live on the archived contract and aren't
                // recoverable from the current ledger state.
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Business Name</p>
                    <p className="text-sm font-medium text-gray-900">{approvedBusiness.businessName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">CAC Number</p>
                    <p className="text-sm font-mono text-gray-900">{approvedBusiness.cacRegNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Approved</p>
                    <p className="text-sm text-gray-900">{formatDate(approvedBusiness.approvedAt)}</p>
                  </div>
                </div>
              ) : (
                // complianceReview / complianceResult / verificationResult fallback — the interim
                // window between Stage 2's Approve (archives BusinessOnboarding) and Stage 3's
                // ApproveCompliance (creates ApprovedBusiness), or a terminal rejection at either
                // stage. Same "only what this record carries" constraint as the branch above.
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Business Name</p>
                    <p className="text-sm font-medium text-gray-900">{displayName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">CAC Number</p>
                    <p className="text-sm font-mono text-gray-900">{displayCacRegNumber}</p>
                  </div>
                  {complianceReview?.agentScore != null && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">AI Risk Score</p>
                      <span className="text-sm font-semibold text-gray-700">{complianceReview.agentScore}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Murabahah Contract */}
            {activeContract && (
              <Link to={`/business/contracts/${activeContract.id}`} className="card p-6 block hover:shadow-card-hover transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display text-base font-semibold text-gray-800 tracking-tight">Active Murabahah Contract</h3>
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
              </Link>
            )}

            {/* Recent Repayments */}
            {recentRepayments.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-gray-800 tracking-tight">Recent Repayments</h3>
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
          <div className="space-y-5">
            <div className="card p-6">
              <h3 className="font-display text-base font-semibold text-gray-800 tracking-tight mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  to="/business/onboarding"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-primary-50 border border-primary/10 text-sm font-medium text-primary hover:bg-primary/10 transition-colors group"
                >
                  <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                    <FileText size={15} />
                  </span>
                  <span>View Onboarding</span>
                  <ArrowRight size={14} className="ml-auto text-primary/40 group-hover:text-primary transition-colors" />
                </Link>

                <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface hover:bg-gray-100 border border-gray-200 text-sm font-medium text-gray-700 transition-colors group">
                  <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                    <Send size={15} className="text-gray-500" />
                  </span>
                  <span>Submit for Review</span>
                  <ArrowRight size={14} className="ml-auto text-gray-400 group-hover:text-gray-600 transition-colors" />
                </button>

                <Link
                  to="/business/financing"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface hover:bg-gray-100 border border-gray-200 text-sm font-medium text-gray-700 transition-colors group"
                >
                  <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={15} className="text-gray-500" />
                  </span>
                  <span>Financing Request</span>
                  <ArrowRight size={14} className="ml-auto text-gray-400 group-hover:text-gray-600 transition-colors" />
                </Link>

                {activeContract && (
                  <Link
                    to={`/business/contracts/${activeContract.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface hover:bg-gray-100 border border-gray-200 text-sm font-medium text-gray-700 transition-colors group"
                  >
                    <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                      <CreditCard size={15} className="text-gray-500" />
                    </span>
                    <span>View Full History</span>
                    <ArrowRight size={14} className="ml-auto text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </Link>
                )}
              </div>
            </div>

            {/* Info card */}
            <div className="card p-6 border-l-4" style={{ borderLeftColor: '#C9A84C' }}>
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,168,76,0.12)' }}>
                  <RefreshCw size={15} className="text-accent-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">What happens next?</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Your application is being reviewed by our AI Verification Agent and Compliance team.
                    This typically takes 1–2 business days. You'll receive a notification once complete.
                  </p>
                </div>
              </div>
            </div>

            {/* Shariah compliance note */}
            <div className="card p-6 bg-emerald-50 border-emerald-100">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800 mb-1">Shariah-Compliant Financing</p>
                  <p className="text-sm text-emerald-700 leading-relaxed">
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
