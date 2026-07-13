import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Copy,
  Check,
  CreditCard,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  TrendingDown,
  ShieldCheck,
  Coins,
  HeartHandshake,
  Lock,
  AlertOctagon,
} from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import AmountDisplay from '../../components/AmountDisplay'
import { ErrorState, FullPageLoader } from '../../components/LoadingState'
import { formatDate, formatNaira } from '../../lib/formatters'
import {
  useContract, useContractRepayments, useRecordPayment, useCloseContract, useDefaultContract,
  useIbraRequests, useGrantIbra, useDeclineIbra,
  useLatePaymentCharities, useSetCharityAmount,
  useRahnAgreements, useCreateRahn, useReleaseCollateral, useEnforceCollateral,
  useAuthorizedOfficers,
} from '../../api/client'

const paymentSchema = z.object({
  date: z.string().min(1, 'Payment date is required'),
  amount: z.number({ invalid_type_error: 'Amount required' }).positive('Enter a valid amount'),
  installmentNumber: z.number({ invalid_type_error: 'Installment # required' }).int().positive(),
})

type PaymentFormData = z.infer<typeof paymentSchema>

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const [copied, setCopied] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  const { data: contract, isLoading: loadingContract, isError } = useContract(id ?? '')
  const { data: repaymentsData, isLoading: loadingRepayments } = useContractRepayments(contract?.cacNumber ?? '')
  const repayments = repaymentsData ?? []
  const recordPayment = useRecordPayment()
  const closeContract = useCloseContract()
  const defaultContract = useDefaultContract()

  const { data: officers } = useAuthorizedOfficers()
  const { data: ibraData } = useIbraRequests()
  const { data: charityData } = useLatePaymentCharities()
  const { data: rahnData } = useRahnAgreements()
  const grantIbra = useGrantIbra()
  const declineIbra = useDeclineIbra()
  const setCharityAmount = useSetCharityAmount()
  const createRahn = useCreateRahn()
  const releaseCollateral = useReleaseCollateral()
  const enforceCollateral = useEnforceCollateral()

  const [defaultConfirm, setDefaultConfirm] = useState(false)
  const [defaultReason, setDefaultReason] = useState('')
  const [defaultOfficerId, setDefaultOfficerId] = useState('')
  const [defaultError, setDefaultError] = useState<string | null>(null)

  const [ibraOfficerA, setIbraOfficerA] = useState('')
  const [ibraOfficerB, setIbraOfficerB] = useState('')
  const [rebateAmount, setRebateAmount] = useState(0)
  const [ibraError, setIbraError] = useState<string | null>(null)

  const [charityAmountInput, setCharityAmountInput] = useState(0)
  const [charityError, setCharityError] = useState<string | null>(null)

  const [rahnDescription, setRahnDescription] = useState('')
  const [rahnValue, setRahnValue] = useState(0)
  const [rahnError, setRahnError] = useState<string | null>(null)
  const [collateralOfficerA, setCollateralOfficerA] = useState('')
  const [collateralOfficerB, setCollateralOfficerB] = useState('')
  const [collateralError, setCollateralError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    values: contract ? {
      date: new Date().toISOString().split('T')[0],
      amount: contract.terms.installmentAmount,
      installmentNumber: repayments.length + 1,
    } : undefined,
  })

  if (loadingContract || loadingRepayments) {
    return (
      <Layout breadcrumb={[{ label: 'Contracts', path: '/fi/contracts' }, { label: '…' }]}>
        <FullPageLoader />
      </Layout>
    )
  }

  if (isError || !contract) {
    return (
      <Layout breadcrumb={[{ label: 'Contracts', path: '/fi/contracts' }, { label: 'Not Found' }]}>
        <ErrorState message="Contract not found" />
      </Layout>
    )
  }

  const progress =
    ((contract.terms.salePrice - contract.outstandingBalance) / contract.terms.salePrice) * 100

  const handleCopyId = () => {
    navigator.clipboard.writeText(contract.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePaymentSubmit = async (data: PaymentFormData) => {
    setPaymentError(null)
    try {
      await recordPayment.mutateAsync({
        id: contract.id,
        payload: { paymentDate: data.date, amountPaid: data.amount, installmentNo: data.installmentNumber },
      })
      setPaymentSuccess(true)
      setTimeout(() => {
        setPaymentSuccess(false)
        reset()
      }, 3000)
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : 'Failed to record payment')
    }
  }

  const handleClose = async () => {
    setCloseError(null)
    try {
      await closeContract.mutateAsync({ id: contract.id, closingDate: new Date().toISOString().split('T')[0] })
      setCloseConfirm(false)
    } catch (e) {
      setCloseError(e instanceof Error ? e.message : 'Failed to close contract')
    }
  }

  // IbraRequest/RahnAgreement carry facilityRef (MurabahahContract's own business
  // key, not its contractId). LatePaymentCharity has no facilityRef at all in the
  // Daml schema — cacNumber is the best available correlation to this contract.
  const pendingIbra = (ibraData ?? []).filter((i) => i.facilityRef === contract.facilityRef)
  const unsettledCharities = (charityData ?? []).filter((c) => c.cacNumber === contract.cacNumber && !c.settled)
  const rahnAgreement = (rahnData ?? []).find((r) => r.facilityRef === contract.facilityRef)

  const handleDefault = async () => {
    setDefaultError(null)
    if (defaultReason.trim().length < 5 || !defaultOfficerId) {
      setDefaultError('Reason and authorizing officer are required')
      return
    }
    try {
      await defaultContract.mutateAsync({ id: contract.id, reason: defaultReason, defaultedBy: defaultOfficerId })
      setDefaultConfirm(false)
    } catch (e) {
      setDefaultError(e instanceof Error ? e.message : 'Failed to default contract')
    }
  }

  const handleGrantIbra = async (ibraId: string) => {
    setIbraError(null)
    if (!ibraOfficerA || !ibraOfficerB || rebateAmount <= 0) {
      setIbraError('Rebate amount and both officers are required')
      return
    }
    try {
      await grantIbra.mutateAsync({
        id: ibraId, rebateAmount, proposedByOfficerId: ibraOfficerA, confirmedByOfficerId: ibraOfficerB,
      })
    } catch (e) {
      setIbraError(e instanceof Error ? e.message : 'Failed to grant Ibra')
    }
  }

  const handleDeclineIbra = async (ibraId: string) => {
    setIbraError(null)
    try {
      await declineIbra.mutateAsync({ id: ibraId, reason: 'Declined by financial institution' })
    } catch (e) {
      setIbraError(e instanceof Error ? e.message : 'Failed to decline Ibra')
    }
  }

  const handleSetCharityAmount = async (charityId: string) => {
    setCharityError(null)
    if (charityAmountInput <= 0) {
      setCharityError('Enter a valid charity amount')
      return
    }
    try {
      await setCharityAmount.mutateAsync({ id: charityId, amount: charityAmountInput })
    } catch (e) {
      setCharityError(e instanceof Error ? e.message : 'Failed to set charity amount')
    }
  }

  const handlePledgeCollateral = async () => {
    setRahnError(null)
    if (!rahnDescription.trim() || rahnValue <= 0) {
      setRahnError('Description and value are required')
      return
    }
    try {
      await createRahn.mutateAsync({
        business: contract.business,
        facilityRef: contract.facilityRef,
        businessName: contract.businessName,
        cacRegNumber: contract.cacNumber,
        collateralDescription: rahnDescription,
        collateralValue: rahnValue,
        collateralStatus: 'CollateralActive',
      })
      setRahnDescription('')
      setRahnValue(0)
    } catch (e) {
      setRahnError(e instanceof Error ? e.message : 'Failed to pledge collateral')
    }
  }

  const handleReleaseCollateral = async () => {
    setCollateralError(null)
    if (!collateralOfficerA || !collateralOfficerB || !rahnAgreement) {
      setCollateralError('Both officers are required')
      return
    }
    try {
      await releaseCollateral.mutateAsync({
        id: rahnAgreement.id, note: 'Released on full repayment',
        proposedByOfficerId: collateralOfficerA, confirmedByOfficerId: collateralOfficerB,
      })
    } catch (e) {
      setCollateralError(e instanceof Error ? e.message : 'Failed to release collateral')
    }
  }

  const handleEnforceCollateral = async () => {
    setCollateralError(null)
    if (!collateralOfficerA || !collateralOfficerB || !rahnAgreement) {
      setCollateralError('Both officers are required')
      return
    }
    try {
      await enforceCollateral.mutateAsync({
        id: rahnAgreement.id, reason: 'Enforced on default',
        proposedByOfficerId: collateralOfficerA, confirmedByOfficerId: collateralOfficerB,
      })
    } catch (e) {
      setCollateralError(e instanceof Error ? e.message : 'Failed to enforce collateral')
    }
  }

  return (
    <Layout
      breadcrumb={[
        { label: 'FI Dashboard', path: '/fi/dashboard' },
        { label: 'Contracts', path: '/fi/contracts' },
        { label: contract.businessName },
      ]}
    >
      <div className="space-y-5">
        {/* Contract Header */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link to="/fi/contracts" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <ChevronLeft size={18} />
                </Link>
                <h1 className="text-lg font-semibold text-gray-900">{contract.businessName}</h1>
                <StatusBadge status={contract.status} />
              </div>
              <div className="flex items-center gap-3 ml-7">
                <span className="text-xs text-gray-500">CAC: </span>
                <span className="text-xs font-mono text-gray-700">{contract.cacNumber}</span>
                <span className="text-gray-300">|</span>
                <span className="text-xs text-gray-500">Contract ID:</span>
                <span className="text-xs font-mono text-gray-600">
                  {contract.id.slice(0, 24)}...
                </span>
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Left + Center: Terms + Repayments */}
          <div className="xl:col-span-2 space-y-5">
            {/* Murabahah Terms */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Murabahah Terms</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Asset Cost', value: contract.terms.assetCost },
                  { label: 'Profit Amount', value: contract.terms.profit },
                  { label: 'Sale Price', value: contract.terms.salePrice, highlight: true },
                  { label: 'Monthly Installment', value: contract.terms.installmentAmount },
                  { label: 'Outstanding Balance', value: contract.outstandingBalance, danger: contract.status === 'Delinquent' },
                ].map(({ label, value, highlight, danger }) => (
                  <div key={label} className={`p-3 rounded-lg ${highlight ? 'bg-primary-50' : 'bg-gray-50'}`}>
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <AmountDisplay
                      amount={value}
                      className={`text-sm font-semibold ${highlight ? 'text-primary' : danger ? 'text-red-600' : 'text-gray-900'}`}
                    />
                  </div>
                ))}
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">Tenure</p>
                  <p className="text-sm font-semibold text-gray-900">{contract.terms.tenureMonths} months</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Repayment Progress</span>
                  <span className="text-xs font-semibold text-primary">{progress.toFixed(1)}% complete</span>
                </div>
                <div className="progress-bar h-3">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: contract.status === 'Delinquent' ? '#DC2626' : '#0D6E4D',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-400">
                    Paid: {formatNaira(contract.terms.salePrice - contract.outstandingBalance)}
                  </span>
                  <span className="text-xs text-gray-400">
                    Remaining: {formatNaira(contract.outstandingBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* G11: Shari'a Supervisory Board certification of the executed terms
                above — the advisor's per-contract sign-off, distinct from the
                Stage 3 sector pre-check. Examiner/regulator-facing provenance. */}
            <div className="card p-5 bg-teal-50/50 border-teal-100">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={16} className="text-teal-600" />
                <h2 className="text-sm font-semibold text-gray-700">Shari'a Certification</h2>
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
              <p className="text-xs text-teal-700 mt-3 leading-relaxed">
                The disclosed cost, profit, sale price, and tenure above were certified compliant by
                the Shari'a Supervisory Board (AAOIFI GSIFI No. 1/2) before this contract could be
                executed.
              </p>
            </div>

            {/* Repayment History */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">
                  Repayment History ({repayments.length} installments)
                </h2>
              </div>

              {repayments.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <TrendingDown size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No repayments recorded yet</p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
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

          {/* Right: Action Panel */}
          <div className="space-y-4">
            {/* Record Payment */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-gray-700">Record Payment</h2>
              </div>

              {paymentSuccess ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                  <p className="text-sm font-semibold text-gray-800">Payment Recorded!</p>
                  <p className="text-xs text-gray-500">The repayment has been logged on the ledger.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit(handlePaymentSubmit)} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
                    <input
                      type="date"
                      className={`input text-sm ${errors.date ? 'input-error' : ''}`}
                      {...register('date')}
                    />
                    {errors.date && <p className="text-xs text-red-600 mt-1">{errors.date.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₦)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                      <input
                        type="number"
                        className={`input pl-6 font-mono text-sm ${errors.amount ? 'input-error' : ''}`}
                        {...register('amount', { valueAsNumber: true })}
                      />
                    </div>
                    {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Installment #</label>
                    <input
                      type="number"
                      min={1}
                      className={`input text-sm ${errors.installmentNumber ? 'input-error' : ''}`}
                      {...register('installmentNumber', { valueAsNumber: true })}
                    />
                    {errors.installmentNumber && (
                      <p className="text-xs text-red-600 mt-1">{errors.installmentNumber.message}</p>
                    )}
                  </div>

                  {paymentError && <p className="text-xs text-red-600">{paymentError}</p>}

                  <button type="submit" disabled={recordPayment.isPending} className="btn-primary w-full text-sm disabled:opacity-50">
                    {recordPayment.isPending ? 'Recording…' : 'Record Payment'}
                  </button>
                </form>
              )}
            </div>

            {/* Close contract */}
            {contract.outstandingBalance <= 0 && contract.status !== 'Completed' && (
              <div className="card p-4">
                {!closeConfirm ? (
                  <button
                    onClick={() => setCloseConfirm(true)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium transition-colors"
                  >
                    <CheckCircle2 size={14} />
                    Close Contract
                  </button>
                ) : (
                  <div className="text-center space-y-2">
                    <p className="text-xs text-gray-600">Close this contract as fully repaid?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCloseConfirm(false)}
                        className="btn-secondary flex-1 text-xs py-1.5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClose}
                        disabled={closeContract.isPending}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {closeContract.isPending ? 'Closing…' : 'Close Contract'}
                      </button>
                    </div>
                    {closeError && <p className="text-xs text-red-600">{closeError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Contract closed info */}
            {contract.status === 'Completed' && (
              <div className="card p-4 bg-teal-50 border-teal-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-teal-600" />
                  <div>
                    <p className="text-xs font-semibold text-teal-800">Contract Completed</p>
                    <p className="text-xs text-teal-700 mt-0.5">All installments have been received.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Delinquent warning + Default action */}
            {contract.status === 'Delinquent' && (
              <div className="card p-4 bg-red-50 border-red-100">
                <div className="flex items-start gap-2 mb-3">
                  <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-800">Delinquent Contract</p>
                    <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                      This contract has missed payments. Contact the business immediately and escalate
                      to recovery if needed.
                    </p>
                  </div>
                </div>
                {!defaultConfirm ? (
                  <button
                    onClick={() => setDefaultConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-300 text-red-700 bg-white hover:bg-red-100 text-xs font-medium transition-colors"
                  >
                    <AlertOctagon size={13} />
                    Default Contract
                  </button>
                ) : (
                  <div className="space-y-2 pt-2 border-t border-red-200">
                    <textarea
                      rows={2}
                      value={defaultReason}
                      onChange={(e) => setDefaultReason(e.target.value)}
                      className="input text-xs resize-none"
                      placeholder="Reason for default (write-off)..."
                    />
                    <select
                      value={defaultOfficerId}
                      onChange={(e) => setDefaultOfficerId(e.target.value)}
                      className="input text-xs"
                    >
                      <option value="">Select authorizing officer…</option>
                      {(officers ?? []).map((o) => (
                        <option key={o.id} value={o.officerId}>{o.officerName} ({o.officerId})</option>
                      ))}
                    </select>
                    {defaultError && <p className="text-xs text-red-600">{defaultError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => setDefaultConfirm(false)} className="btn-secondary flex-1 text-xs py-1.5">
                        Cancel
                      </button>
                      <button
                        onClick={handleDefault}
                        disabled={defaultContract.isPending}
                        className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        {defaultContract.isPending ? 'Defaulting…' : 'Confirm Default'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ibra' — pending early settlement requests from the business */}
            {pendingIbra.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Coins size={15} className="text-primary" />
                  <h2 className="text-sm font-semibold text-gray-700">Early Settlement Request (Ibra')</h2>
                </div>
                {pendingIbra.map((req) => (
                  <div key={req.id} className="space-y-2 pb-3 mb-3 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                    <p className="text-xs text-gray-600">
                      {req.settlementType === 'FullIbra' ? 'Full settlement' : `Partial settlement — ${formatNaira(req.requestedAmount ?? 0)}`}
                      {' '}requested for {formatDate(req.requestedSettlementDate)}
                    </p>
                    <p className="text-xs text-gray-400">Outstanding: {formatNaira(req.outstandingBalance)}</p>
                    <input
                      type="number"
                      className="input text-xs font-mono"
                      placeholder="Rebate amount (₦)"
                      value={rebateAmount || ''}
                      onChange={(e) => setRebateAmount(Number(e.target.value))}
                    />
                    <select value={ibraOfficerA} onChange={(e) => setIbraOfficerA(e.target.value)} className="input text-xs">
                      <option value="">Proposed by (Credit Officer)…</option>
                      {(officers ?? []).map((o) => (
                        <option key={o.id} value={o.officerId}>{o.officerName} ({o.officerId})</option>
                      ))}
                    </select>
                    <select value={ibraOfficerB} onChange={(e) => setIbraOfficerB(e.target.value)} className="input text-xs">
                      <option value="">Confirmed by (Risk Officer)…</option>
                      {(officers ?? []).map((o) => (
                        <option key={o.id} value={o.officerId}>{o.officerName} ({o.officerId})</option>
                      ))}
                    </select>
                    {req.settlementType !== 'FullIbra' && (
                      <p className="text-xs text-amber-600">
                        Partial-settlement rebates aren't supported through the portal yet — decline this
                        request and ask the business to request a full settlement instead.
                      </p>
                    )}
                    {ibraError && <p className="text-xs text-red-600">{ibraError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeclineIbra(req.id)}
                        disabled={declineIbra.isPending}
                        className="btn-secondary flex-1 text-xs py-1.5 disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleGrantIbra(req.id)}
                        disabled={grantIbra.isPending || req.settlementType !== 'FullIbra'}
                        title={req.settlementType !== 'FullIbra' ? 'GrantIbra only supports full settlement — GrantPartialIbra is not yet available' : undefined}
                        className="flex-1 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {grantIbra.isPending ? 'Granting…' : 'Grant Rebate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Late Payment Charity — Sadaqah obligations awaiting an FI-set amount */}
            {unsettledCharities.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <HeartHandshake size={15} className="text-primary" />
                  <h2 className="text-sm font-semibold text-gray-700">Late Payment Charity</h2>
                </div>
                {unsettledCharities.map((c) => (
                  <div key={c.id} className="space-y-2 pb-3 mb-3 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                    <p className="text-xs text-gray-600">
                      Installment #{c.installmentNo} — due {formatDate(c.dueDate)}, paid {formatDate(c.paymentDate)}
                    </p>
                    {c.charityAmount == null ? (
                      <>
                        <input
                          type="number"
                          className="input text-xs font-mono"
                          placeholder="Charity amount (₦)"
                          value={charityAmountInput || ''}
                          onChange={(e) => setCharityAmountInput(Number(e.target.value))}
                        />
                        {charityError && <p className="text-xs text-red-600">{charityError}</p>}
                        <button
                          onClick={() => handleSetCharityAmount(c.id)}
                          disabled={setCharityAmount.isPending}
                          className="btn-primary w-full text-xs py-1.5 disabled:opacity-50"
                        >
                          {setCharityAmount.isPending ? 'Setting…' : 'Set Charity Amount'}
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-amber-700">
                        Amount set: {formatNaira(c.charityAmount)} — awaiting business confirmation
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Rahn (Collateral) */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={15} className="text-primary" />
                <h2 className="text-sm font-semibold text-gray-700">Collateral (Rahn)</h2>
              </div>
              {rahnAgreement ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-700">{rahnAgreement.collateralDescription}</p>
                  <p className="text-xs text-gray-500">Value: {formatNaira(rahnAgreement.collateralValue)}</p>
                  <StatusBadge status={rahnAgreement.collateralStatus} size="sm" />
                  {rahnAgreement.collateralStatus === 'CollateralActive' && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <select value={collateralOfficerA} onChange={(e) => setCollateralOfficerA(e.target.value)} className="input text-xs">
                        <option value="">Proposed by…</option>
                        {(officers ?? []).map((o) => (
                          <option key={o.id} value={o.officerId}>{o.officerName} ({o.officerId})</option>
                        ))}
                      </select>
                      <select value={collateralOfficerB} onChange={(e) => setCollateralOfficerB(e.target.value)} className="input text-xs">
                        <option value="">Confirmed by…</option>
                        {(officers ?? []).map((o) => (
                          <option key={o.id} value={o.officerId}>{o.officerName} ({o.officerId})</option>
                        ))}
                      </select>
                      {collateralError && <p className="text-xs text-red-600">{collateralError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={handleReleaseCollateral}
                          disabled={releaseCollateral.isPending}
                          className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Release
                        </button>
                        <button
                          onClick={handleEnforceCollateral}
                          disabled={enforceCollateral.isPending}
                          className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          Enforce
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-2">No collateral pledged for this facility.</p>
                  <input
                    className="input text-xs"
                    placeholder="Collateral description"
                    value={rahnDescription}
                    onChange={(e) => setRahnDescription(e.target.value)}
                  />
                  <input
                    type="number"
                    className="input text-xs font-mono"
                    placeholder="Estimated value (₦)"
                    value={rahnValue || ''}
                    onChange={(e) => setRahnValue(Number(e.target.value))}
                  />
                  {rahnError && <p className="text-xs text-red-600">{rahnError}</p>}
                  <button
                    onClick={handlePledgeCollateral}
                    disabled={createRahn.isPending}
                    className="btn-secondary w-full text-xs py-1.5 disabled:opacity-50"
                  >
                    {createRahn.isPending ? 'Pledging…' : 'Pledge Collateral'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
