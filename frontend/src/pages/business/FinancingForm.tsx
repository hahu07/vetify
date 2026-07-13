import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TrendingUp, Info, CheckCircle2, Calculator, ShieldCheck, Clock3, Landmark } from 'lucide-react'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/StatusBadge'
import { FullPageLoader, EmptyState } from '../../components/LoadingState'
import { formatNaira, formatDate, calculateInstallment } from '../../lib/formatters'
import {
  useApprovedBusinesses, useCreateFinancing, useUnderwritingPolicyForFi, useFinancingList,
  useApprovedProviders,
} from '../../api/client'

// A business may legitimately hold more than one FinancingRequest at once — RequestFinancing is
// nonconsuming specifically to support repeat/parallel facilities (see ApprovedBusiness in
// Financing.daml) — so this list is never used to block the form, only to make prior
// submissions visible. Without it, the only "submitted" feedback was the one-time confirmation
// screen right after submit; navigating away (or a refresh) left no trace a request existed at
// all, and no way to check its status short of asking vetify/the FI directly.
const ACTIVE_FINANCING_STATUSES = new Set(['Submitted', 'Underwriting'])

// Min/max financing amount and indicative profit margin are entirely FI-configurable
// (UnderwritingPolicy in Financing.daml) — vetify has no opinion on any of the three. Both
// amount bounds are genuinely optional on-ledger: an FI that hasn't set one is enforced at
// creation time (BeginUnderwriting), so a request is never rejected against a bound the FI
// didn't actually set. SLIDER_FLOOR/SLIDER_CEILING below are pure UI scaffolding — the <input
// type="range"> element requires concrete numeric min/max to render at all — never treated as a
// real constraint; validation only ever enforces a bound the FI explicitly configured. The real
// profit margin is set later by the FI when it offers the Murabahah proposal (OfferMurabahah),
// not captured on this request at all — indicativeProfitMarginPct is only an estimate shown
// before underwriting, defaulting to a platform figure when the FI hasn't set one since — unlike
// the amount bounds — there's no "unenforced" state for a number that's purely informational.
const SLIDER_FLOOR = 50_000
const SLIDER_CEILING = 10_000_000
const DEFAULT_INDICATIVE_PROFIT_MARGIN_PCT = 15
const TENURE_OPTIONS = [6, 12, 18, 24]

const LATTICE_BG = {
  backgroundImage: `
    repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 0, transparent 50%),
    repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 0, transparent 50%)
  `,
  backgroundSize: '22px 22px',
}

// min/max are undefined when the FI hasn't configured that bound — no fallback to a platform
// number, so an unset bound is genuinely unenforced rather than silently capped.
function buildSchema(min: number | undefined, max: number | undefined) {
  let amount = z.number({ invalid_type_error: 'Please enter a valid amount' }).positive('Please enter a valid amount')
  if (min !== undefined) amount = amount.min(min, `Minimum financing amount is ${formatNaira(min)}`)
  if (max !== undefined) amount = amount.max(max, `Maximum financing amount is ${formatNaira(max)}`)
  return z.object({
    amount,
    purpose: z
      .string()
      .min(20, 'Please describe the purpose in at least 20 characters')
      .max(500, 'Maximum 500 characters'),
    // z.coerce.number (not z.number) because react-hook-form's valueAsNumber option doesn't
    // apply to a value read from a multi-ref radio group the way it does for a single input —
    // confirmed live: the resolver received tenureMonths as the string "18", not the number 18,
    // even with valueAsNumber: true on every register() call in the group. Coercing here is
    // robust regardless of what type RHF hands off.
    tenureMonths: z.coerce.number({ invalid_type_error: 'Please select a tenure' }),
  })
}

type FormData = z.infer<ReturnType<typeof buildSchema>>

function sliderTrackStyle(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100
  return {
    background: `linear-gradient(to right, #0D6E4D 0%, #0D6E4D ${pct}%, #E5E7EB ${pct}%, #E5E7EB 100%)`,
  }
}

