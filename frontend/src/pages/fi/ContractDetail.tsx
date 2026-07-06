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
} from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import AmountDisplay from '../../components/AmountDisplay'
import { ErrorState, FullPageLoader } from '../../components/LoadingState'
import { formatDate, formatNaira } from '../../lib/formatters'
import { useContract, useContractRepayments, useRecordPayment, useCloseContract } from '../../api/client'

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

            {/* Delinquent warning */}
            {contract.status === 'Delinquent' && (
              <div className="card p-4 bg-red-50 border-red-100">
                <div className="flex items-start gap-2">
                  <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-800">Delinquent Contract</p>
                    <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                      This contract has missed payments. Contact the borrower immediately and escalate
                      to recovery if needed.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
