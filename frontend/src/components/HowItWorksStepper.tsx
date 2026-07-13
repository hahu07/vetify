import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { ArrowRight, BadgeCheck, Bot, Check, CheckCircle2, FileText } from 'lucide-react'

type IconType = ComponentType<{ size?: string | number; className?: string }>

type SceneId = 'apply' | 'verifyComply' | 'approvedRequest' | 'underwrite' | 'reviewExecute' | 'monitorClose'

interface Step {
  title: string
  stageTag: string
  agent: string
  icon: IconType
  desc: string
  sceneId: SceneId
}

const STEPS: Step[] = [
  {
    title: 'Apply',
    stageTag: 'STAGE 1',
    agent: 'Business Onboarding',
    icon: FileText,
    desc: 'You submit your business profile and KYC documents — CAC registration, BVN, NIN.',
    sceneId: 'apply',
  },
  {
    title: 'Verify & Comply',
    stageTag: 'STAGE 2–3',
    agent: 'Verifier Agent',
    icon: Bot,
    desc: 'The Verifier Agent checks your identity, screens for AML risk, and runs a Shariah sector pre-check — a deterministic engine decides, a human signs off.',
    sceneId: 'verifyComply',
  },
  {
    title: 'Get Approved',
    stageTag: 'STAGE 4–5',
    agent: 'Financing Request',
    icon: CheckCircle2,
    desc: 'Once approved, you tell us the amount, purpose, and tenure you need.',
    sceneId: 'approvedRequest',
  },
  {
    title: 'AI Underwriting',
    stageTag: 'STAGE 6',
    agent: 'Underwriting Agent',
    icon: Bot,
    desc: 'The Underwriting Agent analyses your cash flow and DSCR from a bank statement and recommends a financing limit.',
    sceneId: 'underwrite',
  },
  {
    title: 'Review & Execute',
    stageTag: 'STAGE 7–8',
    agent: 'Shariah Certified',
    icon: BadgeCheck,
    desc: 'Your financer makes the final call, then purchases the asset and sells it to you at a disclosed profit — certified by our Shariah Supervisory Board.',
    sceneId: 'reviewExecute',
  },
  {
    title: 'Monitor & Close',
    stageTag: 'STAGE 9–10',
    agent: 'Monitoring Agent',
    icon: Bot,
    desc: 'The Monitoring Agent tracks your instalments automatically and flags any early sign of delinquency — until your contract closes in full.',
    sceneId: 'monitorClose',
  },
]

const AUTOPLAY_MS = 5000

const LATTICE_BG = {
  backgroundImage: `
    repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%),
    repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%)
  `,
  backgroundSize: '20px 20px',
}

