import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Copy,
  Check,
  ChevronLeft,
  TrendingDown,
  ShieldCheck,
  Coins,
  HeartHandshake,
  Lock,
} from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import AmountDisplay from '../../components/AmountDisplay'
import { ErrorState, FullPageLoader } from '../../components/LoadingState'
import { formatDate, formatNaira } from '../../lib/formatters'
import {
  useContract, useContractRepayments,
  useIbraRequests, useRequestIbra,
  useLatePaymentCharities, useConfirmCharityPayment,
  useRahnAgreements,
} from '../../api/client'
import type { IbraSettlementType } from '../../api/client'

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const [copied, setCopied] = useState(false)

  const { data: contract, isLoading: loadingContract, isError } = useContract(id ?? '')
  const { data: repaymentsData, isLoading: loadingRepayments } = useContractRepayments(contract?.cacNumber ?? '')
  const repayments = repaymentsData ?? []

  const { data: ibraData } = useIbraRequests()
  const { data: charityData } = useLatePaymentCharities()
  const { data: rahnData } = useRahnAgreements()
  const requestIbra = useRequestIbra()
  const confirmCharityPayment = useConfirmCharityPayment()

  const [showIbraForm, setShowIbraForm] = useState(false)
  const [settlementType, setSettlementType] = useState<IbraSettlementType>('FullIbra')
  const [requestedSettlementDate, setRequestedSettlementDate] = useState(new Date().toISOString().split('T')[0])
  const [requestedAmount, setRequestedAmount] = useState(0)
  const [ibraError, setIbraError] = useState<string | null>(null)

  const [charityRefInput, setCharityRefInput] = useState('')
  const [charityOrgInput, setCharityOrgInput] = useState('')
  const [charityError, setCharityError] = useState<string | null>(null)
  const [confirmingCharityId, setConfirmingCharityId] = useState<string | null>(null)

  if (loadingContract || loadingRepayments) {
    return (
      <Layout breadcrumb={[{ label: 'Dashboard', path: '/business/dashboard' }, { label: '…' }]}>
        <FullPageLoader />
      </Layout>
    )
  }

  if (isError || !contract) {
    return (
      <Layout breadcrumb={[{ label: 'Dashboard', path: '/business/dashboard' }, { label: 'Not Found' }]}>
        <ErrorState message="Contract not found" />
      </Layout>
    )
  }

  const progress = ((contract.terms.salePrice - contract.outstandingBalance) / contract.terms.salePrice) * 100

  const handleCopyId = () => {
    navigator.clipboard.writeText(contract.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pendingIbra = (ibraData ?? []).filter((i) => i.facilityRef === contract.facilityRef)
  const charities = (charityData ?? []).filter((c) => c.cacNumber === contract.cacNumber)
  const rahnAgreement = (rahnData ?? []).find((r) => r.facilityRef === contract.facilityRef)

  const handleRequestIbra = async () => {
    setIbraError(null)
    if (settlementType === 'PartialIbra' && requestedAmount <= 0) {
      setIbraError('Enter a valid partial settlement amount')
      return
    }
    try {
      await requestIbra.mutateAsync({
        id: contract.id,
        requestedSettlementDate,
        settlementType,
        requestedAmount: settlementType === 'PartialIbra' ? requestedAmount : undefined,
      })
      setShowIbraForm(false)
    } catch (e) {
      setIbraError(e instanceof Error ? e.message : 'Failed to submit settlement request')
    }
  }

  const handleConfirmCharity = async (charityId: string) => {
    setCharityError(null)
    if (charityRefInput.trim().length < 3 || !charityOrgInput.trim()) {
      setCharityError('Receipt reference and beneficiary organization are required')
      return
    }
    try {
      await confirmCharityPayment.mutateAsync({ id: charityId, charityRef: charityRefInput, charityOrganization: charityOrgInput })
      setConfirmingCharityId(null)
      setCharityRefInput('')
      setCharityOrgInput('')
    } catch (e) {
      setCharityError(e instanceof Error ? e.message : 'Failed to confirm charity payment')
    }
  }

  return (
    <Layout
      breadcrumb={[
        { label: 'Dashboard', path: '/business/dashboard' },
        { label: contract.businessName },
      ]}
    >
      <div className="space-y-6">
        {/* Contract Header */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2.5">
                <Link to="/business/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <ChevronLeft size={18} />
                </Link>
                <h1 className="font-display text-xl font-semibold text-gray-900 tracking-tight">{contract.businessName}</h1>
                <StatusBadge status={contract.status} />
              </div>
              <div className="flex items-center gap-3 ml-7">
                <span className="text-xs text-gray-500">Contract ID:</span>
                <span className="text-xs font-mono text-gray-600">{contract.id.slice(0, 24)}...</span>
                <button
                  onClick={handleCopyId}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy contract ID"
                >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-500">Start Date</p>
              <p className="text-sm font-medium text-gray-700">{formatDate(contract.terms.startDate)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left + Center: Terms + Repayments */}
          <div className="xl:col-span-2 space-y-6">
            <div className="card p-6">
              <h2 className="font-display text-base font-semibold text-gray-800 tracking-tight mb-5">Murabahah Terms</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {[
                  { label: 'Asset Cost', value: contract.terms.assetCost },
                  { label: 'Profit Amount', value: contract.terms.profit },
                  { label: 'Sale Price', value: contract.terms.salePrice, highlight: true },
                  { label: 'Monthly Installment', value: contract.terms.installmentAmount },
                  { label: 'Outstanding Balance', value: contract.outstandingBalance, danger: contract.status === 'Delinquent' },
                ].map(({ label, value, highlight, danger }) => (
                  <div key={label} className={`p-4 rounded-xl ${highlight ? 'bg-primary-50' : 'bg-surface'}`}>
                    <p className="text-xs text-gray-500 mb-1.5">{label}</p>
                    <AmountDisplay
                      amount={value}
                      className={`text-base font-semibold ${highlight ? 'text-primary' : danger ? 'text-red-600' : 'text-gray-900'}`}
                    />
                  </div>
                ))}
                <div className="p-4 rounded-xl bg-surface">
                  <p className="text-xs text-gray-500 mb-1.5">Tenure</p>
                  <p className="text-base font-semibold text-gray-900">{contract.terms.tenureMonths} months</p>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Repayment Progress</span>
                  <span className="text-sm font-semibold text-primary">{progress.toFixed(1)}% complete</span>
                </div>
                <div className="progress-bar h-3">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${progress}%`, backgroundColor: contract.status === 'Delinquent' ? '#DC2626' : '#0D6E4D' }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">Paid: {formatNaira(contract.terms.salePrice - contract.outstandingBalance)}</span>
                  <span className="text-xs text-gray-400">Remaining: {formatNaira(contract.outstandingBalance)}</span>
                </div>
              </div>
            </div>

            {/* G11: Shari'a Supervisory Board certification — previously FI/back-office
                visible only; this page is what makes it business-visible too. */}
            <div className="card p-6 bg-teal-50/50 border-teal-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={16} className="text-teal-600" />
                </div>
                <h2 className="font-display text-base font-semibold text-gray-800 tracking-tight">Shari'a Certification</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Certification Reference</p>
                  <p className="text-sm font-mono text-gray-800">{contract.shariahCertificationRef}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Certified By</p>
                  <p className="text-sm font-medium text-gray-800">{contract.shariahCertifiedBy}</p>
                </div>
              </div>
              <p className="text-sm text-teal-700 mt-4 leading-relaxed">
                The disclosed cost, profit, sale price, and tenure above were certified compliant by
                the Shari'a Supervisory Board (AAOIFI GSIFI No. 1/2) before this contract was executed.
              </p>
            </div>

            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-display text-base font-semibold text-gray-800 tracking-tight">Repayment History ({repayments.length} installments)</h2>
              </div>
              {repayments.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <TrendingDown size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No repayments recorded yet</p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Date</th><th>Amount</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {repayments.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-50 text-primary text-xs font-semibold">
                            {r.installmentNumber}
                          </span>
                        </td>
                        <td className="text-gray-600">{formatDate(r.date)}</td>
                        <td><AmountDisplay amount={r.amount} /></td>
                        <td><StatusBadge status={r.status} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="space-y-5">
            {/* Ibra' — Early Settlement */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Coins size={16} className="text-primary" />
                </div>
                <h2 className="font-display text-base font-semibold text-gray-800 tracking-tight">Early Settlement (Ibra')</h2>
              </div>

              {pendingIbra.length > 0 && (
                <div className="space-y-2 mb-3">
                  {pendingIbra.map((req) => (
                    <div key={req.id} className="p-2.5 rounded-lg bg-amber-50 text-xs text-amber-800">
                      {req.settlementType === 'FullIbra' ? 'Full settlement' : `Partial settlement — ${formatNaira(req.requestedAmount ?? 0)}`}
                      {' '}requested for {formatDate(req.requestedSettlementDate)} — awaiting FI decision
                    </div>
                  ))}
                </div>
              )}

              {contract.status === 'Active' && (
                !showIbraForm ? (
                  <button onClick={() => setShowIbraForm(true)} className="btn-secondary w-full text-xs py-2">
                    Request Early Settlement
                  </button>
                ) : (
                  <div className="space-y-2">
                    <select value={settlementType} onChange={(e) => setSettlementType(e.target.value as IbraSettlementType)} className="input text-xs">
                      <option value="FullIbra">Full settlement</option>
                      <option value="PartialIbra">Partial settlement</option>
                    </select>
                    {settlementType === 'PartialIbra' && (
                      <input
                        type="number"
                        className="input text-xs font-mono"
                        placeholder="Amount to settle (₦)"
                        value={requestedAmount || ''}
                        onChange={(e) => setRequestedAmount(Number(e.target.value))}
                      />
                    )}
                    <input
                      type="date"
                      className="input text-xs"
                      value={requestedSettlementDate}
                      onChange={(e) => setRequestedSettlementDate(e.target.value)}
                    />
                    {ibraError && <p className="text-xs text-red-600">{ibraError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => setShowIbraForm(false)} className="btn-secondary flex-1 text-xs py-1.5">Cancel</button>
                      <button
                        onClick={handleRequestIbra}
                        disabled={requestIbra.isPending}
                        className="flex-1 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {requestIbra.isPending ? 'Submitting…' : 'Submit Request'}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Late Payment Charity */}
            {charities.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <HeartHandshake size={16} className="text-primary" />
                  </div>
                  <h2 className="font-display text-base font-semibold text-gray-800 tracking-tight">Late Payment Charity</h2>
                </div>
                {charities.map((c) => (
                  <div key={c.id} className="space-y-2 pb-3 mb-3 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                    <p className="text-xs text-gray-600">
                      Installment #{c.installmentNo} — paid late on {formatDate(c.paymentDate)}
                    </p>
                    {c.settled ? (
                      <p className="text-xs text-emerald-700">Donation confirmed</p>
                    ) : c.charityAmount == null ? (
                      <p className="text-xs text-gray-400">Awaiting the financial institution to set the charity amount</p>
                    ) : confirmingCharityId === c.id ? (
                      <>
                        <p className="text-xs text-amber-700">Amount due: {formatNaira(c.charityAmount)}</p>
                        <input
                          className="input text-xs"
                          placeholder="Receipt / transfer reference"
                          value={charityRefInput}
                          onChange={(e) => setCharityRefInput(e.target.value)}
                        />
                        <input
                          className="input text-xs"
                          placeholder="Beneficiary organization"
                          value={charityOrgInput}
                          onChange={(e) => setCharityOrgInput(e.target.value)}
                        />
                        {charityError && <p className="text-xs text-red-600">{charityError}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmingCharityId(null)} className="btn-secondary flex-1 text-xs py-1.5">Cancel</button>
                          <button
                            onClick={() => handleConfirmCharity(c.id)}
                            disabled={confirmCharityPayment.isPending}
                            className="flex-1 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            {confirmCharityPayment.isPending ? 'Confirming…' : 'Confirm Payment'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-amber-700">Amount due: {formatNaira(c.charityAmount)}</p>
                        <button onClick={() => setConfirmingCharityId(c.id)} className="btn-primary w-full text-xs py-1.5">
                          Confirm Donation Made
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Collateral (read-only — business has no Rahn choices) */}
            {rahnAgreement && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Lock size={16} className="text-primary" />
                  </div>
                  <h2 className="font-display text-base font-semibold text-gray-800 tracking-tight">Collateral (Rahn)</h2>
                </div>
                <p className="text-xs text-gray-700">{rahnAgreement.collateralDescription}</p>
                <p className="text-xs text-gray-500 mt-1">Value: {formatNaira(rahnAgreement.collateralValue)}</p>
                <div className="mt-2">
                  <StatusBadge status={rahnAgreement.collateralStatus} size="sm" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
