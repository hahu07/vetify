import { useState } from 'react'
import { FlaskConical, Play, Loader2 } from 'lucide-react'
import Layout from '../../components/Layout'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import { formatNaira } from '../../lib/formatters'
import {
  useDevOnboardings,
  useSimulateVerifierDecision,
  useDevFinancingRequests,
  useSimulateUnderwritingDecision,
} from '../../api/client'
import type { SimulateVerifierDecisionPayload, SimulateUnderwritingDecisionPayload } from '../../api/client'

type Risk = SimulateVerifierDecisionPayload['risk']
type Compliance = NonNullable<SimulateVerifierDecisionPayload['compliance']>
type UnderwritingPreset = SimulateUnderwritingDecisionPayload['preset']

const RISK_OPTIONS: { value: Risk; label: string }[] = [
  { value: 'low', label: 'Low — auto-approve' },
  { value: 'medium', label: 'Medium — flag for manual review' },
  { value: 'high', label: 'High — auto-reject or flag' },
]

const COMPLIANCE_OPTIONS: { value: Compliance; label: string }[] = [
  { value: 'flag', label: 'Flag for manual review (scorer default)' },
  { value: 'reject', label: 'Auto-reject (AML hard hit)' },
  { value: 'approve', label: 'Approve (manual sign-off stand-in — scorer can never do this itself)' },
]

const UNDERWRITING_PRESET_OPTIONS: { value: UnderwritingPreset; label: string }[] = [
  { value: 'low', label: 'Low — auto-qualify (BeginUnderwriting)' },
  { value: 'medium', label: 'Medium — flag for manual review' },
  { value: 'high', label: 'High — reject (weak financials)' },
  { value: 'highFraud', label: 'High — reject (fraud pattern hard override)' },
]