export default function HowItWorksStepper() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [tick, setTick] = useState(0)
  const [panelOffset, setPanelOffset] = useState(0)

  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current

  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (paused || reducedMotion) return
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % STEPS.length)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [paused, tick, reducedMotion])

  useLayoutEffect(() => {
    function reposition() {
      const listEl = listRef.current
      const panelEl = panelRef.current
      if (!listEl || !panelEl) return
      if (window.innerWidth < 861) {
        setPanelOffset(0)
        return
      }
      const activeBtn = listEl.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      if (!activeBtn) return
      const listTop = listEl.getBoundingClientRect().top
      const btnRect = activeBtn.getBoundingClientRect()
      const panelHeight = panelEl.offsetHeight
      const rowCenter = btnRect.top - listTop + btnRect.height / 2
      let target = rowCenter - panelHeight / 2
      const maxY = Math.max(0, listEl.offsetHeight - panelHeight)
      target = Math.max(0, Math.min(target, maxY))
      setPanelOffset(Math.round(target))
    }
    reposition()
    window.addEventListener('resize', reposition)
    return () => window.removeEventListener('resize', reposition)
  }, [activeIndex])

  function handleSelect(i: number) {
    setActiveIndex(i)
    setTick((t) => t + 1)
  }

  const step = STEPS[activeIndex]
  const Icon = step.icon

  return (
    <div className="grid grid-cols-1 md:grid-cols-[0.86fr_1fr] gap-10 md:gap-14 items-start">
      <div
        ref={listRef}
        role="tablist"
        aria-label="Financing process steps"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="flex flex-col"
      >
        {STEPS.map((s, i) => {
          const current = i === activeIndex
          return (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-current={current}
              data-index={i}
              onClick={() => handleSelect(i)}
              className="grid grid-cols-[40px_1fr] gap-4 py-5 border-t border-gray-200 last:border-b text-left rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4"
            >
              <span
                className={`font-display text-lg font-medium leading-[1.5] transition-colors ${
                  current ? 'text-primary' : 'text-gray-300'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline justify-between gap-3">
                  <span
                    className={`text-base font-semibold transition-colors ${current ? 'text-gray-900' : 'text-gray-400'}`}
                  >
                    {s.title}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-medium tracking-wide text-gray-400 whitespace-nowrap transition-opacity ${
                      current ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {s.stageTag}
                  </span>
                </span>
                <span
                  className={`block text-[13.5px] text-gray-500 leading-relaxed overflow-hidden transition-all duration-300 ${
                    current ? 'max-h-24 opacity-100 mt-1.5' : 'max-h-0 opacity-0'
                  }`}
                >
                  {s.desc}
                </span>
                {current && !reducedMotion && (
                  <span className="block h-0.5 rounded-full bg-gray-200 overflow-hidden max-w-[220px] mt-3">
                    <ProgressFill key={`${activeIndex}-${tick}`} durationMs={AUTOPLAY_MS} />
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div
        className="transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(${panelOffset}px)` }}
      >
        <div
          ref={panelRef}
          className="relative rounded-[20px] bg-primary-dark p-[3px] shadow-[0_20px_45px_-20px_rgba(13,40,28,0.4)] overflow-hidden"
          style={LATTICE_BG}
        >
          <div className="relative flex items-center gap-2 px-4 pt-3.5 pb-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/90 bg-white/10 border border-white/15 px-2.5 py-1 rounded-full">
              <Icon size={12} className="text-accent-400" />
              {step.agent}
            </span>
            <span className="font-mono text-[10px] text-white/55 tracking-wide">{step.stageTag}</span>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]" />
          </div>

          <div className="relative bg-white rounded-[17px] mx-[3px] min-h-[300px] px-6 pt-6 pb-6 flex flex-col">
            <div key={activeIndex} className="flex flex-col animate-fade-in">
              <SceneContent sceneId={step.sceneId} />
            </div>
          </div>

          <div className="relative px-6 pt-4 pb-4 text-center">
            <p className="font-display italic text-[13.5px] text-white/80 leading-relaxed">
              Days, not months — and{' '}
              <strong className="not-italic font-semibold text-accent-400">every decision has a name behind it.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgressFill({ durationMs }: { durationMs: number }) {
  const [filled, setFilled] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFilled(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <span
      className="block h-full bg-primary rounded-full"
      style={{ width: filled ? '100%' : '0%', transition: filled ? `width ${durationMs}ms linear` : 'none' }}
    />
  )
}

function SceneContent({ sceneId }: { sceneId: SceneId }) {
  switch (sceneId) {
    case 'apply':
      return <ApplyScene />
    case 'verifyComply':
      return <VerifyComplyScene />
    case 'approvedRequest':
      return <ApprovedRequestScene />
    case 'underwrite':
      return <UnderwriteScene />
    case 'reviewExecute':
      return <ReviewExecuteScene />
    case 'monitorClose':
      return <MonitorCloseScene />
  }
}

function SceneLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 mb-4">{children}</div>
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{label}</div>
      <div className="text-[13.5px] font-medium text-gray-900 bg-surface border border-gray-200 rounded-lg px-[11px] py-[9px]">
        {value}
      </div>
    </div>
  )
}

function DocChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-lg">
      <FileText size={12} />
      {name}
    </span>
  )
}

function SolidButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="self-start inline-flex items-center gap-2 text-[13.5px] font-semibold text-white bg-primary px-[18px] py-[11px] rounded-[10px] mt-5"
    >
      {children}
    </button>
  )
}

function SignButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="w-full inline-flex items-center justify-center gap-2 text-[13.5px] font-semibold text-white bg-primary px-[18px] py-3 rounded-[10px] mt-4"
    >
      {children}
    </button>
  )
}

