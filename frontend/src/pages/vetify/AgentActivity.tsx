import { useState } from 'react'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import Layout from '../../components/Layout'

type AgentName = 'Verification' | 'Compliance' | 'Underwriting' | 'Monitoring' | 'Reporting'
type Decision = 'AutoApproved' | 'FlaggedManual' | 'AutoRejected' | 'Completed'
type RiskLevel = 'Low' | 'Medium' | 'High'

interface AgentRun {
  id: string
  agent: AgentName
  businessName: string
  contractId: string
  startedAt: string
  completedAt: string
  decision: Decision
  score?: number
  riskLevel?: RiskLevel
  notes: string
}

const MOCK_RUNS: AgentRun[] = [
  {
    id: 'run-001',
    agent: 'Verification',
    businessName: 'Adekunle Foods & Beverages Ltd',
    contractId: 'onb-7f3a2b9c-0e1d',
    startedAt: '2026-06-26T08:00:00Z',
    completedAt: '2026-06-26T08:01:45Z',
    decision: 'FlaggedManual',
    score: 78,
    riskLevel: 'Medium',
    notes: 'BVN validated, CAC registered. NIN cross-match returned 97% confidence. Score 78 — within medium range. Flagging for human review per Model C threshold.',
  },
  {
    id: 'run-002',
    agent: 'Compliance',
    businessName: 'Fatima Tailoring Cooperative',
    contractId: 'onb-4c8d1e5f-2a3b',
    startedAt: '2026-06-25T14:30:00Z',
    completedAt: '2026-06-25T14:32:10Z',
    decision: 'AutoApproved',
    score: 85,
    riskLevel: 'Low',
    notes: 'Shariah verdict: COMPLIANT. AML check clean. PEP screening: no hits. CDD score 82/100. Auto-approving — score above 80 threshold.',
  },
  {
    id: 'run-003',
    agent: 'Underwriting',
    businessName: 'Hamza Building Materials',
    contractId: 'fin-e5f6g7h8',
    startedAt: '2026-06-25T10:15:00Z',
    completedAt: '2026-06-25T10:17:30Z',
    decision: 'FlaggedManual',
    score: 61,
    riskLevel: 'Medium',
    notes: 'DSCR calculated at 1.4x — marginal. Revenue is seasonal (building materials). Recommended limit: ₦4,000,000 (reduced from requested ₦5,000,000). Flagging for FI human review.',
  },
  {
    id: 'run-004',
    agent: 'Monitoring',
    businessName: 'Garba Transport Services',
    contractId: 'mur-k3l4m5n6-o7p8q9r0s1t2',
    startedAt: '2026-06-22T09:00:00Z',
    completedAt: '2026-06-22T09:00:15Z',
    decision: 'Completed',
    notes: '3 consecutive missed installments detected. Contract flagged as Delinquent. FI and Vetify notified. Early workout escalation recommended.',
  },
  {
    id: 'run-005',
    agent: 'Reporting',
    businessName: '(Portfolio-wide)',
    contractId: 'report-june-2026',
    startedAt: '2026-06-01T00:00:00Z',
    completedAt: '2026-06-01T00:02:05Z',
    decision: 'Completed',
    notes: 'June 2026 PortfolioReport created. 4 contracts analysed. Total disbursed: ₦11,500,000. Delinquency rate: 14.3%. Report submitted to regulator observer.',
  },
  {
    id: 'run-006',
    agent: 'Verification',
    businessName: 'Bright Star Electronics',
    contractId: 'onb-9j0k1l2m',
    startedAt: '2026-06-22T13:55:00Z',
    completedAt: '2026-06-22T13:57:00Z',
    decision: 'FlaggedManual',
    score: 63,
    riskLevel: 'Medium',
    notes: 'CAC validated. NIN 91% confidence match. Flagging for manual: gaming product lines noted in business activity — compliance Shariah check required.',
  },
]

const AGENT_COLORS: Record<AgentName, { bg: string; text: string }> = {
  Verification: { bg: '#EFF6FF', text: '#2563EB' },
  Compliance: { bg: '#F0FDF4', text: '#16A34A' },
  Underwriting: { bg: '#FFF7ED', text: '#EA580C' },
  Monitoring: { bg: '#FEF2F2', text: '#DC2626' },
  Reporting: { bg: '#F5F3FF', text: '#7C3AED' },
}