const RANGE_THUMB_CLASSES =
  'w-full h-2 rounded-full appearance-none cursor-pointer ' +
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px] ' +
  '[&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(13,110,77,0.35)] ' +
  '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform ' +
  '[&::-webkit-slider-thumb]:hover:scale-110 ' +
  '[&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white ' +
  '[&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(13,110,77,0.35)] ' +
  '[&::-moz-range-thumb]:cursor-pointer'

export default function FinancingForm() {
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [watchedAmount, setWatchedAmount] = useState(1_500_000)
  const [watchedTenure, setWatchedTenure] = useState(18)
  // Undefined until the business picks one (or the only available institution is
  // auto-selected below) — previously this page hard-coded a single demo FI_PARTY_ID, so a
  // request could never actually reach any self-serve-signed-up institution: there was no way
  // for a business to address it to anyone else. Found live: a real approved provider
  // ("AmanaTrade Investment") never received a single request despite being fully approved.
  const [selectedFi, setSelectedFi] = useState<string | undefined>(undefined)

  const { data: approvedBusinesses, isLoading } = useApprovedBusinesses()
  const { data: approvedProviders, isLoading: loadingProviders } = useApprovedProviders()
  const { data: underwritingPolicy } = useUnderwritingPolicyForFi(selectedFi ?? '')
  const { data: financingRequests } = useFinancingList()
  const createFinancing = useCreateFinancing()
  const approvedBusiness = approvedBusinesses?.find((b) => b.status === 'BusinessActive')

  // Only one institution to choose from — skip making the business click it explicitly.
  useEffect(() => {
    if (!selectedFi && approvedProviders?.length === 1) {
      setSelectedFi(approvedProviders[0].financialInstitution)
    }
  }, [approvedProviders, selectedFi])
  const sortedRequests = [...(financingRequests ?? [])].sort(
    (a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '')
  )
  const activeRequestCount = sortedRequests.filter((r) => ACTIVE_FINANCING_STATUSES.has(r.status)).length

  // Enforced bounds: undefined means the FI genuinely set no limit — used for validation and
  // for whatever copy states the actual constraint. Effective bounds: always concrete numbers,
  // used only to size the slider/presets — never communicated as an FI-imposed limit.
  const enforcedMin = underwritingPolicy?.minLoanAmount
  const enforcedMax = underwritingPolicy?.maxLoanAmount
  const effectiveMin = enforcedMin ?? SLIDER_FLOOR
  const effectiveMax = enforcedMax ?? SLIDER_CEILING
  const profitMargin = underwritingPolicy?.indicativeProfitMarginPct ?? DEFAULT_INDICATIVE_PROFIT_MARGIN_PCT
  const amountPresets = [
    Math.round(effectiveMin + (effectiveMax - effectiveMin) * 0.2),
    Math.round(effectiveMin + (effectiveMax - effectiveMin) * 0.4),
    Math.round(effectiveMin + (effectiveMax - effectiveMin) * 0.6),
    effectiveMax,
  ]

  // resolver reads bounds via this ref (rather than closing over enforcedMin/enforcedMax
  // directly) so validation always uses the latest FI policy without needing to recreate the
  // useForm instance once the policy query resolves after first render.
  const boundsRef = useRef({ min: enforcedMin, max: enforcedMax })
  boundsRef.current = { min: enforcedMin, max: enforcedMax }

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<FormData>({
    resolver: (values, context, options) =>
      zodResolver(buildSchema(boundsRef.current.min, boundsRef.current.max))(values, context, options),
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

  const totalProfit = watchedAmount * (profitMargin / 100)
  const salePrice = watchedAmount + totalProfit
  const monthlyInstallment = calculateInstallment(watchedAmount, profitMargin, watchedTenure)

  const onSubmit = async (data: FormData) => {
    setSubmitError(null)
    if (!approvedBusiness) {
      setSubmitError('No approved business record found — complete onboarding and compliance review first.')
      return
    }
    if (!selectedFi) {
      setSubmitError('Choose a financial institution to send this request to.')
      return
    }
    try {
      await createFinancing.mutateAsync({
        approvedBusinessContractId: approvedBusiness.id,
        financialInstitution: selectedFi,
        terms: { amount: data.amount, purpose: data.purpose, tenureMonths: data.tenureMonths },
      })
      setSubmitted(true)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit financing request')
    }
  }

  if (isLoading || loadingProviders) {
    return (
      <Layout breadcrumb={[{ label: 'Business Portal', path: '/business/dashboard' }, { label: 'Financing Request' }]}>
        <FullPageLoader />
      </Layout>
    )
  }

  if (!approvedProviders || approvedProviders.length === 0) {
    return (
      <Layout breadcrumb={[{ label: 'Business Portal', path: '/business/dashboard' }, { label: 'Financing Request' }]}>
        <EmptyState
          title="No financial institutions available yet"
          description="No financing provider has been approved on the platform yet — check back once one has been onboarded."
          icon={<Landmark size={24} className="text-gray-400" />}
        />
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
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-gray-900 mb-3">Financing Request Submitted!</h2>
          <p className="text-gray-600 text-sm mb-2 leading-relaxed">
            Your financing request has been submitted. The Underwriting Agent will analyze your
            financial data and provide a recommendation within 1 business day.
          </p>
          <p className="text-gray-500 text-xs mb-6">
            You'll be notified once the Underwriting Agent has completed its analysis. You can check its
            status any time under "Your Financing Requests" on this page.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setSubmitted(false)} className="btn-secondary text-sm px-5 py-2.5">
              View Request Status
            </button>
            <Link to="/business/dashboard" className="btn-primary text-sm px-5 py-2.5">
              Back to Dashboard
            </Link>
          </div>
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
      <div className="max-w-5xl mx-auto">
        {/* Approved business banner */}
        {approvedBusiness ? (
          <div className="rounded-2xl p-5 mb-7 bg-emerald-50 border border-emerald-100 flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Approved Business</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                {enforcedMax !== undefined ? (
                  <>
                    You're eligible to request financing up to{' '}
                    <strong className="font-mono">{formatNaira(enforcedMax)}</strong> per request.
                  </>
                ) : (
                  "You're eligible to request financing — describe the amount you actually need below."
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-5 mb-7 bg-amber-50 border border-amber-100">
            <p className="text-sm font-semibold text-amber-800">No approved business record found</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Complete onboarding and compliance review before requesting financing.
            </p>
          </div>
        )}

        {/* Your Financing Requests — the only persistent record a business has that a request
            was actually submitted; the post-submit confirmation screen below is one-time and
            vanishes on navigation/refresh. Never hides or disables the form: RequestFinancing
            is nonconsuming specifically to support repeat/parallel facilities, so an existing
            request (of any status) is informational, not a block. */}
        {sortedRequests.length > 0 && (
          <div className="card p-6 mb-7">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock3 size={16} className="text-gray-400" />
                <h3 className="font-display text-base font-semibold text-gray-800 tracking-tight">
                  Your Financing Requests
                </h3>
              </div>
              {activeRequestCount > 0 && (
                <span className="text-xs font-medium text-gray-500">
                  {activeRequestCount} in progress
                </span>
              )}
            </div>
            <div className="space-y-2.5">
              {sortedRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-surface border border-gray-100"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 font-mono">{req.financingRef}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatNaira(req.terms.amount)} · {req.terms.tenureMonths} months
                      {req.submittedAt && <> · Submitted {formatDate(req.submittedAt)}</>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Financial institution picker — only shown when there's a real choice to make;
            a single approved institution is auto-selected above without asking. */}
        {approvedProviders.length > 1 && (
          <div className="card p-6 mb-7">
            <div className="flex items-center gap-2 mb-4">
              <Landmark size={16} className="text-gray-400" />
              <h3 className="font-display text-base font-semibold text-gray-800 tracking-tight">
                Choose a Financial Institution
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {approvedProviders.map((p) => {
                const isSelected = selectedFi === p.financialInstitution
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedFi(p.financialInstitution)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary-50'
                        : 'border-gray-200 hover:border-primary/40'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                      {p.providerName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.providerType}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.approvedInstruments.map((i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 text-[10px] font-medium">
                          {i}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <div className="lg:col-span-3 card p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-gray-900 tracking-tight">Financing Request</h2>
                <p className="text-sm text-gray-500 mt-0.5">Murabahah-compliant business financing</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor="amount" className="text-sm font-medium text-gray-700">
                    Financing Amount <span className="text-red-500">*</span>
                  </label>
                  {enforcedMax !== undefined && (
                    <span className="text-xs text-gray-400">
                      Up to <span className="font-mono font-medium text-gray-600">{formatNaira(enforcedMax)}</span>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-display text-2xl font-semibold text-gray-300 pointer-events-none">
                    ₦
                  </span>
                  <input
                    id="amount"
                    type="number"
                    className={`w-full pl-12 pr-5 py-4 font-display text-3xl font-semibold text-gray-900 bg-surface border-2 rounded-2xl
                      placeholder-gray-300 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary
                      transition-colors ${errors.amount ? 'border-red-300' : 'border-gray-200'}`}
                    placeholder="1,500,000"
                    step={10000}
                    min={enforcedMin}
                    max={enforcedMax}
                    {...register('amount', { valueAsNumber: true })}
                  />
                </div>
                {errors.amount && <p className="mt-1.5 text-xs text-red-600">{errors.amount.message}</p>}

                {/* Amount slider — spans effectiveMin/effectiveMax (UI scaffolding), not the FI's
                    actual enforced bounds, so it still renders usefully when the FI has set no
                    limit at all */}
                <input
                  type="range"
                  min={effectiveMin}
                  max={effectiveMax}
                  step={50_000}
                  value={watchedAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setWatchedAmount(val)
                    setValue('amount', val, { shouldValidate: true })
                  }}
                  style={sliderTrackStyle(watchedAmount, effectiveMin, effectiveMax)}
                  className={`${RANGE_THUMB_CLASSES} mt-5`}
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-gray-400">{formatNaira(effectiveMin)}</p>
                  <p className="text-xs text-gray-400">{formatNaira(effectiveMax)}</p>
                </div>

                {/* Quick-pick presets */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {amountPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setWatchedAmount(preset)
                        setValue('amount', preset, { shouldValidate: true })
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        watchedAmount === preset
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40 hover:text-primary'
                      }`}
                    >
                      {preset === effectiveMax ? 'Max' : formatNaira(preset).replace('.00', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-2">
                  Business Purpose <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="purpose"
                  rows={4}
                  className={`input resize-none text-sm py-3 ${errors.purpose ? 'input-error' : ''}`}
                  placeholder="Describe how this financing will be used — e.g., purchase of equipment, inventory acquisition, working capital expansion..."
                  {...register('purpose')}
                />
                {errors.purpose && <p className="mt-1.5 text-xs text-red-600">{errors.purpose.message}</p>}
                <p className="text-xs text-gray-400 mt-1.5">
                  Be specific — helps the Underwriting Agent assess your request accurately.
                </p>
              </div>

              {/* Tenure */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Repayment Tenure <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {TENURE_OPTIONS.map((months) => {
                    const previewInstallment = calculateInstallment(watchedAmount, profitMargin, months)
                    const isSelected = watchedTenure === months
                    return (
                      <label key={months} className="cursor-pointer">
                        <input
                          type="radio"
                          value={months}
                          className="sr-only"
                          {...register('tenureMonths', {
                            valueAsNumber: true,
                            // Passed through register's own options (not a competing onChange prop
                            // below it) so react-hook-form's internal handler still runs first and
                            // correctly marks this radio `checked` in the DOM. An overriding
                            // onChange prop previously replaced that handler entirely; calling
                            // setValue(name, months, ...) with months as a number instead of the
                            // native radio's string value never marked any radio checked (RHF's
                            // radio-group sync does a strict `domValue === value` comparison), so
                            // handleSubmit — which reads radio-group fields from DOM checked state,
                            // not the tracked value — always saw tenureMonths as unset.
                            onChange: () => setWatchedTenure(months),
                          })}
                        />
                        <div
                          className={`text-center py-3.5 px-1.5 rounded-xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary text-white shadow-[0_4px_14px_rgba(13,110,77,0.25)]'
                              : 'border-gray-200 text-gray-700 hover:border-primary/40'
                          }`}
                        >
                          <span className="block text-base font-semibold">{months}</span>
                          <span className={`block text-[11px] mt-0.5 ${isSelected ? 'text-white/75' : 'text-gray-400'}`}>
                            months
                          </span>
                          <span
                            className={`block text-[10.5px] font-mono mt-1.5 pt-1.5 border-t ${
                              isSelected ? 'border-white/20 text-white/90' : 'border-gray-100 text-gray-500'
                            }`}
                          >
                            {formatNaira(previewInstallment).replace('.00', '')}/mo
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
                {errors.tenureMonths && <p className="mt-1.5 text-xs text-red-600">{errors.tenureMonths.message}</p>}
              </div>

              <div className="p-4 rounded-xl bg-accent-50 border border-accent/20 flex items-start gap-3">
                <Info size={15} className="text-accent-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  This request will be processed as a <strong>Murabahah</strong> (cost-plus sale). The financial
                  institution purchases the asset at cost and sells it to you at a disclosed profit margin.
                  No interest applies.
                </p>
              </div>

              {submitError && <p className="text-xs text-red-600">{submitError}</p>}

              <button
                type="submit"
                disabled={createFinancing.isPending || !selectedFi}
                className="btn-primary w-full py-3.5 text-sm disabled:opacity-50"
              >
                {createFinancing.isPending
                  ? 'Submitting…'
                  : !selectedFi
                  ? 'Choose a financial institution above'
                  : 'Submit Financing Request'}
              </button>
            </form>
          </div>

          {/* Summary */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6 space-y-5">
              <div className="relative rounded-2xl p-6 overflow-hidden bg-primary-dark shadow-[0_20px_45px_-20px_rgba(13,40,28,0.4)]" style={LATTICE_BG}>
                <div className="relative flex items-center gap-2 mb-6">
                  <Calculator size={16} className="text-accent-400" />
                  <h3 className="text-sm font-semibold text-white/90">Estimated Terms</h3>
                </div>

                <div className="relative space-y-0.5">
                  <div className="flex justify-between items-center py-3 border-b border-white/10">
                    <span className="text-xs text-white/60">Asset Cost (Principal)</span>
                    <span className="font-mono text-sm text-white/90">{formatNaira(watchedAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/10">
                    <span className="text-xs text-white/60">Profit Margin ({profitMargin}%)</span>
                    <span className="font-mono text-sm text-white/90">{formatNaira(totalProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center py-4">
                    <span className="text-xs font-medium text-white/70">Sale Price (Total)</span>
                    <span className="font-display font-semibold text-2xl text-white">{formatNaira(salePrice)}</span>
                  </div>
                </div>

                <div className="relative h-px w-full my-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)' }} />

                <div className="relative flex items-center justify-between pt-4">
                  <div>
                    <p className="text-xs text-white/60 mb-1">Tenure</p>
                    <p className="text-sm font-medium text-white">{watchedTenure} months</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/60 mb-1">Monthly Installment</p>
                    <p className="font-display font-bold text-xl text-accent-400">
                      {formatNaira(monthlyInstallment)}
                      <span className="text-xs font-sans font-normal text-white/50">/mo</span>
                    </p>
                  </div>
                </div>

                <p className="relative text-[11px] text-white/40 mt-5 leading-relaxed">
                  * Estimates based on {profitMargin}% profit margin. Actual terms are finalized
                  by the financial institution after underwriting review.
                </p>
              </div>

              {/* Shariah compliance */}
              <div className="card p-5 bg-primary-50 border-primary/10">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={16} className="text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">Shariah Compliant</p>
                    <p className="text-xs text-primary/80 leading-relaxed">
                      Certified under AAOIFI Standard No. 8 (Murabahah) and CBN Non-Interest Financial
                      Institutions Framework. All profit is disclosed upfront — no hidden charges.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