function CheckRow({ text, sub, index }: { text: string; sub: string; index: number }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setDone(true), 220 + index * 360)
    return () => window.clearTimeout(t)
  }, [index])
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
      <span
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
          done ? 'bg-primary border-primary' : 'border-gray-200'
        }`}
      >
        <Check size={11} className={`text-white transition-opacity duration-200 ${done ? 'opacity-100' : 'opacity-0'}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-gray-900">{text}</span>
        <span className="block text-[11px] text-gray-400 mt-0.5">{sub}</span>
      </span>
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-gray-200 rounded-lg px-[13px] py-[12px]">
      <div className="text-[10.5px] text-gray-400 mb-1">{label}</div>
      <div className="font-mono text-[15px] font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function ContractLine({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between py-2 ${total ? 'pt-3' : 'border-b border-gray-100'}`}>
      <span className={`text-[13px] ${total ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{label}</span>
      <span className={`font-mono font-semibold ${total ? 'text-base text-primary' : 'text-[13px] text-gray-900'}`}>
        {value}
      </span>
    </div>
  )
}

function PayRow({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 text-[12.5px]">
      <span className="text-gray-500">
        {label}
        <small className="block text-[10.5px] text-gray-400 mt-0.5">{sub}</small>
      </span>
      <span className="font-mono font-semibold text-gray-900">{value}</span>
    </div>
  )
}

function ApplyScene() {
  return (
    <>
      <SceneLabel>Business Profile</SceneLabel>
      <Field label="Business name" value="Khalid Agro Supplies Ltd" />
      <Field label="CAC registration number" value="RC 1854203" />
      <Field label="Sector" value="Agriculture & Agro-processing" />
      <div className="flex gap-2 flex-wrap mt-3.5 mb-5">
        <DocChip name="cac_certificate.pdf" />
        <DocChip name="directors_id.pdf" />
      </div>
      <SolidButton>
        Submit for Review <ArrowRight size={14} />
      </SolidButton>
    </>
  )
}

function VerifyComplyScene() {
  const items = [
    { text: 'Identity match — NIN / BVN', sub: 'mono.co Lookup mashup' },
    { text: 'CAC registration lookup', sub: 'Corporate Affairs Commission' },
    { text: 'AML & sanctions screen', sub: 'Youverify watchlist' },
    { text: 'Shariah sector pre-check', sub: 'AAOIFI keyword table' },
  ]
  return (
    <>
      <SceneLabel>Verifier Agent · Identity &amp; Compliance</SceneLabel>
      <div className="flex flex-col">
        {items.map((it, i) => (
          <CheckRow key={it.text} index={i} text={it.text} sub={it.sub} />
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-dashed border-gray-200">
        <div>
          <div className="font-mono text-xl font-semibold text-gray-900">91</div>
          <div className="text-[11px] font-medium text-gray-400 mt-0.5">Verification &amp; compliance score · Low risk</div>
        </div>
        <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full whitespace-nowrap">
          Auto-approved
        </span>
      </div>
    </>
  )
}

function ApprovedRequestScene() {
  return (
    <>
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-primary bg-primary/10 border border-primary/20 px-3 py-2 rounded-[10px] mb-[18px]">
        <CheckCircle2 size={14} className="flex-shrink-0" />
        You&rsquo;re approved — eligible to request financing
      </div>
      <SceneLabel>Financing Request</SceneLabel>
      <Field label="Amount requested" value="₦2,450,000" />
      <Field label="Purpose" value="Cold storage equipment purchase" />
      <Field label="Tenure" value="12 months" />
      <SolidButton>
        Submit Financing Request <ArrowRight size={14} />
      </SolidButton>
    </>
  )
}

function UnderwriteScene() {
  return (
    <>
      <SceneLabel>Underwriting Agent · Risk Score</SceneLabel>
      <div className="flex items-center gap-6 mb-5">
        <div className="font-display text-5xl font-semibold text-primary leading-none">85</div>
        <div className="text-[12.5px] text-gray-500 leading-relaxed">
          <strong className="block text-[13.5px] text-gray-900 mb-0.5 font-semibold">Low Risk</strong>
          Weighted across cash flow, DSCR,
          <br />
          creditworthiness &amp; fraud checks
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <MetricBox label="DSCR" value="1.8×" />
        <MetricBox label="Cash reserve" value="3.2 mo" />
        <MetricBox label="Revenue trend" value="+12%" />
        <MetricBox label="Recommended limit" value="₦2,450,000" />
      </div>
    </>
  )
}

function ReviewExecuteScene() {
  return (
    <>
      <SceneLabel>Financing Review &amp; Murabahah Execution</SceneLabel>
      <p className="text-[12.5px] text-gray-500 mb-3.5">
        Approved by <strong className="text-gray-900 font-semibold">First Trust Bank — Credit Committee</strong>
      </p>
      <span className="inline-flex self-start items-center gap-1.5 text-[11.5px] font-semibold text-accent-800 bg-accent-100 border border-accent-300/60 px-2.5 py-1.5 rounded-full mb-4">
        <BadgeCheck size={13} className="text-accent-600" />
        Certified against AAOIFI Standard No. 8
      </span>
      <div className="flex flex-col">
        <ContractLine label="Asset cost" value="₦2,100,000" />
        <ContractLine label="Disclosed profit margin" value="₦350,000" />
        <ContractLine label="Tenure" value="12 months" />
        <ContractLine label="Monthly instalment" value="₦204,166" />
        <ContractLine label="Sale price" value="₦2,450,000" total />
      </div>
      <SignButton>Accept &amp; Sign — Qabul</SignButton>
    </>
  )
}

function MonitorCloseScene() {
  return (
    <>
      <SceneLabel>Repayment Monitoring</SceneLabel>
      <div className="mb-3.5">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>
            <strong className="text-gray-900 font-semibold">7</strong> of 12 instalments paid
          </span>
          <span>58%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: '58%' }} />
        </div>
      </div>
      <PayRow label="Instalment #6" sub="Paid 2 Jun 2026" value="₦204,166" />
      <PayRow label="Instalment #7" sub="Paid 2 Jul 2026" value="₦204,166" />
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-dashed border-gray-200">
        <span className="text-[13px] text-gray-500 font-medium">Repayment status</span>
        <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">On track</span>
      </div>
      <p className="mt-5 pt-3.5 border-t border-dashed border-gray-200 text-[11.5px] text-gray-400 leading-relaxed">
        On full repayment, your contract closes automatically — outstanding drops to{' '}
        <code className="font-mono text-[10.5px] bg-surface border border-gray-200 rounded px-1.5 py-0.5">₦0</code> and
        the full history stays on the ledger.
      </p>
    </>
  )
}