const DECISION_STYLES: Record<Decision, { bg: string; text: string; label: string }> = {
  AutoApproved: { bg: '#D1FAE5', text: '#065F46', label: 'Auto-Approved' },
  FlaggedManual: { bg: '#FEF3C7', text: '#92400E', label: 'Flagged — Manual' },
  AutoRejected: { bg: '#FEE2E2', text: '#991B1B', label: 'Auto-Rejected' },
  Completed: { bg: '#E0E7FF', text: '#3730A3', label: 'Completed' },
}

function elapsed(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.round(s / 60)}m ${s % 60}s`
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AgentActivity() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [lastUpdated] = useState(new Date().toLocaleTimeString())

  return (
    <Layout title="AI Agent Activity">
      <div className="space-y-5 animate-fade-in">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">
              Last updated: <span className="font-medium text-gray-700">{lastUpdated}</span>
            </p>
          </div>
          <button className="btn btn-secondary flex items-center gap-1.5 text-xs">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(AGENT_COLORS) as AgentName[]).map((agent) => (
            <span
              key={agent}
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: AGENT_COLORS[agent].bg, color: AGENT_COLORS[agent].text }}
            >
              {agent}
            </span>
          ))}
        </div>

        {/* Timeline feed */}
        <div className="space-y-3">
          {MOCK_RUNS.map((run) => {
            const agentStyle = AGENT_COLORS[run.agent]
            const decisionStyle = DECISION_STYLES[run.decision]
            const isExpanded = expanded === run.id
            const shortNotes = run.notes.slice(0, 80) + (run.notes.length > 80 ? '…' : '')

            return (
              <div key={run.id} className="card p-4 hover:shadow-card-hover transition-shadow">
                <div className="flex items-start gap-3">
                  {/* Agent badge (vertical accent) */}
                  <div
                    className="flex-shrink-0 w-1 self-stretch rounded-full"
                    style={{ backgroundColor: agentStyle.text }}
                  />

                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: agentStyle.bg, color: agentStyle.text }}
                      >
                        {run.agent} Agent
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: decisionStyle.bg, color: decisionStyle.text }}
                      >
                        {decisionStyle.label}
                      </span>
                      {run.riskLevel && (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor:
                              run.riskLevel === 'Low'
                                ? '#D1FAE5'
                                : run.riskLevel === 'Medium'
                                ? '#FEF3C7'
                                : '#FEE2E2',
                            color:
                              run.riskLevel === 'Low'
                                ? '#065F46'
                                : run.riskLevel === 'Medium'
                                ? '#92400E'
                                : '#991B1B',
                          }}
                        >
                          {run.riskLevel} Risk
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                        {timeAgo(run.completedAt)}
                      </span>
                    </div>

                    {/* Business + contract */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {run.businessName}
                      </p>
                      <span className="text-xs font-mono text-gray-400 truncate hidden sm:block">
                        {run.contractId.slice(0, 20)}…
                      </span>
                    </div>

                    {/* Score + elapsed */}
                    <div className="flex items-center gap-4 mb-2">
                      {run.score != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Score</span>
                          <div className="h-1.5 w-12 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${run.score}%`,
                                backgroundColor:
                                  run.score >= 80
                                    ? '#10B981'
                                    : run.score >= 50
                                    ? '#F59E0B'
                                    : '#EF4444',
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-800">{run.score}</span>
                        </div>
                      )}
                      <span className="text-xs text-gray-400">
                        Ran in {elapsed(run.startedAt, run.completedAt)}
                      </span>
                    </div>

                    {/* Notes */}
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {isExpanded ? run.notes : shortNotes}
                    </p>

                    {run.notes.length > 80 && (
                      <button
                        onClick={() => setExpanded(isExpanded ? null : run.id)}
                        className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {isExpanded ? (
                          <>Show less <ChevronUp size={12} /></>
                        ) : (
                          <>Read more <ChevronDown size={12} /></>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty state placeholder */}
        {MOCK_RUNS.length === 0 && (
          <div className="card py-16 text-center">
            <p className="text-sm text-gray-400">No agent runs recorded yet</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
