import { ShieldCheck } from 'lucide-react'
import Layout from '../../components/Layout'
import GovernanceSignIn from '../../components/GovernanceSignIn'
import { FullPageLoader, ErrorState, EmptyState } from '../../components/LoadingState'
import {
  usePendingVerificationPolicies, useEndorseVerificationPolicy,
  usePendingCompliancePolicies, useEndorseCompliancePolicy,
} from '../../api/client'
import type { VerificationScoringWeights, ComplianceScoringWeights } from '../../api/client'
import { useGovernanceAuth } from '../../auth/GovernanceAuthContext'

function EndorseCard({
  title, proposedBy, reason, proposedAt, endorsedBy, weightSummary, onEndorse, endorsing, canEndorse,
}: {
  title: string; proposedBy: string; reason: string; proposedAt: string
  endorsedBy?: string
  weightSummary: string
  onEndorse: () => void
  endorsing: boolean
  canEndorse: boolean
}) {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {endorsedBy && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            Endorsed by {endorsedBy}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600">{reason}</p>
      <p className="text-xs text-gray-400">Proposed by {proposedBy} on {new Date(proposedAt).toLocaleString()}</p>
      <p className="text-xs text-gray-500 font-mono bg-gray-50 rounded-lg p-2">{weightSummary}</p>
      {!endorsedBy && (
        <button
          onClick={onEndorse}
          disabled={!canEndorse || endorsing}
          className="btn-primary text-sm flex items-center gap-1 disabled:opacity-40"
        >
          <ShieldCheck size={14} />
          {endorsing ? 'Endorsing…' : 'Endorse'}
        </button>
      )}
    </div>
  )
}

function summarizeVerificationWeights(w: VerificationScoringWeights): string {
  return `identityVerified=${w.identityVerified}, cacActiveExactMatch=${w.cacActiveExactMatch}, tinVerifiedMatchesCac=${w.tinVerifiedMatchesCac}`
}

function summarizeComplianceWeights(w: ComplianceScoringWeights): string {
  return `amlBothClear=${w.amlBothClear}, kybActiveFullMatch=${w.kybActiveFullMatch}, creditClean=${w.creditClean}`
}

export default function RiskCommitteeDashboard() {
  const { data: pendingVerification, isLoading: l1, isError: e1 } = usePendingVerificationPolicies()
  const { data: pendingCompliance, isLoading: l2, isError: e2 } = usePendingCompliancePolicies()
  const endorseVerification = useEndorseVerificationPolicy()
  const endorseCompliance = useEndorseCompliancePolicy()
  const { session } = useGovernanceAuth()
  const canEndorse = !!session && session.partyRole === 'riskCommittee'

  if (l1 || l2) return <Layout title="Pending Endorsements"><FullPageLoader /></Layout>
  if (e1 || e2 || !pendingVerification || !pendingCompliance) {
    return <Layout title="Pending Endorsements"><ErrorState message="Failed to load pending policy proposals" /></Layout>
  }

  const total = pendingVerification.length + pendingCompliance.length

  return (
    <Layout title="Pending Endorsements">
      <div className="space-y-5 max-w-3xl">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Scoring Policy Proposals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} proposal{total !== 1 ? 's' : ''} awaiting Risk Committee endorsement — Layer 2 of the
            Policy-Approval Security Roadmap. Vetify cannot finalize either proposal below until it is
            endorsed here, by this Committee's own credentials.
          </p>
        </div>

        <GovernanceSignIn requiredRole="riskCommittee" />

        {total === 0 ? (
          <div className="card">
            <EmptyState
              title="Nothing pending"
              description="Scoring policy proposals awaiting endorsement will appear here"
              icon={<ShieldCheck size={24} className="text-gray-400" />}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {pendingVerification.map((p) => (
              <EndorseCard
                key={p.id}
                title={`Verification Policy — ${p.policyVersion}`}
                proposedBy={p.proposedBy}
                reason={p.reason}
                proposedAt={p.proposedAt}
                endorsedBy={p.riskCommitteeEndorsedBy}
                weightSummary={summarizeVerificationWeights(p.scoringWeights)}
                endorsing={endorseVerification.isPending}
                canEndorse={canEndorse}
                onEndorse={() => session && endorseVerification.mutate({ id: p.id, token: session.token })}
              />
            ))}
            {pendingCompliance.map((p) => (
              <EndorseCard
                key={p.id}
                title={`Compliance Policy — ${p.policyVersion}`}
                proposedBy={p.proposedBy}
                reason={p.reason}
                proposedAt={p.proposedAt}
                endorsedBy={p.riskCommitteeEndorsedBy}
                weightSummary={summarizeComplianceWeights(p.scoringWeights)}
                endorsing={endorseCompliance.isPending}
                canEndorse={canEndorse}
                onEndorse={() => session && endorseCompliance.mutate({ id: p.id, token: session.token })}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