export default function DevTools() {
  const { data: onboardings, isLoading, isError } = useDevOnboardings()
  const simulate = useSimulateVerifierDecision()

  const [onboardingContractId, setOnboardingContractId] = useState('')
  const [risk, setRisk] = useState<Risk>('low')
  const [compliance, setCompliance] = useState<Compliance>('approve')
  const [skipCompliance, setSkipCompliance] = useState(false)
  const [log, setLog] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onRun = async () => {
    setError(null)
    setLog(null)
    try {
      const result = await simulate.mutateAsync({
        onboardingContractId,
        risk,
        ...(skipCompliance ? { skipCompliance: true } : { compliance }),
      })
      setLog(result.log)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed')
    }
  }

  const { data: financingRequests, isLoading: loadingFinancing, isError: financingError } = useDevFinancingRequests()
  const simulateUnderwriting = useSimulateUnderwritingDecision()

  const [financingRequestContractId, setFinancingRequestContractId] = useState('')
  const [underwritingPreset, setUnderwritingPreset] = useState<UnderwritingPreset>('low')
  const [underwritingLog, setUnderwritingLog] = useState<string[] | null>(null)
  const [underwritingError, setUnderwritingError] = useState<string | null>(null)

  const onRunUnderwriting = async () => {
    setUnderwritingError(null)
    setUnderwritingLog(null)
    try {
      const result = await simulateUnderwriting.mutateAsync({
        financingRequestContractId,
        preset: underwritingPreset,
      })
      setUnderwritingLog(result.log)
    } catch (e) {
      setUnderwritingError(e instanceof Error ? e.message : 'Simulation failed')
    }
  }

  if (isLoading) return <Layout title="Dev Tools"><FullPageLoader /></Layout>
  if (isError) return <Layout title="Dev Tools"><ErrorState message="Failed to load onboardings" /></Layout>

  return (
    <Layout title="Dev Tools">
      <div className="max-w-2xl space-y-5">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-700">Simulate Stage 2/3 decision</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Runs the real deterministic scoring engines (scoreVerification/scoreCompliance) against hand-built
            evidence and drives the actual Canton choices — no mono.co/Youverify/LLM keys needed. Dev-only:
            this page and its backend route don't exist in a production build.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                BusinessOnboarding (status = UnderReview)
              </label>
              <select
                className="input"
                value={onboardingContractId}
                onChange={(e) => setOnboardingContractId(e.target.value)}
              >
                <option value="">Select an onboarding…</option>
                {onboardings?.map((o) => (
                  <option key={o.contractId} value={o.contractId}>
                    {o.payload.profile.name} ({o.payload.kyc.cacRegNumber})
                  </option>
                ))}
              </select>
              {onboardings?.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  No onboardings are currently UnderReview — submit one from the Business portal first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Stage 2 evidence preset</label>
              <select className="input" value={risk} onChange={(e) => setRisk(e.target.value as Risk)}>
                {RISK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
                <input
                  type="checkbox"
                  checked={skipCompliance}
                  onChange={(e) => setSkipCompliance(e.target.checked)}
                />
                Stop after Stage 2 (don't run Stage 3)
              </label>
            </div>

            {!skipCompliance && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Stage 3 outcome</label>
                <select className="input" value={compliance} onChange={(e) => setCompliance(e.target.value as Compliance)}>
                  {COMPLIANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Only reached if Stage 2 resolves to Approve — a Reject or Flag at Stage 2 stops there.
                </p>
              </div>
            )}

            {error && (
              <div className="px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <button
              onClick={onRun}
              disabled={!onboardingContractId || simulate.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {simulate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {simulate.isPending ? 'Running…' : 'Run simulation'}
            </button>
          </div>
        </div>

        {log && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Result</h3>
            <ol className="space-y-1.5">
              {log.map((line, i) => (
                <li key={i} className="text-xs font-mono text-gray-600">
                  {i + 1}. {line}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-gray-700">Simulate Stage 6 decision</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Runs the real deterministic scoring engine (scoreUnderwriting — five independent engines: Financial
            Behaviour, Cashflow Risk, Creditworthiness, Fraud Detection, Final Decision) against a hand-built
            6-month transaction history and drives the actual Canton choice — no mono.co keys needed. Dev-only:
            this page and its backend route don't exist in a production build.
          </p>

          {loadingFinancing ? (
            <Loader2 size={16} className="animate-spin text-gray-400" />
          ) : financingError ? (
            <p className="text-xs text-red-600">Failed to load financing requests.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  FinancingRequest (status = Submitted)
                </label>
                <select
                  className="input"
                  value={financingRequestContractId}
                  onChange={(e) => setFinancingRequestContractId(e.target.value)}
                >
                  <option value="">Select a financing request…</option>
                  {financingRequests?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.businessName} ({r.cacNumber}) — {formatNaira(r.terms.amount)} / {r.terms.tenureMonths}mo
                    </option>
                  ))}
                </select>
                {financingRequests?.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    No financing requests are currently Submitted — submit one from the Business portal first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Stage 6 evidence preset</label>
                <select
                  className="input"
                  value={underwritingPreset}
                  onChange={(e) => setUnderwritingPreset(e.target.value as UnderwritingPreset)}
                >
                  {UNDERWRITING_PRESET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  requestedAmount/tenureMonths are read from the selected request itself — every other financial
                  figure (revenue, expenses, balance, business age, DSCR, credit score) is synthetic per preset.
                </p>
              </div>

              {underwritingError && (
                <div className="px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                  {underwritingError}
                </div>
              )}

              <button
                onClick={onRunUnderwriting}
                disabled={!financingRequestContractId || simulateUnderwriting.isPending}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {simulateUnderwriting.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {simulateUnderwriting.isPending ? 'Running…' : 'Run simulation'}
              </button>
            </div>
          )}
        </div>

        {underwritingLog && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Result</h3>
            <ol className="space-y-1.5">
              {underwritingLog.map((line, i) => (
                <li key={i} className="text-xs font-mono text-gray-600">
                  {i + 1}. {line}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Layout>
  )
}
