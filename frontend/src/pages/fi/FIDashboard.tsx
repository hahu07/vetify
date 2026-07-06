import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Banknote,
  Activity,
  ArrowUpRight,
} from 'lucide-react'
import Layout from '../../components/Layout'
import { FullPageLoader, ErrorState } from '../../components/LoadingState'
import { formatNaira } from '../../lib/formatters'
import { usePortfolioSummary } from '../../api/client'

const DONUT_COLORS = ['#0D6E4D', '#DC2626', '#0F766E', '#374151']

interface KPICardProps {
  label: string
  value: string
  icon: React.ReactNode
  trend?: string
  alert?: boolean
  iconBg?: string
}

function KPICard({ label, value, icon, trend, alert, iconBg }: KPICardProps) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg ?? 'bg-primary-50'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className={`text-xl font-bold font-mono tracking-tight ${alert ? 'text-red-600' : 'text-gray-900'}`}>
          {value}
        </p>
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            <ArrowUpRight size={11} className="text-emerald-500" />
            <span className="text-xs text-emerald-600">{trend}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Custom tooltip for bar chart
export default function FIDashboard() {
  const { data: summary, isLoading, isError } = usePortfolioSummary()

  if (isLoading) return <Layout title="Portfolio Overview"><FullPageLoader /></Layout>
  if (isError || !summary) return <Layout title="Portfolio Overview"><ErrorState message="Failed to load portfolio summary" /></Layout>

  const totalContracts = summary.totalActive + summary.completedCount + summary.defaultedCount
  const delinquencyRate = summary.totalActive > 0 ? (summary.delinquentCount / summary.totalActive) * 100 : 0

  const donutData = [
    { name: 'Active', value: summary.totalActive - summary.delinquentCount },
    { name: 'Delinquent', value: summary.delinquentCount },
    { name: 'Completed', value: summary.completedCount },
    { name: 'Defaulted', value: summary.defaultedCount },
  ]

  return (
    <Layout title="Portfolio Overview">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            label="Total Disbursed"
            value={formatNaira(summary.totalDisbursed)}
            icon={<Banknote size={20} className="text-primary" />}
            iconBg="bg-primary-50"
          />
          <KPICard
            label="Active Contracts"
            value={String(summary.totalActive)}
            icon={<FileCheck size={20} className="text-blue-600" />}
            iconBg="bg-blue-50"
          />
          <KPICard
            label="Delinquency Rate"
            value={`${delinquencyRate.toFixed(1)}%`}
            icon={<AlertTriangle size={20} className="text-red-500" />}
            alert={delinquencyRate > 5}
            iconBg="bg-red-50"
          />
          <KPICard
            label="Completed Contracts"
            value={String(summary.completedCount)}
            icon={<CheckCircle2 size={20} className="text-emerald-600" />}
            iconBg="bg-emerald-50"
          />
        </div>

        {/* Donut chart */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-5">
            <Activity size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-gray-700">Portfolio Breakdown</h3>
            <span className="ml-auto text-xs text-gray-500">{totalContracts} total contracts</span>
          </div>
          {totalContracts === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">No Murabahah contracts yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {donutData.map((_, index) => (
                    <Cell key={index} fill={DONUT_COLORS[index]} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 4 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} contract${value !== 1 ? 's' : ''}`, name]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Layout>
  )
}
