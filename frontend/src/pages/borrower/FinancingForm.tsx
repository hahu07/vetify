import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TrendingUp, Info, CheckCircle2, Calculator } from 'lucide-react'
import Layout from '../../components/Layout'
import AmountDisplay from '../../components/AmountDisplay'
import { FullPageLoader } from '../../components/LoadingState'
import { formatNaira, calculateInstallment } from '../../lib/formatters'
import { useApprovedBorrowers, useCreateFinancing } from '../../api/client'
import { FI_PARTY_ID } from '../../api/parties'

const PROFIT_MARGIN = 15 // 15% profit margin (typical Murabahah) — an estimate shown to the
// borrower before underwriting; the real profit margin is set later by the FI when it offers
// the Murabahah proposal (OfferMurabahah), not captured on this request at all.
const TENURE_OPTIONS = [6, 12, 18, 24]

// ApprovedBorrower carries no credit-limit field on-ledger (see CLAUDE.md's Templates table) —
// there's no ledger source for a numeric cap here yet, so the amount field's upper bound is a
// fixed platform ceiling rather than a per-borrower approved limit.
const REQUEST_CEILING = 5_000_000

const schema = z.object({
  amount: z
    .number({ invalid_type_error: 'Please enter a valid amount' })
    .min(100_000, 'Minimum financing amount is ₦100,000')
    .max(REQUEST_CEILING, `Maximum financing amount is ${REQUEST_CEILING.toLocaleString()}`),
  purpose: z
    .string()
    .min(20, 'Please describe the purpose in at least 20 characters')
    .max(500, 'Maximum 500 characters'),
  tenureMonths: z.number({ invalid_type_error: 'Please select a tenure' }),
})

type FormData = z.infer<typeof schema>

export default function FinancingForm() {
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [watchedAmount, setWatchedAmount] = useState(1_500_000)
  const [watchedTenure, setWatchedTenure] = useState(18)

  const { data: approvedBorrowers, isLoading } = useApprovedBorrowers()
  const createFinancing = useCreateFinancing()
  const approvedBorrower = approvedBorrowers?.find((b) => b.status === 'BorrowerActive')
  const approvedLimit = REQUEST_CEILING

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: 1_500_000,
      purpose: '',
      tenureMonths: 18,
    },
  })

  const amount = watch('amount')
  const tenureMonths = watch('tenureMonths')

  useEffect(() => {
    if (amount) setWatchedAmount(Number(amount))
    if (tenureMonths) setWatchedTenure(Number(tenureMonths))
  }, [amount, tenureMonths])

  const totalProfit = watchedAmount * (PROFIT_MARGIN / 100)
  const salePrice = watchedAmount + totalProfit
  const monthlyInstallment = calculateInstallment(watchedAmount, PROFIT_MARGIN, watchedTenure)

  const onSubmit = async (data: FormData) => {
    setSubmitError(null)
    if (!approvedBorrower) {
      setSubmitError('No approved borrower record found — complete onboarding and compliance review first.')
      return
    }
    try {
      await createFinancing.mutateAsync({
        approvedBorrowerContractId: approvedBorrower.id,
        financialInstitution: FI_PARTY_ID,
        terms: { amount: data.amount, purpose: data.purpose, tenureMonths: data.tenureMonths },
      })
      setSubmitted(true)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit financing request')
    }
  }

  if (isLoading) {
    return (
      <Layout breadcrumb={[{ label: 'Business Portal', path: '/business/dashboard' }, { label: 'Financing Request' }]}>
        <FullPageLoader />
      </Layout>
    )
  }

  if (submitted) {
    return (
      <Layout
        breadcrumb={[
          { label: 'Business Portal', path: '/business/dashboard' },
          { label: 'Financing Request' },
        ]}
      >
        <div className="max-w-lg mx-auto mt-16 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Financing Request Submitted!</h2>
          <p className="text-gray-600 text-sm mb-2">
            Your financing request has been submitted. The Underwriting Agent will analyze your
            financial data and provide a recommendation within 1 business day.
          </p>
          <p className="text-gray-500 text-xs">
            You'll be notified once the Underwriting Agent has completed its analysis.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      breadcrumb={[
        { label: 'Business Portal', path: '/business/dashboard' },
        { label: 'Financing Request' },
      ]}
    >
      <div className="max-w-2xl mx-auto">
        {/* Approved borrower banner */}
        {approvedBorrower ? (
          <div className="card p-4 mb-5 bg-emerald-50 border-emerald-100">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Approved Borrower</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  You're eligible to request financing up to{' '}
                  <strong className="font-mono">{formatNaira(approvedLimit)}</strong> per request.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-4 mb-5 bg-amber-50 border-amber-100">
            <p className="text-sm font-semibold text-amber-800">No approved borrower record found</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Complete onboarding and compliance review before requesting financing.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Form */}
          <div className="lg:col-span-3 card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
                <TrendingUp size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Financing Request</h2>
                <p className="text-xs text-gray-500">Murabahah-compliant business financing</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Amount */}
              <div>
                <label htmlFor="amount" className="block text-xs font-medium text-gray-700 mb-1">
                  Financing Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">₦</span>
                  <input
                    id="amount"
                    type="number"
                    className={`input pl-7 font-mono ${errors.amount ? 'input-error' : ''}`}
                    placeholder="1,500,000"
                    step={10000}
                    min={100000}
                    max={approvedLimit}
                    {...register('amount', { valueAsNumber: true })}
                  />
                </div>
                {errors.amount && (
                  <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-400">Min: ₦100,000</p>
                  <p className="text-xs text-gray-400">Max: {formatNaira(approvedLimit)}</p>
                </div>

                {/* Amount slider */}
                <input
                  type="range"
                  min={100_000}
                  max={approvedLimit}
                  step={50_000}
                  value={watchedAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setWatchedAmount(val)
                    setValue('amount', val)
                  }}
                  className="w-full mt-2 accent-primary"
                />
              </div>

              {/* Purpose */}
              <div>
                <label htmlFor="purpose" className="block text-xs font-medium text-gray-700 mb-1">
                  Business Purpose <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="purpose"
                  rows={4}
                  className={`input resize-none ${errors.purpose ? 'input-error' : ''}`}
                  placeholder="Describe how this financing will be used — e.g., purchase of equipment, inventory acquisition, working capital expansion..."
                  {...register('purpose')}
                />
                {errors.purpose && (
                  <p className="mt-1 text-xs text-red-600">{errors.purpose.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Be specific — helps the Underwriting Agent assess your request accurately.
                </p>
              </div>

              {/* Tenure */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Repayment Tenure <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TENURE_OPTIONS.map((months) => (
                    <label key={months} className="cursor-pointer">
                      <input
                        type="radio"
                        value={months}
                        className="sr-only"
                        {...register('tenureMonths', { valueAsNumber: true })}
                        onChange={() => {
                          setWatchedTenure(months)
                          setValue('tenureMonths', months)
                        }}
                      />
                      <div
                        className={`text-center py-2.5 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer ${
                          watchedTenure === months
                            ? 'border-primary bg-primary text-white'
                            : 'border-gray-200 text-gray-600 hover:border-primary/50'
                        }`}
                      >
                        <span className="block font-semibold">{months}</span>
                        <span className="text-xs opacity-70">months</span>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.tenureMonths && (
                  <p className="mt-1 text-xs text-red-600">{errors.tenureMonths.message}</p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-accent-50 border border-accent/20 flex items-start gap-2">
                <Info size={14} className="text-accent mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  This request will be processed as a <strong>Murabahah</strong> (cost-plus sale). The financial
                  institution purchases the asset at cost and sells it to you at a disclosed profit margin.
                  No interest applies.
                </p>
              </div>

              {submitError && <p className="text-xs text-red-600">{submitError}</p>}

              <button type="submit" disabled={createFinancing.isPending} className="btn-primary w-full disabled:opacity-50">
                {createFinancing.isPending ? 'Submitting…' : 'Submit Financing Request'}
              </button>
            </form>
          </div>

          {/* Summary */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calculator size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-gray-700">Estimated Terms</h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Asset Cost (Principal)</span>
                  <AmountDisplay amount={watchedAmount} />
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Profit Margin ({PROFIT_MARGIN}%)</span>
                  <AmountDisplay amount={totalProfit} />
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">Sale Price (Total)</span>
                  <AmountDisplay amount={salePrice} className="font-semibold text-gray-900 text-base" />
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Tenure</span>
                  <span className="text-sm font-medium text-gray-900">{watchedTenure} months</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-semibold text-gray-700">Monthly Installment</span>
                  <div className="text-right">
                    <AmountDisplay amount={monthlyInstallment} className="font-bold text-primary text-base" />
                    <p className="text-xs text-gray-400">/month</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                * Estimates based on {PROFIT_MARGIN}% profit margin. Actual terms are finalized
                by the financial institution after underwriting review.
              </p>
            </div>

            {/* Shariah compliance */}
            <div className="card p-4 bg-primary-50 border-primary/10">
              <p className="text-xs font-semibold text-primary mb-1">Shariah Compliant</p>
              <p className="text-xs text-primary/80 leading-relaxed">
                Certified under AAOIFI Standard No. 8 (Murabahah) and CBN Non-Interest Financial
                Institutions Framework. All profit is disclosed upfront — no hidden charges.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
